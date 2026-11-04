#include "ui.h"

#include <stdio.h>
#include <string.h>

// ---- palette ---------------------------------------------------------------------------------
#define C_BG        gfx_rgb(6, 4, 14)
#define C_PANEL     gfx_rgb(24, 18, 42)
#define C_TEXT      gfx_rgb(255, 255, 255)
#define C_MUTED     gfx_rgb(150, 140, 175)
#define C_ACCENT    gfx_rgb(255, 105, 180)   // the web player's pink
#define C_ACCENT2   gfx_rgb(130, 90, 255)
#define C_OK        gfx_rgb(60, 220, 120)
#define C_WARN      gfx_rgb(255, 170, 40)
#define C_BAD       gfx_rgb(255, 70, 80)

#define FLASH_MS    520
#define KNOB_MS     900

// ---- equalizer state -------------------------------------------------------------------------
#define BARS        16
#define BAR_W       6
#define BAR_GAP     2
#define EQ_TOP      42
#define EQ_BOTTOM   79
#define EQ_MAX      (EQ_BOTTOM - EQ_TOP)

static float s_height[BARS];
static float s_target[BARS];
static float s_peak[BARS];
static uint32_t s_next_target_ms[BARS];
static uint32_t s_last_ms;
static uint32_t s_rng = 0x1234567u;

static uint32_t rnd(void)
{
    s_rng ^= s_rng << 13;
    s_rng ^= s_rng >> 17;
    s_rng ^= s_rng << 5;
    return s_rng;
}

static void update_equalizer(bool playing, uint32_t now, float dt_frames)
{
    // A soft "kick" at ~124 BPM pushes the low bars up, so the motion feels like music.
    uint32_t beat_ms = 484;
    float beat = 1.0f - (float)(now % beat_ms) / (float)beat_ms;
    beat = beat * beat;

    for (int i = 0; i < BARS; i++) {
        if (!playing) {
            s_target[i] = 2.0f;
        } else if ((int32_t)(now - s_next_target_ms[i]) >= 0) {
            // lower bars (bass) sit higher; treble is jumpier
            float base = 0.85f - 0.035f * (float)i;
            float r = (float)(rnd() % 1000) / 1000.0f;
            s_target[i] = (0.25f + r * base) * EQ_MAX;
            s_next_target_ms[i] = now + 60 + rnd() % 90;
        }
        float target = s_target[i];
        if (playing && i < 5) target += beat * (5 - i) * 3.0f;
        if (target > EQ_MAX) target = EQ_MAX;

        float k = playing ? 0.35f : 0.12f;
        float step = (target - s_height[i]) * k * dt_frames;
        if (step > (target - s_height[i]) && target > s_height[i]) step = target - s_height[i];
        s_height[i] += step;
        if (s_height[i] < 1.0f) s_height[i] = 1.0f;

        if (s_height[i] >= s_peak[i]) s_peak[i] = s_height[i];
        else s_peak[i] -= 0.45f * dt_frames;
        if (s_peak[i] < s_height[i]) s_peak[i] = s_height[i];
    }
}

static void draw_equalizer(gfx_t *g, bool dim)
{
    for (int i = 0; i < BARS; i++) {
        int x = i * (BAR_W + BAR_GAP) + 1;
        int h = (int)(s_height[i] + 0.5f);
        int hue = 320 - i * 9; // pink -> violet -> blue across the bars
        for (int y = 0; y < h; y++) {
            // brighter towards the top of each bar
            uint8_t v = (uint8_t)(110 + (145 * y) / EQ_MAX);
            if (dim) v /= 3;
            uint16_t c = gfx_hsv(hue, 200, v);
            gfx_fill_rect(g, x, EQ_BOTTOM - y, BAR_W, 1, c);
        }
        int peak_y = EQ_BOTTOM - (int)(s_peak[i] + 0.5f) - 1;
        if (peak_y >= EQ_TOP - 1) gfx_fill_rect(g, x, peak_y, BAR_W, 1, dim ? C_MUTED : C_TEXT);
    }
    // faint reflection under the bars
    for (int i = 0; i < BARS; i++) {
        int x = i * (BAR_W + BAR_GAP) + 1;
        int h = (int)(s_height[i] / 6);
        uint16_t c = gfx_hsv(320 - i * 9, 200, dim ? 18 : 45);
        gfx_fill_rect(g, x, EQ_BOTTOM + 1, BAR_W, h > 3 ? 3 : h, c);
    }
}

