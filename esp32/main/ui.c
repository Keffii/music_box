#include "ui.h"
#include "fonts_inter.h"

#include <ctype.h>
#include <math.h>
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
#define EQ_TOP      46
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
// Every icon is drawn inside a box of height h centred on (cx, cy), so it can be placed and sized
// without overlapping anything around it. Widths are given next to each function.

/**
 * Play triangle, about 0.87h wide. Centring the box makes it look too far left and centring the
 * centroid too far right, so it sits in between: the box is shifted right by w/12.
 */
static void icon_play(gfx_t *g, int cx, int cy, int h, uint16_t c)
{
    int w = (h * 87 + 50) / 100;
    int half = h / 2;
    int left = cx - (w * 5 + 6) / 12;
    gfx_fill_triangle(g, left, cy - half, left, cy + half, left + w, cy, c);
}

/** Two bars, about 0.9h wide. */
static void icon_pause(gfx_t *g, int cx, int cy, int h, uint16_t c)
{
    int bw = (h * 32 + 50) / 100, gap = (h * 26 + 50) / 100;
    if (bw < 2) bw = 2;
    if (gap < 2) gap = 2;
    int total = 2 * bw + gap;
    int left = cx - total / 2, top = cy - h / 2;
    gfx_fill_rect(g, left, top, bw, h, c);
    gfx_fill_rect(g, left + bw + gap, top, bw, h, c);
}

/** Skip next (two triangles and an end bar), about 1.1h wide; mirrored for previous. */
static void icon_skip(gfx_t *g, int cx, int cy, int h, uint16_t c, bool previous)
{
    int t = (h * 48 + 50) / 100;          // width of one triangle
    int b = h / 7 > 2 ? h / 7 : 2;         // end bar
    int total = 2 * t + b;
    int left = cx - total / 2, half = h / 2;
    if (!previous) {
        gfx_fill_triangle(g, left, cy - half, left, cy + half, left + t, cy, c);
        gfx_fill_triangle(g, left + t, cy - half, left + t, cy + half, left + 2 * t, cy, c);
        gfx_fill_rect(g, left + 2 * t, cy - half, b, 2 * half + 1, c);
    } else {
        gfx_fill_rect(g, left, cy - half, b, 2 * half + 1, c);
        gfx_fill_triangle(g, left + b + t, cy - half, left + b + t, cy + half, left + b, cy, c);
        gfx_fill_triangle(g, left + b + 2 * t, cy - half, left + b + 2 * t, cy + half, left + b + t, cy, c);
    }
}

typedef enum { SPEAKER_WAVES, SPEAKER_MUTED, SPEAKER_PLAIN } speaker_t;

/** Speaker with sound waves or a red X to its right, about 1.15h wide in total, never overlapping. */
static void icon_speaker(gfx_t *g, int cx, int cy, int h, uint16_t c, speaker_t mode)
{
    int body_w = (h * 22 + 50) / 100, body_h = (h * 40 + 50) / 100;
    int cone_w = (h * 30 + 50) / 100;
    int gap = h / 6 > 2 ? h / 6 : 2;
    int side = mode == SPEAKER_PLAIN ? 0 : (h * 46 + 50) / 100; // the waves or the X
    int total = body_w + cone_w + (side ? gap + side : 0);
    int left = cx - total / 2, half = h / 2;

    // body and cone
    gfx_fill_rect(g, left, cy - body_h / 2, body_w, body_h | 1, c);
    int cl = left + body_w, cr = cl + cone_w;
    gfx_fill_triangle(g, cl, cy - body_h / 2, cr, cy - half, cr, cy + half, c);
    gfx_fill_triangle(g, cl, cy - body_h / 2, cl, cy + body_h / 2, cr, cy + half, c);
    gfx_fill_rect(g, cr - 1, cy - half, 1, 2 * half + 1, c);

    int sx = cr + gap; // left edge of the side part
    if (mode == SPEAKER_MUTED) {
        // an X, two pixels thick, in a side x side square
        int r = side / 2;
        int mx = sx + r;
        for (int i = -r; i <= r - 1; i++) {
            gfx_fill_rect(g, mx + i, cy + i, 2, 2, C_BAD);
            gfx_fill_rect(g, mx + i, cy - i - 1, 2, 2, C_BAD);
        }
    } else if (mode == SPEAKER_WAVES) {
        // two arcs centred on the cone's mouth, about 80 degrees wide; the outer one ends at the
        // right edge of the side part. Pixels count when their centre is within 1.3 px of the arc.
        int radii[2] = {gap + side / 2 - 1, gap + side - 1};
        for (int k = 0; k < 2; k++) {
            float r = (float)radii[k];
            for (int dy = -radii[k]; dy <= radii[k]; dy++) {
                for (int dx = 1; dx <= radii[k]; dx++) {
                    float d = sqrtf((float)(dx * dx + dy * dy));
                    if (d > r + 0.5f || d < r - 0.8f) continue;
                    if ((dy < 0 ? -dy : dy) * 10 > dx * 9) continue;
                    gfx_pixel(g, cr + dx, cy + dy, c);
                }
            }
        }
    }
}

