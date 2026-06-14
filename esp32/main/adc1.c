#include "adc1.h"

#include "esp_log.h"

static const char *TAG = "adc1";

static adc_oneshot_unit_handle_t s_unit = NULL;

adc_oneshot_unit_handle_t adc1_get_unit(void)
{
    if (s_unit == NULL) {
        adc_oneshot_unit_init_cfg_t cfg = {
            .unit_id = ADC_UNIT_1,
        };
        esp_err_t err = adc_oneshot_new_unit(&cfg, &s_unit);
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "adc_oneshot_new_unit falhou: %s", esp_err_to_name(err));
            s_unit = NULL;
        }
    }
    return s_unit;
}