// ---- icons -----------------------------------------------------------------------------------
static void icon_play(gfx_t *g, int cx, int cy, int s, uint16_t c)
{
    gfx_fill_triangle(g, cx - s / 2, cy - s, cx - s / 2, cy + s, cx + s, cy, c);
}

static void icon_pause(gfx_t *g, int cx, int cy, int s, uint16_t c)
{
    int w = s * 2 / 3 > 1 ? s * 2 / 3 : 2;
    gfx_fill_rect(g, cx - s + 1, cy - s, w, 2 * s + 1, c);
    gfx_fill_rect(g, cx + s - w, cy - s, w, 2 * s + 1, c);
}

static void icon_next(gfx_t *g, int cx, int cy, int s, uint16_t c, bool reverse)
{
    int d = reverse ? -1 : 1;
    gfx_fill_triangle(g, cx - d * s, cy - s, cx - d * s, cy + s, cx, cy, c);
    gfx_fill_triangle(g, cx, cy - s, cx, cy + s, cx + d * s, cy, c);
    int bar_x = reverse ? cx - s - 2 : cx + s;
    gfx_fill_rect(g, bar_x, cy - s, 3, 2 * s + 1, c);
}

static void icon_speaker(gfx_t *g, int cx, int cy, int s, uint16_t c, bool muted)
{
    gfx_fill_rect(g, cx - s, cy - s / 3, s / 2 + 1, 2 * (s / 3) + 1, c);
    gfx_fill_triangle(g, cx - s / 2, cy - s / 3, cx + s / 4, cy - s, cx + s / 4, cy + s, c);
    gfx_fill_triangle(g, cx - s / 2, cy + s / 3, cx - s / 2, cy - s / 3, cx + s / 4, cy + s, c);
    if (muted) {
        for (int i = -s / 2; i <= s / 2; i++) {
            gfx_fill_rect(g, cx + s / 2 + i + s / 4, cy + i, 2, 2, C_BAD);
            gfx_fill_rect(g, cx + s / 2 + i + s / 4, cy - i, 2, 2, C_BAD);
        }
    } else {
        for (int r = s / 2; r <= s; r += s / 3 > 1 ? s / 3 : 2) {
            for (int dy = -r; dy <= r; dy++) {
                for (int dx = 0; dx <= r; dx++) {
                    int d = dx * dx + dy * dy;
                    if (d <= r * r && d > (r - 1) * (r - 1) && dx * 2 > (dy < 0 ? -dy : dy)) {
                        gfx_pixel(g, cx + s / 4 + 2 + dx, cy + dy, c);
                    }
                }
            }
        }
    }
}

// ---- pieces of the main screen ----------------------------------------------------------------
static void draw_header(gfx_t *g, const ui_model_t *m, uint32_t now)
{
    gfx_text(g, 2, 2, "MUSIC BOX", 1, C_ACCENT);

    int x = GFX_W - 2;
    // link indicator: three rising bars
    for (int i = 2; i >= 0; i--) {
        int h = 3 + i * 2;
        x -= 3;
        gfx_fill_rect(g, x, 9 - h, 2, h, m->link == UI_LINK_OK ? C_OK : C_MUTED);
        x -= 1;
    }
    x -= 4;
    if (m->repeat) { x -= 6; gfx_text(g, x, 2, "R", 1, C_ACCENT2); x -= 2; }
    if (m->shuffle) { x -= 6; gfx_text(g, x, 2, "S", 1, C_ACCENT2); }
    (void)now;
    gfx_fill_rect(g, 0, 11, GFX_W, 1, C_PANEL);
}

