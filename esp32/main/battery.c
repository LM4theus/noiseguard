#include "battery.h"

#include "sdkconfig.h"

#if CONFIG_NG_BATTERY_ENABLE

#include "esp_log.h"
#include "esp_adc/adc_oneshot.h"
#include "esp_adc/adc_cali.h"
#include "esp_adc/adc_cali_scheme.h"
#include "adc1.h"

static const char *TAG = "battery";

#define SAMPLE_COUNT  64

static adc_oneshot_unit_handle_t s_adc = NULL;
static adc_cali_handle_t s_cali = NULL;
static bool s_cali_ok = false;
static const adc_channel_t s_channel = CONFIG_NG_BATT_ADC_CHANNEL;

esp_err_t battery_init(void)
{
    s_adc = adc1_get_unit();
    if (s_adc == NULL) {
        ESP_LOGE(TAG, "ADC1 indisponivel");
        return ESP_FAIL;
    }

    adc_oneshot_chan_cfg_t chan_cfg = {
        .atten = ADC_ATTEN_DB_12,
        .bitwidth = ADC_BITWIDTH_DEFAULT,
    };
    esp_err_t err = adc_oneshot_config_channel(s_adc, s_channel, &chan_cfg);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "config_channel (bateria) falhou: %s", esp_err_to_name(err));
        return err;
    }

    adc_cali_line_fitting_config_t cali_cfg = {
        .unit_id = ADC_UNIT_1,
        .atten = ADC_ATTEN_DB_12,
        .bitwidth = ADC_BITWIDTH_DEFAULT,
    };
    s_cali_ok = (adc_cali_create_scheme_line_fitting(&cali_cfg, &s_cali) == ESP_OK);

    ESP_LOGI(TAG, "Bateria no ADC1 canal %d (divisor x%d/100, faixa %d-%d mV)",
             (int)s_channel, CONFIG_NG_BATT_DIVIDER_X100,
             CONFIG_NG_BATT_MIN_MV, CONFIG_NG_BATT_MAX_MV);
    return ESP_OK;
}

int battery_read_mv(void)
{
    if (s_adc == NULL) return 0;

    long acc = 0;
    int n = 0;
    for (int i = 0; i < SAMPLE_COUNT; ++i) {
        int raw = 0;
        if (adc_oneshot_read(s_adc, s_channel, &raw) != ESP_OK) {
            continue;
        }
        int mv = raw;
        if (s_cali_ok) {
            adc_cali_raw_to_voltage(s_cali, raw, &mv);
        }
        acc += mv;
        n++;
    }
    if (n == 0) return 0;

    int adc_mv = (int)(acc / n);
    // Reverte o divisor resistivo: Vbat = Vadc * (x/100).
    return adc_mv * CONFIG_NG_BATT_DIVIDER_X100 / 100;
}

int battery_percent(void)
{
    int mv = battery_read_mv();
    const int lo = CONFIG_NG_BATT_MIN_MV;
    const int hi = CONFIG_NG_BATT_MAX_MV;
    if (hi <= lo) return 0;

    int pct = (mv - lo) * 100 / (hi - lo);
    if (pct < 0) pct = 0;
    if (pct > 100) pct = 100;
    return pct;
}

#else  /* !CONFIG_NG_BATTERY_ENABLE: stubs seguros */

esp_err_t battery_init(void) { return ESP_OK; }
int battery_read_mv(void)    { return 0; }
int battery_percent(void)    { return -1; }  // -1 => omitido no JSON

#endif /* CONFIG_NG_BATTERY_ENABLE */
