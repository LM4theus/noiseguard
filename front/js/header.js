// Header compartilhado das telas de lista/detalhe: apenas reflete o status
// da conexão com o backend. O tema é tratado por theme.js.
import { connect } from './api.js';
import './theme.js';

const connDot  = document.getElementById('conn-dot');
const connText = document.getElementById('conn-text');

const MAP = {
  connected:    { dot: 'green',  text: 'CONECTADO' },
  disconnected: { dot: 'red',    text: 'DESCONECTADO' },
  reconnecting: { dot: 'yellow', text: 'RECONECTANDO...' },
  connecting:   { dot: 'yellow', text: 'CONECTANDO...' },
};

function setStatus(status) {
  if (!connDot) return;
  const s = MAP[status] ?? MAP.connecting;
  connDot.className = `conn-dot ${s.dot}`;
  connText.textContent = s.text;
}

// Conecta só para refletir o status (mensagens são ignoradas aqui).
connect(() => {}, setStatus);
