#pragma once

#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Inicia o cliente SNTP (NTP) para sincronizar o relogio interno do ESP32
 * com servidores de tempo da internet. Requer WiFi conectado.
 *
 * A primeira sincronizacao e OBRIGATORIA: a funcao bloqueia ate o relogio
 * sincronizar ou ate esgotar total_wait_ms.
 *
 * @param interval_s   intervalo de resync automatico, em segundos (min. 15).
 * @param total_wait_ms tempo maximo (ms) a aguardar pela 1a sincronizacao.
 * @return true se sincronizou dentro do prazo; false caso contrario (o
 *         chamador deve tratar como falha, ex.: reiniciar).
 */
bool time_sync_init(uint32_t interval_s, int total_wait_ms);

/**
 * @return true se o relogio ja foi sincronizado (hora plausivel, >= 2023).
 */
bool time_sync_is_valid(void);

/**
 * @return tempo atual em milissegundos desde a epoch (UTC), compativel com
 *         Date.now() do JavaScript. Sem valor confiavel se !time_sync_is_valid().
 */
int64_t time_sync_now_ms(void);

#ifdef __cplusplus
}
#endif
