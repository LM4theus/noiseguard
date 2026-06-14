# NoiseGuard — Firmware ESP32 (ESP-IDF)

Firmware para **ESP32 (ESP-WROOM-32)** usando o framework **ESP-IDF v5.x**. Lê um
sinal analógico (microfone/sensor de ruído), converte para um valor aproximado em
**dB** e envia periodicamente, via WiFi, um POST JSON para o servidor NoiseGuard.

```json
POST http://<host>:<porta>/api/noise
{"deviceid":10034,"db":97.3,"timestamp":1700000000000}
```

> **Nota sobre o formato:** o servidor (`back/server/routes/noise.js`) valida `db`
> como **número** entre 0 e 140. Por isso o firmware envia o valor numérico (não
> como string). O campo `deviceid` é incluído conforme solicitado; o servidor
> atual o ignora, mas ele já vai no payload para uso futuro.
>
> **`timestamp`** (epoch em ms, igual ao `Date.now()`) só é enviado depois que o
> relógio sincroniza via **NTP**. Enquanto isso não acontece, o campo é omitido e
> o servidor carimba a hora ao receber.

---

## Funcionalidades

- **Modo normal:** conecta no WiFi (STA), amostra o ADC, calcula o RMS → dB e faz
  POST no servidor no intervalo configurado.
- **Modo de configuração:** sobe um **SoftAP** com um **portal web** para definir
  SSID/senha do WiFi, host/porta/endpoint do servidor, Device ID e intervalo de
  envio. A configuração é persistida em **NVS**.
- **Entrada no modo de configuração:**
  - Segurando o **botão de configuração** (ativo em zero) durante o boot; **ou**
  - Automaticamente, quando ainda não há configuração salva (primeiro boot).
- **Buffer offline (store-and-forward):** se o WiFi cair ou o servidor ficar
  indisponível, as leituras são guardadas num **buffer circular em RAM** e
  reenviadas (com a hora original) assim que a conexão volta.

---

## Ligações de hardware (defaults)

| Função | GPIO padrão | Observação |
|---|---|---|
| Sinal analógico | **GPIO34** (ADC1_CH6) | Entrada apenas; ideal para sensor. Atenuação 12 dB (~0–3,1 V) |
| Botão de configuração | **GPIO4** | Botão entre o pino e o **GND**, ativo em zero. Pull-up interno habilitado |

> **Por que não GPIO0 para o botão?** Em nível baixo no boot, o GPIO0 coloca a ROM
> do ESP32 em modo download UART. Por isso o default é o **GPIO4**. Ambos os pinos
> são configuráveis via `idf.py menuconfig`.

O ADC do ESP32 lê de 0 a ~3,3 V. Um microfone (ex.: módulo MAX9814 ou um eletreto
com pré-amplificador) deve entregar um sinal centrado em ~1,65 V para aproveitar
toda a faixa.

---

## Configuração de compilação

Parâmetros padrão em `main/Kconfig.projbuild` (ajustáveis via `idf.py menuconfig`
→ *NoiseGuard - Configuracao de Hardware*):

### GPIO
| GPIO |  Direção  |    Função     | Descrição |
|:----:|:---------:|:-------------:|:----------|
| 4    | *Entrada* |    Botão      | Botão entre o pino e o GND, ativo em zero. Pull-up interno habilitado |
| 34   | *Entrada* |   Sinal       | Entrada apenas; ideal para sensor. Atenuação 12 dB (~0–3,1 V) |
| 0 e 2 | *Saída*   |  LED Status   | Indica o modo por padrão de piscada (veja abaixo). Anodo no GPIO, catodo no GND via resistor |


### Conexão

| Parâmetro | Default | Descrição |
|:---------:|:--------|:----------|
| Prefixo do SSID do AP | `NoiseGuard` | O SSID final é `NoiseGuard_XXXXXX`, onde `XXXXXX` são os 6 últimos dígitos hex do MAC da WiFi (ex.: `NoiseGuard_A1B2C3`) |
| Senha do AP de config | `noiseguard` |Senha da rede WiFi criada pelo ESP32 quando está em modo de configuração |
| Host do servidor | `192.168.0.100` |Endereço IP do servidor |
| Porta | `3000` |Porta do servidor |
| Endpoint | `/api/noise` |
| Device ID | `10034` |
| Intervalo de envio | `1000` ms |
| Resync NTP | `3600` s | De quanto em quanto tempo o relógio é re-sincronizado via NTP (mín. 15 s) |

Esses valores são apenas **defaults**; o que vale em runtime é o que estiver salvo
na NVS pelo portal de configuração.

> **Sincronismo obrigatório no boot:** ao entrar em modo normal, a ESP aguarda
> (até 60 s) a primeira sincronização NTP antes de começar a enviar — nenhuma
> leitura é enviada sem hora válida. Se não sincronizar nesse prazo (ex.: WiFi
> sem saída para a internet), a ESP **entra no modo de configuração** (em vez de
> ficar em reboot-loop), permitindo corrigir a rede pelo portal.

