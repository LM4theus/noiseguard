#include "config_portal.h"

#include <stdlib.h>
#include <string.h>
#include "esp_log.h"
#include "esp_http_server.h"
#include "esp_system.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "app_config.h"

static const char *TAG = "portal";

// Pagina de configuracao. Os valores atuais sao injetados via snprintf.
static const char *PAGE_TEMPLATE =
    "<!DOCTYPE html><html lang=\"pt-br\"><head><meta charset=\"utf-8\">"
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
    "<title>NoiseGuard - Configuracao</title><style>"
    "body{font-family:system-ui,Arial,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:24px}"
    ".card{max-width:480px;margin:0 auto;background:#1e293b;border-radius:12px;padding:24px;box-shadow:0 8px 24px rgba(0,0,0,.4)}"
    "h1{font-size:20px;margin:0 0 4px}p.sub{color:#94a3b8;margin:0 0 20px;font-size:13px}"
    "label{display:block;margin:14px 0 4px;font-size:13px;color:#cbd5e1}"
    "input{width:100%;box-sizing:border-box;padding:10px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#e2e8f0;font-size:14px}"
    "button{margin-top:22px;width:100%;padding:12px;border:0;border-radius:8px;background:#22c55e;color:#052e16;font-weight:700;font-size:15px;cursor:pointer}"
    ".row{display:flex;gap:12px}.row>div{flex:1}"
    "</style></head><body><div class=\"card\">"
    "<h1>NoiseGuard</h1><p class=\"sub\">Modo de configuracao do dispositivo</p>"
    "<form method=\"POST\" action=\"/save\">"
    "<label>Rede WiFi (SSID)</label><input name=\"ssid\" value=\"%s\" maxlength=\"32\" required>"
    "<label>Senha WiFi</label><input name=\"pass\" type=\"password\" value=\"%s\" maxlength=\"64\">"
    "<label>Host / IP do servidor</label><input name=\"host\" value=\"%s\" maxlength=\"63\" required>"
    "<div class=\"row\"><div><label>Porta</label><input name=\"port\" type=\"number\" value=\"%u\" min=\"1\" max=\"65535\" required></div>"
    "<div><label>Device ID</label><input name=\"devid\" type=\"number\" value=\"%lu\" required></div></div>"
    "<label>Endpoint</label><input name=\"path\" value=\"%s\" maxlength=\"63\" required>"
    "<label>Intervalo de envio (ms)</label><input name=\"interval\" type=\"number\" value=\"%lu\" min=\"100\" required>"
    "<label>Resync NTP (s)</label><input name=\"ntpint\" type=\"number\" value=\"%lu\" min=\"15\" required>"
    "<button type=\"submit\">Salvar e reiniciar</button>"
    "</form></div></body></html>";

static const char *DONE_PAGE =
    "<!DOCTYPE html><html lang=\"pt-br\"><head><meta charset=\"utf-8\">"
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
    "<title>Salvo</title><style>body{font-family:system-ui,Arial;background:#0f172a;color:#e2e8f0;"
    "display:flex;height:100vh;align-items:center;justify-content:center;text-align:center;margin:0}"
    "</style></head><body><div><h1>Configuracao salva!</h1>"
    "<p>O dispositivo vai reiniciar e conectar a rede.</p></div></body></html>";

/* ---- utilitarios de parsing de form url-encoded ---- */

// Decodifica %XX e '+' in-place.
static void url_decode(char *s)
{
    char *o = s;
    for (char *p = s; *p; ++p) {
        if (*p == '+') {
            *o++ = ' ';
        } else if (*p == '%' && p[1] && p[2]) {
            char hex[3] = { p[1], p[2], 0 };
            *o++ = (char)strtol(hex, NULL, 16);
            p += 2;
        } else {
            *o++ = *p;
        }
    }
    *o = '\0';
}

// Extrai o valor do campo `key` de um corpo url-encoded para `out`.
static bool form_get(const char *body, const char *key, char *out, size_t out_len)
{
    size_t klen = strlen(key);
    const char *p = body;
    while (p && *p) {
        if (strncmp(p, key, klen) == 0 && p[klen] == '=') {
            const char *val = p + klen + 1;
            const char *end = strchr(val, '&');
            size_t len = end ? (size_t)(end - val) : strlen(val);
            if (len >= out_len) len = out_len - 1;
            memcpy(out, val, len);
            out[len] = '\0';
            url_decode(out);
            return true;
        }
        p = strchr(p, '&');
        if (p) p++;
    }
    return false;
}

