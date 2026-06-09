#include "wifi_manager.h"

#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_netif.h"
#include "esp_log.h"
#include "sdkconfig.h"

static const char *TAG = "wifi";

#define WIFI_CONNECTED_BIT BIT0
#define WIFI_FAIL_BIT      BIT1
#define MAX_STA_RETRY      8

static EventGroupHandle_t s_wifi_events;
static int s_retry_count = 0;
static bool s_connected = false;
static bool s_initialized = false;

static void event_handler(void *arg, esp_event_base_t base, int32_t id, void *data)
{
    if (base == WIFI_EVENT && id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();
    } else if (base == WIFI_EVENT && id == WIFI_EVENT_STA_DISCONNECTED) {
        s_connected = false;
        if (s_retry_count < MAX_STA_RETRY) {
            s_retry_count++;
            ESP_LOGW(TAG, "Reconectando (%d/%d)...", s_retry_count, MAX_STA_RETRY);
            esp_wifi_connect();
        } else {
            xEventGroupSetBits(s_wifi_events, WIFI_FAIL_BIT);
        }
    } else if (base == IP_EVENT && id == IP_EVENT_STA_GOT_IP) {
        ip_event_got_ip_t *evt = (ip_event_got_ip_t *)data;
        ESP_LOGI(TAG, "IP obtido: " IPSTR, IP2STR(&evt->ip_info.ip));
        s_retry_count = 0;
        s_connected = true;
        xEventGroupSetBits(s_wifi_events, WIFI_CONNECTED_BIT);
    }
}

esp_err_t wifi_manager_init(void)
{
    if (s_initialized) return ESP_OK;

    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    ESP_ERROR_CHECK(esp_event_handler_instance_register(
        WIFI_EVENT, ESP_EVENT_ANY_ID, &event_handler, NULL, NULL));
    ESP_ERROR_CHECK(esp_event_handler_instance_register(
        IP_EVENT, IP_EVENT_STA_GOT_IP, &event_handler, NULL, NULL));

    s_wifi_events = xEventGroupCreate();
    s_initialized = true;
    return ESP_OK;
}

esp_err_t wifi_manager_start_sta(const app_config_t *cfg, int timeout_ms)
{
    esp_netif_create_default_wifi_sta();

    wifi_config_t wc = { 0 };
    strlcpy((char *)wc.sta.ssid, cfg->wifi_ssid, sizeof(wc.sta.ssid));
    strlcpy((char *)wc.sta.password, cfg->wifi_pass, sizeof(wc.sta.password));
    wc.sta.threshold.authmode = WIFI_AUTH_OPEN;  // aceita rede aberta ou WPA2

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wc));
    ESP_ERROR_CHECK(esp_wifi_start());

    ESP_LOGI(TAG, "Conectando a '%s'...", cfg->wifi_ssid);

    EventBits_t bits = xEventGroupWaitBits(
        s_wifi_events, WIFI_CONNECTED_BIT | WIFI_FAIL_BIT,
        pdFALSE, pdFALSE, pdMS_TO_TICKS(timeout_ms));

    if (bits & WIFI_CONNECTED_BIT) {
        return ESP_OK;
    }
    ESP_LOGE(TAG, "Falha ao conectar no WiFi");
    return ESP_FAIL;
}

esp_err_t wifi_manager_start_ap(void)
{
    esp_netif_create_default_wifi_ap();

    wifi_config_t wc = { 0 };
    strlcpy((char *)wc.ap.ssid, CONFIG_NG_AP_SSID, sizeof(wc.ap.ssid));
    wc.ap.ssid_len = strlen(CONFIG_NG_AP_SSID);
    wc.ap.max_connection = 4;
    wc.ap.channel = 1;

    const char *pass = CONFIG_NG_AP_PASSWORD;
    if (strlen(pass) >= 8) {
        strlcpy((char *)wc.ap.password, pass, sizeof(wc.ap.password));
        wc.ap.authmode = WIFI_AUTH_WPA2_PSK;
    } else {
        wc.ap.authmode = WIFI_AUTH_OPEN;  // senha curta/vazia -> AP aberto
    }

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_AP));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_AP, &wc));
    ESP_ERROR_CHECK(esp_wifi_start());

    esp_netif_ip_info_t ip;
    esp_netif_t *ap = esp_netif_get_handle_from_ifkey("WIFI_AP_DEF");
    esp_netif_get_ip_info(ap, &ip);
    ESP_LOGI(TAG, "SoftAP '%s' ativo. Conecte e acesse http://" IPSTR,
             CONFIG_NG_AP_SSID, IP2STR(&ip.ip));
    return ESP_OK;
}

bool wifi_manager_is_connected(void)
{
    return s_connected;
}
