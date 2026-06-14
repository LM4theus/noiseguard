#pragma once

#ifdef __cplusplus
extern "C" {
#endif

typedef enum {
    STATUS_LED_CONFIG,   // modo de configuracao: 3 piscadas rapidas + pausa
    STATUS_LED_NORMAL,   // modo normal: piscada lenta
} status_led_mode_t;

/**
 * Inicializa o GPIO do LED de status (CONFIG_NG_STATUS_LED_GPIO) e cria uma
 * task que repete o padrao de piscadas correspondente ao modo informado.
 *
 * Padroes:
 *   CONFIG: 200 HIGH / 200 LOW / 200 HIGH / 200 LOW / 200 HIGH / 1000 LOW (ms)
 *   NORMAL: 500 HIGH / 1500 LOW (ms)
 *
 * Deve ser chamado uma unica vez por boot (o modo nao muda em runtime).
 */
void status_led_start(status_led_mode_t mode);

#ifdef __cplusplus
}
#endif
