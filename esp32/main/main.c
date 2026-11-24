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
#define RECONFIGURE_FIRST_MS 2000   // resend the display's settings this long after start...
#define RECONFIGURE_EVERY_MS 30000  // ...and then this often (see ssd1351_reconfigure)
#define LOCAL_HOLD_MS   400   // after a local input, ignore polled state this long (it may be stale)
#define FAILS_OFFLINE   2     // failed requests in a row before showing the offline screen
#define EQ_NET_DELAY_MS 30    // rough age of the backend's answer when it arrives
#define POS_SNAP_MS     300   // a position further off than this is a jump (seek, skip): follow it at once
#define POS_SLEW        0.1f  // otherwise move this share of the way, so network jitter doesn't show

typedef struct {
    char command[16];
} net_cmd_t;

static ui_model_t s_model;
static SemaphoreHandle_t s_lock;
static QueueHandle_t s_commands;
static uint32_t s_last_local_ms;
static bool s_have_state;   // a state has arrived since boot
static long s_position_song; // the song the play position belongs to

/**
 * Takes the backend's play position (with the lock held). Polls arrive with a varying delay, so
 * taking each one as is would make the progress and the equalizer jitter. While the same song
 * plays on, the remote keeps its own clock and only drifts towards the backend's position; a real
 * jump (a seek, a new song, play or pause) is followed straight away.
 */
static void take_position(const api_state_t *st, uint32_t now)
{
    uint32_t at = now - EQ_NET_DELAY_MS;
    bool continuing = s_have_state && st->song_id == s_position_song && st->playing && s_model.playing;
    if (continuing) {
        int32_t local = (int32_t)ui_position_ms(&s_model, at);
        int32_t err = (int32_t)st->position_ms - local;
        if (err > -POS_SNAP_MS && err < POS_SNAP_MS) {
            s_model.position_ms = (uint32_t)(local + (int32_t)(err * POS_SLEW));
            s_model.position_at_ms = at;
            return;
        }
    }
    s_model.position_ms = (uint32_t)st->position_ms;
    s_model.position_at_ms = at;
    s_position_song = st->song_id;
}

// The current song's cover (UI_COVER_SIZE square, RGB565 high byte first). The net task
// downloads into s_cover_dl, then copies it into s_cover under the lock; the UI task copies
// s_cover into s_cover_ui each frame, so it never draws a half-replaced cover.
#define COVER_BYTES (UI_COVER_SIZE * UI_COVER_SIZE * 2)
static uint8_t s_cover[COVER_BYTES], s_cover_dl[COVER_BYTES], s_cover_ui[COVER_BYTES];
static long s_cover_song;   // the song whose cover (or lack of one) is known; 0 = none yet

/** Moves the play position to pos_ms from now on (call with s_lock held). */
static void set_position(uint32_t pos_ms, uint32_t now)
{
    s_model.position_ms = pos_ms;
    s_model.position_at_ms = now;
}

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
        set_position(ui_position_ms(&s_model, now), now); // freeze or resume from here
        s_model.playing = !s_model.playing;
        s_model.flash = s_model.playing ? UI_FLASH_PLAY : UI_FLASH_PAUSE;
        snprintf(cmd, sizeof cmd, "PLAY_PAUSE");
        break;
    case INPUT_NEXT:
        s_model.flash = UI_FLASH_NEXT;
        set_position(0, now);
        snprintf(cmd, sizeof cmd, "NEXT");
        break;
    case INPUT_PREV:
        s_model.flash = UI_FLASH_PREV;
        set_position(0, now);
        snprintf(cmd, sizeof cmd, "PREV");
        break;
    case INPUT_SEEK:
        s_model.flash = UI_FLASH_SEEK;
        set_position(ui_position_ms(&s_model, now) + 10000, now);
        snprintf(cmd, sizeof cmd, "SEEK_FORWARD");
        break;
    case INPUT_SEEK_END:
        // nothing to show; tells the website the seeking is over, so its sound comes back at once
        snprintf(cmd, sizeof cmd, "SEEK_END");
        break;
    case INPUT_SHUFFLE:
        s_model.shuffle = !s_model.shuffle;
        s_model.flash = s_model.shuffle ? UI_FLASH_SHUFFLE_ON : UI_FLASH_SHUFFLE_OFF;
        snprintf(cmd, sizeof cmd, "SHUFFLE");
        break;
    case INPUT_REPEAT:
        s_model.repeat = !s_model.repeat;
        s_model.flash = s_model.repeat ? UI_FLASH_REPEAT_ON : UI_FLASH_REPEAT_OFF;
        snprintf(cmd, sizeof cmd, "REPEAT");
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
    if (ev.type != INPUT_VOLUME && ev.type != INPUT_SEEK_END) s_model.flash_at_ms = now;
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
        take_position(st, now_ms()); // before playing changes: it compares with the old state
        s_model.playing = st->playing;
        s_model.muted = st->muted;
        s_model.shuffle = st->shuffle;
        s_model.repeat = st->repeat;
        // while the knob is turning, the knob is the source of truth
        if (now_ms() - s_model.knob_at_ms > LOCAL_HOLD_MS) {
            // changed somewhere else (the website): show it in the footer too
            if (s_have_state && st->volume != s_model.volume) s_model.knob_at_ms = now_ms();
            s_model.volume = st->volume;
        }
        s_model.duration_ms = (uint32_t)st->duration_ms;
        s_have_state = true;
    }
    // Equalizer frames: eq_from places them on the song's timeline (newer backends); without it
    // they start at the play position when the backend answered, a moment ago
    snprintf(s_model.eq, sizeof s_model.eq, "%s", st->eq);
    s_model.eq_fps = st->eq_fps;
    s_model.eq_from = st->eq_from;
    s_model.eq_at_ms = now_ms() - EQ_NET_DELAY_MS;
    s_model.link = UI_LINK_OK;
    xSemaphoreGive(s_lock);
}

