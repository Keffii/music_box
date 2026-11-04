#include "json_lite.h"

#include <ctype.h>
#include <stdlib.h>
#include <string.h>

// Skips a JSON string starting at the opening quote; returns the char after the closing quote.
static const char *skip_string(const char *p)
{
    p++;
    while (*p && *p != '"') {
        if (*p == '\\' && p[1]) p++;
        p++;
    }
    return *p ? p + 1 : p;
}

// Finds the value for "key" at the top level of the object. Returns NULL when absent.
static const char *find_value(const char *json, const char *key)
{
    size_t klen = strlen(key);
    const char *p = json;
    int depth = 0;
    while (*p) {
        if (*p == '"') {
            const char *start = p + 1;
            const char *end = skip_string(p);
            if (depth == 1 && (size_t)(end - 1 - start) == klen && strncmp(start, key, klen) == 0) {
                const char *q = end;
                while (isspace((unsigned char)*q)) q++;
                if (*q == ':') {
                    q++;
                    while (isspace((unsigned char)*q)) q++;
                    return q;
                }
            }
            p = end;
            continue;
        }
        if (*p == '{' || *p == '[') depth++;
        else if (*p == '}' || *p == ']') depth--;
        p++;
    }
    return NULL;
}

bool json_get_string(const char *json, const char *key, char *out, size_t out_size)
{
    const char *p = find_value(json, key);
    if (!p || *p != '"' || out_size == 0) return false;
    p++;
    size_t n = 0;
    while (*p && *p != '"') {
        char c = *p++;
        if (c == '\\' && *p) {
            char e = *p++;
            switch (e) {
            case 'n': c = ' '; break;
            case 't': c = ' '; break;
            case 'u':
                // \uXXXX: keep ASCII, replace the rest (the OLED font is ASCII only)
                if (strlen(p) >= 4) {
                    char hex[5] = {p[0], p[1], p[2], p[3], 0};
                    long cp = strtol(hex, NULL, 16);
                    c = (cp >= 0x20 && cp < 0x7F) ? (char)cp : '?';
                    p += 4;
                } else {
                    c = '?';
                }
                break;
            default: c = e; break; // \" \\ \/
            }
        } else if ((unsigned char)c >= 0x80) {
            // UTF-8 multi-byte sequence: one '?' for the whole character
            while (((unsigned char)*p & 0xC0) == 0x80) p++;
            c = '?';
        }
        if (n + 1 < out_size) out[n++] = c;
    }
    out[n] = '\0';
    return true;
}

bool json_get_int(const char *json, const char *key, long *out)
{
    const char *p = find_value(json, key);
    if (!p || !(*p == '-' || isdigit((unsigned char)*p))) return false;
    *out = strtol(p, NULL, 10);
    return true;
}

bool json_get_bool(const char *json, const char *key, bool *out)
{
    const char *p = find_value(json, key);
    if (!p) return false;
    if (strncmp(p, "true", 4) == 0) { *out = true; return true; }
    if (strncmp(p, "false", 5) == 0) { *out = false; return true; }
    return false;
}
