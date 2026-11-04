#include "input.h"

#include <stdlib.h>

#include "driver/gpio.h"
#include "esp_adc/adc_oneshot.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "sdkconfig.h"

static const char *TAG = "input";

#define SCAN_MS       5
#define DEBOUNCE_MS   25
#define KNOB_EVERY_MS 20
#define KNOB_MIN_GAP  120   // ms between volume events, so the knob cannot flood the network
#define KNOB_STEP     2     // ignore changes smaller than this (pot noise)

typedef struct {
    int gpio;
    input_type_t type;
    bool pressed;        // debounced state
    bool raw;
    int64_t changed_ms;
} button_t;

static button_t s_buttons[] = {
    {.gpio = CONFIG_MUSICBOX_PIN_PLAY_PAUSE, .type = INPUT_PLAY_PAUSE},
    {.gpio = CONFIG_MUSICBOX_PIN_NEXT, .type = INPUT_NEXT},
    {.gpio = CONFIG_MUSICBOX_PIN_PREV, .type = INPUT_PREV},
    {.gpio = CONFIG_MUSICBOX_PIN_MUTE, .type = INPUT_MUTE},
    {.gpio = CONFIG_MUSICBOX_PIN_SEEK, .type = INPUT_SEEK},
};
#define N_BUTTONS (sizeof s_buttons / sizeof s_buttons[0])

static input_cb_t s_cb;
static adc_oneshot_unit_handle_t s_adc;
static adc_channel_t s_adc_channel;
static bool s_knob_ok;

static int64_t now_ms(void) { return esp_timer_get_time() / 1000; }

static void setup_buttons(void)
{
    uint64_t mask = 0;
    for (size_t i = 0; i < N_BUTTONS; i++) mask |= 1ULL << s_buttons[i].gpio;
    gpio_config_t io = {
        .pin_bit_mask = mask,
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = GPIO_PULLUP_ENABLE,
    };
    ESP_ERROR_CHECK(gpio_config(&io));
}

static void setup_knob(void)
{
    adc_unit_t unit;
    if (adc_oneshot_io_to_channel(CONFIG_MUSICBOX_PIN_KNOB, &unit, &s_adc_channel) != ESP_OK
        || unit != ADC_UNIT_1) {
        // ADC2 cannot be used while WiFi is on
        ESP_LOGE(TAG, "GPIO %d is not an ADC1 pin; the volume knob is disabled", CONFIG_MUSICBOX_PIN_KNOB);
        return;
    }
    adc_oneshot_unit_init_cfg_t unit_cfg = {.unit_id = ADC_UNIT_1};
    ESP_ERROR_CHECK(adc_oneshot_new_unit(&unit_cfg, &s_adc));
    adc_oneshot_chan_cfg_t chan_cfg = {.atten = ADC_ATTEN_DB_12, .bitwidth = ADC_BITWIDTH_12};
    ESP_ERROR_CHECK(adc_oneshot_config_channel(s_adc, s_adc_channel, &chan_cfg));
    s_knob_ok = true;
}

/** Raw 12-bit reading to 0..100, with small dead zones at both ends so 0 and 100 are reachable. */
static int knob_percent(float raw)
{
    const float lo = 60, hi = 4000;
    float p = (raw - lo) * 100.0f / (hi - lo);
    if (p < 0) p = 0;
    if (p > 100) p = 100;
    int v = (int)(p + 0.5f);
#if CONFIG_MUSICBOX_KNOB_INVERT
    v = 100 - v;
#endif
    return v;
}

static void scan_buttons(int64_t now)
{
    for (size_t i = 0; i < N_BUTTONS; i++) {
        button_t *b = &s_buttons[i];
        bool raw = gpio_get_level(b->gpio) == 0; // wired to GND, so pressed reads low
        if (raw != b->raw) {
            b->raw = raw;
            b->changed_ms = now;
        } else if (raw != b->pressed && now - b->changed_ms >= DEBOUNCE_MS) {
            b->pressed = raw;
            if (raw) s_cb((input_event_t){.type = b->type});
        }
    }
}

static void input_task(void *arg)
{
    float smooth = -1;
    int reported = -1;          // last volume sent (-1: not yet, the first reading is not sent)
    int64_t last_knob_read = 0, last_knob_event = 0;

    for (;;) {
        int64_t now = now_ms();
        scan_buttons(now);

        if (s_knob_ok && now - last_knob_read >= KNOB_EVERY_MS) {
            last_knob_read = now;
            int raw = 0;
            if (adc_oneshot_read(s_adc, s_adc_channel, &raw) == ESP_OK) {
                smooth = smooth < 0 ? raw : smooth * 0.8f + raw * 0.2f;
                int v = knob_percent(smooth);
                if (reported < 0) {
                    // Don't overwrite the player's volume at boot; wait until the knob moves.
                    reported = v;
                } else if ((abs(v - reported) >= KNOB_STEP || ((v == 0 || v == 100) && v != reported))
                           && now - last_knob_event >= KNOB_MIN_GAP) {
                    reported = v;
                    last_knob_event = now;
                    s_cb((input_event_t){.type = INPUT_VOLUME, .value = v});
                }
            }
        }
        vTaskDelay(pdMS_TO_TICKS(SCAN_MS));
    }
}

void input_start(input_cb_t cb)
{
    s_cb = cb;
    setup_buttons();
    setup_knob();
    xTaskCreate(input_task, "input", 3072, NULL, 6, NULL);
}
