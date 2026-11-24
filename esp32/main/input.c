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
#define KNOB_SAMPLES  16    // ADC readings averaged per knob reading (the ESP32's ADC is noisy)
#define KNOB_WAKE     3     // while idle, ignore changes smaller than this (noise, a touch)
#define KNOB_SETTLE_MS 400  // after the knob stops this long, it's idle again
#define HOLD_MS       450   // holding Next this long seeks forward instead of skipping
#define SEEK_EVERY_MS 500   // and keeps seeking at this pace while held

typedef struct {
    int gpio;
    input_type_t type;
    bool pressed;        // debounced state
    bool raw;
    int64_t changed_ms;
    bool held;           // Next only: held long enough to seek, so releasing doesn't skip
    int64_t next_seek_ms;
} button_t;

static button_t s_buttons[] = {
    {.gpio = CONFIG_MUSICBOX_PIN_PLAY_PAUSE, .type = INPUT_PLAY_PAUSE},
    {.gpio = CONFIG_MUSICBOX_PIN_NEXT, .type = INPUT_NEXT},
    {.gpio = CONFIG_MUSICBOX_PIN_PREV, .type = INPUT_PREV},
    {.gpio = CONFIG_MUSICBOX_PIN_SEEK, .type = INPUT_SEEK},
    {.gpio = CONFIG_MUSICBOX_PIN_SHUFFLE, .type = INPUT_SHUFFLE},
    {.gpio = CONFIG_MUSICBOX_PIN_REPEAT, .type = INPUT_REPEAT},
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
    for (size_t i = 0; i < N_BUTTONS; i++) {
        if (s_buttons[i].gpio >= 0) mask |= 1ULL << s_buttons[i].gpio; // -1: not fitted
    }
    if (mask == 0) return;
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
        if (b->gpio < 0) continue;
        bool raw = gpio_get_level(b->gpio) == 0; // wired to GND, so pressed reads low
        if (raw != b->raw) {
            b->raw = raw;
            b->changed_ms = now;
        } else if (raw != b->pressed && now - b->changed_ms >= DEBOUNCE_MS) {
            b->pressed = raw;
            if (b->type != INPUT_NEXT) {
                if (raw) s_cb((input_event_t){.type = b->type});
            } else if (raw) {
                // Next decides on release: a short press skips, holding it seeks (below)
                b->held = false;
                b->next_seek_ms = now + HOLD_MS;
            } else {
                s_cb((input_event_t){.type = b->held ? INPUT_SEEK_END : INPUT_NEXT});
            }
        }
        if (b->type == INPUT_NEXT && b->pressed && now >= b->next_seek_ms) {
            b->held = true;
            b->next_seek_ms = now + SEEK_EVERY_MS;
            s_cb((input_event_t){.type = INPUT_SEEK});
        }
    }
}

static void input_task(void *arg)
{
    float smooth = -1;
    int reported = -1;          // last volume sent (-1: not yet, the first reading is not sent)
    int64_t last_knob_read = 0, last_knob_event = 0;
    int64_t moving_until = 0;   // while turning, follow 1 % steps; once idle, only a real turn counts
    int last_dir = 0;           // direction of the last change: 1 % steps must keep going that way

    for (;;) {
        int64_t now = now_ms();
        scan_buttons(now);

        if (s_knob_ok && now - last_knob_read >= KNOB_EVERY_MS) {
            last_knob_read = now;
            int sum = 0, n = 0;
            for (int i = 0; i < KNOB_SAMPLES; i++) {
                int raw = 0;
                if (adc_oneshot_read(s_adc, s_adc_channel, &raw) == ESP_OK) {
                    sum += raw;
                    n++;
                }
            }
            if (n > 0) {
                float raw = (float)sum / (float)n;
                smooth = smooth < 0 ? raw : smooth * 0.8f + raw * 0.2f;
                int v = knob_percent(smooth);
                int diff = abs(v - reported);
                int dir = v > reported ? 1 : -1;
                // a small step only counts while turning and in the same direction, so noise
                // that wobbles back and forth (54, 55, 54) never gets through
                bool small_step = now < moving_until && diff >= 1 && dir == last_dir;
                bool at_end = (v == 0 || v == 100) && v != reported;
                if (reported < 0) {
                    // Don't overwrite the player's volume at boot; wait until the knob moves.
                    reported = v;
                } else if ((diff >= KNOB_WAKE || small_step || at_end)
                           && now - last_knob_event >= KNOB_MIN_GAP) {
                    reported = v;
                    last_dir = dir;
                    last_knob_event = now;
                    moving_until = now + KNOB_SETTLE_MS;
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
