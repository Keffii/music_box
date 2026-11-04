// Renders UI frames on a PC so the screen design can be checked without hardware.
//
//   gcc -O2 -I../main render_preview.c ../main/ui.c ../main/gfx.c ../main/font5x7.c -o render_preview
//   ./render_preview out_dir
//
// Writes one binary PPM (P6) per scene. The colours match what the SSD1351 shows.

#include <stdio.h>
#include <string.h>
#include "ui.h"

static gfx_t g;

static void save(const char *dir, const char *name)
{
    char path[512];
    snprintf(path, sizeof path, "%s/%s.ppm", dir, name);
    FILE *f = fopen(path, "wb");
    if (!f) { perror(path); return; }
    fprintf(f, "P6\n%d %d\n255\n", GFX_W, GFX_H);
    for (int i = 0; i < GFX_W * GFX_H; i++) {
        uint16_t c = gfx_get(&g, i % GFX_W, i / GFX_W);
        unsigned char rgb[3] = {
            (unsigned char)(((c >> 11) & 0x1F) * 255 / 31),
            (unsigned char)(((c >> 5) & 0x3F) * 255 / 63),
            (unsigned char)((c & 0x1F) * 255 / 31),
        };
        fwrite(rgb, 1, 3, f);
    }
    fclose(f);
}

/** Runs the animation from `from` to `to` ms at 30 fps, then saves the last frame. */
static void scene(const char *dir, const char *name, ui_model_t *m, uint32_t from, uint32_t to)
{
    for (uint32_t t = from; t <= to; t += 33) ui_render(&g, m, t);
    save(dir, name);
}

int main(int argc, char **argv)
{
    const char *dir = argc > 1 ? argv[1] : ".";
    ui_model_t m;
    memset(&m, 0, sizeof m);
    snprintf(m.server, sizeof m.server, "http://192.168.1.100:8080");

    m.link = UI_LINK_WIFI_CONNECTING;
    scene(dir, "01_wifi", &m, 1000, 1500);

    m.link = UI_LINK_SERVER_UNREACHABLE;
    scene(dir, "02_offline", &m, 1000, 1900);

    m.link = UI_LINK_OK;
    snprintf(m.title, sizeof m.title, "Better Day");
    snprintf(m.artist, sizeof m.artist, "penguinmusic");
    snprintf(m.category, sizeof m.category, "Electronic");
    m.playing = true;
    m.volume = 72;
    scene(dir, "03_playing", &m, 2000, 4000);

    m.flash = UI_FLASH_NEXT;
    m.flash_at_ms = 4000;
    scene(dir, "04_flash_next", &m, 4000, 4200);

    m.flash = UI_FLASH_PAUSE;
    m.flash_at_ms = 5000;
    m.playing = false;
    scene(dir, "05_flash_pause", &m, 5000, 5200);
    scene(dir, "06_paused", &m, 5200, 7000);

    m.playing = true;
    m.flash = UI_FLASH_SEEK;
    m.flash_at_ms = 7000;
    scene(dir, "07_flash_seek", &m, 7000, 7200);

    m.flash = UI_FLASH_MUTE;
    m.flash_at_ms = 8000;
    m.muted = true;
    scene(dir, "08_flash_mute", &m, 8000, 8200);

    m.muted = false;
    m.flash = UI_FLASH_NONE;
    m.volume = 45;
    m.knob_at_ms = 9000;
    scene(dir, "09_knob", &m, 9000, 9300);

    snprintf(m.title, sizeof m.title, "Lonewolf Dark Trap");
    snprintf(m.artist, sizeof m.artist, "onesevenbeatxs");
    snprintf(m.category, sizeof m.category, "Hiphop");
    m.knob_at_ms = 0;
    m.shuffle = true;
    m.repeat = true;
    scene(dir, "10_long_title", &m, 10000, 12400);

    m.flash = UI_FLASH_PREV;
    m.flash_at_ms = 13000;
    scene(dir, "11_flash_prev", &m, 13000, 13200);

    m.flash = UI_FLASH_PLAY;
    m.flash_at_ms = 14000;
    scene(dir, "12_flash_play", &m, 14000, 14200);

    memset(m.title, 0, sizeof m.title);
    m.flash = UI_FLASH_NONE;
    scene(dir, "13_empty", &m, 15000, 15500);

    // font check: every printable character
    gfx_clear(&g, 0);
    char line[22];
    for (int row = 0; row < 5; row++) {
        int n = 0;
        for (int c = 0x20 + row * 20; c < 0x20 + (row + 1) * 20 && c <= 0x7E; c++) line[n++] = (char)c;
        line[n] = 0;
        gfx_text(&g, 2, 4 + row * 12, line, 1, gfx_rgb(255, 255, 255));
    }
    save(dir, "14_font");
    return 0;
}
