#include "gfx.h"

#include <stdio.h>
#include <string.h>

static inline uint16_t swap16(uint16_t v) { return (uint16_t)((v << 8) | (v >> 8)); }

uint16_t gfx_mix(uint16_t a, uint16_t b, uint8_t t)
{
    int ar = (a >> 11) & 0x1F, ag = (a >> 5) & 0x3F, ab = a & 0x1F;
    int br = (b >> 11) & 0x1F, bg = (b >> 5) & 0x3F, bb = b & 0x1F;
    int r = ar + ((br - ar) * t) / 255;
    int gg = ag + ((bg - ag) * t) / 255;
    int bl = ab + ((bb - ab) * t) / 255;
    return (uint16_t)((r << 11) | (gg << 5) | bl);
}

uint16_t gfx_hsv(int h, uint8_t s, uint8_t v)
{
    h %= 360;
    if (h < 0) h += 360;
    int region = h / 60;
    int rem = (h - region * 60) * 255 / 60;
    int p = (v * (255 - s)) / 255;
    int q = (v * (255 - (s * rem) / 255)) / 255;
    int t = (v * (255 - (s * (255 - rem)) / 255)) / 255;
    switch (region) {
    case 0:  return gfx_rgb(v, t, p);
    case 1:  return gfx_rgb(q, v, p);
    case 2:  return gfx_rgb(p, v, t);
    case 3:  return gfx_rgb(p, q, v);
    case 4:  return gfx_rgb(t, p, v);
    default: return gfx_rgb(v, p, q);
    }
}

void gfx_clear(gfx_t *g, uint16_t color)
{
    uint16_t c = swap16(color);
    for (int i = 0; i < GFX_W * GFX_H; i++) g->px[i] = c;
}

void gfx_pixel(gfx_t *g, int x, int y, uint16_t color)
{
    if ((unsigned)x >= GFX_W || (unsigned)y >= GFX_H) return;
    g->px[y * GFX_W + x] = swap16(color);
}

uint16_t gfx_get(const gfx_t *g, int x, int y)
{
    if ((unsigned)x >= GFX_W || (unsigned)y >= GFX_H) return 0;
    return swap16(g->px[y * GFX_W + x]);
}

void gfx_fill_rect(gfx_t *g, int x, int y, int w, int h, uint16_t color)
{
    if (x < 0) { w += x; x = 0; }
    if (y < 0) { h += y; y = 0; }
    if (x + w > GFX_W) w = GFX_W - x;
    if (y + h > GFX_H) h = GFX_H - y;
    if (w <= 0 || h <= 0) return;
    uint16_t c = swap16(color);
    for (int j = y; j < y + h; j++) {
        uint16_t *row = &g->px[j * GFX_W + x];
        for (int i = 0; i < w; i++) row[i] = c;
    }
}

void gfx_rect(gfx_t *g, int x, int y, int w, int h, uint16_t color)
{
    gfx_fill_rect(g, x, y, w, 1, color);
    gfx_fill_rect(g, x, y + h - 1, w, 1, color);
    gfx_fill_rect(g, x, y, 1, h, color);
    gfx_fill_rect(g, x + w - 1, y, 1, h, color);
}

void gfx_fill_circle(gfx_t *g, int cx, int cy, int r, uint16_t color)
{
    for (int dy = -r; dy <= r; dy++) {
        for (int dx = -r; dx <= r; dx++) {
            if (dx * dx + dy * dy <= r * r + r) gfx_pixel(g, cx + dx, cy + dy, color);
        }
    }
}

void gfx_circle(gfx_t *g, int cx, int cy, int r, uint16_t color)
{
    int outer = r * r + r, inner = (r - 1) * (r - 1) + (r - 1);
    for (int dy = -r; dy <= r; dy++) {
        for (int dx = -r; dx <= r; dx++) {
            int d = dx * dx + dy * dy;
            if (d <= outer && d > inner) gfx_pixel(g, cx + dx, cy + dy, color);
        }
    }
}

void gfx_fill_round_rect(gfx_t *g, int x, int y, int w, int h, int r, uint16_t color)
{
    if (r * 2 > h) r = h / 2;
    if (r * 2 > w) r = w / 2;
    gfx_fill_rect(g, x + r, y, w - 2 * r, h, color);
    gfx_fill_rect(g, x, y + r, r, h - 2 * r, color);
    gfx_fill_rect(g, x + w - r, y + r, r, h - 2 * r, color);
    for (int dy = 0; dy < r; dy++) {
        for (int dx = 0; dx < r; dx++) {
            int ddx = r - dx - 1, ddy = r - dy - 1;
            if (ddx * ddx + ddy * ddy <= r * r) {
                gfx_pixel(g, x + dx, y + dy, color);
                gfx_pixel(g, x + w - 1 - dx, y + dy, color);
                gfx_pixel(g, x + dx, y + h - 1 - dy, color);
                gfx_pixel(g, x + w - 1 - dx, y + h - 1 - dy, color);
            }
        }
    }
}

