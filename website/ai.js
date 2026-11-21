/*
 * Live AI for the portals: OpenAI (understanding, conversation) and ElevenLabs
 * (speech-to-text and text-to-speech), always through the centrix server's /api/*.
 * The browser never holds an API key.
 *
 * When the page is opened without the server (any static host), status.live is
 * false and every portal falls back to its built-in, rule-based behaviour.
 */
(function () {
  "use strict";

  const status = fetch("/api/status", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((s) => ({ live: !!(s && s.openai), voice: !!(s && s.elevenlabs), model: s && s.model }))
    .catch(() => ({ live: false, voice: false, model: null }));

  async function ask(task, body) {
    const r = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task, ...body })
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "AI unavailable");
    return r.json();
  }

  // ---------- voice out: ElevenLabs, one message at a time ----------
  let queue = Promise.resolve();
  let current = null;
  function speak(text) {
    queue = queue.then(() => play(text)).catch(() => {});
    return queue;
  }
  async function play(text) {
    const s = await status;
    if (!s.voice) return browserSpeak(text);
    const r = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    if (!r.ok) return browserSpeak(text);
    const url = URL.createObjectURL(await r.blob());
    await new Promise((done) => {
      current = new Audio(url);
      current.onended = current.onerror = () => { URL.revokeObjectURL(url); current = null; done(); };
      current.play().catch(done);
    });
  }
  function stopSpeaking() {
    queue = Promise.resolve();
    if (current) { current.pause(); current = null; }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }
  function browserSpeak(text) {
    if (!("speechSynthesis" in window)) return;
    return new Promise((done) => {
      const u = new SpeechSynthesisUtterance(text);
      u.onend = u.onerror = done;
      window.speechSynthesis.speak(u);
    });
  }

  // ---------- voice in: record, then ElevenLabs Scribe ----------
  // listen(opts) returns a handle; handle.stop() resolves to { text, language }.
  // opts.onSilence() is called once when the speaker stops talking (or never
  // starts), so the caller can stop the recording without a second tap.
  // opts.onInterim(text) gets live partial text when the browser recogniser is used.
  async function listen(opts = {}) {
    const s = await status;
    if (s.voice && navigator.mediaDevices && window.MediaRecorder) return recordAndTranscribe(opts);
    return browserListen(opts);
  }

  async function recordAndTranscribe(opts) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t)) || "";
    const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const finished = new Promise((done) => { rec.onstop = done; });
    rec.start();
    const vad = watchForSilence(stream, opts.onSilence);
    return {
      async stop() {
        vad.stop();
        if (rec.state !== "inactive") rec.stop();
        await finished;
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        return transcribe(blob);
      },
      cancel() { vad.stop(); if (rec.state !== "inactive") rec.stop(); stream.getTracks().forEach((t) => t.stop()); }
    };
  }

  // Voice activity detection on the microphone level. Speech is anything clearly
  // above the room's noise floor; after speech, 1.4 s of quiet means "done".
  // Nothing said within 7 s, or 60 s in total, also ends the recording.
  const VAD = { tick: 50, calibrate: 400, speechMs: 200, silenceMs: 1400, noSpeechMs: 7000, maxMs: 60000 };
  function watchForSilence(stream, onSilence) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!onSilence || !AC) return { stop() {} };
    let ctx;
    try { ctx = new AC(); } catch (e) { return { stop() {} }; }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    const started = Date.now();
    let floor = 0, samples = 0, voiced = 0, quietSince = 0, heard = false, fired = false;
    const fire = () => { if (fired) return; fired = true; stop(); onSilence(); };
    const timer = setInterval(() => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      const t = Date.now() - started;
      if (t < VAD.calibrate) { floor += rms; samples += 1; return; }
      const threshold = Math.max(0.012, (samples ? floor / samples : 0) * 2.5);
      if (rms > threshold) {
        voiced += VAD.tick;
        quietSince = 0;
        if (voiced >= VAD.speechMs) heard = true;
      } else if (heard) {
        quietSince = quietSince || Date.now();
        if (Date.now() - quietSince >= VAD.silenceMs) fire();
      }
      if ((!heard && t >= VAD.noSpeechMs) || t >= VAD.maxMs) fire();
    }, VAD.tick);
    function stop() { clearInterval(timer); if (ctx.state !== "closed") ctx.close().catch(() => {}); }
    return { stop };
  }

  async function transcribe(blob) {
    const r = await fetch("/api/stt", { method: "POST", headers: { "Content-Type": blob.type || "audio/webm" }, body: blob });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Couldn't transcribe");
    return r.json();
  }

  // The browser recogniser ends by itself when the speaker pauses
  // (continuous = false); that end is reported as onSilence.
  function browserListen(opts) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return Promise.reject(new Error("Voice input isn't available in this browser."));
    const rec = new SR();
    rec.lang = navigator.language || "en-GB";
    rec.continuous = false;
    rec.interimResults = true;
    let text = "";
    let stopped = false;
    let signaled = false;
    const signal = () => { if (stopped || signaled) return; signaled = true; if (opts.onSilence) opts.onSilence(); };
    const finished = new Promise((done, fail) => {
      rec.onresult = (e) => {
        text = [...e.results].map((r) => r[0].transcript).join(" ").trim();
        if (opts.onInterim) opts.onInterim(text);
      };
      rec.onerror = (e) => { if (e.error === "no-speech" || e.error === "aborted") return; fail(new Error(e.error || "Couldn't hear you")); };
      rec.onend = () => {
        done({ text, language: null });
        signal();
      };
    });
    finished.catch(signal);
    rec.start();
    return Promise.resolve({ stop() { stopped = true; rec.stop(); return finished; }, cancel() { stopped = true; rec.abort(); } });
  }

  window.CentrixAI = { status, ask, speak, stopSpeaking, listen, transcribe };
})();
