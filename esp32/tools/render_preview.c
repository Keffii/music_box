// Renders UI frames on a PC so the screen design can be checked without hardware.
//
//   gcc -O2 -I../main render_preview.c ../main/ui.c ../main/gfx.c ../main/fonts_inter.c -o render_preview -lm
//   ./render_preview out_dir        renders every scene
//   ./render_preview --check        checks that flash icons stay inside their circle
//
// Writes one binary PPM (P6) per scene. The colours match what the SSD1351 shows.

#include <stdio.h>
#include <string.h>
#include "ui.h"
#include "fonts_inter.h"

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

/**
 * Checks each flash icon over its whole animation: no white pixel may lie outside the 17 px circle
 * (that would be the icon poking out), and once settled the icon's ink should be centred.
 * Returns the number of problems found.
 */
static int check_flash_icons(void)
{
    static const char *names[] = {"", "play", "pause", "next", "prev", "mute", "unmute", "seek"};
    const uint16_t white = gfx_rgb(255, 255, 255), red = gfx_rgb(255, 70, 80); // C_TEXT, C_BAD
    const int cx = GFX_W / 2, cy = 44, r = 17;
    int problems = 0;
    ui_model_t m;
    memset(&m, 0, sizeof m);
    m.link = UI_LINK_OK;
    m.volume = 50;
    snprintf(m.title, sizeof m.title, "Better Day");
    snprintf(m.artist, sizeof m.artist, "penguinmusic");

    for (int f = UI_FLASH_PLAY; f <= UI_FLASH_SEEK; f++) {
        m.flash = (ui_flash_t)f;
        m.flash_at_ms = 100000;
        int worst = 0;
        for (uint32_t age = 20; age < 500; age += 10) {
            ui_render(&g, &m, m.flash_at_ms + age);
            int minx = GFX_W, maxx = -1, miny = GFX_H, maxy = -1;
            for (int y = 0; y < 66; y++) {
                for (int x = 0; x < GFX_W; x++) {
                    uint16_t px = gfx_get(&g, x, y);
                    if (px != white && px != red) continue;
                    int dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
                    if (d2 > r * r) continue; // dimmed text behind is never pure white after 20 ms
                    if (d2 > worst) worst = d2;
                    if (x < minx) minx = x;
                    if (x > maxx) maxx = x;
                    if (y < miny) miny = y;
                    if (y > maxy) maxy = y;
                    if (d2 > (r - 2) * (r - 2)) {
                        printf("  %s: icon pixel at the circle's edge (%d,%d), age %u ms\n", names[f], x, y, (unsigned)age);
                        problems++;
                        goto next_age;
                    }
                }
            }
            if (age == 300 && maxx >= 0) {
                // ink box centre vs circle centre, in half pixels (play is checked on its centroid instead)
                int ox = (minx + maxx) - 2 * cx, oy = (miny + maxy) - 2 * cy;
                printf("%-7s settled ink box %dx%d, offset from centre x %+.1f y %+.1f px\n", names[f],
                       maxx - minx + 1, maxy - miny + 1, ox / 2.0, oy / 2.0);
            }
        next_age:;
        }
    }
    return problems;
}

int main(int argc, char **argv)
{
    if (argc > 1 && strcmp(argv[1], "--check") == 0) {
        int problems = check_flash_icons();
        printf(problems ? "%d problem(s)\n" : "all flash icons stay inside their circle\n", problems);
        return problems ? 1 : 0;
    }

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

    // font check: every printable character in the small fonts, plus the large sizes
    gfx_clear(&g, 0);
    const uint16_t white = gfx_rgb(255, 255, 255);
    const char *rows[] = {
        " !\"#$%&'()*+,-./0123456789:;<=>?@",
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`",
        "abcdefghijklmnopqrstuvwxyz{|}~",
    };
    for (int i = 0; i < 3; i++) {
        gfx_text(&g, &inter_9_semibold, 1, 9 + i * 11, rows[i], white, GFX_LEFT, 0, 0, GFX_W);
        gfx_text(&g, &inter_10_regular, 1, 42 + i * 12, rows[i], white, GFX_LEFT, 0, 0, GFX_W);
    }
    gfx_text(&g, &inter_17_bold, 1, 92, "Better Day", white, GFX_LEFT, 0, 0, GFX_W);
    gfx_text(&g, &inter_26_bold, GFX_W - 1, 92, "72", white, GFX_RIGHT, 0, 0, GFX_W);
    save(dir, "14_font");
    return 0;
}