static void set_link(ui_link_t link)
{
    xSemaphoreTake(s_lock, portMAX_DELAY);
    s_model.link = link;
    xSemaphoreGive(s_lock);
}

/** Downloads the song's cover. The old one stays up until the new one is in. */
static void fetch_cover(long song_id)
{
    esp_err_t err = api_get_cover(song_id, UI_COVER_SIZE, s_cover_dl, COVER_BYTES);
    if (err != ESP_OK && err != ESP_ERR_NOT_FOUND) return; // try again after the next poll
    xSemaphoreTake(s_lock, portMAX_DELAY);
    if (err == ESP_OK) memcpy(s_cover, s_cover_dl, COVER_BYTES);
    s_model.cover = err == ESP_OK ? s_cover : NULL;   // no cover: the layout without one
    xSemaphoreGive(s_lock);
    s_cover_song = song_id;
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
            if (st.song_id && st.song_id != s_cover_song) fetch_cover(st.song_id);
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
    uint32_t stat_at = now_ms(), frames = 0, slowest = 0;
    uint32_t reconfigure_at = now_ms() + RECONFIGURE_FIRST_MS;
    for (;;) {
        uint32_t start = now_ms();
        xSemaphoreTake(s_lock, portMAX_DELAY);
        snapshot = s_model;
        if (snapshot.cover) {
            memcpy(s_cover_ui, snapshot.cover, COVER_BYTES);
            snapshot.cover = s_cover_ui;
        }
        xSemaphoreGive(s_lock);

        ui_render(&s_fb, &snapshot, now_ms());
        // between frames, on this task, so it never interleaves with a frame being sent
        if ((int32_t)(now_ms() - reconfigure_at) >= 0) {
            ssd1351_reconfigure();
            reconfigure_at = now_ms() + RECONFIGURE_EVERY_MS;
        }
        ssd1351_flush(&s_fb);

        // every 30 s: the frame rate and the slowest frame (drawing + sending), to spot stutter
        uint32_t end = now_ms();
        if (end - start > slowest) slowest = end - start;
        frames++;
        if (end - stat_at >= 30000) {
            ESP_LOGI(TAG, "screen: %.1f fps, slowest frame %u ms", frames * 1000.0f / (float)(end - stat_at),
                     (unsigned)slowest);
            stat_at = end;
            frames = slowest = 0;
        }
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
    xTaskCreatePinnedToCore(ui_task, "ui", 6144, NULL, 4, NULL, 1); // holds a copy of the model

    wifi_start();
    api_init();
    xTaskCreatePinnedToCore(net_task, "net", 6144, NULL, 5, NULL, 0);
    input_start(on_input);

    ESP_LOGI(TAG, "remote ready, server %s", CONFIG_MUSICBOX_SERVER_URL);
}