### LED de status (GPIO0 e GPIO2)

Os dois GPIOs são acionados em paralelo, com o mesmo padrão. O LED indica o modo
atual pelo padrão de piscada:

| Modo | Padrão (ms) | Aparência |
|---|---|---|
| Configuração | 200 ON / 200 OFF / 200 ON / 200 OFF / 200 ON / 1000 OFF | 3 piscadas rápidas + pausa longa |
| Normal | 500 ON / 1500 OFF | piscada lenta |

---

## Como compilar e gravar

Pré-requisito: **ESP-IDF v5.x** instalado e o ambiente carregado
(`export.sh` / `export.ps1`).

```bash
# definir o alvo (uma vez)
idf.py set-target esp32

# (opcional) ajustar pinos/defaults
idf.py menuconfig

# compilar, gravar e abrir o monitor serial
idf.py -p <PORTA> flash monitor
```

No Windows (PowerShell), a porta costuma ser `COM3`, `COM4`, etc.:

```powershell
idf.py -p COM4 flash monitor
```

---

## Como usar

### 1. Primeiro boot / reconfiguração

1. Ligue a ESP segurando o **botão de configuração** (GPIO4 → GND). No primeiro
   boot, sem config salva, ela entra em modo de configuração automaticamente.
2. No celular/PC, conecte-se à rede WiFi **`NoiseGuard_XXXXXX`** (o nome exato aparece
   no monitor serial e na lista de redes; senha `noiseguard`).
3. Abra o navegador em **`http://192.168.4.1`**.
4. Preencha SSID, senha, host/porta/endpoint do servidor, Device ID e intervalo.
5. Clique em **Salvar e reiniciar**. A ESP grava na NVS e reinicia.

### 2. Operação normal

No boot seguinte (sem o botão pressionado), a ESP conecta no WiFi configurado e
começa a enviar leituras ao servidor. Acompanhe pelo monitor serial:

```
I (1234) main: ==> MODO NORMAL
I (2345) wifi: IP obtido: 192.168.0.42
I (2900) time_sync: Relogio sincronizado (UTC): 2026-06-14 12:00:00
I (3456) sender: POST http://192.168.0.100:3000/api/noise -> 200  body={"deviceid":10034,"db":72.4,"timestamp":1700000000000}
```

---

## Buffer offline (store-and-forward)

Quando o dispositivo fica sem conseguir entregar uma leitura (WiFi caiu ou o
servidor não respondeu), ela é guardada num **buffer circular em RAM**:

- **Capacidade:** 64 KB → **~10.922 eventos** (registro otimizado de **6 bytes**:
  timestamp em segundos `uint32` + dB em décimos `int16`). O tamanho é
  configurável em `idf.py menuconfig` (`NG_OFFLINE_BUFFER_KB`, ~170 eventos/KB).
- **Resolução do registro:** hora com 1 s e ruído com 0,1 dB.
- **Cheio:** sobrescreve a leitura **mais antiga** (mantém sempre as mais recentes).
- **Flush automático:** ao reconectar, as pendentes são reenviadas da **mais
  antiga para a mais nova**, preservando a ordem cronológica e a **hora original**
  de cada leitura (até 10 por ciclo, para não travar a amostragem).

> ⚠️ O buffer é em **RAM** — não sobrevive a uma queda de energia. Para isso,
> seria preciso memória não-volátil (FRAM/SD).

A ~1 leitura/s, 10.922 eventos cobrem **~3 horas** de queda de rede.

---

## Estrutura do projeto

```
esp32/
├── CMakeLists.txt          # projeto ESP-IDF
├── partitions.csv          # tabela de partições (NVS dedicado)
├── sdkconfig.defaults      # configs padrão de build
└── main/
    ├── CMakeLists.txt
    ├── Kconfig.projbuild    # opções de menuconfig (pinos/defaults)
    ├── main.c               # orquestra: lê botão e escolhe o modo
    ├── app_config.c/.h      # persistência da config em NVS
    ├── wifi_manager.c/.h     # WiFi STA (normal) e SoftAP (config)
    ├── config_portal.c/.h    # servidor HTTP + formulário de config
    ├── sensor.c/.h           # leitura ADC e cálculo de dB (RMS)
    ├── sender.c/.h           # POST JSON para o servidor
    ├── status_led.c/.h       # LED de status (padrões de piscada)
    ├── time_sync.c/.h        # sincronização de hora via NTP/SNTP
    └── data_buffer.c/.h      # buffer circular em RAM (store-and-forward)
```

---

## Calibração do dB

A conversão é uma **aproximação**: o firmware coleta uma janela de amostras,
calcula o RMS da componente AC (em mV) e aplica
`dB = 20·log10(rms_mV + 1) + offset`, com resultado limitado a 30–140 dB.

O `offset` está em `DB_CAL_OFFSET` (`main/sensor.c`). Ajuste-o comparando a leitura
com um decibelímetro de referência para o seu microfone/circuito.
