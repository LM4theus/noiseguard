#pragma once

#include <stdbool.h>
#include "esp_err.h"
#include "app_config.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Inicializa a stack TCP/IP, o loop de eventos e o WiFi (uma unica vez).
 * Deve ser chamado antes de wifi_manager_start_sta / config_portal_start.
 */
esp_err_t wifi_manager_init(void);

/**
 * Conecta como estacao (STA) usando as credenciais da config.
 * Bloqueia ate obter IP ou estourar o timeout.
 *
 * @return ESP_OK se conectou e obteve IP; erro caso contrario.
 */
esp_err_t wifi_manager_start_sta(const app_config_t *cfg, int timeout_ms);

/**
 * Sobe um SoftAP (sem internet) para o portal de configuracao.
 */
esp_err_t wifi_manager_start_ap(void);

/**
 * Retorna o SSID do SoftAP no formato "<prefixo>_XXXXXX", onde XXXXXX sao
 * os 6 ultimos digitos hex do MAC da WiFi (3 ultimos bytes). O prefixo vem
 * de CONFIG_NG_AP_SSID. O valor e calculado uma vez e mantido em buffer
 * estatico.
 */
const char *wifi_manager_ap_ssid(void);

/**
 * true enquanto a STA estiver com IP valido.
 */
bool wifi_manager_is_connected(void);

#ifdef __cplusplus
}
#endif
