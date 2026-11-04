#pragma once
// Minimal SSD1351 driver for the Waveshare 1.27" 128x96 RGB OLED over SPI.

#include "esp_err.h"
#include "gfx.h"

esp_err_t ssd1351_init(void);
/** Sends the whole framebuffer to the panel (about 12 ms at 16 MHz). */
esp_err_t ssd1351_flush(const gfx_t *fb);
