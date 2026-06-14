#pragma once

#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Buffer circular em RAM para store-and-forward das leituras quando o
 * dispositivo fica offline. Cada registro ocupa 6 bytes (formato otimizado):
 *   - timestamp: epoch em SEGUNDOS (uint32, 4 bytes)
 *   - db:        décimos de dB     (int16,  2 bytes)
 *
 * Em 64 KB cabem ~10.922 eventos. Quando cheio, sobrescreve o MAIS ANTIGO
 * (mantém sempre as leituras mais recentes). A API converte de/para
 * (float db, int64_t ts_ms) para casar com o resto do firmware.
 *
 * Observação: o timestamp tem resolução de 1 s e o dB de 0,1 dB (perdas
 * inerentes ao formato de 6 bytes escolhido).
 */

/** Inicializa o buffer (idempotente). */
void data_buffer_init(void);

/**
 * Enfileira uma leitura. Se o buffer estiver cheio, descarta a mais antiga.
 * @return true se armazenou; false se nao inicializado.
 */
bool data_buffer_push(float db, int64_t ts_ms);

/**
 * Lê (sem remover) a leitura mais antiga. Use antes de tentar enviar.
 * @return true se havia uma leitura; false se vazio.
 */
bool data_buffer_peek_oldest(float *db, int64_t *ts_ms);

/** Remove a leitura mais antiga (chame após envio bem-sucedido). */
void data_buffer_pop_oldest(void);

/** Quantidade de leituras pendentes. */
size_t data_buffer_count(void);

/** Capacidade total em eventos. */
size_t data_buffer_capacity(void);

#ifdef __cplusplus
}
#endif
