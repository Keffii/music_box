#pragma once
// HTTP client for the Music Box device API (/api/device/*).

#include <stdbool.h>
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
} api_state_t;

void api_init(void);
/** GET /api/device/state */
esp_err_t api_get_state(api_state_t *out);
/** POST /api/device/command; the response (the new state) is parsed into out. */
esp_err_t api_send_command(const char *command, api_state_t *out);
