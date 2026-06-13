#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "esp_system.h"
#include "nvs_flash.h"
#include "driver/gpio.h"
#include "sdkconfig.h"

#include "app_config.h"
#include "wifi_manager.h"
#include "config_portal.h"
#include "sensor.h"
#include "sender.h"

static const char *TAG = "main";

#define CONFIG_BUTTON_GPIO  CONFIG_NG_CONFIG_BUTTON_GPIO
#define WIFI_TIMEOUT_MS     20000

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

/**
 * Modo normal: conecta no WiFi, le o sensor e envia ao servidor
 * no intervalo configurado.
 */
static void run_normal_mode(const app_config_t *cfg)
{
    ESP_LOGI(TAG, "==> MODO NORMAL");

    ESP_ERROR_CHECK(wifi_manager_init());
    if (wifi_manager_start_sta(cfg, WIFI_TIMEOUT_MS) != ESP_OK) {
        ESP_LOGE(TAG, "Sem WiFi. Reiniciando em 10s...");
        vTaskDelay(pdMS_TO_TICKS(10000));
        esp_restart();
    }

    ESP_ERROR_CHECK(sensor_init());

    TickType_t last = xTaskGetTickCount();
    const TickType_t period = pdMS_TO_TICKS(cfg->interval_ms);

    while (true) {
        if (wifi_manager_is_connected()) {
            float db = sensor_read_db();
            sender_post_reading(cfg, db);
        } else {
            ESP_LOGW(TAG, "WiFi caiu; aguardando reconexao...");
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

    // Entra em config se o botao estiver pressionado no boot OU se ainda
    // nao houver configuracao salva.
    if (button || !cfg.provisioned) {
        if (!cfg.provisioned) {
            ESP_LOGW(TAG, "Dispositivo nao provisionado - entrando em config");
        }
        run_config_mode();   // nao retorna
    }

    run_normal_mode(&cfg);   // nao retorna
}
