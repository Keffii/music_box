#include "api.h"

#include <stdio.h>
#include <string.h>
#include "esp_http_client.h"
#include "esp_log.h"
#include "json_lite.h"
#include "sdkconfig.h"

static const char *TAG = "api";

#define RESP_MAX 1024

typedef struct {
    char buf[RESP_MAX];
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
        int room = RESP_MAX - 1 - r->len;
        int n = ev->data_len < room ? ev->data_len : room;
        if (n > 0) {
            memcpy(r->buf + r->len, ev->data, n);
            r->len += n;
        }
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
    json_get_bool(json, "isPlaying", &out->playing);
    json_get_bool(json, "isMuted", &out->muted);
    json_get_bool(json, "shuffle", &out->shuffle);
    json_get_bool(json, "repeat", &out->repeat);
    if (json_get_int(json, "volume", &v)) out->volume = (int)v;
    if (json_get_int(json, "seq", &v)) out->seq = v;
}

static esp_err_t request(esp_http_client_method_t method, const char *url, const char *body, api_state_t *out)
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
        return err;
    }
    int status = esp_http_client_get_status_code(s_client);
    if (status != 200) {
        ESP_LOGW(TAG, "%s returned HTTP %d%s", url, status,
                 status == 401 || status == 403 ? " (check the device key)" : "");
        return ESP_FAIL;
    }
    s_resp.buf[s_resp.len] = '\0';
    parse(s_resp.buf, out);
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