static void draw_title(gfx_t *g, const ui_model_t *m, uint32_t now)
{
    const char *title = m->title[0] ? m->title : "No songs yet";
    const char *artist = m->title[0] ? m->artist : "Add tracks to music/";
    int w = gfx_text_width(title, 2);
    int y = 15;
    if (w <= GFX_W - 4) {
        gfx_text(g, (GFX_W - w) / 2, y, title, 2, C_TEXT);
    } else {
        // marquee: hold at the start, then scroll, with a gap before the text repeats
        int gap = 36;
        int span = w + gap;
        int hold = 1200;
        int period = hold + span * 28;
        int t = (int)(now % (uint32_t)period);
        int offset = t < hold ? 0 : (t - hold) / 28;
        gfx_text_clipped(g, 2 - offset, y, title, 2, C_TEXT, 2, GFX_W - 2);
        gfx_text_clipped(g, 2 - offset + span, y, title, 2, C_TEXT, 2, GFX_W - 2);
    }
    char line[22];
    snprintf(line, sizeof line, "%.21s", artist); // 21 characters fit on one line
    int aw = gfx_text_width(line, 1);
    gfx_text(g, (GFX_W - aw) / 2, 32, line, 1, C_MUTED);
}

static void draw_footer(gfx_t *g, const ui_model_t *m)
{
    int y = 86;
    if (m->playing) icon_play(g, 6, y + 4, 4, C_TEXT);
    else icon_pause(g, 6, y + 4, 4, C_TEXT);

    int bx = 16, bw = 84, bh = 5, by = y + 2;
    gfx_fill_round_rect(g, bx, by, bw, bh, 2, C_PANEL);
    int fill = m->muted ? 0 : (bw * m->volume) / 100;
    for (int i = 0; i < fill; i++) {
        uint16_t c = gfx_mix(C_ACCENT2, C_ACCENT, (uint8_t)(i * 255 / bw));
        gfx_fill_rect(g, bx + i, by + 1, 1, bh - 2, c);
    }
    if (fill > 0) gfx_fill_rect(g, bx, by + 1, 1, bh - 2, C_ACCENT2);

    char vol[8];
    if (m->muted) {
        gfx_text(g, 104, y + 1, "MUTE", 1, C_BAD);
    } else {
        snprintf(vol, sizeof vol, "%3d", m->volume);
        gfx_text(g, 106, y + 1, vol, 1, C_TEXT);
    }
}

// ---- overlays ----------------------------------------------------------------------------------
static void draw_flash(gfx_t *g, const ui_model_t *m, uint32_t age)
{
    // background dims fast, icon pops in with a little overshoot, ring expands and fades
    uint8_t keep = age < 80 ? (uint8_t)(255 - age * 2) : 95;
    if (age > FLASH_MS - 120) keep = (uint8_t)(95 + (age - (FLASH_MS - 120)) * 160 / 120);
    gfx_dim(g, keep);

    int cx = GFX_W / 2, cy = 44;
    float p = (float)age / 140.0f;
    if (p > 1.0f) p = 1.0f;
    float pop = p < 1.0f ? p * 1.25f : 1.0f; // slight overshoot then settle
    if (age > 140 && age < 220) pop = 1.25f - (float)(age - 140) / 80.0f * 0.25f;
    int s = (int)(12 * pop);
    if (s < 2) s = 2;

    int ring = 18 + (int)(age / 18);
    uint8_t ring_v = age < 400 ? (uint8_t)(255 - age * 255 / 400) : 0;
    if (ring_v) gfx_circle(g, cx, cy, ring, gfx_mix(C_BG, C_ACCENT, ring_v));
    gfx_fill_circle(g, cx, cy, 17, gfx_mix(C_BG, C_ACCENT2, 90));

    const char *label = "";
    switch (m->flash) {
    case UI_FLASH_PLAY:   icon_play(g, cx + 2, cy, s, C_TEXT); label = "PLAY"; break;
    case UI_FLASH_PAUSE:  icon_pause(g, cx, cy, s, C_TEXT); label = "PAUSE"; break;
    case UI_FLASH_NEXT:   icon_next(g, cx - 1, cy, s * 2 / 3, C_TEXT, false); label = "NEXT"; break;
    case UI_FLASH_PREV:   icon_next(g, cx + 1, cy, s * 2 / 3, C_TEXT, true); label = "PREVIOUS"; break;
    case UI_FLASH_MUTE:   icon_speaker(g, cx - 3, cy, s, C_TEXT, true); label = "MUTED"; break;
    case UI_FLASH_UNMUTE: icon_speaker(g, cx - 4, cy, s, C_TEXT, false); label = "SOUND ON"; break;
    case UI_FLASH_SEEK: {
        const char *t = "+10";
        gfx_text(g, cx - gfx_text_width(t, 2) / 2, cy - 7, t, 2, C_TEXT);
        label = "SECONDS";
        break;
    }
    default: break;
    }
    int lw = gfx_text_width(label, 1);
    gfx_text(g, (GFX_W - lw) / 2, 70, label, 1, C_TEXT);
}

