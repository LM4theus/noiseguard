#include "status_led.h"

#include <stddef.h>
#include <stdint.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "sdkconfig.h"

static const char *TAG = "status_led";

// Pinos acionados em paralelo, com o mesmo padrao. -1 desabilita um pino.
static const int LED_GPIOS[] = {
    CONFIG_NG_STATUS_LED_GPIO,
    CONFIG_NG_STATUS_LED_GPIO2,
};
#define LED_GPIO_COUNT  (sizeof(LED_GPIOS) / sizeof(LED_GPIOS[0]))

typedef struct {
    uint8_t  level;   // 1 = HIGH, 0 = LOW
    uint32_t ms;      // duracao do passo
} led_step_t;

// Modo de configuracao: 3 piscadas rapidas e uma pausa longa.
static const led_step_t CONFIG_PATTERN[] = {
    { 1, 200 }, { 0, 200 },
    { 1, 200 }, { 0, 200 },
    { 1, 200 }, { 0, 1000 },
};

// Modo normal: piscada lenta.
static const led_step_t NORMAL_PATTERN[] = {
    { 1, 500 }, { 0, 1500 },
};

static const led_step_t *s_pattern;
static size_t s_pattern_len;

static void leds_set(uint8_t level)
{
    for (size_t i = 0; i < LED_GPIO_COUNT; ++i) {
        if (LED_GPIOS[i] >= 0) {
            gpio_set_level(LED_GPIOS[i], level);
        }
    }
}

static void led_task(void *arg)
{
    while (true) {
        for (size_t i = 0; i < s_pattern_len; ++i) {
            leds_set(s_pattern[i].level);
            vTaskDelay(pdMS_TO_TICKS(s_pattern[i].ms));
        }
    }
}

void status_led_start(status_led_mode_t mode)
{
    uint64_t mask = 0;
    for (size_t i = 0; i < LED_GPIO_COUNT; ++i) {
        if (LED_GPIOS[i] >= 0) {
            mask |= 1ULL << LED_GPIOS[i];
        }
    }

    gpio_config_t io = {
        .pin_bit_mask = mask,
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    gpio_config(&io);
    leds_set(0);

    if (mode == STATUS_LED_CONFIG) {
        s_pattern = CONFIG_PATTERN;
        s_pattern_len = sizeof(CONFIG_PATTERN) / sizeof(CONFIG_PATTERN[0]);
    } else {
        s_pattern = NORMAL_PATTERN;
        s_pattern_len = sizeof(NORMAL_PATTERN) / sizeof(NORMAL_PATTERN[0]);
    }

    xTaskCreate(led_task, "status_led", 2048, NULL, 3, NULL);
    ESP_LOGI(TAG, "LED de status nos GPIO%d e GPIO%d (modo %s)",
             CONFIG_NG_STATUS_LED_GPIO, CONFIG_NG_STATUS_LED_GPIO2,
             mode == STATUS_LED_CONFIG ? "config" : "normal");
}
