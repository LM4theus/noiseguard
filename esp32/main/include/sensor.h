#pragma once

#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Inicializa o ADC1 no canal definido em Kconfig (NG_ADC_CHANNEL).
 */
esp_err_t sensor_init(void);

/**
 * Faz uma janela de amostragem do sinal analogico, calcula o RMS e
 * converte para um valor aproximado em dB (faixa 0..140, compativel
 * com o servidor NoiseGuard).
 *
 * Retorna o valor em dB. A conversao e uma aproximacao e depende de
 * calibracao do microfone/condicionamento do sinal.
 */
float sensor_read_db(void);

#ifdef __cplusplus
}
#endif
