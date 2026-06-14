#include "time_sync.h"

#include <time.h>
#include <sys/time.h>
#include "esp_log.h"
#include "esp_netif_sntp.h"
#include "esp_sntp.h"

static const char *TAG = "time_sync";

// Limiar de "hora plausivel": 1700000000 ~ 2023-11-14. Antes disso,
// consideramos que o relogio ainda nao foi sincronizado.
#define TIME_VALID_THRESHOLD  1700000000

static void log_current_time(void)
{
    time_t now = time(NULL);
    struct tm tm_utc;
    gmtime_r(&now, &tm_utc);
    char buf[32];
    strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S", &tm_utc);
    ESP_LOGI(TAG, "Relogio sincronizado (UTC): %s", buf);
}

bool time_sync_init(uint32_t interval_s, int total_wait_ms)
{
    esp_sntp_config_t config = ESP_NETIF_SNTP_DEFAULT_CONFIG("pool.ntp.org");
    esp_err_t err = esp_netif_sntp_init(&config);
    if (err != ESP_OK && err != ESP_ERR_INVALID_STATE) {
        ESP_LOGE(TAG, "esp_netif_sntp_init falhou: %s", esp_err_to_name(err));
        return false;
    }

    // Aplica o intervalo de resync configurado (lwip exige >= 15s).
    uint32_t ms = interval_s * 1000;
    if (ms < 15000) ms = 15000;
    esp_sntp_set_sync_interval(ms);
    esp_sntp_restart();

    // Sincronismo obrigatorio: aguarda em janelas ate sincronizar ou estourar.
    const int step_ms = 5000;
    int waited = 0;
    while (waited < total_wait_ms) {
        int slice = (total_wait_ms - waited) < step_ms ? (total_wait_ms - waited) : step_ms;
        esp_netif_sntp_sync_wait(pdMS_TO_TICKS(slice));
        if (time_sync_is_valid()) {
            log_current_time();
            ESP_LOGI(TAG, "Resync NTP a cada %lus", (unsigned long)(ms / 1000));
            return true;
        }
        waited += slice;
        ESP_LOGW(TAG, "Aguardando NTP obrigatorio... (%d/%d ms)", waited, total_wait_ms);
    }
    ESP_LOGE(TAG, "Falha no sincronismo NTP obrigatorio apos %d ms", total_wait_ms);
    return false;
}

bool time_sync_is_valid(void)
{
    return time(NULL) > TIME_VALID_THRESHOLD;
}

int64_t time_sync_now_ms(void)
{
    struct timeval tv;
    gettimeofday(&tv, NULL);
    return (int64_t)tv.tv_sec * 1000 + tv.tv_usec / 1000;
}
