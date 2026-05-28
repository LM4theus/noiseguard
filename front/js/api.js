const BASE = 'http://localhost:3000';
const MAX_SSE_FAILURES = 3;
const RECONNECT_DELAY_MS = 3000;
const POLL_INTERVAL_MS = 1000;

let onMessageCb = null;
let onStatusCb = null;
let sseFailures = 0;
let pollingTimer = null;
let source = null;

export function connect(onMessage, onStatus) {
  onMessageCb = onMessage;
  onStatusCb = onStatus;
  openSSE();
}

export async function fetchHistory() {
  const res = await fetch(`${BASE}/api/history`);
  return res.json();
}

function openSSE() {
  onStatusCb('connecting');
  source = new EventSource(`${BASE}/events`);

  source.onopen = () => {
    sseFailures = 0;
    stopPolling();
    onStatusCb('connected');
  };

  source.onmessage = (e) => {
    try {
      onMessageCb(JSON.parse(e.data));
    } catch (_) {}
  };

  source.onerror = () => {
    source.close();
    source = null;
    sseFailures++;

    if (sseFailures >= MAX_SSE_FAILURES) {
      onStatusCb('disconnected');
      startPolling();
    } else {
      onStatusCb('reconnecting');
      setTimeout(openSSE, RECONNECT_DELAY_MS);
    }
  };
}

function stopPolling() {
  if (pollingTimer !== null) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}

function startPolling() {
  stopPolling();
  pollingTimer = setInterval(async () => {
    try {
      const res = await fetch(`${BASE}/api/history`);
      const data = await res.json();
      if (data.length > 0) {
        onMessageCb(data[data.length - 1]);
      }
    } catch (_) {}
  }, POLL_INTERVAL_MS);
}
