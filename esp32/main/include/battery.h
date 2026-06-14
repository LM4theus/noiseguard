#pragma once

#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Configura o canal ADC1 da bateria (CONFIG_NG_BATT_ADC_CHANNEL) sobre a
 * unidade ADC1 compartilhada. Requer um divisor resistivo entre a bateria
 * e o pino (a bateria de LiPo chega a 4,2 V, acima dos ~3,3 V do ADC).
 */
esp_err_t battery_init(void);

/**
 * @return tensao da bateria em mV (ja aplicando o divisor configurado),
 *         ou 0 se a leitura falhar.
 */
int battery_read_mv(void);

/**
 * @return nivel da bateria em 0..100 %, mapeado linearmente entre
 *         CONFIG_NG_BATT_MIN_MV (0%) e CONFIG_NG_BATT_MAX_MV (100%).
 */
int battery_percent(void);

#ifdef __cplusplus
}
#endif
