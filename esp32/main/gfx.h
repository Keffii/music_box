#pragma once
// Tiny drawing library over a 128x96 RGB565 framebuffer. Plain C, no ESP-IDF headers, so the UI
// can also be compiled and rendered on a PC (see tools/render_preview.c).

#include <stdint.h>
#include <stdbool.h>

#define GFX_W 128
#define GFX_H 96

typedef struct {
    // Pixels are stored byte-swapped (big-endian RGB565), the order the SSD1351 expects over SPI.
    uint16_t px[GFX_W * GFX_H];
} gfx_t;

static inline uint16_t gfx_rgb(uint8_t r, uint8_t g, uint8_t b)
{
    return (uint16_t)(((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3));
}

/** Linear blend of two RGB565 colours, t in 0..255 (0 = a, 255 = b). */
uint16_t gfx_mix(uint16_t a, uint16_t b, uint8_t t);
/** HSV to RGB565, h in 0..359, s and v in 0..255. */
uint16_t gfx_hsv(int h, uint8_t s, uint8_t v);

void gfx_clear(gfx_t *g, uint16_t color);
void gfx_pixel(gfx_t *g, int x, int y, uint16_t color);
uint16_t gfx_get(const gfx_t *g, int x, int y);
void gfx_fill_rect(gfx_t *g, int x, int y, int w, int h, uint16_t color);
void gfx_rect(gfx_t *g, int x, int y, int w, int h, uint16_t color);
void gfx_round_rect(gfx_t *g, int x, int y, int w, int h, int r, uint16_t color);
void gfx_fill_round_rect(gfx_t *g, int x, int y, int w, int h, int r, uint16_t color);
void gfx_fill_circle(gfx_t *g, int cx, int cy, int r, uint16_t color);
void gfx_circle(gfx_t *g, int cx, int cy, int r, uint16_t color);
void gfx_fill_triangle(gfx_t *g, int x0, int y0, int x1, int y1, int x2, int y2, uint16_t color);
/** Darkens every pixel: keep = 0..255 (255 keeps the image, 0 makes it black). */
void gfx_dim(gfx_t *g, uint8_t keep);

/** Draws ASCII text with the 5x7 font; each glyph is 6*scale wide. Returns the x after the text. */
int gfx_text(gfx_t *g, int x, int y, const char *s, int scale, uint16_t color);
/** Same, but only draws pixels with clip_x0 <= x < clip_x1 (for scrolling titles). */
int gfx_text_clipped(gfx_t *g, int x, int y, const char *s, int scale, uint16_t color, int clip_x0, int clip_x1);
int gfx_text_width(const char *s, int scale);
