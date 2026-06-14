#pragma once

#include <stdint.h>
#include "esp_err.h"
#include "app_config.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Monta e envia um POST JSON para http://host:port/path com o corpo:
 *   {"deviceid":<device_id>,"db":<db>,"timestamp":<ts_ms>,"battery":<pct>}
 *
 * @param ts_ms       epoch em ms da leitura (hora original). Use <= 0 para
 *                    omitir o campo (o servidor carimba a hora ao receber).
 * @param battery_pct nivel da bateria em 0..100. Use < 0 para omitir o campo.
 * @return ESP_OK em sucesso (status HTTP 2xx); erro caso contrario.
 */
esp_err_t sender_post_reading(const app_config_t *cfg, float db, int64_t ts_ms,
                              int battery_pct);

#ifdef __cplusplus
}
#endif
