#pragma once

#include "esp_adc/adc_oneshot.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Retorna o handle (compartilhado) da unidade ADC1, criando-o na primeira
 * chamada. O driver oneshot so permite uma instancia por unidade, entao
 * tanto o sensor de ruido quanto a leitura de bateria usam este mesmo handle.
 *
 * @return handle valido, ou NULL em caso de falha.
 */
adc_oneshot_unit_handle_t adc1_get_unit(void);

#ifdef __cplusplus
}
#endif