void gfx_round_rect(gfx_t *g, int x, int y, int w, int h, int r, uint16_t color)
{
    if (r * 2 > h) r = h / 2;
    if (r * 2 > w) r = w / 2;
    gfx_fill_rect(g, x + r, y, w - 2 * r, 1, color);
    gfx_fill_rect(g, x + r, y + h - 1, w - 2 * r, 1, color);
    gfx_fill_rect(g, x, y + r, 1, h - 2 * r, color);
    gfx_fill_rect(g, x + w - 1, y + r, 1, h - 2 * r, color);
    int outer = r * r, inner = (r - 1) * (r - 1);
    for (int dy = 0; dy < r; dy++) {
        for (int dx = 0; dx < r; dx++) {
            int ddx = r - dx - 1, ddy = r - dy - 1;
            int d = ddx * ddx + ddy * ddy;
            if (d <= outer && d >= inner) {
                gfx_pixel(g, x + dx, y + dy, color);
                gfx_pixel(g, x + w - 1 - dx, y + dy, color);
                gfx_pixel(g, x + dx, y + h - 1 - dy, color);
                gfx_pixel(g, x + w - 1 - dx, y + h - 1 - dy, color);
            }
        }
    }
}

static int edge(int ax, int ay, int bx, int by, int px, int py)
{
    return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
}

void gfx_fill_triangle(gfx_t *g, int x0, int y0, int x1, int y1, int x2, int y2, uint16_t color)
{
    int minx = x0 < x1 ? (x0 < x2 ? x0 : x2) : (x1 < x2 ? x1 : x2);
    int maxx = x0 > x1 ? (x0 > x2 ? x0 : x2) : (x1 > x2 ? x1 : x2);
    int miny = y0 < y1 ? (y0 < y2 ? y0 : y2) : (y1 < y2 ? y1 : y2);
    int maxy = y0 > y1 ? (y0 > y2 ? y0 : y2) : (y1 > y2 ? y1 : y2);
    int area = edge(x0, y0, x1, y1, x2, y2);
    if (area == 0) return;
    for (int y = miny; y <= maxy; y++) {
        for (int x = minx; x <= maxx; x++) {
            int w0 = edge(x1, y1, x2, y2, x, y);
            int w1 = edge(x2, y2, x0, y0, x, y);
            int w2 = edge(x0, y0, x1, y1, x, y);
            if (area > 0 ? (w0 >= 0 && w1 >= 0 && w2 >= 0) : (w0 <= 0 && w1 <= 0 && w2 <= 0)) {
                gfx_pixel(g, x, y, color);
            }
        }
    }
}

void gfx_dim(gfx_t *g, uint8_t keep)
{
    for (int i = 0; i < GFX_W * GFX_H; i++) {
        uint16_t c = swap16(g->px[i]);
        g->px[i] = swap16(gfx_mix(0, c, keep));
    }
}

static const gfx_glyph_t *glyph_of(const gfx_font_t *f, char c)
{
    unsigned char u = (unsigned char)c;
    if (u < f->first || u > f->last) u = (f->first <= '?' && '?' <= f->last) ? '?' : f->first;
    return &f->glyphs[u - f->first];
}

int gfx_text_width(const gfx_font_t *f, const char *s, int tracking16)
{
    int pen16 = 0;
    for (const char *p = s; *p; p++) {
        pen16 += glyph_of(f, *p)->adv16;
        if (p[1]) pen16 += tracking16;
    }
    return (pen16 + 8) >> 4;
}

/** Blends a colour into one pixel with coverage a (0..15). */
static void blend_px(gfx_t *g, int x, int y, uint16_t color, int a)
{
    if ((unsigned)x >= GFX_W || (unsigned)y >= GFX_H || a == 0) return;
    uint16_t *dst = &g->px[y * GFX_W + x];
    *dst = a >= 15 ? swap16(color) : swap16(gfx_mix(swap16(*dst), color, (uint8_t)(a * 17)));
}

int gfx_text(gfx_t *g, const gfx_font_t *f, int x, int y, const char *s, uint16_t color,
             gfx_align_t align, int tracking16, int clip_x0, int clip_x1)
{
    int width = gfx_text_width(f, s, tracking16);
    if (align == GFX_CENTER) x -= width / 2;
    else if (align == GFX_RIGHT) x -= width;
    if (clip_x0 < 0) clip_x0 = 0;
    if (clip_x1 > GFX_W) clip_x1 = GFX_W;

    int pen16 = x * 16;
    for (; *s; s++) {
        const gfx_glyph_t *gl = glyph_of(f, *s);
        int gx = ((pen16 + 8) >> 4) + gl->x;
        int gy = y + gl->y;
        int row_bytes = (gl->w + 1) / 2;
        const uint8_t *bits = f->bitmap + gl->offset;
        for (int row = 0; row < gl->h; row++) {
            for (int col = 0; col < gl->w; col++) {
                int px = gx + col;
                if (px < clip_x0 || px >= clip_x1) continue;
                uint8_t b = bits[row * row_bytes + col / 2];
                int a = (col & 1) ? (b & 0x0F) : (b >> 4);
                blend_px(g, px, gy + row, color, a);
            }
        }
        pen16 += gl->adv16 + tracking16;
    }
    return width;
}

void gfx_text_fit(const gfx_font_t *f, const char *s, int tracking16, int max_w, char *out, int out_size)
{
    if (out_size <= 0) return;
    snprintf(out, (size_t)out_size, "%s", s);
    if (gfx_text_width(f, out, tracking16) <= max_w) return;
    // drop characters from the end until the text plus "..." fits
    int n = (int)strlen(out);
    while (n > 0) {
        n--;
        while (n > 0 && out[n - 1] == ' ') n--; // no space before the dots
        if (n + 4 > out_size) continue;
        memcpy(out + n, "...", 4);
        if (gfx_text_width(f, out, tracking16) <= max_w) return;
    }
    snprintf(out, (size_t)out_size, "...");
}
