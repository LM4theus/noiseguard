#include "sender.h"

#include <stdio.h>
#include <string.h>
#include "esp_log.h"
#include "esp_http_client.h"

static const char *TAG = "sender";

esp_err_t sender_post_reading(const app_config_t *cfg, float db, int64_t ts_ms)
{
    char url[160];
    const char *path = cfg->server_path[0] ? cfg->server_path : "/api/noise";
    // Garante a barra inicial no path.
    if (path[0] == '/') {
        snprintf(url, sizeof(url), "http://%s:%u%s",
                 cfg->server_host, cfg->server_port, path);
    } else {
        snprintf(url, sizeof(url), "http://%s:%u/%s",
                 cfg->server_host, cfg->server_port, path);
    }

    // O servidor NoiseGuard valida "db" como numero (0..140), por isso
    // enviamos o valor numerico (e nao string). O "timestamp" (epoch ms,
    // igual a Date.now()) e o da leitura: para leituras bufferizadas, e a
    // hora original em que foram capturadas. ts_ms <= 0 omite o campo (o
    // servidor entao carimba a hora ao receber).
    char body[128];
    int body_len;
    if (ts_ms > 0) {
        body_len = snprintf(body, sizeof(body),
                            "{\"deviceid\":%lu,\"db\":%.1f,\"timestamp\":%lld}",
                            (unsigned long)cfg->device_id, db, (long long)ts_ms);
    } else {
        body_len = snprintf(body, sizeof(body),
                            "{\"deviceid\":%lu,\"db\":%.1f}",
                            (unsigned long)cfg->device_id, db);
    }

    esp_http_client_config_t http_cfg = {
        .url = url,
        .method = HTTP_METHOD_POST,
        .timeout_ms = 5000,
    };
    esp_http_client_handle_t client = esp_http_client_init(&http_cfg);
    if (!client) {
        ESP_LOGE(TAG, "Falha ao criar cliente HTTP");
        return ESP_FAIL;
    }

    esp_http_client_set_header(client, "Content-Type", "application/json");
    esp_http_client_set_post_field(client, body, body_len);

    esp_err_t err = esp_http_client_perform(client);
    if (err == ESP_OK) {
        int status = esp_http_client_get_status_code(client);
        if (status >= 200 && status < 300) {
            ESP_LOGI(TAG, "POST %s -> %d  body=%s", url, status, body);
        } else {
            ESP_LOGW(TAG, "POST %s -> HTTP %d  body=%s", url, status, body);
            err = ESP_FAIL;
        }
    } else {
        ESP_LOGE(TAG, "POST %s falhou: %s", url, esp_err_to_name(err));
    }

    esp_http_client_cleanup(client);
    return err;
}
