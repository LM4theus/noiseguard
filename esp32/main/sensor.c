#include "sensor.h"

#include <math.h>
#include "esp_log.h"
#include "esp_adc/adc_oneshot.h"
#include "esp_adc/adc_cali.h"
#include "esp_adc/adc_cali_scheme.h"
#include "adc1.h"
#include "sdkconfig.h"

static const char *TAG = "sensor";

#define SAMPLE_COUNT   512          // amostras por leitura (janela de RMS)
#define DB_MIN         30.0f
#define DB_MAX         140.0f

// Offset de calibracao. Ajuste conforme o seu microfone/circuito.
// dB = 20*log10(rms_mV) + DB_CAL_OFFSET
#define DB_CAL_OFFSET  26.0f

static adc_oneshot_unit_handle_t s_adc = NULL;
static adc_cali_handle_t s_cali = NULL;
static bool s_cali_ok = false;
static const adc_channel_t s_channel = CONFIG_NG_ADC_CHANNEL;

esp_err_t sensor_init(void)
{
    s_adc = adc1_get_unit();
    if (s_adc == NULL) {
        ESP_LOGE(TAG, "ADC1 indisponivel");
        return ESP_FAIL;
    }

    adc_oneshot_chan_cfg_t chan_cfg = {
        .atten = ADC_ATTEN_DB_12,             // ~0..3.1V (substitui o antigo DB_11)
        .bitwidth = ADC_BITWIDTH_DEFAULT,     // 12 bits no ESP32
    };
    esp_err_t err = adc_oneshot_config_channel(s_adc, s_channel, &chan_cfg);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "config_channel falhou: %s", esp_err_to_name(err));
        return err;
    }

    // Calibracao (line fitting no ESP32). Se falhar, usamos valores brutos.
    adc_cali_line_fitting_config_t cali_cfg = {
        .unit_id = ADC_UNIT_1,
        .atten = ADC_ATTEN_DB_12,
        .bitwidth = ADC_BITWIDTH_DEFAULT,
    };
    if (adc_cali_create_scheme_line_fitting(&cali_cfg, &s_cali) == ESP_OK) {
        s_cali_ok = true;
        ESP_LOGI(TAG, "Calibracao ADC habilitada (line fitting)");
    } else {
        ESP_LOGW(TAG, "Calibracao ADC indisponivel - usando leitura bruta");
    }

    ESP_LOGI(TAG, "Sensor inicializado no ADC1 canal %d", (int)s_channel);
    return ESP_OK;
}

static inline int raw_to_mv(int raw)
{
    int mv = raw;
    if (s_cali_ok) {
        if (adc_cali_raw_to_voltage(s_cali, raw, &mv) != ESP_OK) {
            mv = raw;  // fallback
        }
    }
    return mv;
}

float sensor_read_db(void)
{
    double sum = 0.0;
    double sum_sq = 0.0;
    int n = 0;

    // 1a passada: media (componente DC do sinal)
    int samples[SAMPLE_COUNT];
    for (int i = 0; i < SAMPLE_COUNT; ++i) {
        int raw = 0;
        if (adc_oneshot_read(s_adc, s_channel, &raw) != ESP_OK) {
            continue;
        }
        int mv = raw_to_mv(raw);
        samples[n++] = mv;
        sum += mv;
    }

    if (n == 0) {
        ESP_LOGW(TAG, "Nenhuma amostra lida");
        return DB_MIN;
    }

    double mean = sum / n;

    // 2a passada: RMS em torno da media (parte AC = sinal acustico)
    for (int i = 0; i < n; ++i) {
        double d = (double)samples[i] - mean;
        sum_sq += d * d;
    }
    double rms = sqrt(sum_sq / n);  // em mV

    // Converte para dB. log10(0) -> evita com +1.
    float db = 20.0f * log10f((float)rms + 1.0f) + DB_CAL_OFFSET;

    if (db < DB_MIN) db = DB_MIN;
    if (db > DB_MAX) db = DB_MAX;

    ESP_LOGD(TAG, "rms=%.1fmV -> %.1f dB", rms, db);
    return db;
}