// ---- text styles (Inter, see fonts_inter.h) ---------------------------------------------------
#define F_LABEL     (&inter_9_semibold)
#define F_BODY      (&inter_10_regular)
#define F_STRONG    (&inter_10_semibold)
#define F_TITLE     (&inter_17_bold)
#define F_BIG       (&inter_26_bold)
#define TRACK_CAPS  10   // letter spacing for capitals, in 1/16 px (about 0.6 px)

static int text(gfx_t *g, const gfx_font_t *f, int x, int y, const char *s, uint16_t c, gfx_align_t align, int tracking)
{
    return gfx_text(g, f, x, y, s, c, align, tracking, 0, GFX_W);
}

// ---- pieces of the main screen ----------------------------------------------------------------
static void draw_header(gfx_t *g, const ui_model_t *m, uint32_t now)
{
    (void)now;
    int x = GFX_W - 2;
    // link indicator: three rising bars
    for (int i = 2; i >= 0; i--) {
        int h = 3 + i * 2;
        x -= 3;
        gfx_fill_rect(g, x, 9 - h, 2, h, m->link == UI_LINK_OK ? C_OK : C_MUTED);
        x -= 1;
    }
    x -= 4;
    if (m->repeat) x -= text(g, F_LABEL, x, 9, "R", C_ACCENT2, GFX_RIGHT, 0) + 4;
    if (m->shuffle) x -= text(g, F_LABEL, x, 9, "S", C_ACCENT2, GFX_RIGHT, 0) + 4;

    // The current track's genre in capitals; "MUSIC BOX" when there is none (e.g. an empty library).
    char upper[24], label[24];
    const char *src = m->title[0] && m->category[0] ? m->category : "Music Box";
    size_t n = 0;
    for (; src[n] && n < sizeof upper - 1; n++) upper[n] = (char)toupper((unsigned char)src[n]);
    upper[n] = '\0';
    gfx_text_fit(F_LABEL, upper, TRACK_CAPS, x - 4, label, sizeof label);
    text(g, F_LABEL, 2, 9, label, C_ACCENT, GFX_LEFT, TRACK_CAPS);

    gfx_fill_rect(g, 0, 12, GFX_W, 1, C_PANEL);
}

static void draw_title(gfx_t *g, const ui_model_t *m, uint32_t now)
{
    const char *title = m->title[0] ? m->title : "No songs yet";
    const char *artist = m->title[0] ? m->artist : "Add tracks to music/";
    int w = gfx_text_width(F_TITLE, title, 0);
    int y = 28; // baseline
    if (w <= GFX_W - 6) {
        text(g, F_TITLE, GFX_W / 2, y, title, C_TEXT, GFX_CENTER, 0);
    } else {
        // marquee: hold at the start, then scroll, with a gap before the text repeats
        int gap = 36;
        int span = w + gap;
        int hold = 1200;
        int period = hold + span * 28;
        int t = (int)(now % (uint32_t)period);
        int offset = t < hold ? 0 : (t - hold) / 28;
        gfx_text(g, F_TITLE, 3 - offset, y, title, C_TEXT, GFX_LEFT, 0, 3, GFX_W - 3);
        gfx_text(g, F_TITLE, 3 - offset + span, y, title, C_TEXT, GFX_LEFT, 0, 3, GFX_W - 3);
    }
    char line[48];
    gfx_text_fit(F_BODY, artist, 0, GFX_W - 8, line, sizeof line);
    text(g, F_BODY, GFX_W / 2, 42, line, C_MUTED, GFX_CENTER, 0);
}

