(function () {
  "use strict";

  // Tenant portal: one conversation from "something is wrong" to "it's fixed".
  // No forms: the assistant asks only what centrix doesn't know yet.
  // Everything runs in the browser on data/tenant-data.js (demo only).

  let session = null;
  try { session = JSON.parse(sessionStorage.getItem("centrix.session")); } catch (e) {}
  if (!session || session.role !== "tenant") return; // the guard in <head> already redirects

  const DATA = window.CENTRIX_TENANT;
  const HOME = DATA.home;
  const $ = (id) => document.getElementById(id);
  const STEPS = ["Reported", "Booked", "On the way", "Working", "Done"];

  const state = {
    step: "start",       // start → urgency → photo → choose → slot → consent → booked → on_the_way → working → done → closed
    problem: null,       // key in DATA.problems
    urgent: false,
    photo: null,
    plumber: null,
    slot: null,
    access: "caretaker",
    progress: -1,        // index in STEPS
    messages: []
  };

  // ---------- top bar ----------
  const first = session.name.split(" ")[0];
  $("app-user").textContent = session.name;
  $("app-avatar").textContent = initials(session.name);
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
    onText(text);
  });
  $("photo-btn").addEventListener("click", () => $("photo-input").click());
  $("photo-input").addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (file && file.type.startsWith("image/")) onPhoto(URL.createObjectURL(file));
  });
  $("track-msg").addEventListener("click", () => {
    input.focus();
    input.placeholder = `Message ${state.plumber ? state.plumber.name : "the plumber"}…`;
  });
  $("demo-next").addEventListener("click", demoNext);

  // ---------- conversation ----------
  say("ai", `Hi ${first}, what's going on in your home? Describe it in your own words, or pick one below.`);
  showProblemChips();

  function onText(text) {
    me(text);
    if (state.step === "start") {
      const key = classify(text);
      if (key) return withTyping(() => askUrgency(key));
      return withTyping(() => {
        say("ai", "Thanks. Which of these is closest?");
        showProblemChips();
      });
    }
    if (["booked", "on_the_way", "working"].includes(state.step)) {
      return later(() => say("centrix", `Sent to ${state.plumber.name}. They'll reply here.`), 400);
    }
    withTyping(() => say("ai", "Noted, I've added that to your report for the plumber."));
  }

  function askUrgency(key) {
    const p = DATA.problems[key];
    state.problem = key;
    state.step = "urgency";
    state.progress = 0;
    renderRepair();
    say("ai", `That sounds like: ${p.title.toLowerCase()}. ${p.question}`);
    chips([
      [p.yes, () => { me(p.yes); state.urgent = true; withTyping(askPhoto); }],
      [p.no, () => { me(p.no); state.urgent = false; withTyping(askPhoto); }]
    ]);
  }

  function askPhoto() {
    state.step = "photo";
    say("ai", "A photo helps the plumber bring the right parts. Want to add one?");
    chips([
      ["Add a photo", () => $("photo-input").click(), "camera"],
      ["Skip", () => { me("Skip the photo"); withTyping(showEstimate); }]
    ]);
  }

  function onPhoto(url) {
    if (state.step !== "photo") {
      state.messages.push({ from: "me", image: url, time: now() });
      renderThread();
      return;
    }
    state.photo = url;
    state.messages.push({ from: "me", image: url, time: now() });
    renderThread();
    withTyping(showEstimate);
  }

  function showEstimate() {
    const p = DATA.problems[state.problem];
    state.step = "choose";
    say("ai", "Here's what I think it is, and what it usually costs:", { card: estimateCard(p) });
    say("ai", "These plumbers near you can help. Pick one:");
    showPlumberCards();
  }

  function choosePlumber(pro) {
    state.plumber = pro;
    me(`${pro.name}`);
    withTyping(() => {
      state.step = "slot";
      say("ai", `${pro.name} can come at these times. Which suits you?`);
      chips(pro.slots.map((s) => [s, () => chooseSlot(s), "clock"]));
    });
  }

  function chooseSlot(slot) {
    state.slot = slot;
    me(slot);
    withTyping(() => {
      state.step = "consent";
      say("ai", `Before I book, this is what ${state.plumber.name} will see:`, { card: consentCard() });
      setActions([]);
    });
  }

  function book(card) {
    state.step = "booked";
    state.progress = 1;
    // lock the consent card so it reads as a record, not an open question
    card.classList.add("is-done");
    card.querySelectorAll("button").forEach((b) => { b.disabled = true; b.classList.remove("is-loading"); });
    const okBtn = card.querySelector(".btn-primary");
    okBtn.textContent = "Booked ✓";
    me("Agree and book");
    setActions([]);
    const access = state.access === "home" ? "tenant at home" : "key with the caretaker";
    withTyping(() => {
      say("centrix", `Booked with ${state.plumber.name}, ${state.slot} (${access}). Consent saved at ${now()} via the portal.`);
      say("ai", "You're all set. You'll see every update here, and a live map once the plumber is on the way.");
      renderRepair();
      renderNearby();
      toast("Plumber booked. You can follow the repair here.");
    });
  }

  function confirmFixed(ok) {
    setActions([]);
    if (ok) {
      me("Yes, it's fixed");
      state.step = "closed";
      state.progress = 4;
      renderRepair();
      withTyping(() => {
        say("centrix", `Repair closed. The work report and invoice are saved on ${HOME.unit}.`);
        say("ai", "Glad it's sorted. If anything else comes up, just tell me here.");
        toast("Repair closed. Thanks for confirming.");
      });
    } else {
      me("No, it's not fixed yet");
      state.step = "booked";
      state.progress = 1;
      renderRepair();
      withTyping(() => {
        say("ai", `Sorry about that. I've asked ${state.plumber.name} to come back at no extra cost. You'll get a new time here.`);
      });
    }
  }

  // ---------- demo controls: move the job forward as the plumber would ----------

  function demoNext() {
    if (state.step === "booked") return startTrip();
    if (state.step === "on_the_way") return arrive();
    if (state.step === "working") return finishJob();
  }

  function startTrip() {
    state.step = "on_the_way";
    state.progress = 2;
    renderRepair();
    say("centrix", `${state.plumber.name} is on the way.`);
    later(() => say("plumber", `Hi ${first}, I'm on my way. See you in about 15 minutes.`), 900);
    showTracking();
  }

  function arrive() {
    stopTracking();
    state.step = "working";
    state.progress = 3;
    renderRepair();
    say("centrix", `${state.plumber.name} has arrived and started the work.`);
  }

  function finishJob() {
    const p = DATA.problems[state.problem];
    state.step = "done";
    state.progress = 4;
    renderRepair();
    say("plumber", "All done. Here's what I did:", { card: reportCard(p) });
    later(() => {
      say("ai", "Is the problem fixed?");
      chips([
        ["Yes, it's fixed", () => confirmFixed(true), "check"],
        ["No, not yet", () => confirmFixed(false)]
      ]);
    }, 700);
  }

  // ---------- live tracking map (only while on the way) ----------

  let trackMap = null, van = null, raf = null;
  function showTracking() {
    const pro = state.plumber;
    $("track").hidden = false;
    $("track-avatar").textContent = pro.initials;
    $("track-name").textContent = `${pro.name} · ${pro.rating} ★`;
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
      new maplibregl.Marker({ element: homeEl }).setLngLat(home).addTo(trackMap);
      const vanEl = document.createElement("div");
      vanEl.className = "van-pin";
      vanEl.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M1.5 4.5h8v6h-8zM9.5 6.5h3l2 2v2h-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="4.5" cy="11.5" r="1.4" fill="currentColor"/><circle cx="12" cy="11.5" r="1.4" fill="currentColor"/></svg>';
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
    const note = p_("est-note", "The plumber confirms the final price with you before starting. Example prices.");
    const causes = div("est-causes");
    causes.append(span("t-label", "Likely cause"));
    p.causes.forEach((c, i) => causes.append(span("cause-pill" + (i === 0 ? " is-top" : ""), c)));
    el.append(top, price, lines, note, causes);
    return el;
  }

  function consentCard() {
    const el = div("consent");
    const list = document.createElement("ul");
    list.className = "consent-list";
    const p = DATA.problems[state.problem];
    [
      ["Name and phone", `${HOME.tenant}, ${HOME.phone}`],
      ["Address", `${HOME.address}, ${HOME.floor}`],
      ["Problem", `${p.title}${state.urgent ? " (urgent)" : ""}`],
      ["Photo", state.photo ? "1 photo" : "No photo"],
      ["Time", state.slot]
    ].forEach(([k, v]) => list.append(li(k, v, true)));

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
    const ok = button("btn-primary btn-lg", "Agree and book");
    ok.addEventListener("click", () => {
      ok.disabled = true;
      ok.classList.add("is-loading");
      setTimeout(() => book(el), 450);
    });
    const change = button("btn-ghost btn-lg", "Change time");
    change.addEventListener("click", () => {
      say("ai", "No problem. Pick another time:");
      chips(state.plumber.slots.map((s) => [s, () => chooseSlot(s), "clock"]));
    });
    actions.append(ok, change);
    const fine = p_("t-muted t-small", "Only for this repair. You can withdraw consent in your settings.");
    el.append(list, accessLabel, access, actions, fine);
    return el;
  }

  function reportCard(p) {
    const el = div("est");
    const price = Math.round((p.price[0] + p.price[1]) / 2);
    el.append(h3("Work report"));
    el.append(p_("est-note", `Fixed: ${p.causes[0].toLowerCase()}. Tested for 10 minutes, no further problems.`));
    const lines = document.createElement("ul");
    lines.className = "price-lines";
    lines.append(li("Call-out", `€${DATA.callOut}`), li("Labour and parts", `€${price - DATA.callOut}`), li("Total", `€${price}`, false, true));
    el.append(lines);
    return el;
  }

  // ---------- sidebar ----------

  function renderNearby() {
    const list = $("nearby");
    const title = $("nearby-title");
    if (state.plumber && state.progress >= 1) {
      title.textContent = "Your plumber";
      list.replaceChildren(proRow(state.plumber, false));
      return;
    }
    title.textContent = "Plumbers near you";
    list.replaceChildren(...DATA.plumbers.map((p) => proRow(p, false)));
  }

  function proRow(p, withButton) {
    const row = document.createElement("li");
    row.className = "pro";
    const av = span("avatar", p.initials);
    av.setAttribute("aria-hidden", "true");
    const info = div("pro-info");
    info.append(span("pro-name", p.name), span("pro-meta", `${p.distance} · ${p.rating} ★ (${p.reviews}) · from €${p.from}`));
    const booked = state.plumber === p && state.progress >= 1;
    const next = span("pro-next", booked ? state.slot : `Free ${p.next.toLowerCase()}`);
    row.append(av, info, next);
    if (withButton) {
      const b = button("btn-ghost pro-choose", "Choose");
      b.setAttribute("aria-label", `Choose ${p.name}`);
      b.addEventListener("click", () => { setActions([]); choosePlumber(p); });
      row.append(b);
    }
    return row;
  }

  function renderRepair() {
    const status = {
      start: "No open repair. Report a problem in the chat.",
      urgency: "Reporting a problem…", photo: "Reporting a problem…", choose: "Choosing a plumber…",
      slot: "Choosing a time…", consent: "Almost booked…",
      booked: state.plumber ? `${state.plumber.name} · ${state.slot}` : "",
      on_the_way: "Your plumber is on the way.",
      working: "The plumber is working on it.",
      done: "Done. Please confirm it's fixed.",
      closed: "Repair closed. Report and invoice saved."
    }[state.step];
    $("repair-status").textContent = status;
    $("repair-steps").replaceChildren(...STEPS.map((s, i) => {
      const item = document.createElement("li");
      item.className = i < state.progress || state.step === "closed" ? "is-done" : i === state.progress ? "is-current" : "";
      if (i === state.progress && state.step !== "closed") item.setAttribute("aria-current", "step");
      item.textContent = s;
      return item;
    }));
    const demo = $("demo-next");
    const label = { booked: "Demo: plumber leaves now", on_the_way: "Demo: plumber starts work", working: "Demo: plumber finishes" }[state.step];
    demo.hidden = !label;
    if (label) demo.textContent = label;
  }

  function renderHome() {
    $("home-facts").replaceChildren(...[
      ["Address", HOME.address],
      ["Floor", HOME.floor],
      ["Phone", HOME.phone],
      ["Access", HOME.access],
      ["Building", HOME.building]
    ].flatMap(([k, v]) => {
      const dt = document.createElement("dt");
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.textContent = v;
      return [dt, dd];
    }));
  }

  // ---------- chat rendering ----------

  function say(from, text, extra = {}) {
    state.messages.push({ from, text, time: now(), card: extra.card || null });
    renderThread();
  }
  function me(text) { say("me", text); }

  function renderThread() {
    const who = { ai: "Assistant", me: "You", centrix: "centrix", plumber: state.plumber ? state.plumber.name : "Plumber" };
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
  function chips(list) {
    setActions(list.map(([label, run, icon]) => {
      const b = button("t-chip", label);
      if (icon) b.prepend(iconEl(icon));
      b.addEventListener("click", () => { setActions([]); run(); });
      return b;
    }));
  }
  function showProblemChips() {
    chips(Object.entries(DATA.problems).map(([key, p]) => [p.label, () => { me(p.label); withTyping(() => askUrgency(key)); }]));
  }
  function showPlumberCards() {
    const list = document.createElement("ul");
    list.className = "t-pros t-pros-pick";
    DATA.plumbers.forEach((p) => list.append(proRow(p, true)));
    setActions([list]);
  }
  function setActions(nodes) {
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
      check: '<path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>'
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
  function li(k, v, check, strong) {
    const item = document.createElement("li");
    if (strong) item.className = "is-total";
    if (check) item.append(iconEl("check"));
    item.append(span("k", k), span("v", v));
    return item;
  }
  function button(cls, text) { const b = document.createElement("button"); b.type = "button"; b.className = cls; b.textContent = text; return b; }
  function initials(name) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join(""); }
  function now() { return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
})();
