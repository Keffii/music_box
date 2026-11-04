#pragma once
// Reads fields from a flat JSON object such as {"title":"Better Day","volume":72,"isPlaying":true}.
// Enough for the device API's responses, with no allocations. Nested values are not supported.

#include <stdbool.h>
#include <stddef.h>

/** Copies a string field (unescaped, non-ASCII replaced by '?') into out. False if missing. */
bool json_get_string(const char *json, const char *key, char *out, size_t out_size);
bool json_get_int(const char *json, const char *key, long *out);
bool json_get_bool(const char *json, const char *key, bool *out);
