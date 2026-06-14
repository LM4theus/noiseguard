#include "data_buffer.h"

#include <math.h>
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "esp_log.h"
#include "sdkconfig.h"

static const char *TAG = "data_buffer";

// Registro otimizado de 6 bytes. 'packed' para evitar os 2 bytes de padding
// que o alinhamento do uint32 inseriria (sizeof seria 8 sem o packed).
typedef struct __attribute__((packed)) {
    uint32_t ts_s;     // epoch em segundos
    int16_t  db_dx;    // dB em décimos (ex.: 72.4 dB -> 724)
} record_t;

#define BUFFER_BYTES   (CONFIG_NG_OFFLINE_BUFFER_KB * 1024)
#define CAPACITY       (BUFFER_BYTES / sizeof(record_t))   // ~170 eventos/KB

static record_t s_buf[CAPACITY];
static size_t   s_start;   // índice da leitura mais antiga
static size_t   s_count;   // quantidade ocupada
static SemaphoreHandle_t s_mutex;

void data_buffer_init(void)
{
    if (s_mutex == NULL) {
        s_mutex = xSemaphoreCreateMutex();
    }
    s_start = 0;
    s_count = 0;
    ESP_LOGI(TAG, "Buffer circular: %u eventos (%d bytes, %u B/evento)",
             (unsigned)CAPACITY, BUFFER_BYTES, (unsigned)sizeof(record_t));
}

bool data_buffer_push(float db, int64_t ts_ms)
{
    if (s_mutex == NULL) return false;

    record_t rec = {
        .ts_s  = (uint32_t)(ts_ms / 1000),
        .db_dx = (int16_t)lroundf(db * 10.0f),
    };

    xSemaphoreTake(s_mutex, portMAX_DELAY);
    size_t write = (s_start + s_count) % CAPACITY;
    s_buf[write] = rec;
    if (s_count == CAPACITY) {
        // Cheio: sobrescreveu a posição mais antiga, avança o início.
        s_start = (s_start + 1) % CAPACITY;
    } else {
        s_count++;
    }
    xSemaphoreGive(s_mutex);
    return true;
}

bool data_buffer_peek_oldest(float *db, int64_t *ts_ms)
{
    if (s_mutex == NULL) return false;

    bool ok = false;
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    if (s_count > 0) {
        record_t rec = s_buf[s_start];
        if (db)    *db = rec.db_dx / 10.0f;
        if (ts_ms) *ts_ms = (int64_t)rec.ts_s * 1000;
        ok = true;
    }
    xSemaphoreGive(s_mutex);
    return ok;
}

void data_buffer_pop_oldest(void)
{
    if (s_mutex == NULL) return;

    xSemaphoreTake(s_mutex, portMAX_DELAY);
    if (s_count > 0) {
        s_start = (s_start + 1) % CAPACITY;
        s_count--;
    }
    xSemaphoreGive(s_mutex);
}

size_t data_buffer_count(void)
{
    if (s_mutex == NULL) return 0;
    xSemaphoreTake(s_mutex, portMAX_DELAY);
    size_t n = s_count;
    xSemaphoreGive(s_mutex);
    return n;
}

size_t data_buffer_capacity(void)
{
    return CAPACITY;
}
