#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "esp_system.h"
#include "esp_attr.h"
#include "nvs_flash.h"
#include "driver/gpio.h"
#include "sdkconfig.h"

#include "app_config.h"
#include "wifi_manager.h"
#include "config_portal.h"
#include "sensor.h"
#include "sender.h"
#include "status_led.h"
#include "time_sync.h"
#include "data_buffer.h"

static const char *TAG = "main";

#define CONFIG_BUTTON_GPIO  CONFIG_NG_CONFIG_BUTTON_GPIO
#define WIFI_TIMEOUT_MS     20000

// Flag em memoria RTC: sobrevive a um esp_restart() (mas nao a um power-off).
// Usado para entrar no modo de configuracao apos falha no NTP obrigatorio,
// evitando reboot-loop no modo normal.
#define FORCE_CONFIG_MAGIC  0xC0FFEE01u
RTC_DATA_ATTR static uint32_t s_force_config;

/**
 * Le o botao de configuracao (ativo em zero). Retorna true se pressionado.
 * Faz uma pequena amostragem para evitar ruido/leitura espuria.
 */
static bool config_button_pressed(void)
{
    gpio_config_t io = {
        .pin_bit_mask = 1ULL << CONFIG_BUTTON_GPIO,
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = GPIO_PULLUP_ENABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    gpio_config(&io);

    // Debounce simples: precisa estar em 0 em todas as leituras.
    for (int i = 0; i < 5; ++i) {
        if (gpio_get_level(CONFIG_BUTTON_GPIO) != 0) {
            return false;
        }
        vTaskDelay(pdMS_TO_TICKS(10));
    }
    return true;
}

/**
 * Modo de configuracao: SoftAP + portal HTTP. Nao retorna.
 */
static void run_config_mode(void)
{
    ESP_LOGI(TAG, "==> MODO DE CONFIGURACAO");
    status_led_start(STATUS_LED_CONFIG);
    ESP_ERROR_CHECK(wifi_manager_init());
    ESP_ERROR_CHECK(wifi_manager_start_ap());
    ESP_ERROR_CHECK(config_portal_start());

    ESP_LOGI(TAG, "Conecte-se ao WiFi '%s' e acesse http://192.168.4.1",
             wifi_manager_ap_ssid());

    // Fica vivo aguardando o usuario salvar (o portal reinicia a ESP).
    while (true) {
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}

// Maximo de leituras pendentes drenadas por ciclo, para nao monopolizar a
// task durante uma recuperacao longa (cada POST leva dezenas de ms).
#define FLUSH_MAX_PER_CYCLE  10

/**
 * Tenta drenar (enviar) as leituras pendentes do buffer, da mais antiga para
 * a mais nova, removendo cada uma so apos o POST ter sucesso. Para no primeiro
 * erro (servidor indisponivel) e tenta de novo no proximo ciclo.
 *
 * @return true se o buffer ficou vazio (tudo enviado).
 */
static bool flush_buffer(const app_config_t *cfg)
{
    int sent = 0;
    float db;
    int64_t ts_ms;

    while (sent < FLUSH_MAX_PER_CYCLE && data_buffer_peek_oldest(&db, &ts_ms)) {
        if (sender_post_reading(cfg, db, ts_ms) != ESP_OK) {
            break;  // servidor caiu de novo; mantem no buffer
        }
        data_buffer_pop_oldest();
        sent++;
    }

    if (sent > 0) {
        ESP_LOGI(TAG, "Flush: %d pendente(s) enviada(s); restam %u",
                 sent, (unsigned)data_buffer_count());
    }
    return data_buffer_count() == 0;
}

/**
 * Modo normal: conecta no WiFi, le o sensor e envia ao servidor
 * no intervalo configurado. Quando offline (ou servidor indisponivel),
 * armazena as leituras no buffer circular e as reenvia ao reconectar.
 */
static void run_normal_mode(const app_config_t *cfg)
{
    ESP_LOGI(TAG, "==> MODO NORMAL");
    status_led_start(STATUS_LED_NORMAL);

    ESP_ERROR_CHECK(wifi_manager_init());
    if (wifi_manager_start_sta(cfg, WIFI_TIMEOUT_MS) != ESP_OK) {
        ESP_LOGE(TAG, "Sem WiFi. Reiniciando em 10s...");
        vTaskDelay(pdMS_TO_TICKS(10000));
        esp_restart();
    }

    // Sincronismo NTP OBRIGATORIO logo apos o boot. Sem hora valida, nao
    // faz sentido carimbar leituras. Se falhar (ex.: WiFi sem internet),
    // entra no modo de configuracao no proximo boot em vez de ficar em
    // reboot-loop no modo normal.
    if (!time_sync_init(cfg->ntp_interval_s, 60000)) {
        ESP_LOGE(TAG, "Sincronismo NTP obrigatorio falhou; indo para modo de configuracao");
        s_force_config = FORCE_CONFIG_MAGIC;
        vTaskDelay(pdMS_TO_TICKS(3000));
        esp_restart();
    }

    ESP_ERROR_CHECK(sensor_init());
    data_buffer_init();

    TickType_t last = xTaskGetTickCount();
    const TickType_t period = pdMS_TO_TICKS(cfg->interval_ms);

    while (true) {
        float db = sensor_read_db();
        int64_t ts_ms = time_sync_now_ms();

        if (!wifi_manager_is_connected()) {
            // Offline: guarda para enviar depois.
            data_buffer_push(db, ts_ms);
        } else {
            // Online: drena pendentes primeiro (mantem ordem cronologica).
            bool drained = flush_buffer(cfg);
            if (!drained) {
                // Ainda ha pendentes (servidor indisponivel): enfileira a
                // atual em vez de fura-la na frente das mais antigas.
                data_buffer_push(db, ts_ms);
            } else if (sender_post_reading(cfg, db, ts_ms) != ESP_OK) {
                // Buffer vazio mas o POST da atual falhou: guarda no buffer.
                data_buffer_push(db, ts_ms);
            }
        }
        vTaskDelayUntil(&last, period);
    }
}

void app_main(void)
{
    // NVS precisa estar pronto antes de carregar a config.
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        err = nvs_flash_init();
    }
    ESP_ERROR_CHECK(err);

    app_config_t cfg;
    app_config_load(&cfg);

    bool button = config_button_pressed();
    ESP_LOGI(TAG, "Botao de config (GPIO%d) pressionado no boot: %s",
             CONFIG_BUTTON_GPIO, button ? "SIM" : "nao");

    // Le e limpa o flag de "forcar config" (one-shot) deixado por uma falha
    // de NTP no boot anterior.
    bool force_cfg = (s_force_config == FORCE_CONFIG_MAGIC);
    s_force_config = 0;

    // Entra em config se: botao pressionado, sem config salva, ou o boot
    // anterior falhou no sincronismo NTP obrigatorio.
    if (button || !cfg.provisioned || force_cfg) {
        if (force_cfg) {
            ESP_LOGW(TAG, "Falha de NTP no boot anterior - entrando em config para corrigir a rede");
        } else if (!cfg.provisioned) {
            ESP_LOGW(TAG, "Dispositivo nao provisionado - entrando em config");
        }
        run_config_mode();   // nao retorna
    }

    run_normal_mode(&cfg);   // nao retorna
}
