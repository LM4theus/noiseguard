// Limiares padrão (usados para leituras sem dispositivo registrado).
const DEFAULT_WARN = 94;   // dB — acima disso: ATENÇÃO
const DEFAULT_CRIT = 110;  // dB — acima disso: CRÍTICO

// Classifica uma leitura. Aceita limiares por dispositivo via { warn, crit };
// na ausência, usa os padrões globais.
function classify(db, { warn = DEFAULT_WARN, crit = DEFAULT_CRIT } = {}) {
  if (db < warn) return 'OK';
  if (db < crit) return 'ATENCAO';
  return 'CRITICO';
}

module.exports = { DEFAULTS: { warn: DEFAULT_WARN, crit: DEFAULT_CRIT }, classify };
