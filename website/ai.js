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
  // start() returns a handle; handle.stop() resolves to { text, language }.
  async function listen() {
    const s = await status;
    if (s.voice && navigator.mediaDevices && window.MediaRecorder) return recordAndTranscribe();
    return browserListen();
  }

  async function recordAndTranscribe() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t)) || "";
    const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const finished = new Promise((done) => { rec.onstop = done; });
    rec.start();
    return {
      async stop() {
        if (rec.state !== "inactive") rec.stop();
        await finished;
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        return transcribe(blob);
      },
      cancel() { if (rec.state !== "inactive") rec.stop(); stream.getTracks().forEach((t) => t.stop()); }
    };
  }

  async function transcribe(blob) {
    const r = await fetch("/api/stt", { method: "POST", headers: { "Content-Type": blob.type || "audio/webm" }, body: blob });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Couldn't transcribe");
    return r.json();
  }

  function browserListen() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return Promise.reject(new Error("Voice input isn't available in this browser."));
    const rec = new SR();
    rec.lang = navigator.language || "en-GB";
    rec.interimResults = false;
    let text = "";
    const finished = new Promise((done, fail) => {
      rec.onresult = (e) => { text = [...e.results].map((r) => r[0].transcript).join(" "); };
      rec.onerror = (e) => fail(new Error(e.error || "Couldn't hear you"));
      rec.onend = () => done({ text, language: null });
    });
    rec.start();
    return Promise.resolve({ stop() { rec.stop(); return finished; }, cancel() { rec.abort(); } });
  }

  window.CentrixAI = { status, ask, speak, stopSpeaking, listen, transcribe };
})();
