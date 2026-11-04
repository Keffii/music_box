#pragma once
#include <stdint.h>

/** Five column bytes for an ASCII character (bit 0 = top row, bit 7 = descender row).
 *  Glyphs are 5 wide and up to 8 tall. Unknown characters map to '?'. */
const uint8_t *font5x7_glyph(char c);
