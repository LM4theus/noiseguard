#pragma once

#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Sobe o servidor HTTP do portal de configuracao.
 * Pre-requisito: SoftAP ja iniciado (wifi_manager_start_ap()).
 *
 * Serve um formulario em GET "/" e processa POST "/save", que
 * persiste a config na NVS e reinicia a ESP.
 */
esp_err_t config_portal_start(void);

#ifdef __cplusplus
}
#endif
