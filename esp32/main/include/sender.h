#pragma once

#include "esp_err.h"
#include "app_config.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Monta e envia um POST JSON para http://host:port/path com o corpo:
 *   {"deviceid":<device_id>,"db":<db>}
 *
 * @return ESP_OK em sucesso (status HTTP 2xx); erro caso contrario.
 */
esp_err_t sender_post_reading(const app_config_t *cfg, float db);

#ifdef __cplusplus
}
#endif
