#pragma once

#include <stdint.h>
#include <stdbool.h>
#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

#define NG_SSID_MAX_LEN      33   // 32 + '\0'
#define NG_PASS_MAX_LEN      65   // 64 + '\0'
#define NG_HOST_MAX_LEN      64
#define NG_PATH_MAX_LEN      64

/**
 * Configuracao do dispositivo, persistida em NVS.
 */
typedef struct {
    char     wifi_ssid[NG_SSID_MAX_LEN];
    char     wifi_pass[NG_PASS_MAX_LEN];
    char     server_host[NG_HOST_MAX_LEN];
    uint16_t server_port;
    char     server_path[NG_PATH_MAX_LEN];
    uint32_t device_id;
    uint32_t interval_ms;
    uint32_t ntp_interval_s;   // intervalo de resync NTP, em segundos
    bool     provisioned;      // true quando o usuario ja salvou uma config valida
} app_config_t;

/**
 * Carrega a configuracao da NVS. Campos ausentes recebem os defaults
 * definidos em Kconfig. Sempre retorna uma struct utilizavel.
 */
void app_config_load(app_config_t *cfg);

/**
 * Persiste a configuracao na NVS. Marca provisioned = true.
 */
esp_err_t app_config_save(const app_config_t *cfg);

/**
 * Apaga a configuracao salva (volta para o estado nao-provisionado).
 */
esp_err_t app_config_erase(void);

#ifdef __cplusplus
}
#endif