static void draw_knob_overlay(gfx_t *g, const ui_model_t *m, uint32_t age)
{
    (void)age;
    int x = 14, y = 30, w = 100, h = 36;
    gfx_fill_round_rect(g, x, y, w, h, 6, C_PANEL);
    gfx_round_rect(g, x, y, w, h, 6, C_ACCENT2);
    char num[8];
    snprintf(num, sizeof num, "%d", m->volume);
    int nw = gfx_text_width(num, 3);
    icon_speaker(g, x + 16, y + 14, 7, C_TEXT, m->volume == 0);
    gfx_text(g, x + 62 - nw / 2, y + 5, num, 3, C_TEXT);
    int bx = x + 8, bw = w - 16, by = y + h - 9;
    gfx_fill_rect(g, bx, by, bw, 4, C_BG);
    int fill = bw * m->volume / 100;
    for (int i = 0; i < fill; i++) {
        gfx_fill_rect(g, bx + i, by, 1, 4, gfx_mix(C_ACCENT2, C_ACCENT, (uint8_t)(i * 255 / bw)));
    }
}

// ---- offline screens ---------------------------------------------------------------------------
static void draw_offline(gfx_t *g, const ui_model_t *m, uint32_t now)
{
    gfx_clear(g, C_BG);
    bool wifi = m->link == UI_LINK_WIFI_CONNECTING;
    const char *line1 = wifi ? "Connecting" : "Music Box";
    const char *line2 = wifi ? "to WiFi" : "unreachable";

    // pulsing ring
    int phase = (int)(now % 1400);
    int r = 8 + phase / 100;
    uint8_t v = (uint8_t)(255 - phase * 255 / 1400);
    gfx_circle(g, GFX_W / 2, 26, r, gfx_mix(C_BG, wifi ? C_WARN : C_BAD, v));
    gfx_fill_circle(g, GFX_W / 2, 26, 6, wifi ? C_WARN : C_BAD);

    gfx_text(g, (GFX_W - gfx_text_width(line1, 2)) / 2, 46, line1, 2, C_TEXT);
    gfx_text(g, (GFX_W - gfx_text_width(line2, 1)) / 2, 64, line2, 1, C_MUTED);

    char dots[4] = "...";
    dots[(now / 400) % 4 == 3 ? 3 : (now / 400) % 4] = '\0';
    gfx_text(g, (GFX_W + gfx_text_width(line2, 1)) / 2 + 1, 64, dots, 1, C_MUTED);

    // drop the scheme so the address fits (21 characters per line)
    const char *addr = m->server;
    if (strncmp(addr, "http://", 7) == 0) addr += 7;
    char server[22];
    snprintf(server, sizeof server, "%.21s", addr);
    gfx_text(g, (GFX_W - gfx_text_width(server, 1)) / 2, 84, server, 1, gfx_rgb(90, 80, 120));
}

// ---- entry point -------------------------------------------------------------------------------
void ui_render(gfx_t *g, const ui_model_t *m, uint32_t now)
{
    float dt = s_last_ms ? (float)(now - s_last_ms) / 33.0f : 1.0f;
    if (dt > 4.0f) dt = 4.0f;
    s_last_ms = now;

    if (m->link != UI_LINK_OK) {
        draw_offline(g, m, now);
        return;
    }

    update_equalizer(m->playing && !m->muted, now, dt);

    gfx_clear(g, C_BG);
    draw_header(g, m, now);
    draw_title(g, m, now);
    draw_equalizer(g, !m->playing);
    draw_footer(g, m);

    uint32_t flash_age = now - m->flash_at_ms;
    uint32_t knob_age = now - m->knob_at_ms;
    if (m->flash != UI_FLASH_NONE && flash_age < FLASH_MS) {
        draw_flash(g, m, flash_age);
    } else if (m->knob_at_ms && knob_age < KNOB_MS) {
        draw_knob_overlay(g, m, knob_age);
    }
}
