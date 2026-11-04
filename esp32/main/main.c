// Music Box WiFi remote: buttons and a volume knob that control the web player over HTTP,
// with the now-playing state on a 128x96 colour OLED.
//
// Three tasks:
//   input  - scans buttons and the knob, updates the screen at once and queues a command
//   net    - sends queued commands, otherwise polls the now-playing state
//   ui     - renders the screen at ~30 fps

#include <stdio.h>
#include <string.h>

#include "esp_attr.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/semphr.h"
#include "freertos/task.h"
#include "nvs_flash.h"
#include "sdkconfig.h"

#include "api.h"
#include "gfx.h"
#include "input.h"
#include "ssd1351.h"
#include "ui.h"
#include "wifi.h"

static const char *TAG = "musicbox";

#define FRAME_MS        33
#define LOCAL_HOLD_MS   400   // after a local input, ignore polled state this long (it may be stale)
#define FAILS_OFFLINE   2     // failed requests in a row before showing the offline screen

typedef struct {
    char command[16];
} net_cmd_t;

static ui_model_t s_model;
static SemaphoreHandle_t s_lock;
static QueueHandle_t s_commands;
static uint32_t s_last_local_ms;

// in internal RAM, which the SPI DMA can read
static DMA_ATTR gfx_t s_fb;

static uint32_t now_ms(void) { return (uint32_t)(esp_timer_get_time() / 1000); }

static void queue_command(const char *cmd)
{
    net_cmd_t c;
    snprintf(c.command, sizeof c.command, "%s", cmd);
    if (xQueueSend(s_commands, &c, 0) != pdTRUE) {
        ESP_LOGW(TAG, "command queue full, dropped %s", cmd);
    }
}

/** Runs on the input task: show feedback right away, then let the net task send it. */
static void on_input(input_event_t ev)
{
    char cmd[16];
    uint32_t now = now_ms();

    xSemaphoreTake(s_lock, portMAX_DELAY);
    s_last_local_ms = now;
    switch (ev.type) {
    case INPUT_PLAY_PAUSE:
        s_model.playing = !s_model.playing;
        s_model.flash = s_model.playing ? UI_FLASH_PLAY : UI_FLASH_PAUSE;
        snprintf(cmd, sizeof cmd, "PLAY_PAUSE");
        break;
    case INPUT_NEXT:
        s_model.flash = UI_FLASH_NEXT;
        snprintf(cmd, sizeof cmd, "NEXT");
        break;
    case INPUT_PREV:
        s_model.flash = UI_FLASH_PREV;
        snprintf(cmd, sizeof cmd, "PREV");
        break;
    case INPUT_MUTE:
        s_model.muted = !s_model.muted;
        s_model.flash = s_model.muted ? UI_FLASH_MUTE : UI_FLASH_UNMUTE;
        snprintf(cmd, sizeof cmd, "MUTE");
        break;
    case INPUT_SEEK:
        s_model.flash = UI_FLASH_SEEK;
        snprintf(cmd, sizeof cmd, "SEEK_FORWARD");
        break;
    case INPUT_VOLUME:
        s_model.volume = ev.value;
        s_model.muted = ev.value == 0;
        s_model.knob_at_ms = now;
        snprintf(cmd, sizeof cmd, "VOLUME:%d", ev.value);
        break;
    default:
        xSemaphoreGive(s_lock);
        return;
    }
    if (ev.type != INPUT_VOLUME) s_model.flash_at_ms = now;
    xSemaphoreGive(s_lock);

    queue_command(cmd);
}

static void apply_state(const api_state_t *st, bool from_command)
{
    xSemaphoreTake(s_lock, portMAX_DELAY);
    // A poll that was in flight while a button was pressed may predate that press.
    bool stale = !from_command && (now_ms() - s_last_local_ms < LOCAL_HOLD_MS);
    if (!stale && uxQueueMessagesWaiting(s_commands) == 0) {
        snprintf(s_model.title, sizeof s_model.title, "%s", st->title);
        snprintf(s_model.artist, sizeof s_model.artist, "%s", st->artist);
        snprintf(s_model.category, sizeof s_model.category, "%s", st->category);
        s_model.playing = st->playing;
        s_model.muted = st->muted;
        s_model.shuffle = st->shuffle;
        s_model.repeat = st->repeat;
        // while the knob is turning, the knob is the source of truth
        if (now_ms() - s_model.knob_at_ms > LOCAL_HOLD_MS) s_model.volume = st->volume;
    }
    s_model.link = UI_LINK_OK;
    xSemaphoreGive(s_lock);
}

static void set_link(ui_link_t link)
{
    xSemaphoreTake(s_lock, portMAX_DELAY);
    s_model.link = link;
    xSemaphoreGive(s_lock);
}

static void net_task(void *arg)
{
    int fails = 0;
    api_state_t st;

    for (;;) {
        if (!wifi_is_connected()) {
            set_link(UI_LINK_WIFI_CONNECTING);
            fails = 0;
            vTaskDelay(pdMS_TO_TICKS(200));
            continue;
        }

        net_cmd_t cmd;
        bool have_cmd = xQueueReceive(s_commands, &cmd, pdMS_TO_TICKS(CONFIG_MUSICBOX_POLL_MS)) == pdTRUE;
        memset(&st, 0, sizeof st);
        esp_err_t err = have_cmd ? api_send_command(cmd.command, &st) : api_get_state(&st);

        if (err == ESP_OK) {
            fails = 0;
            apply_state(&st, have_cmd);
        } else if (++fails >= FAILS_OFFLINE) {
            set_link(UI_LINK_SERVER_UNREACHABLE);
            vTaskDelay(pdMS_TO_TICKS(500));
        }
    }
}

static void ui_task(void *arg)
{
    ui_model_t snapshot;
    TickType_t wake = xTaskGetTickCount();
    for (;;) {
        xSemaphoreTake(s_lock, portMAX_DELAY);
        snapshot = s_model;
        xSemaphoreGive(s_lock);

        ui_render(&s_fb, &snapshot, now_ms());
        ssd1351_flush(&s_fb);
        vTaskDelayUntil(&wake, pdMS_TO_TICKS(FRAME_MS));
    }
}

void app_main(void)
{
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        err = nvs_flash_init();
    }
    ESP_ERROR_CHECK(err);

    s_lock = xSemaphoreCreateMutex();
    s_commands = xQueueCreate(8, sizeof(net_cmd_t));

    memset(&s_model, 0, sizeof s_model);
    s_model.link = UI_LINK_WIFI_CONNECTING;
    s_model.volume = 50;
    snprintf(s_model.server, sizeof s_model.server, "%s", CONFIG_MUSICBOX_SERVER_URL);

    ESP_ERROR_CHECK(ssd1351_init());
    xTaskCreatePinnedToCore(ui_task, "ui", 4096, NULL, 4, NULL, 1);

    wifi_start();
    api_init();
    xTaskCreatePinnedToCore(net_task, "net", 6144, NULL, 5, NULL, 0);
    input_start(on_input);

    ESP_LOGI(TAG, "remote ready, server %s", CONFIG_MUSICBOX_SERVER_URL);
}
