#include "api.h"

#include <stdio.h>
#include <string.h>
#include "esp_http_client.h"
#include "esp_log.h"
#include "json_lite.h"
#include "sdkconfig.h"

static const char *TAG = "api";

#define RESP_MAX 2048   // the state with equalizer frames is about 750 bytes

typedef struct {
    char buf[RESP_MAX];
    char *dst;      // where the body goes: buf for JSON, or the caller's buffer for a cover
    int cap;        // room in dst
    int len;
} response_t;

static esp_http_client_handle_t s_client;
static response_t s_resp;
static char s_url_state[160];
static char s_url_command[160];

static esp_err_t on_http_event(esp_http_client_event_t *ev)
{
    if (ev->event_id == HTTP_EVENT_ON_DATA) {
        response_t *r = (response_t *)ev->user_data;
        int room = r->cap - r->len;
        int n = ev->data_len < room ? ev->data_len : room;
        if (n > 0) memcpy(r->dst + r->len, ev->data, n);
        r->len += ev->data_len; // counts everything, so a body that didn't fit can be told apart
    }
    return ESP_OK;
}

static void create_client(void)
{
    esp_http_client_config_t cfg = {
        .url = s_url_state,
        .event_handler = on_http_event,
        .user_data = &s_resp,
        .timeout_ms = 2500,
        .keep_alive_enable = true,
    };
    s_client = esp_http_client_init(&cfg);
    esp_http_client_set_header(s_client, "X-Device-Key", CONFIG_MUSICBOX_DEVICE_KEY);
    esp_http_client_set_header(s_client, "Accept", "application/json");
}

void api_init(void)
{
    snprintf(s_url_state, sizeof s_url_state, "%s/api/device/state", CONFIG_MUSICBOX_SERVER_URL);
    snprintf(s_url_command, sizeof s_url_command, "%s/api/device/command", CONFIG_MUSICBOX_SERVER_URL);
    create_client();
}

static void parse(const char *json, api_state_t *out)
{
    long v;
    json_get_string(json, "title", out->title, sizeof out->title);
    json_get_string(json, "artist", out->artist, sizeof out->artist);
    json_get_string(json, "category", out->category, sizeof out->category);
    json_get_bool(json, "isPlaying", &out->playing);
    json_get_bool(json, "isMuted", &out->muted);
    json_get_bool(json, "shuffle", &out->shuffle);
    json_get_bool(json, "repeat", &out->repeat);
    if (json_get_int(json, "volume", &v)) out->volume = (int)v;
    if (json_get_int(json, "seq", &v)) out->seq = v;
    // Optional, from newer backends: the progress bar is empty without them
    out->position_ms = json_get_int(json, "positionMs", &v) && v > 0 ? v : 0;
    out->duration_ms = json_get_int(json, "durationMs", &v) && v > 0 ? v : 0;
    out->song_id = json_get_int(json, "songId", &v) && v > 0 ? v : 0;

    // Optional, from newer backends: whole frames of 16 hex digits, else none
    out->eq_fps = json_get_int(json, "eqFps", &v) && v > 0 && v <= 100 ? (int)v : 0;
    out->eq_from = json_get_int(json, "eqFrom", &v) && v >= 0 ? v : -1;
    if (!out->eq_fps || !json_get_string(json, "eq", out->eq, sizeof out->eq) || strlen(out->eq) % 16 != 0) {
        out->eq[0] = '\0';
    }
}

/** Sends the request; the body lands in s_resp.dst. Returns the HTTP status, or -1 on a network error. */
static int perform(esp_http_client_method_t method, const char *url, const char *body)
{
    s_resp.len = 0;
    esp_http_client_set_url(s_client, url);
    esp_http_client_set_method(s_client, method);
    if (body) {
        esp_http_client_set_header(s_client, "Content-Type", "application/json");
        esp_http_client_set_post_field(s_client, body, (int)strlen(body));
    } else {
        esp_http_client_delete_header(s_client, "Content-Type");
        esp_http_client_set_post_field(s_client, NULL, 0);
    }

    esp_err_t err = esp_http_client_perform(s_client);
    if (err != ESP_OK) {
        // a dropped keep-alive connection: start over with a fresh client next time
        ESP_LOGW(TAG, "%s failed: %s", url, esp_err_to_name(err));
        esp_http_client_cleanup(s_client);
        create_client();
        return -1;
    }
    return esp_http_client_get_status_code(s_client);
}

static esp_err_t request(esp_http_client_method_t method, const char *url, const char *body, api_state_t *out)
{
    s_resp.dst = s_resp.buf;
    s_resp.cap = RESP_MAX - 1;
    int status = perform(method, url, body);
    if (status < 0) return ESP_FAIL;
    if (status != 200) {
        ESP_LOGW(TAG, "%s returned HTTP %d%s", url, status,
                 status == 401 || status == 403 ? " (check the device key)" : "");
        return ESP_FAIL;
    }
    if (s_resp.len > s_resp.cap) s_resp.len = s_resp.cap; // too long: parse what fitted
    s_resp.buf[s_resp.len] = '\0';
    parse(s_resp.buf, out);
    return ESP_OK;
}

esp_err_t api_get_cover(long song_id, int size, uint8_t *out, size_t out_len)
{
    char url[200];
    snprintf(url, sizeof url, "%s/api/device/cover/%ld?size=%d", CONFIG_MUSICBOX_SERVER_URL, song_id, size);
    s_resp.dst = (char *)out;
    s_resp.cap = (int)out_len;
    esp_http_client_set_header(s_client, "Accept", "application/octet-stream");
    int status = perform(HTTP_METHOD_GET, url, NULL);
    esp_http_client_set_header(s_client, "Accept", "application/json");
    if (status == 404) return ESP_ERR_NOT_FOUND; // the song has no cover (or an older backend)
    if (status != 200 || s_resp.len != (int)out_len) {
        ESP_LOGW(TAG, "cover %ld: HTTP %d, %d bytes", song_id, status, s_resp.len);
        return ESP_FAIL;
    }
    return ESP_OK;
}

esp_err_t api_get_state(api_state_t *out)
{
    return request(HTTP_METHOD_GET, s_url_state, NULL, out);
}

esp_err_t api_send_command(const char *command, api_state_t *out)
{
    char body[48];
    snprintf(body, sizeof body, "{\"command\":\"%s\"}", command);
    return request(HTTP_METHOD_POST, s_url_command, body, out);
}
