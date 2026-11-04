#pragma once
// Screen layout and animation. Plain C (no ESP-IDF), so it also renders on a PC for previews.

#include <stdbool.h>
#include <stdint.h>
#include "gfx.h"

typedef enum {
    UI_FLASH_NONE = 0,
    UI_FLASH_PLAY,
    UI_FLASH_PAUSE,
    UI_FLASH_NEXT,
    UI_FLASH_PREV,
    UI_FLASH_MUTE,
    UI_FLASH_UNMUTE,
    UI_FLASH_SEEK,
} ui_flash_t;

typedef enum {
    UI_LINK_WIFI_CONNECTING = 0,
    UI_LINK_SERVER_UNREACHABLE,
    UI_LINK_OK,
} ui_link_t;

typedef struct {
    ui_link_t link;
    char title[64];
    char artist[48];
    char category[24];       // genre shown in the header, e.g. "Lofi"
    bool playing;
    bool muted;
    bool shuffle;
    bool repeat;
    int volume;              // 0..100
    ui_flash_t flash;        // feedback for the last button press
    uint32_t flash_at_ms;    // when that press happened
    uint32_t knob_at_ms;     // last time the knob moved (shows the volume overlay)
    char server[48];         // shown on the offline screen
} ui_model_t;

/** Draws one frame for the given model at time now_ms. Keeps its own animation state. */
void ui_render(gfx_t *g, const ui_model_t *m, uint32_t now_ms);
