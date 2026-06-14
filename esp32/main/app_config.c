#include "app_config.h"

#include <string.h>
#include "nvs_flash.h"
#include "nvs.h"
#include "esp_log.h"
#include "sdkconfig.h"

static const char *TAG = "app_config";
static const char *NVS_NAMESPACE = "noiseguard";

static void load_str(nvs_handle_t h, const char *key, char *out, size_t out_len,
                     const char *def)
{
    size_t len = out_len;
    if (nvs_get_str(h, key, out, &len) != ESP_OK) {
        strlcpy(out, def, out_len);
    }
}

void app_config_load(app_config_t *cfg)
{
    // Defaults vindos do menuconfig.
    memset(cfg, 0, sizeof(*cfg));
    strlcpy(cfg->server_host, CONFIG_NG_DEFAULT_SERVER_HOST, sizeof(cfg->server_host));
    strlcpy(cfg->server_path, CONFIG_NG_DEFAULT_SERVER_PATH, sizeof(cfg->server_path));
    cfg->server_port = CONFIG_NG_DEFAULT_SERVER_PORT;
    cfg->device_id      = CONFIG_NG_DEFAULT_DEVICE_ID;
    cfg->interval_ms    = CONFIG_NG_DEFAULT_INTERVAL_MS;
    cfg->ntp_interval_s = CONFIG_NG_DEFAULT_NTP_INTERVAL_S;
    cfg->provisioned    = false;

    nvs_handle_t h;
    esp_err_t err = nvs_open(NVS_NAMESPACE, NVS_READONLY, &h);
    if (err != ESP_OK) {
        ESP_LOGI(TAG, "Sem configuracao salva (%s) - usando defaults", esp_err_to_name(err));
        return;
    }

    load_str(h, "ssid", cfg->wifi_ssid, sizeof(cfg->wifi_ssid), "");
    load_str(h, "pass", cfg->wifi_pass, sizeof(cfg->wifi_pass), "");
    load_str(h, "host", cfg->server_host, sizeof(cfg->server_host), cfg->server_host);
    load_str(h, "path", cfg->server_path, sizeof(cfg->server_path), cfg->server_path);

    uint16_t u16;
    if (nvs_get_u16(h, "port", &u16) == ESP_OK) cfg->server_port = u16;

    uint32_t u32;
    if (nvs_get_u32(h, "devid", &u32) == ESP_OK) cfg->device_id = u32;
    if (nvs_get_u32(h, "interval", &u32) == ESP_OK) cfg->interval_ms = u32;
    if (nvs_get_u32(h, "ntpint", &u32) == ESP_OK) cfg->ntp_interval_s = u32;

    uint8_t prov = 0;
    if (nvs_get_u8(h, "prov", &prov) == ESP_OK) cfg->provisioned = (prov != 0);

    nvs_close(h);

    ESP_LOGI(TAG, "Config carregada: ssid='%s' host=%s:%u path=%s devid=%lu intervalo=%lums ntp=%lus prov=%d",
             cfg->wifi_ssid, cfg->server_host, cfg->server_port, cfg->server_path,
             (unsigned long)cfg->device_id, (unsigned long)cfg->interval_ms,
             (unsigned long)cfg->ntp_interval_s, cfg->provisioned);
}

esp_err_t app_config_save(const app_config_t *cfg)
{
    nvs_handle_t h;
    esp_err_t err = nvs_open(NVS_NAMESPACE, NVS_READWRITE, &h);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "nvs_open falhou: %s", esp_err_to_name(err));
        return err;
    }

    err  = nvs_set_str(h, "ssid", cfg->wifi_ssid);
    err |= nvs_set_str(h, "pass", cfg->wifi_pass);
    err |= nvs_set_str(h, "host", cfg->server_host);
    err |= nvs_set_str(h, "path", cfg->server_path);
    err |= nvs_set_u16(h, "port", cfg->server_port);
    err |= nvs_set_u32(h, "devid", cfg->device_id);
    err |= nvs_set_u32(h, "interval", cfg->interval_ms);
    err |= nvs_set_u32(h, "ntpint", cfg->ntp_interval_s);
    err |= nvs_set_u8(h, "prov", 1);

    if (err == ESP_OK) {
        err = nvs_commit(h);
    }
    nvs_close(h);

    if (err == ESP_OK) {
        ESP_LOGI(TAG, "Configuracao salva com sucesso");
    } else {
        ESP_LOGE(TAG, "Falha ao salvar configuracao: %s", esp_err_to_name(err));
    }
    return err;
}

esp_err_t app_config_erase(void)
{
    nvs_handle_t h;
    esp_err_t err = nvs_open(NVS_NAMESPACE, NVS_READWRITE, &h);
    if (err != ESP_OK) return err;
    err = nvs_erase_all(h);
    if (err == ESP_OK) err = nvs_commit(h);
    nvs_close(h);
    return err;
}