/* ---- handlers ---- */

static esp_err_t root_get(httpd_req_t *req)
{
    app_config_t cfg;
    app_config_load(&cfg);

    char *page = malloc(3072);
    if (!page) return httpd_resp_send_500(req);

    snprintf(page, 3072, PAGE_TEMPLATE,
             cfg.wifi_ssid, cfg.wifi_pass, cfg.server_host,
             cfg.server_port, (unsigned long)cfg.device_id,
             cfg.server_path, (unsigned long)cfg.interval_ms,
             (unsigned long)cfg.ntp_interval_s);

    httpd_resp_set_type(req, "text/html");
    esp_err_t err = httpd_resp_send(req, page, HTTPD_RESP_USE_STRLEN);
    free(page);
    return err;
}

static void reboot_task(void *arg)
{
    vTaskDelay(pdMS_TO_TICKS(1500));
    esp_restart();
}

static esp_err_t save_post(httpd_req_t *req)
{
    int total = req->content_len;
    if (total <= 0 || total > 1024) {
        return httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "corpo invalido");
    }

    char *body = malloc(total + 1);
    if (!body) return httpd_resp_send_500(req);

    int received = 0;
    while (received < total) {
        int r = httpd_req_recv(req, body + received, total - received);
        if (r <= 0) {
            free(body);
            return httpd_resp_send_500(req);
        }
        received += r;
    }
    body[total] = '\0';

    app_config_t cfg;
    app_config_load(&cfg);  // parte dos defaults atuais

    char tmp[NG_PASS_MAX_LEN];

    if (form_get(body, "ssid", cfg.wifi_ssid, sizeof(cfg.wifi_ssid))) { /* ok */ }
    form_get(body, "pass", cfg.wifi_pass, sizeof(cfg.wifi_pass));
    form_get(body, "host", cfg.server_host, sizeof(cfg.server_host));
    form_get(body, "path", cfg.server_path, sizeof(cfg.server_path));

    if (form_get(body, "port", tmp, sizeof(tmp))) {
        cfg.server_port = (uint16_t)atoi(tmp);
    }
    if (form_get(body, "devid", tmp, sizeof(tmp))) {
        cfg.device_id = (uint32_t)strtoul(tmp, NULL, 10);
    }
    if (form_get(body, "interval", tmp, sizeof(tmp))) {
        cfg.interval_ms = (uint32_t)strtoul(tmp, NULL, 10);
        if (cfg.interval_ms < 100) cfg.interval_ms = 100;
    }
    if (form_get(body, "ntpint", tmp, sizeof(tmp))) {
        cfg.ntp_interval_s = (uint32_t)strtoul(tmp, NULL, 10);
        if (cfg.ntp_interval_s < 15) cfg.ntp_interval_s = 15;
    }

    free(body);

    esp_err_t err = app_config_save(&cfg);
    if (err != ESP_OK) {
        return httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "falha ao salvar");
    }

    httpd_resp_set_type(req, "text/html");
    httpd_resp_send(req, DONE_PAGE, HTTPD_RESP_USE_STRLEN);

    ESP_LOGI(TAG, "Config salva pelo portal; reiniciando...");
    xTaskCreate(reboot_task, "reboot", 2048, NULL, 5, NULL);
    return ESP_OK;
}

esp_err_t config_portal_start(void)
{
    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    config.stack_size = 8192;

    httpd_handle_t server = NULL;
    esp_err_t err = httpd_start(&server, &config);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "httpd_start falhou: %s", esp_err_to_name(err));
        return err;
    }

    httpd_uri_t root = { .uri = "/", .method = HTTP_GET, .handler = root_get };
    httpd_uri_t save = { .uri = "/save", .method = HTTP_POST, .handler = save_post };
    httpd_register_uri_handler(server, &root);
    httpd_register_uri_handler(server, &save);

    ESP_LOGI(TAG, "Portal de configuracao no ar (GET / e POST /save)");
    return ESP_OK;
}
