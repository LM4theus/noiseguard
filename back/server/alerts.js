const THRESHOLD_WARN = 94;   // dB — acima disso: ATENÇÃO
const THRESHOLD_CRIT = 110;  // dB — acima disso: CRÍTICO (reserva de segurança)

function classify(db) {
  if (db < THRESHOLD_WARN) return 'OK';
  if (db < THRESHOLD_CRIT) return 'ATENCAO';
  return 'CRITICO';
}

module.exports = { THRESHOLDS: { OK: THRESHOLD_WARN, ATENCAO: THRESHOLD_CRIT }, classify };
