const BASE = 'http://localhost:3000';
const MAX_SSE_FAILURES = 3;
const RECONNECT_DELAY_MS = 3000;
const POLL_INTERVAL_MS = 1000;

let onMessageCb = null;
let onStatusCb = null;
let deviceParam = null;
let sseFailures = 0;
let pollingTimer = null;
let source = null;

// deviceId opcional: assina apenas o feed daquele dispositivo.
export function connect(onMessage, onStatus, deviceId = null) {
  onMessageCb = onMessage;
  onStatusCb = onStatus;
  deviceParam = deviceId;
  openSSE();
}

function historyUrl(deviceId) {
  const q = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : '';
  return `${BASE}/api/history${q}`;
}

export async function fetchHistory(deviceId = null) {
  const res = await fetch(historyUrl(deviceId));
  return res.json();
}

function openSSE() {
  onStatusCb('connecting');
  const q = deviceParam ? `?deviceId=${encodeURIComponent(deviceParam)}` : '';
  source = new EventSource(`${BASE}/events${q}`);

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
      const res = await fetch(historyUrl(deviceParam));
      const data = await res.json();
      if (data.length > 0) {
        onMessageCb(data[data.length - 1]);
      }
    } catch (_) {}
  }, POLL_INTERVAL_MS);
}
