# NoiseGuard — Firmware ESP32 (ESP-IDF)

Firmware para **ESP32 (ESP-WROOM-32)** usando o framework **ESP-IDF v5.x**. Lê um
sinal analógico (microfone/sensor de ruído), converte para um valor aproximado em
**dB** e envia periodicamente, via WiFi, um POST JSON para o servidor NoiseGuard.

```json
POST http://<host>:<porta>/api/noise
{"deviceid":10034,"db":97.3}
```

> **Nota sobre o formato:** o servidor (`back/server/routes/noise.js`) valida `db`
> como **número** entre 0 e 140. Por isso o firmware envia o valor numérico (não
> como string). O campo `deviceid` é incluído conforme solicitado; o servidor
> atual o ignora, mas ele já vai no payload para uso futuro.

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

| Parâmetro | Default |
|---|---|
| GPIO do botão | 4 |
| Canal ADC1 | 6 (GPIO34) |
| SSID do AP de config | `NoiseGuard-Setup` |
| Senha do AP de config | `noiseguard` |
| Host do servidor | `192.168.0.100` |
| Porta | `3000` |
| Endpoint | `/api/noise` |
| Device ID | `10034` |
| Intervalo de envio | `500` ms |

Esses valores são apenas **defaults**; o que vale em runtime é o que estiver salvo
na NVS pelo portal de configuração.

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
2. No celular/PC, conecte-se à rede WiFi **`NoiseGuard-Setup`** (senha `noiseguard`).
3. Abra o navegador em **`http://192.168.4.1`**.
4. Preencha SSID, senha, host/porta/endpoint do servidor, Device ID e intervalo.
5. Clique em **Salvar e reiniciar**. A ESP grava na NVS e reinicia.

### 2. Operação normal

No boot seguinte (sem o botão pressionado), a ESP conecta no WiFi configurado e
começa a enviar leituras ao servidor. Acompanhe pelo monitor serial:

```
I (1234) main: ==> MODO NORMAL
I (2345) wifi: IP obtido: 192.168.0.42
I (3456) sender: POST http://192.168.0.100:3000/api/noise -> 200  body={"deviceid":10034,"db":72.4}
```

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
    └── sender.c/.h           # POST JSON para o servidor
```

---

## Calibração do dB

A conversão é uma **aproximação**: o firmware coleta uma janela de amostras,
calcula o RMS da componente AC (em mV) e aplica
`dB = 20·log10(rms_mV + 1) + offset`, com resultado limitado a 30–140 dB.

O `offset` está em `DB_CAL_OFFSET` (`main/sensor.c`). Ajuste-o comparando a leitura
com um decibelímetro de referência para o seu microfone/circuito.
