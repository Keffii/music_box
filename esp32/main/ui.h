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
    UI_FLASH_SHUFFLE_ON,
    UI_FLASH_SHUFFLE_OFF,
    UI_FLASH_REPEAT_ON,
    UI_FLASH_REPEAT_OFF,
} ui_flash_t;
#define UI_FLASH_LAST UI_FLASH_REPEAT_OFF

typedef enum {
    UI_LINK_WIFI_CONNECTING = 0,
    UI_LINK_SERVER_UNREACHABLE,
    UI_LINK_OK,
} ui_link_t;

// Equalizer frames from the backend: UI_EQ_BANDS hex digits per frame, one per bar (bass first)
#define UI_EQ_BANDS       16
#define UI_EQ_MAX_FRAMES  30
// The cover: a square of UI_COVER_SIZE pixels, RGB565 with the high byte first, row by row
#define UI_COVER_SIZE     52

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
    uint32_t knob_at_ms;     // last time the volume changed (the footer shows the volume for a moment)
    char server[48];         // shown on the offline screen
    // The song's equalizer from the play position on ("" = none: the bars animate on their own).
    // Frame 0 belongs to eq_at_ms, and there are eq_fps frames per second.
    char eq[UI_EQ_BANDS * UI_EQ_MAX_FRAMES + 1];
    int eq_fps;
    uint32_t eq_at_ms;
    int32_t eq_from;         // the song frame eq starts at, placed by the play position (-1: use eq_at_ms)
    // Play position: position_ms at position_at_ms, moving on while playing. 0 duration = unknown.
    uint32_t position_ms;
    uint32_t position_at_ms;
    uint32_t duration_ms;
    const uint8_t *cover;    // the song's cover, or NULL: the layout without one
} ui_model_t;

/** The play position at now_ms, kept within the song. */
uint32_t ui_position_ms(const ui_model_t *m, uint32_t now_ms);

/** Draws one frame for the given model at time now_ms. Keeps its own animation state. */
void ui_render(gfx_t *g, const ui_model_t *m, uint32_t now_ms);
