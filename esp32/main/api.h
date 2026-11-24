#pragma once
// HTTP client for the Music Box device API (/api/device/*).

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include "esp_err.h"

typedef struct {
    char title[64];
    char artist[48];
    char category[24];
    bool playing;
    bool muted;
    bool shuffle;
    bool repeat;
    int volume;
    long seq;
    char eq[16 * 30 + 1];   // equalizer frames while playing ("" when the backend sends none)
    int eq_fps;
    long eq_from;           // the song frame eq starts at (-1: not sent, an older backend)
    long position_ms;       // play position when the backend answered
    long duration_ms;       // the song's length (0 = unknown)
    long song_id;           // 0 = unknown (an older backend): no cover
} api_state_t;

void api_init(void);
/** GET /api/device/state */
esp_err_t api_get_state(api_state_t *out);
/** POST /api/device/command; the response (the new state) is parsed into out. */
esp_err_t api_send_command(const char *command, api_state_t *out);
/**
 * GET /api/device/cover/{song_id}?size=size: size x size RGB565 pixels, high byte first, into out
 * (out_len = size * size * 2). ESP_ERR_NOT_FOUND when the song has no cover.
 */
esp_err_t api_get_cover(long song_id, int size, uint8_t *out, size_t out_len);
