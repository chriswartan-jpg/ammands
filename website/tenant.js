(function () {
  "use strict";

  // Tenant portal: one conversation from "something is wrong" to "it's fixed".
  // No forms: the assistant asks only what centrix doesn't know yet.
  // Follows the final workflow (21 steps): report → language → classify → duplicate
  // check → follow-ups → photo → urgency → job brief → consent → manager dispatch →
  // plumber's 3 time windows → booking → reminder → on the way → cost check →
  // work note → tenant confirms → invoice → feedback → seven-day follow-up.
  // Everything runs in the browser on data/tenant-data.js (demo only).

  let session = null;
  try { session = JSON.parse(sessionStorage.getItem("centrix.session")); } catch (e) {}
  if (!session || session.role !== "tenant") return; // the guard in <head> already redirects

  const DATA = window.CENTRIX_TENANT;
  const HOME = DATA.home;
  const POLICY = DATA.policy;
  const CASE_ID = DATA.nextCaseId || "CASE-1042";
  const $ = (id) => document.getElementById(id);
  const AI = window.CentrixAI;
  let live = false;          // OpenAI available through the centrix server
  let voiceLive = false;     // ElevenLabs available
  let voiceReplies = false;  // speak every assistant and plumber message
  let currentChips = [];     // the chips on screen, for matching spoken or typed answers
  const STEPS = ["Reported", "Brief and consent", "Dispatched", "Booked", "On the way", "Repair", "Fixed and invoiced", "Closed"];

  const state = {
    // start → manager_review → followup → photo → brief → dispatch → windows → booked →
    // reminded → on_the_way → cost_check → approval → working → done → feedback →
    // followup_wait → closed
    step: "start",
    problem: null,       // key in DATA.problems
    report: "",          // the tenant's own words
    language: null,      // { code, name } when not English
    linked: null,        // duplicate case in the same building
    answers: [],         // [{ q, a }]
    urgent: false,
    photo: null,
    plumber: null,
    slot: null,
    windows: null,       // the 3 windows the plumber proposed
    windowRound: 0,
    access: "caretaker",
    consent: null,       // { at, channel }
    quote: null,         // net € the plumber quoted on site
    invoice: null,
    feedback: {},
    aiFollowUps: null,   // follow-up questions written by OpenAI, in the tenant's language
    aiTitle: null,       // short English title for the plumber's brief
    progress: -1,        // index in STEPS
    messages: []
  };

  // ---------- top bar ----------
  const first = session.name.split(" ")[0];
  $("app-user").textContent = session.name;
  setAvatar($("app-avatar"), initials(session.name), HOME.photo);
  $("hello").textContent = `Hi ${first}`;
  $("hello-sub").textContent = `${HOME.unit} · ${HOME.address}`;
  $("logout").addEventListener("click", (event) => {
    const btn = event.currentTarget;
    btn.disabled = true;
    btn.querySelector(".btn-label").textContent = "Logging out…";
    sessionStorage.removeItem("centrix.session");
    setTimeout(() => { location.href = "login.html?role=tenant"; }, 350);
  });

  // ---------- sidebar ----------
  renderHome();
  renderNearby();
  renderRepair();

  // ---------- composer ----------
  const input = $("message");
  const send = $("send");
  input.addEventListener("input", () => {
    send.disabled = !input.value.trim();
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 140) + "px";
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      $("composer").requestSubmit();
    }
  });
  $("composer").addEventListener("submit", (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    input.style.height = "auto";
    send.disabled = true;
    // An answer that matches a quick-reply chip ("today", "a couple of days",
    // "yes") works as if the chip was tapped; anything else is a normal message.
    const chip = matchChip(text);
    if (chip) {
      setActions([]);
      return chip.run();
    }
    onText(text);
  });
  $("photo-btn").addEventListener("click", () => $("photo-input").click());
  $("photo-input").addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (file && file.type.startsWith("image/")) onPhoto(URL.createObjectURL(file));
  });
  $("mic-btn").addEventListener("click", dictate);
  $("voice-toggle").addEventListener("click", () => {
    voiceReplies = !voiceReplies;
    if (!voiceReplies) AI.stopSpeaking();
    renderMode();
  });
  AI.status.then((st) => { live = st.live; voiceLive = st.voice; renderMode(); renderThread(); });
  $("track-msg").addEventListener("click", () => {
    input.focus();
    input.placeholder = `Message ${state.plumber ? plumberName() : "the plumber"}…`;
  });

  // ---------- conversation ----------
  say("ai", `Hi ${first}, what's going on in your home? Type or tap the microphone and describe it in your own words, or pick one below.`);
  showProblemChips();

  function onText(text) {
    if (state.step === "closed") resetCase();
    say("me", text, { raw: true });
    if (state.step === "start") {
      state.report = text;
      if (live) return aiStart(text);
      detectLanguage(text);
      const key = classify(text);
      if (key) return withTyping(() => startCase(key));
      return withTyping(() => {
        say("ai", "I'm not sure this is a plumbing problem. Which of these is closest?");
        showProblemChips(true);
      });
    }
    if (live) return aiChat();
    if (["booked", "reminded", "on_the_way", "cost_check", "approval", "working"].includes(state.step)) {
      return later(() => say("centrix", `Sent to ${plumberName()}. They'll reply here.`), 400);
    }
    withTyping(() => say("ai", "Noted, I've added that to your report for the plumber."));
  }

  // ---------- live AI (OpenAI through the centrix server) ----------

  // Steps 2, 3, 5 and 7 in one call: language, classification, follow-ups, urgency.
  function aiStart(text) {
    thinking(AI.ask("classify", { text, home: { unit: HOME.unit, address: HOME.address, building: HOME.building } }))
      .then((r) => {
        if (r.language && r.language.code && r.language.code !== "en") {
          state.language = { code: r.language.code, name: r.language.name };
          say("centrix", `Language detected: ${r.language.name}. The assistant answers you in ${r.language.name}; the plumber gets the brief in German.`);
        }
        if (r.reply) say("ai", r.reply, { raw: true });
        if (r.route === "plumbing" && DATA.problems[r.problem]) {
          state.aiTitle = r.title || null;
          state.aiFollowUps = (r.followUps || []).slice(0, 3)
            .filter((f) => f.q && f.options && f.options.length >= 2)
            .map((f) => ({ q: f.q, raw: true, options: f.options.slice(0, 3).map((o) => [o.label, !!o.urgent]) }));
          if (!state.aiFollowUps.length) state.aiFollowUps = null;
          if (r.urgent) state.urgent = true;
          return startCase(r.problem);
        }
        if (r.route === "not_plumbing") return managerReview();
        say("ai", "I'm not sure this is a plumbing problem. Which of these is closest?");
        showProblemChips(true);
      })
      .catch(() => {
        // Fall back to the built-in rules
        detectLanguage(text);
        const key = classify(text);
        if (key) return startCase(key);
        say("ai", "I'm not sure this is a plumbing problem. Which of these is closest?");
        showProblemChips(true);
      });
  }

  // Free conversation at any step, grounded in the case.
  function aiChat() {
    const history = state.messages.filter((m) => m.text && !m.typing).slice(-14).map((m) => ({
      role: m.from === "me" ? "user" : "assistant",
      content: m.from === "centrix" ? `[centrix status] ${m.text}` : m.from === "plumber" ? `[plumber] ${m.text}` : m.text
    }));
    thinking(AI.ask("chat", { messages: history, context: caseContext() }))
      .then((r) => {
        say("ai", r.reply, { raw: true });
        handleIntent(r.intent);
      })
      .catch(() => say("ai", "Noted, I've added that to your report for the plumber."));
  }

  function handleIntent(intent) {
    if (intent === "rebook" && ["windows", "booked", "reminded"].includes(state.step)) {
      setActions([]);
      state.step = "dispatch";
      renderRepair();
      say("centrix", `Asked ${plumberName()} for new times.`);
      return later(proposeWindows, 1000);
    }
    if (intent === "not_fixed" && ["done", "feedback", "followup_wait", "followup_check"].includes(state.step)) {
      setActions([]);
      return reopen();
    }
    if (intent === "urgent" && state.step !== "start" && state.step !== "closed") {
      state.urgent = true;
      renderRepair();
      say("centrix", `Marked urgent. ${POLICY.manager} has been alerted and the voice agent will call you on ${HOME.phone}.`);
    }
  }

  function caseContext() {
    const p = state.problem ? DATA.problems[state.problem] : null;
    return {
      step: state.step,
      home: { unit: HOME.unit, address: HOME.address, floor: HOME.floor, access: HOME.access, shutoffValve: HOME.shutoff },
      problem: state.aiTitle || (p && p.title) || null,
      tenantAnswers: state.answers.map((a) => `${a.q} → ${a.a}`),
      urgent: state.urgent,
      tenantLanguage: state.language ? state.language.name : "English",
      linkedCase: state.linked ? `${state.linked.id} (${state.linked.unit}): ${state.linked.text}` : null,
      estimate: p ? `€${p.price[0]}–€${p.price[1]} net incl. €${DATA.callOut} call-out (example prices)` : null,
      preApprovedLimit: `€${fmt(POLICY.preApprovedLimit)} net; above that the property manager approves the quote first`,
      propertyManager: POLICY.manager,
      neverShared: DATA.withheld,
      consentGiven: state.consent ? `${state.consent.at} via ${state.consent.channel}` : false,
      plumber: state.plumber ? plumberFull() : null,
      proposedWindows: state.windows,
      bookedSlot: state.slot,
      quote: state.quote ? `€${fmt(state.quote)} net` : null,
      invoice: state.invoice ? `${state.invoice.number}, €${money(state.invoice.gross)} incl. ${POLICY.vat}% VAT, billed to ${POLICY.invoiceTo}` : null
    };
  }

  // Show "typing" until the promise settles; keeps any open quick replies.
  function thinking(promise) {
    const typing = { from: "ai", typing: true };
    state.messages.push(typing);
    renderThread();
    return promise.finally(() => {
      const i = state.messages.indexOf(typing);
      if (i >= 0) state.messages.splice(i, 1);
      renderThread();
    });
  }

  // Scripted messages follow the tenant's language (translated once, then cached).
  const translations = new Map();
  let translateQueue = [];
  function localize(text, apply) {
    if (!live || !state.language || state.language.code === "en" || !text) return false;
    if (translations.has(text)) { apply(translations.get(text)); return true; }
    translateQueue.push([text, apply]);
    if (translateQueue.length === 1) setTimeout(flushTranslations, 40);
    return true;
  }
  async function flushTranslations() {
    const batch = translateQueue;
    translateQueue = [];
    const texts = [...new Set(batch.map((b) => b[0]))];
    try {
      const r = await AI.ask("translate", { texts, language: state.language.name });
      texts.forEach((t, i) => { if (r.texts && r.texts[i]) translations.set(t, r.texts[i]); });
    } catch (e) { /* keep English */ }
    batch.forEach(([t, apply]) => apply(translations.get(t) || t));
  }

  function renderMode() {
    const badge = $("ai-mode");
    badge.textContent = live ? (voiceLive ? "Live AI · voice" : "Live AI") : "Demo mode";
    badge.title = live ? "Answers by OpenAI, voice by ElevenLabs, through the centrix server" : "Built-in demo assistant (the AI server isn't running)";
    badge.classList.toggle("is-live", live);
    const t = $("voice-toggle");
    t.setAttribute("aria-pressed", String(voiceReplies));
    t.setAttribute("aria-label", voiceReplies ? "Turn spoken replies off" : "Turn spoken replies on");
    t.dataset.tip = voiceReplies ? "Spoken replies on" : "Spoken replies off";
  }

  // Step 2: language detection. The voice agent keeps talking in the tenant's language.
  function detectLanguage(text) {
    const words = text.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
    let best = null, bestHits = 0;
    Object.entries(DATA.languages).forEach(([code, lang]) => {
      const hits = lang.words.filter((w) => w.includes(" ") ? text.toLowerCase().includes(w) : words.includes(w)).length;
      if (hits > bestHits) { best = { code, name: lang.name }; bestHits = hits; }
    });
    if (best && bestHits >= 2) {
      state.language = best;
      say("centrix", `Language detected: ${best.name}. The voice agent answers you in ${best.name}; the plumber gets the brief in German.`);
    }
  }

  // Steps 3 and 4: classified as plumbing, then the duplicate check in the same building.
  function startCase(key) {
    state.problem = key;
    state.progress = 0;
    state.step = "followup";
    const p = DATA.problems[key];
    if (!state.report) state.report = p.title;
    say("centrix", `Classified as plumbing: ${p.label.toLowerCase()}. Case ${CASE_ID} opened for ${HOME.unit}.`);
    const dup = DATA.openCases.find((c) => c.problem === key);
    if (dup) {
      state.linked = dup;
      say("centrix", `Possible same leak: ${dup.id} from ${dup.unit}, “${dup.text}” (${dup.reported}). Both cases are now linked, so one plumber visit covers them.`);
    }
    renderRepair();
    askFollowUp(0);
  }

  // Step 5: up to 3 one-tap follow-up questions.
  function askFollowUp(i) {
    const p = DATA.problems[state.problem];
    const list = state.aiFollowUps || p.followUps;
    const f = list[i];
    if (!f) return withTyping(askPhoto);
    say("ai", i === 0 && !f.raw ? `That sounds like: ${p.title.toLowerCase()}. ${f.q}` : f.q, { raw: f.raw });
    chips(f.options.map(([label, urgent]) => [label, () => {
      say("me", label, { raw: f.raw });
      state.answers.push({ q: f.q, a: label });
      if (urgent) state.urgent = true;
      withTyping(() => askFollowUp(i + 1));
    }]), f.raw);
  }

  // Step 6: optional photo.
  function askPhoto() {
    state.step = "photo";
    say("ai", "A photo helps the plumber bring the right parts. Want to add one? It's optional.");
    chips([
      ["Add a photo", () => $("photo-input").click(), "camera"],
      ["Skip", () => { me("Skip the photo"); withTyping(checkUrgency); }]
    ]);
  }

  function onPhoto(url) {
    state.messages.push({ from: "me", image: url, time: now() });
    renderThread();
    if (state.step !== "photo") return;
    state.photo = url;
    withTyping(checkUrgency);
  }

  // Step 7: urgency check from the answers, with the urgent path (7b).
  function checkUrgency() {
    if (state.urgent) {
      say("centrix", `Urgent. The voice agent is calling you now on ${HOME.phone}, and ${POLICY.manager} has been alerted.`);
      say("ai", "While you wait, close the water here:", { card: noteCard("Shut-off valve", HOME.shutoff, "From your home record.") });
    }
    showBrief();
  }

  // Steps 8 and 9: the job brief and the tenant's consent.
  function showBrief() {
    const p = DATA.problems[state.problem];
    state.step = "brief";
    state.progress = 1;
    renderRepair();
    say("ai", "Here's what I think it is, and what it usually costs:", { card: estimateCard(p) });
    say("ai", "This is the job brief the plumber will receive. Nothing is shared until you agree:", { card: briefCard() });
    setActions([]);
  }

  function giveConsent(card) {
    state.consent = { at: now(), channel: "Tenant portal (tap)" };
    card.classList.add("is-done");
    card.querySelectorAll("button").forEach((b) => { b.disabled = true; b.classList.remove("is-loading"); });
    card.querySelector(".btn-primary").textContent = "Agreed ✓";
    me("Agree and send");
    withTyping(dispatch);
  }

  // Step 10: the manager reviews the brief, sets priority and dispatches.
  function dispatch() {
    state.step = "dispatch";
    say("centrix", `Consent saved at ${state.consent.at} via ${state.consent.channel.toLowerCase()}. Brief sent to ${POLICY.manager} for review.`);
    renderRepair();
    later(() => {
      state.plumber = DATA.plumbers.find((x) => x.id === DATA.dispatchTo) || DATA.plumbers[0];
      state.progress = 2;
      say("centrix", `${POLICY.manager} reviewed the brief, set priority to ${state.urgent ? "urgent" : "normal"} and dispatched ${plumberFull()}.`);
      renderRepair();
      renderNearby();
      later(proposeWindows, 900);
    }, 1400);
  }

  // Steps 11 and 12: the plumber proposes 3 windows, the tenant picks one or asks for new ones (12b).
  function proposeWindows() {
    state.step = "windows";
    const pro = state.plumber;
    state.windows = state.windowRound % 2 === 0 ? pro.slots : pro.moreSlots;
    state.windowRound += 1;
    say("plumber", `Hi ${first}, I can come at one of these times. Which suits you?`);
    renderRepair();
    chips([
      ...state.windows.map((s) => [s, () => chooseSlot(s), "clock"]),
      ["None of these fit", noneFit]
    ]);
  }

  function noneFit() {
    me("None of these fit");
    withTyping(() => {
      say("ai", `No problem. I've asked ${plumberName()} for new times.`);
      later(proposeWindows, 1100);
    });
  }

  // Step 13: confirmation to tenant and manager.
  function chooseSlot(slot) {
    state.slot = slot;
    me(slot);
    withTyping(() => {
      state.step = "booked";
      state.progress = 3;
      const access = state.access === "home" ? "you're at home" : "key with the caretaker";
      say("centrix", `Confirmed: ${plumberFull()}, ${slot} (${access}). Sent to you and ${POLICY.manager}.`);
      say("ai", "You're all set. I'll remind you the day before, and you'll see a live ETA once the plumber is on the way.");
      renderRepair();
      renderNearby();
      toast("Visit booked. You can follow the repair here.");
    });
  }

  // ---------- demo controls: move the case forward as the plumber or manager would ----------

  // Step 14: reminder the day before, with the option to rebook.
  function remind() {
    state.step = "reminded";
    say("ai", `Reminder: ${plumberName()} comes tomorrow, ${state.slot}. Will you be home, or should we find another time?`, { speak: true });
    renderRepair();
    chips([
      ["Yes, see you then", () => { me("Yes, see you then"); withTyping(() => say("ai", "Great, I've let the plumber know.")); }, "check"],
      ["I need another time", () => { me("I need another time"); state.step = "dispatch"; renderRepair(); withTyping(() => { say("ai", `OK, I've asked ${plumberName()} for new times.`); later(proposeWindows, 900); }); }]
    ]);
  }

  // Step 15: on the way, with a spoken ETA.
  function startTrip() {
    setActions([]);
    state.step = "on_the_way";
    state.progress = 4;
    renderRepair();
    say("centrix", `${plumberName()} is on the way.`);
    later(() => say("plumber", `Hi ${first}, I'm on my way. I'll be there in about 15 minutes.`, { speak: true }), 900);
    showTracking();
  }

  // Step 16: on-site cost check against the pre-approved limit.
  function arrive() {
    stopTracking();
    state.step = "cost_check";
    state.progress = 5;
    renderRepair();
    say("centrix", `${plumberName()} has arrived and is checking the cost against the €${fmt(POLICY.preApprovedLimit)} pre-approved limit.`);
  }

  function quote(net) {
    state.quote = net;
    if (net <= POLICY.preApprovedLimit) {
      say("centrix", `Quote €${fmt(net)} net is within the €${fmt(POLICY.preApprovedLimit)} pre-approved limit. The repair starts now.`);
      state.step = "working";
    } else {
      say("centrix", `Quote €${fmt(net)} net is over the €${fmt(POLICY.preApprovedLimit)} limit. ${POLICY.manager} has to approve it before the repair starts.`);
      state.step = "approval";
    }
    renderRepair();
  }

  function approveQuote() {
    say("centrix", `${POLICY.manager} approved the quote of €${fmt(state.quote)} net. The repair starts now.`);
    state.step = "working";
    renderRepair();
  }

  // Steps 17 and 18: work note, then the tenant confirms the fix.
  function finishJob() {
    const p = DATA.problems[state.problem];
    state.step = "done";
    renderRepair();
    say("plumber", "All done. Here's my work note:", { card: reportCard(p) });
    later(() => {
      say("ai", state.problem === "leak" ? "Is it dry now?" : "Is the problem fixed?", { speak: true });
      chips([
        ["Yes, it's fixed", () => confirmFixed(true), "check"],
        ["No, not yet", () => confirmFixed(false)]
      ]);
    }, 700);
  }

  function confirmFixed(ok) {
    setActions([]);
    if (!ok) {
      me("No, it's not fixed yet");
      return reopen();
    }
    me("Yes, it's fixed");
    fixed();
  }

  // Not fixed (after the repair or at the seven-day check): no invoice, the plumber comes back.
  function reopen() {
    {
      state.step = "dispatch";
      state.progress = 2;
      renderRepair();
      return withTyping(() => {
        say("ai", `Sorry about that. I've asked ${plumberName()} to come back at no extra cost.`);
        later(proposeWindows, 900);
      });
    }
  }

  function fixed() {
    state.progress = 6;
    withTyping(() => {
      // Step 19: the invoice, made from the work note and linked to the case and the unit.
      state.invoice = buildInvoice();
      say("centrix", `Invoice ${state.invoice.number} created from the work note and linked to ${CASE_ID} and ${HOME.unit}.`, { card: invoiceCard(state.invoice) });
      askFeedback();
    });
  }

  // Step 20: two quick feedback questions.
  function askFeedback() {
    state.step = "feedback";
    renderRepair();
    say("ai", "Two quick questions. How was the service?");
    chips(["Great", "Good", "OK", "Poor"].map((r) => [r, () => {
      me(r);
      state.feedback.rating = r;
      withTyping(() => {
        say("ai", "Was the plumber on time?");
        chips([["Yes", () => endFeedback("Yes")], ["No", () => endFeedback("No")]]);
      });
    }]));
  }

  function endFeedback(onTime) {
    me(onTime);
    state.feedback.onTime = onTime;
    withTyping(() => {
      state.step = "followup_wait";
      state.progress = 7;
      say("ai", "Thanks, that helps your property manager. I'll check in once more in seven days to make sure it stays fixed.");
      renderRepair();
    });
  }

  // Step 21: seven-day follow-up, then the unit record is updated and the case closes.
  function sevenDays() {
    state.step = "followup_check";
    renderRepair();
    say("ai", state.problem === "leak" ? "It's been seven days since the repair. Is it still dry?" : "It's been seven days since the repair. Is everything still working?", { speak: true });
    chips([
      ["Yes, all good", () => {
        me("Yes, all good");
        withTyping(() => {
          const p = DATA.problems[state.problem];
          const month = new Date().toLocaleDateString("en-GB", { month: "short", year: "numeric" });
          HOME.history.unshift(`${month} · ${p.title.toLowerCase()}: ${p.causes[0].toLowerCase()} fixed`);
          state.step = "closed";
          renderHome();
          renderRepair();
          say("centrix", `Case ${CASE_ID} closed. Your home record is updated, so the next brief for ${HOME.unit} is better.`);
          say("ai", "Glad it's sorted. If anything else comes up, just tell me here.");
          chips(Object.entries(DATA.problems).map(([key, p]) => [p.label, () => { resetCase(); me(p.label); withTyping(() => startCase(key)); }]));
          toast("Repair closed. Thanks for confirming.");
        });
      }, "check"],
      ["No, it's back", () => {
        me("No, the problem is back");
        state.step = "dispatch";
        state.progress = 2;
        renderRepair();
        withTyping(() => {
          say("centrix", `${CASE_ID} reopened and ${POLICY.manager} notified. The repair is covered, no new call-out fee.`);
          later(proposeWindows, 900);
        });
      }]
    ]);
  }

  // A closed case is a record; a new report starts a fresh case.
  function resetCase() {
    Object.assign(state, {
      step: "start", problem: null, report: "", language: null, linked: null, answers: [], urgent: false,
      photo: null, plumber: null, slot: null, windows: null, windowRound: 0, access: "caretaker",
      consent: null, quote: null, invoice: null, feedback: {}, aiFollowUps: null, aiTitle: null, progress: -1
    });
    renderRepair();
    renderNearby();
  }

  // Manager review (3b): not plumbing or unsure.
  function toManager() {
    me("Something else");
    withTyping(managerReview);
  }

  function managerReview() {
    {
      state.step = "manager_review";
      state.progress = 0;
      say("centrix", `Not clearly plumbing, so your report went to ${POLICY.manager} for review. They'll handle it, or continue it as a plumbing repair.`);
      renderRepair();
    }
  }

  function managerOverride() {
    say("centrix", `${POLICY.manager} reviewed your report and continued it as a plumbing repair.`);
    state.problem = "leak";
    state.progress = 0;
    state.step = "followup";
    renderRepair();
    withTyping(() => askFollowUp(0));
  }

  function managerKeeps() {
    say("centrix", `${POLICY.manager} will handle this one directly and contact you. No plumber needed.`);
    state.step = "start";
    state.progress = -1;
    state.report = "";
    renderRepair();
    later(() => { say("ai", "Anything else I can help with?"); showProblemChips(); }, 600);
  }

  // The demo buttons in the "Your repair" card, per step
  function demoActions() {
    return {
      manager_review: [["Demo: manager continues as plumbing", managerOverride], ["Demo: manager handles it", managerKeeps]],
      booked: [["Demo: day-before reminder", remind], ["Demo: plumber leaves now", startTrip]],
      reminded: [["Demo: plumber leaves now", startTrip]],
      on_the_way: [["Demo: plumber arrives", arrive]],
      cost_check: [[`Demo: quote within €${fmt(POLICY.preApprovedLimit)}`, () => quote(Math.round(avgPrice() / (1 + POLICY.vat / 100)))], [`Demo: quote over €${fmt(POLICY.preApprovedLimit)}`, () => quote(3480)]],
      approval: [["Demo: manager approves quote", approveQuote]],
      working: [["Demo: plumber finishes", finishJob]],
      followup_wait: [["Demo: seven days later", sevenDays]]
    }[state.step] || [];
  }

  // ---------- live tracking map (only while on the way) ----------

  let trackMap = null, van = null, homePin = null, raf = null;
  function showTracking() {
    const pro = state.plumber;
    $("track").hidden = false;
    $("track-title").textContent = "Plumber on the way";
    $("track-note").textContent = "Getting closer. You'll get a message when they're at the door.";
    setAvatar($("track-avatar"), pro.initials, pro.photo);
    $("track-name").textContent = `${pro.contact ? `${pro.contact} · ` : ""}${pro.name} · ${pro.rating} ★`;
    $("track").scrollIntoView({ behavior: "smooth", block: "start" });

    const home = [HOME.lng, HOME.lat];
    const start = [pro.start[1], pro.start[0]];
    // a simple bent route: start → corner → near home → home
    const route = [start, [start[0], (start[1] + home[1]) / 2], [(start[0] + home[0]) / 2, home[1] - 0.0012], home];

    if (!trackMap) {
      trackMap = new maplibregl.Map({
        container: "track-map",
        style: window.CentrixMap.styleUrl,
        center: home, zoom: 14,
        attributionControl: { compact: true },
        interactive: true, dragRotate: false
      });
      trackMap.on("style.load", () => window.CentrixMap.restyle(trackMap));
    }
    const ready = () => {
      if (trackMap.getSource("route")) trackMap.getSource("route").setData(line(route));
      else {
        trackMap.addSource("route", { type: "geojson", data: line(route) });
        trackMap.addLayer({ id: "route-casing", type: "line", source: "route", paint: { "line-color": "#ffffff", "line-width": 8 }, layout: { "line-cap": "round", "line-join": "round" } });
        trackMap.addLayer({ id: "route", type: "line", source: "route", paint: { "line-color": "#7a3fbf", "line-width": 4, "line-dasharray": [1.5, 1.2] }, layout: { "line-cap": "round", "line-join": "round" } });
      }
      const homeEl = document.createElement("div");
      homeEl.className = "home-pin";
      homeEl.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2.5 7.5 8 3l5.5 4.5V13h-3.5V9.5h-4V13H2.5z" fill="currentColor"/></svg>';
      if (homePin) homePin.remove();
      homePin = new maplibregl.Marker({ element: homeEl }).setLngLat(home).addTo(trackMap);
      const vanEl = document.createElement("div");
      vanEl.className = "van-pin";
      vanEl.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M1.5 4.5h8v6h-8zM9.5 6.5h3l2 2v2h-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="4.5" cy="11.5" r="1.4" fill="currentColor"/><circle cx="12" cy="11.5" r="1.4" fill="currentColor"/></svg>';
      if (van) van.remove();
      van = new maplibregl.Marker({ element: vanEl }).setLngLat(start).addTo(trackMap);
      trackMap.resize();
      trackMap.fitBounds(route.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(start, start)), { padding: 50, duration: 0 });
      drive(route);
    };
    if (trackMap.isStyleLoaded() && trackMap.getLayer("background")) ready(); else trackMap.once("load", ready);
  }

  function drive(route) {
    const total = 15; // minutes shown
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 24000;
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / duration);
      van.setLngLat(along(route, k));
      const left = Math.ceil(total * (1 - k));
      $("eta-min").textContent = left > 0 ? left : "Now";
      $("eta-unit").textContent = left > 0 ? "min" : "";
      if (k > 0.85 && k < 1) $("track-note").textContent = "Almost there. Get ready to open the door.";
      if (k < 1) raf = requestAnimationFrame(step);
      else {
        $("track-title").textContent = "Plumber is at your door";
        $("track-note").textContent = "They've arrived. The status will change once work starts.";
        say("plumber", "I'm outside your building now.");
      }
    };
    raf = requestAnimationFrame(step);
  }

  function stopTracking() {
    cancelAnimationFrame(raf);
    $("track").hidden = true;
  }

  // ---------- cards inside the chat ----------

  function estimateCard(p) {
    const el = div("est");
    const top = div("est-top");
    const tag = span("est-tag" + (state.urgent ? " is-urgent" : ""), state.urgent ? "Urgent" : "Normal priority");
    top.append(h3(p.title), tag);
    const price = div("price");
    price.append(span("price-label", "Estimated price"), span("price-num", `€${p.price[0]} – €${p.price[1]}`));
    const lines = document.createElement("ul");
    lines.className = "price-lines";
    lines.append(
      li(`Call-out fee €${DATA.callOut}`, "included"),
      li("Labour and small parts", `€${p.price[0] - DATA.callOut} – €${p.price[1] - DATA.callOut}`)
    );
    const note = p_("est-note", `Net prices, example ranges. Repairs up to €${fmt(POLICY.preApprovedLimit)} net are pre-approved by your property manager.`);
    const causes = div("est-causes");
    causes.append(span("t-label", "Likely cause"));
    p.causes.forEach((c, i) => causes.append(span("cause-pill" + (i === 0 ? " is-top" : ""), c)));
    el.append(top, price, lines, note, causes);
    return el;
  }

  // Job brief (step 8) with consent (step 9): what's shared, what's withheld, how to get in.
  function briefCard() {
    const el = div("consent");
    const p = DATA.problems[state.problem];
    const list = document.createElement("ul");
    list.className = "consent-list";
    const rows = [
      ["Name and phone", `${HOME.tenant}, ${HOME.phone}`],
      ["Address", `${HOME.address}, ${HOME.floor}`],
      ["Problem", `${state.aiTitle || p.title}${state.urgent ? " (urgent)" : ""}`],
      ["Your answers", state.answers.map((x) => x.a).join(" · ") || "None"],
      ["Photo", state.photo ? "1 photo" : "No photo"],
      ["Shut-off valve", HOME.shutoff],
      ["Repair policy", `Up to €${fmt(POLICY.preApprovedLimit)} net pre-approved`]
    ];
    if (state.linked) rows.push(["Linked case", `${state.linked.id}, ${state.linked.unit}`]);
    if (state.language) rows.push(["Language", `${state.language.name} (brief in German)`]);
    rows.forEach(([k, v]) => list.append(li(k, v, true)));

    const withheldLabel = span("t-label", "Never shared with the plumber");
    const withheld = document.createElement("ul");
    withheld.className = "consent-list is-withheld";
    DATA.withheld.forEach((w) => withheld.append(li(w, "", false, false, "lock")));

    const accessLabel = span("t-label", "How do they get in?");
    const access = div("seg");
    access.setAttribute("role", "radiogroup");
    access.setAttribute("aria-label", "Access");
    [["home", "I'll be home"], ["caretaker", "Key with caretaker"]].forEach(([v, label]) => {
      const b = button("seg-btn", label);
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(state.access === v));
      b.addEventListener("click", () => {
        state.access = v;
        access.querySelectorAll(".seg-btn").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
      });
      access.append(b);
    });

    const actions = div("consent-actions");
    const ok = button("btn-primary btn-lg", "Agree and send");
    ok.addEventListener("click", () => {
      ok.disabled = true;
      ok.classList.add("is-loading");
      setTimeout(() => giveConsent(el), 450);
    });
    const listen = button("btn-ghost btn-lg", "");
    listen.append(iconEl("play"), " Read it to me");
    listen.addEventListener("click", () => speak(`The plumber will receive: ${rows.map(([k, v]) => `${k}: ${v}`).join(". ")}. Your email, owner details, lease and meter numbers are never shared.`));
    actions.append(ok, listen);
    const fine = p_("t-muted t-small", "Only for this repair. Your consent is logged with the time and channel, and you can withdraw it in your settings.");
    el.append(list, withheldLabel, withheld, accessLabel, access, actions, fine);
    return el;
  }

  function noteCard(title, text, foot) {
    const el = div("est");
    el.append(h3(title), p_("est-note", text));
    if (foot) el.append(p_("t-muted t-small", foot));
    return el;
  }

  function reportCard(p) {
    const el = div("est");
    el.append(h3("Work note"));
    el.append(p_("est-note", `Found and fixed: ${p.causes[0].toLowerCase()}. Tested for 10 minutes, no further problems.`));
    if (state.linked) el.append(p_("est-note", `Also checked ${state.linked.unit} for ${state.linked.id}: no new water damage.`));
    return el;
  }

  function buildInvoice() {
    const net = state.quote || avgPrice();
    const vat = Math.round(net * POLICY.vat) / 100;
    return {
      number: `INV-${CASE_ID.replace(/^C(ASE)?-/, "")}-01`,
      lines: [["Call-out", DATA.callOut], ["Labour and parts", net - DATA.callOut]],
      net, vat, gross: net + vat
    };
  }

  function invoiceCard(inv) {
    const el = div("est");
    const top = div("est-top");
    top.append(h3(`Invoice ${inv.number}`), span("est-tag", `Billed to ${POLICY.invoiceTo}`));
    const lines = document.createElement("ul");
    lines.className = "price-lines";
    inv.lines.forEach(([k, v]) => lines.append(li(k, `€${money(v)}`)));
    lines.append(li("Net", `€${money(inv.net)}`), li(`VAT ${POLICY.vat}%`, `€${money(inv.vat)}`), li("Total", `€${money(inv.gross)}`, false, true));
    el.append(top, lines, p_("est-note", `Linked to ${CASE_ID} and ${HOME.unit}. You don't pay this yourself.`));
    return el;
  }

  // ---------- sidebar ----------

  function renderNearby() {
    const list = $("nearby");
    const title = $("nearby-title");
    if (state.plumber) {
      title.textContent = "Your plumber";
      list.replaceChildren(proRow(state.plumber));
      return;
    }
    title.textContent = "Plumbers near you";
    list.replaceChildren(...DATA.plumbers.map((p) => proRow(p)));
  }

  function proRow(p) {
    const row = document.createElement("li");
    row.className = "pro";
    const av = setAvatar(span("avatar", ""), p.initials, p.photo);
    av.setAttribute("aria-hidden", "true");
    const info = div("pro-info");
    info.append(span("pro-name", p.name), span("pro-meta", `${p.contact ? `${p.contact} · ` : ""}${p.distance} · ${p.rating} ★ (${p.reviews}) · from €${p.from}`));
    const next = span("pro-next", state.plumber === p ? (state.slot || "Dispatched") : `Free ${p.next.toLowerCase()}`);
    row.append(av, info, next);
    return row;
  }

  function renderRepair() {
    const status = {
      start: "No open repair. Report a problem in the chat.",
      manager_review: "With your property manager for review.",
      followup: "Reporting a problem…", photo: "Reporting a problem…",
      brief: "Check the job brief and agree.",
      dispatch: "Your property manager is dispatching a plumber…",
      windows: "Pick one of the plumber's times.",
      booked: state.plumber ? `${plumberName()} · ${state.slot}` : "",
      reminded: state.plumber ? `Tomorrow: ${plumberName()} · ${state.slot}` : "",
      on_the_way: "Your plumber is on the way.",
      cost_check: "The plumber is checking the cost on site.",
      approval: "Waiting for your property manager to approve the quote.",
      working: "The plumber is working on it.",
      done: "Done. Please confirm it's fixed.",
      feedback: "Fixed and invoiced. Two quick questions.",
      followup_wait: "Fixed. One more check in seven days.",
      followup_check: "Seven-day check: is it still fixed?",
      closed: "Repair closed. Your home record is updated."
    }[state.step];
    $("repair-status").textContent = status;
    const meta = [];
    if (state.problem && state.step !== "start") meta.push(CASE_ID);
    if (state.urgent && state.step !== "closed") meta.push("Urgent");
    if (state.language) meta.push(state.language.name);
    if (state.linked) meta.push(`Linked: ${state.linked.id}`);
    $("repair-meta").replaceChildren(...meta.map((m) => span("est-tag" + (m === "Urgent" ? " is-urgent" : ""), m)));
    $("repair-steps").replaceChildren(...STEPS.map((s, i) => {
      const item = document.createElement("li");
      item.className = i < state.progress || state.step === "closed" ? "is-done" : i === state.progress ? "is-current" : "";
      if (i === state.progress && state.step !== "closed") item.setAttribute("aria-current", "step");
      item.textContent = s;
      return item;
    }));
    $("demo-actions").replaceChildren(...demoActions().map(([label, run]) => {
      const b = button("demo-btn", label);
      b.addEventListener("click", () => { setActions([]); run(); });
      return b;
    }));
  }

  function renderHome() {
    $("home-facts").replaceChildren(...[
      ["Address", HOME.address],
      ["Floor", HOME.floor],
      ["Phone", HOME.phone],
      ["Access", HOME.access],
      ["Shut-off", HOME.shutoff],
      ["Building", HOME.building],
      ["Repairs", HOME.history.join("\n")]
    ].flatMap(([k, v]) => {
      const dt = document.createElement("dt");
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.textContent = v;
      return [dt, dd];
    }));
  }

  // ---------- voice (browser preview of the ElevenLabs voice agent) ----------

  // Talk to the assistant: tap the microphone and speak. Recording stops by
  // itself when you pause, and the words land in the message field. An answer
  // to a quick-reply question ("today", "a few days", "yes") is sent straight
  // away; anything else waits in the field so you can check it and press send.
  // Using the microphone also turns on spoken replies.
  let listening = null;  // the active recording
  let starting = false;  // waiting for microphone permission
  let draftBase = "";    // text already in the field before dictating
  async function dictate() {
    if (starting) return;
    if (listening) return finishListening();
    starting = true;
    let handle = null;
    let silentEarly = false;
    draftBase = input.value.trim();
    try {
      AI.stopSpeaking();
      handle = await AI.listen({
        onSilence: () => { if (handle && listening === handle) finishListening(); else if (!handle) silentEarly = true; },
        onInterim: (text) => { if (listening === handle) showDraft(text); }
      });
      listening = handle;
      setMic("live");
      if (silentEarly) finishListening();
    } catch (e) {
      setMic("idle");
      toast(/denied|allowed|permission/i.test(e.message) ? "Allow microphone access to talk, or type instead." : "Voice input isn't available here. Type your message instead.");
    }
    starting = false;
  }

  async function finishListening() {
    const handle = listening;
    if (!handle) return;
    listening = null;
    setMic("busy");
    try {
      const r = await handle.stop();
      const text = (r.text || "").trim();
      if (text) {
        voiceReplies = true;
        renderMode();
        showDraft(text);
        if (matchChip(text)) $("composer").requestSubmit();
        else input.focus();
      } else {
        showDraft("");
        toast("I didn't catch that. Try again, or type instead.");
      }
    } catch (e) {
      showDraft("");
      toast("Couldn't understand the recording. Try again, or type instead.");
    }
    setMic("idle");
  }

  // Put dictated words in the message field, after anything already typed.
  function showDraft(text) {
    input.value = [draftBase, text].filter(Boolean).join(" ");
    input.dispatchEvent(new Event("input"));
  }

  function setMic(mode) {
    const btn = $("mic-btn");
    btn.classList.toggle("is-live", mode === "live");
    btn.classList.toggle("is-busy", mode === "busy");
    btn.disabled = mode === "busy";
    btn.setAttribute("aria-pressed", String(mode === "live"));
    btn.setAttribute("aria-label", mode === "live" ? "Stop listening" : "Speak your message");
    btn.dataset.tip = mode === "live" ? "Stop listening" : mode === "busy" ? "Transcribing…" : "Speak";
    input.placeholder = mode === "live" ? "Listening… stops when you pause" : mode === "busy" ? "Transcribing…" : "There's water under my kitchen sink…";
  }

  // ---------- matching a spoken or typed answer to a quick-reply chip ----------

  const NUMBERS = { one: 1, a: 1, an: 1, two: 2, couple: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7, zwei: 2, drei: 3, fünf: 5, sechs: 6, sieben: 7 };
  const YES = /^(yes|yeah|yep|yup|ya|sure|correct|right|indeed|of course|definitely|absolutely|ok yes|ja|jawel|jazeker|klopt|oui|si|sí)\b/;
  const NO = /^(no|nope|nah|not yet|not really|nee|nein|non)\b/;

  function norm(text) {
    return String(text).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[’']/g, "").replace(/[^a-z0-9ß]+/g, " ").trim();
  }

  // "Since when?" answers fall into three buckets, whatever the wording.
  function timeBucket(text) {
    const t = norm(text);
    const days = t.match(/\b(\d+|[a-z]+) (days?|dagen|dag|tage|tagen)\b/);
    const n = days && (/^\d+$/.test(days[1]) ? Number(days[1]) : NUMBERS[days[1]]);
    if (n) return n >= 7 ? "longer" : "few";
    if (/\b(more than|over|longer than|meer dan|langer dan|mehr als|langer als)\b.*\b(days?|dagen|tage)\b/.test(t)) return "longer";
    if (/\b(this week|deze week|diese woche)\b/.test(t)) return "few";
    if (/\b(longer|long time|ages|forever|weeks?|months?|years?|a while|langer|lang|lange|weken|maanden|maand|jaren|lange tijd|wochen|woche|monate|monat|jahre|lange zeit)\b/.test(t)) return "longer";
    if (/\b(few days|couple days|couple of days|several days|days|yesterday|day before yesterday|last night|monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend|gisteren|eergisteren|paar dagen|dagen|gestern|vorgestern|paar tage|tage)\b/.test(t)) return "few";
    if (/\b(today|this morning|this afternoon|this evening|tonight|just now|right now|hours?|minutes?|just started|just happened|vandaag|vanochtend|vanmorgen|vanmiddag|vanavond|zojuist|heute|gerade|stunden?|uur)\b/.test(t)) return "today";
    return null;
  }

  function polarity(text) {
    const t = norm(text);
    if (NO.test(t)) return "no";
    if (YES.test(t)) return "yes";
    return null;
  }

  // Which chip does this answer mean? Returns { label, run } or null.
  // Exact label first, then a unique "Since when?" bucket, then a unique yes/no,
  // then a short answer that contains a chip's label ("I'd say longer").
  function matchChip(text) {
    if (!currentChips.length) return null;
    const t = norm(text);
    if (!t) return null;
    const names = (c) => [norm(c.label), norm(c.shown())].filter(Boolean);
    const unique = (list) => (list.length === 1 ? list[0] : null);

    const exact = unique(currentChips.filter((c) => names(c).includes(t)));
    if (exact) return exact;

    // Only for a "since when" set: every chip in a different time bucket.
    const buckets = currentChips.map((c) => timeBucket(c.label));
    const sinceWhen = buckets.filter(Boolean).length >= 2 && new Set(buckets).size === buckets.length;
    const bucket = sinceWhen && timeBucket(t);
    if (bucket) {
      const byTime = unique(currentChips.filter((c) => names(c).some((n) => timeBucket(n) === bucket)));
      if (byTime) return byTime;
    }

    const words = t.split(" ").length;
    // Only for a yes/no set: at least one "yes" chip and one "no" chip.
    const pols = currentChips.map((c) => polarity(c.label));
    const yesNo = pols.includes("yes") && pols.includes("no");
    const pol = yesNo && words <= 6 ? polarity(t) : null;
    if (pol) {
      const byPol = unique(currentChips.filter((c) => names(c).some((n) => polarity(n) === pol)));
      if (byPol) return byPol;
    }

    const contains = currentChips.filter((c) => names(c).some((n) => words <= n.split(" ").length + 4 && new RegExp(`\\b${n}\\b`).test(t)));
    return unique(contains);
  }

  // Spoken messages: ElevenLabs voice through the server, browser voice as fallback.
  function speak(text) { AI.speak(text); }

  // ---------- chat rendering ----------

  function say(from, text, extra = {}) {
    const msg = { from, text, time: now(), card: extra.card || null, speak: !!extra.speak };
    state.messages.push(msg);
    renderThread();
    const voiced = from === "ai" || from === "plumber";
    const pending = !extra.raw && localize(text, (x) => {
      msg.text = x;
      renderThread();
      if (voiced && voiceReplies) speak(x);
    });
    if (!pending && voiced && voiceReplies) speak(text);
    if (msg.card && !extra.raw) localizeTree(msg.card);
  }

  // Cards (estimate, brief, invoice) follow the tenant's language too
  function localizeTree(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) if (/[a-z]{2}/i.test(walker.currentNode.nodeValue)) nodes.push(walker.currentNode);
    nodes.forEach((n) => localize(n.nodeValue.trim(), (x) => { n.nodeValue = x; }));
  }
  function me(text) { say("me", text); }

  function renderThread() {
    const who = { ai: "Assistant", me: "You", centrix: "centrix", plumber: state.plumber ? plumberFull() : "Plumber" };
    $("thread").replaceChildren(...state.messages.map((m) => {
      const item = document.createElement("li");
      item.className = `t-msg t-msg-${m.from}`;
      if (m.typing) {
        item.classList.add("is-typing");
        item.setAttribute("aria-label", "Assistant is typing");
        item.innerHTML = '<p><span></span><span></span><span></span></p>';
        return item;
      }
      if (m.image) {
        const img = document.createElement("img");
        img.src = m.image;
        img.alt = "Your photo of the problem";
        img.className = "t-photo";
        item.append(img);
      }
      if (m.text) item.append(p_("", m.text));
      if (m.card) item.append(m.card);
      if (m.speak || (voiceLive && (m.from === "ai" || m.from === "plumber"))) {
        // spoken messages (ElevenLabs voice in production) get a play button
        const play = button("t-listen", "");
        play.append(iconEl("play"), " Listen");
        play.setAttribute("aria-label", "Listen to this message");
        play.addEventListener("click", () => speak(m.text));
        item.append(play);
      }
      const small = document.createElement("small");
      small.textContent = `${who[m.from]} · ${m.time}`;
      item.append(small);
      return item;
    }));
    const thread = $("thread");
    thread.scrollTop = thread.scrollHeight;
  }

  function withTyping(fn) {
    const typing = { from: "ai", typing: true };
    state.messages.push(typing);
    setActions([]);
    renderThread();
    setTimeout(() => {
      state.messages.splice(state.messages.indexOf(typing), 1);
      fn();
      renderThread();
    }, 650);
  }
  function later(fn, ms) { setTimeout(fn, ms); }

  // Quick-reply chips under the conversation
  function chips(list, raw) {
    const entries = [];
    setActions(list.map(([label, run, icon]) => {
      const b = button("t-chip", "");
      const text = span("", label);
      b.append(text);
      if (!raw) localize(label, (x) => { text.textContent = x; });
      if (icon) b.prepend(iconEl(icon));
      b.addEventListener("click", () => { setActions([]); run(); });
      entries.push({ label, run, shown: () => text.textContent });
      return b;
    }));
    currentChips = entries;
  }
  function showProblemChips(withOther) {
    const list = Object.entries(DATA.problems).map(([key, p]) => [p.label, () => { me(p.label); withTyping(() => startCase(key)); }]);
    if (withOther) list.push(["Something else", toManager]);
    chips(list);
  }
  function setActions(nodes) {
    currentChips = [];
    $("actions").replaceChildren(...nodes);
    const thread = $("thread");
    thread.scrollTop = thread.scrollHeight;
  }

  // ---------- toast ----------
  let toastTimer = null;
  function toast(text) {
    const box = $("toast");
    clearTimeout(toastTimer);
    const msg = document.createElement("span");
    msg.textContent = text;
    const close = button("toast-close", "");
    close.setAttribute("aria-label", "Dismiss");
    close.innerHTML = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    close.addEventListener("click", () => box.classList.remove("is-open"));
    box.replaceChildren(msg, close);
    box.classList.add("is-open");
    toastTimer = setTimeout(() => box.classList.remove("is-open"), 5000);
  }

  // ---------- helpers ----------

  function classify(text) {
    const t = text.toLowerCase();
    // check the more specific problems first ("toilet keeps running" is not a leak)
    for (const key of ["toilet", "hotwater", "blockage", "leak"]) {
      if (DATA.problems[key].words.some((w) => t.includes(w))) return key;
    }
    return null;
  }
  function line(coords) { return { type: "Feature", geometry: { type: "LineString", coordinates: coords } }; }
  function along(route, k) {
    const seg = [];
    let total = 0;
    for (let i = 1; i < route.length; i++) {
      const d = Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]);
      seg.push(d);
      total += d;
    }
    let target = total * k;
    for (let i = 0; i < seg.length; i++) {
      if (target <= seg[i]) {
        const f = seg[i] ? target / seg[i] : 0;
        return [route[i][0] + (route[i + 1][0] - route[i][0]) * f, route[i][1] + (route[i + 1][1] - route[i][1]) * f];
      }
      target -= seg[i];
    }
    return route[route.length - 1];
  }
  function iconEl(name) {
    const paths = {
      camera: '<path d="M2 5.5h2.5L6 3.5h4l1.5 2H14v7H2z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="8" cy="9" r="2.2" fill="none" stroke="currentColor" stroke-width="1.5"/>',
      clock: '<circle cx="8" cy="8" r="5.8" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 5v3.2l2.2 1.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
      check: '<path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
      play: '<path d="M5 3.5v9l7-4.5z" fill="currentColor"/>',
      lock: '<rect x="3.5" y="7" width="9" height="6.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" stroke-width="1.5"/>'
    };
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 16 16");
    s.setAttribute("width", "14");
    s.setAttribute("height", "14");
    s.setAttribute("aria-hidden", "true");
    s.innerHTML = paths[name];
    return s;
  }
  function div(cls) { const d = document.createElement("div"); d.className = cls; return d; }
  function span(cls, text) { const s = document.createElement("span"); s.className = cls; s.textContent = text; return s; }
  function h3(text) { const h = document.createElement("h3"); h.className = "est-title"; h.textContent = text; return h; }
  function p_(cls, text) { const p = document.createElement("p"); if (cls) p.className = cls; p.textContent = text; return p; }
  function li(k, v, check, strong, icon) {
    const item = document.createElement("li");
    if (strong) item.className = "is-total";
    if (check || icon) item.append(iconEl(icon || "check"));
    item.append(span("k", k), span("v", v));
    return item;
  }
  function button(cls, text) { const b = document.createElement("button"); b.type = "button"; b.className = cls; b.textContent = text; return b; }
  // The plumber as a person ("Stefan Brandt"), and with the company where it matters
  function plumberName() { return state.plumber ? (state.plumber.contact || state.plumber.name) : "the plumber"; }
  function plumberFull() { return state.plumber && state.plumber.contact ? `${state.plumber.contact} (${state.plumber.name})` : plumberName(); }

  // A profile picture when there is one, otherwise the initials
  function setAvatar(el, letters, photo) {
    el.textContent = photo ? "" : letters;
    el.classList.toggle("has-photo", !!photo);
    el.style.backgroundImage = photo ? `url("${photo}")` : "";
    return el;
  }
  function initials(name) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join(""); }
  function avgPrice() { const p = DATA.problems[state.problem]; return Math.round((p.price[0] + p.price[1]) / 2); }
  function fmt(n) { return n.toLocaleString("en-GB"); }
  function money(n) { return n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function now() { return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
})();