static void draw_footer(gfx_t *g, const ui_model_t *m)
{
    int y = 86;
    if (m->playing) icon_play(g, 7, y + 4, 9, C_TEXT);
    else icon_pause(g, 7, y + 4, 9, C_TEXT);

    // number (or MUTE) on the right; the bar takes the space that is left
    char vol[8];
    snprintf(vol, sizeof vol, "%d", m->volume);
    const char *right = m->muted ? "MUTE" : vol;
    int tw = text(g, F_STRONG, GFX_W - 3, 94, right, m->muted ? C_BAD : C_TEXT, GFX_RIGHT,
                  m->muted ? TRACK_CAPS : 0);

    int bx = 16, bh = 5, by = y + 2;
    int bw = GFX_W - 3 - tw - 6 - bx;
    gfx_fill_round_rect(g, bx, by, bw, bh, 2, C_PANEL);
    int fill = m->muted ? 0 : (bw * m->volume) / 100;
    for (int i = 0; i < fill; i++) {
        uint16_t c = gfx_mix(C_ACCENT2, C_ACCENT, (uint8_t)(i * 255 / bw));
        gfx_fill_rect(g, bx + i, by + 1, 1, bh - 2, c);
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
    // pop in with a slight overshoot, then settle. At the largest (1.12 x 18 px) every icon still
    // stays at least 2 px inside the circle.
    float pop = p < 1.0f ? p * 1.12f : 1.0f;
    if (age > 140 && age < 220) pop = 1.12f - (float)(age - 140) / 80.0f * 0.12f;
    int s = ((int)(18 * pop)) | 1; // odd, so the icon has a centre row
    if (s < 3) s = 3;

    int ring = 18 + (int)(age / 18);
    uint8_t ring_v = age < 400 ? (uint8_t)(255 - age * 255 / 400) : 0;
    if (ring_v) gfx_circle(g, cx, cy, ring, gfx_mix(C_BG, C_ACCENT, ring_v));
    gfx_fill_circle(g, cx, cy, 17, gfx_mix(C_BG, C_ACCENT2, 90));

    const char *label = "";
    switch (m->flash) {
    case UI_FLASH_PLAY:   icon_play(g, cx, cy, s, C_TEXT); label = "PLAY"; break;
    case UI_FLASH_PAUSE:  icon_pause(g, cx, cy, s, C_TEXT); label = "PAUSE"; break;
    case UI_FLASH_NEXT:   icon_skip(g, cx, cy, s, C_TEXT, false); label = "NEXT"; break;
    case UI_FLASH_PREV:   icon_skip(g, cx, cy, s, C_TEXT, true); label = "PREVIOUS"; break;
    case UI_FLASH_MUTE:   icon_speaker(g, cx, cy, s, C_TEXT, SPEAKER_MUTED); label = "MUTED"; break;
    case UI_FLASH_UNMUTE: icon_speaker(g, cx, cy, s, C_TEXT, SPEAKER_WAVES); label = "SOUND ON"; break;
    case UI_FLASH_SEEK:
        text(g, F_TITLE, cx, cy + 6, "+10", C_TEXT, GFX_CENTER, 0);
        label = "SECONDS";
        break;
    default: break;
    }
    text(g, F_STRONG, GFX_W / 2, 77, label, C_TEXT, GFX_CENTER, TRACK_CAPS);
}

static void draw_knob_overlay(gfx_t *g, const ui_model_t *m, uint32_t age)
{
    (void)age;
    int x = 14, y = 30, w = 100, h = 36;
    gfx_fill_round_rect(g, x, y, w, h, 6, C_PANEL);
    gfx_round_rect(g, x, y, w, h, 6, C_ACCENT2);
    char num[8];
    snprintf(num, sizeof num, "%d", m->volume);
    icon_speaker(g, x + 19, y + 15, 15, C_TEXT, m->volume == 0 ? SPEAKER_MUTED : SPEAKER_WAVES);
    text(g, F_BIG, x + 62, y + 25, num, C_TEXT, GFX_CENTER, 0);
    int bx = x + 8, bw = w - 16, by = y + h - 7;
    gfx_fill_rect(g, bx, by, bw, 3, C_BG);
    int fill = bw * m->volume / 100;
    for (int i = 0; i < fill; i++) {
        gfx_fill_rect(g, bx + i, by, 1, 3, gfx_mix(C_ACCENT2, C_ACCENT, (uint8_t)(i * 255 / bw)));
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
    int r = 8 + phase / 150; // at most 17, so it never reaches the headline
    uint8_t v = (uint8_t)(255 - phase * 255 / 1400);
    gfx_circle(g, GFX_W / 2, 24, r, gfx_mix(C_BG, wifi ? C_WARN : C_BAD, v));
    gfx_fill_circle(g, GFX_W / 2, 24, 6, wifi ? C_WARN : C_BAD);

    text(g, F_TITLE, GFX_W / 2, 56, line1, C_TEXT, GFX_CENTER, 0);
    // centre the line without the dots, so it does not jump while they animate
    int w2 = gfx_text_width(F_BODY, line2, 0);
    int x2 = (GFX_W - w2) / 2;
    text(g, F_BODY, x2, 69, line2, C_MUTED, GFX_LEFT, 0);
    static const char *dots[] = {"", ".", "..", "..."};
    text(g, F_BODY, x2 + w2 + 1, 69, dots[(now / 400) % 4], C_MUTED, GFX_LEFT, 0);

    const char *addr = m->server;
    if (strncmp(addr, "http://", 7) == 0) addr += 7;
    char server[48];
    gfx_text_fit(F_BODY, addr, 0, GFX_W - 8, server, sizeof server);
    text(g, F_BODY, GFX_W / 2, 89, server, gfx_rgb(90, 80, 120), GFX_CENTER, 0);
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
