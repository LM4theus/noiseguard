let stream     = null;
let audioCtx   = null;
let analyser   = null;
let intervalId = null;
let active     = false;

export async function startMicrophone({ onPermissionDenied } = {}) {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);

    const buffer = new Uint8Array(analyser.fftSize);
    active = true;

    intervalId = setInterval(() => {
      analyser.getByteTimeDomainData(buffer);
      const rms = Math.sqrt(
        buffer.reduce((sum, v) => sum + ((v - 128) / 128) ** 2, 0) / buffer.length
      );
      // +94 is SPL calibration offset; clamp to [0, 120]
      const db = rms > 0 ? Math.round(20 * Math.log10(rms) + 94) : 30;
      const dbClamped = Math.max(0, Math.min(120, db));

      fetch('http://localhost:3000/api/noise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ db: dbClamped }),
      });
    }, 500);
  } catch (_) {
    active = false;
    if (onPermissionDenied) onPermissionDenied();
  }
}

export function stopMicrophone() {
  active = false;
  clearInterval(intervalId);
  intervalId = null;
  if (analyser)  { analyser.disconnect(); analyser = null; }
  if (audioCtx)  { audioCtx.close();      audioCtx = null; }
  if (stream)    { stream.getTracks().forEach(t => t.stop()); stream = null; }
}

export function isMicActive() {
  return active;
}
