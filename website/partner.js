(function () {
  "use strict";

  // Partner dashboard: jobs on a map (left list, pins, right detail panel).
  // Everything runs in the browser on the demo data in data/partner-jobs.js.

  let session = null;
  try { session = JSON.parse(sessionStorage.getItem("centrix.session")); } catch (e) {}
  if (!session || session.role !== "partner") return; // the guard in <head> already redirects

  const JOBS = window.CENTRIX_PARTNER_JOBS || [];
  const STATUS = {
    new: "New",
    scheduled: "Scheduled",
    in_progress: "In progress",
    done: "Done"
  };
  const POLICY = window.CENTRIX_PARTNER_POLICY;
  // The partner's part of the final workflow, in order (steps 10–21)
  const FLOW = [
    "Job accepted",
    "3 time windows proposed",
    "Tenant picked a slot",
    "On the way, ETA sent",
    `Cost check (up to €${fmt(POLICY.preApprovedLimit)})`,
    "Repair done, work note",
    "Tenant confirmed the fix",
    "Invoice sent",
    "Seven-day follow-up"
  ];
  // Where each stage sits in FLOW (the step that is current)
  const STAGE_AT = { review: 0, propose: 1, awaiting_pick: 2, booked: 3, on_the_way: 4, cost_check: 4, approval: 4, working: 5, confirm: 6, invoice: 7, follow_up: 8, closed: 9 };
  const ICONS = {
    check: '<path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
    van: '<path d="M1.5 4.5h8v6h-8zM9.5 6.5h3l2 2v2h-5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="4.5" cy="11.5" r="1.4" fill="currentColor"/><circle cx="12" cy="11.5" r="1.4" fill="currentColor"/>',
    flag: '<path d="M4 14V2.5M4 3h8l-1.8 3L12 9H4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
    clock: '<circle cx="8" cy="8" r="5.8" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 5v3.2l2.2 1.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    pin: '<path d="M8 14.5s4.5-4.2 4.5-7.8a4.5 4.5 0 0 0-9 0c0 3.6 4.5 7.8 4.5 7.8z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="6.6" r="1.6" fill="currentColor"/>',
    euro: '<path d="M11.5 4.2A4.5 4.5 0 1 0 11.5 11.8M2.5 7h6.5M2.5 9h6.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    send: '<path d="M2.5 8 13.5 3 10 13.5 7.5 9z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
    mic: '<rect x="5.5" y="1.8" width="5" height="8" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    lock: '<rect x="3.5" y="7" width="9" height="6.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" stroke-width="1.5"/>',
    chat: '<path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>'
  };

  const $ = (id) => document.getElementById(id);
  const workspace = document.querySelector(".workspace");
  let filter = "all";
  let selectedId = null;

  // ---------- top bar ----------

  $("app-user").textContent = session.name;
  $("app-avatar").textContent = initials(session.name);
  $("logout").addEventListener("click", (event) => {
    const btn = event.currentTarget;
    btn.disabled = true;
    btn.setAttribute("aria-busy", "true");
    btn.querySelector(".btn-label").textContent = "Logging out…";
    sessionStorage.removeItem("centrix.session");
    setTimeout(() => { location.href = "login.html?role=partner"; }, 350);
  });

  // ---------- map ----------

  // A vector street map (OpenFreeMap, no API key), restyled in restyle()
  // to white land with purple roads, like a branded Google Maps.
  const map = new maplibregl.Map({
    container: "map",
    style: window.CentrixMap.styleUrl,
    center: [6.0858, 50.7752],
    zoom: 14.5,
    attributionControl: { compact: true },
    dragRotate: false,
    pitchWithRotate: false
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new FitAllControl(), "bottom-right");
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
  map.on("style.load", restyle);
  map.once("load", () => {
    map.resize();
    fitAll(false);
    $("map").classList.add("is-ready");
  });

  const popup = new maplibregl.Popup({ offset: [0, -38], maxWidth: "300px", focusAfterOpen: false });
  let popupJobId = null;
  popup.on("close", () => { popupJobId = null; });

  const markers = {};
  JOBS.forEach((job) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "pin-wrap";
    el.setAttribute("aria-label", `${job.service}, ${job.address}. ${STATUS[job.status]}.`);
    el.dataset.tip = job.service;
    const pin = document.createElement("span");
    pin.className = "pin";
    el.append(pin);
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      select(job.id);
    });
    markers[job.id] = { el, pin, marker: new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([job.lng, job.lat]).addTo(map) };
  });

  // ---------- panels ----------

  setupTabs(["tab-jobs", "tab-legend"]);
  setupTabs(["dt-info", "dt-chat"]);

  renderLegend();
  renderFilters();
  renderList();
  refreshPins();

  $("d-close").addEventListener("click", closeDetail);

  // Esc closes the job (or first the map card)
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !selectedId) return;
    if (document.activeElement === $("composer-input") && $("composer-input").value) return;
    closeDetail();
  });

  // Chat composer: Send only works when there is text
  const input = $("composer-input");
  const send = $("send");
  input.addEventListener("input", () => { send.disabled = !input.value.trim(); });
  $("composer").addEventListener("submit", (event) => {
    event.preventDefault();
    const text = input.value.trim();
    const job = current();
    if (!text || !job) return;
    const msg = { from: "partner", time: now(), text, state: "sending" };
    job.messages.push(msg);
    input.value = "";
    send.disabled = true;
    renderThread(job);
    setTimeout(() => {
      msg.state = "sent";
      if (current() === job) renderThread(job);
    }, 700);
  });

  // ---------- rendering ----------

  function renderStats() {
    const count = (s) => JOBS.filter((j) => j.status === s).length;
    const urgent = JOBS.filter((j) => j.urgency === "urgent" && j.status !== "done").length;
    $("stats").replaceChildren(
      stat(count("new"), "New", "sun"),
      stat(count("scheduled") + count("in_progress"), "Planned"),
      stat(urgent, "Urgent", urgent ? "alert" : "")
    );
  }

  function stat(value, label, tone) {
    const el = document.createElement("div");
    el.className = "stat" + (tone ? ` is-${tone}` : "");
    const b = document.createElement("b");
    b.textContent = value;
    const span = document.createElement("span");
    span.textContent = label;
    el.append(b, span);
    return el;
  }

  function renderFilters() {
    const options = [["all", "All"], ...Object.entries(STATUS)];
    $("filters").replaceChildren(...options.map(([value, label]) => {
      const n = value === "all" ? JOBS.length : JOBS.filter((j) => j.status === value).length;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      if (value !== "all") btn.dataset.status = value;
      btn.setAttribute("aria-pressed", String(filter === value));
      btn.disabled = n === 0 && value !== "all" && filter !== value;
      if (value !== "all") {
        const dot = document.createElement("span");
        dot.className = "dot";
        dot.setAttribute("aria-hidden", "true");
        btn.append(dot);
      }
      const num = document.createElement("span");
      num.className = "chip-count";
      num.textContent = n;
      btn.append(label, num);
      btn.addEventListener("click", () => {
        filter = filter === value ? "all" : value;
        renderFilters();
        renderList();
        refreshPins();
        const chip = $("filters").querySelectorAll(".chip")[options.findIndex(([v]) => v === value)];
        if (chip) chip.focus();
      });
      return btn;
    }));
  }

  function renderList() {
    renderStats();
    const list = $("job-list");
    const visible = JOBS
      .filter((j) => filter === "all" || j.status === filter)
      .sort((a, b) => rank(a) - rank(b));

    if (!visible.length) {
      const li = document.createElement("li");
      li.className = "empty";
      const p = document.createElement("p");
      p.textContent = `No ${STATUS[filter].toLowerCase()} jobs right now.`;
      const reset = document.createElement("button");
      reset.type = "button";
      reset.className = "text-btn";
      reset.textContent = "Show all jobs";
      reset.addEventListener("click", () => { filter = "all"; renderFilters(); renderList(); refreshPins(); });
      li.append(p, reset);
      list.replaceChildren(li);
      return;
    }

    list.replaceChildren(...visible.map((job) => {
      const urgent = job.urgency === "urgent" && job.status !== "done";
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "job" + (urgent ? " is-urgent" : "");
      btn.dataset.status = job.status;
      if (job.id === selectedId) btn.setAttribute("aria-current", "true");

      const dot = document.createElement("span");
      dot.className = "dot";
      dot.setAttribute("aria-hidden", "true");
      const title = document.createElement("span");
      title.className = "job-title";
      title.textContent = job.service;
      const tag = document.createElement("span");
      tag.className = "job-tag" + (urgent ? " is-urgent" : "");
      tag.textContent = urgent ? "Urgent" : STATUS[job.status];
      const meta = document.createElement("span");
      meta.className = "job-meta";
      meta.textContent = `${job.address} · ${job.reported}`;
      const chev = document.createElement("span");
      chev.className = "job-chev";
      chev.setAttribute("aria-hidden", "true");
      chev.innerHTML = '<svg viewBox="0 0 16 16" width="12" height="12"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

      btn.append(dot, title, tag, meta, chev);
      btn.addEventListener("click", () => select(job.id));
      li.append(btn);
      return li;
    }));
  }

  function renderLegend() {
    $("legend").replaceChildren(...Object.entries(STATUS).map(([value, label]) => {
      const li = document.createElement("li");
      li.dataset.status = value;
      const dot = document.createElement("span");
      dot.className = "dot";
      dot.setAttribute("aria-hidden", "true");
      li.append(dot, label);
      return li;
    }));
  }

  function select(id) {
    const wasOpen = !!selectedId;
    selectedId = id;
    const job = current();
    renderList();
    refreshPins();
    renderDetail(job);
    openPopup(job);
    map.easeTo({ center: [job.lng, job.lat], padding: mapPadding(), duration: 600 });
    if (!wasOpen) {
      // first open: slide the panel in and land on the Job tab
      $("dt-info").click();
    }
  }

  function closeDetail() {
    const id = selectedId;
    selectedId = null;
    $("detail").hidden = true;
    workspace.classList.remove("has-detail");
    popup.remove();
    refreshPins();
    renderList();
    // give keyboard focus back to the job in the list
    const back = [...document.querySelectorAll(".job")].find((b) => b.querySelector(".job-title").textContent === (JOBS.find((j) => j.id === id) || {}).service);
    if (back) back.focus();
  }

  function openPopup(job) {
    popupJobId = job.id;
    popup.setLngLat([job.lng, job.lat]).setDOMContent(popupContent(job)).addTo(map);
  }

  function renderDetail(job) {
    $("detail").hidden = false;
    workspace.classList.add("has-detail");
    $("d-id").textContent = `${job.id} · ${job.category}`;
    $("d-title").textContent = job.service;

    const badges = [badge(STATUS[job.status], job.status)];
    if (job.urgency === "urgent" && job.status !== "done") badges.push(badge("Urgent", null, true));
    badges.push(badge(job.photos ? `${job.photos} photo${job.photos > 1 ? "s" : ""}` : "No photos"));
    $("d-badges").replaceChildren(...badges);

    $("d-desc").textContent = `“${job.description}”`;

    $("d-causes").replaceChildren(...job.causes.map((c) => {
      const li = document.createElement("li");
      const row = document.createElement("div");
      row.className = "cause-row";
      const name = document.createElement("span");
      name.textContent = c.name;
      const pct = document.createElement("span");
      pct.textContent = `${c.likelihood}%`;
      row.append(name, pct);
      const bar = document.createElement("div");
      bar.className = "bar";
      bar.setAttribute("role", "img");
      bar.setAttribute("aria-label", `${c.likelihood}% likely`);
      const fill = document.createElement("i");
      fill.style.width = `${c.likelihood}%`;
      bar.append(fill);
      li.append(row, bar);
      return li;
    }));

    const props = [
      ["Case", job.caseId],
      ["Address", job.address],
      ["Area", job.district],
      ["Floor", job.floor],
      ["Tenant", job.tenant],
      ["Language", job.language && job.language !== "German" ? `${job.language} (your brief is in German)` : "German"],
      ["Access", job.access],
      ["Time slot", job.slot],
      ["Reported", job.reported]
    ];
    if (job.shutoff) props.splice(7, 0, ["Shut-off", job.shutoff]);
    $("d-props").replaceChildren(...props.flatMap(([k, v]) => {
      const dt = document.createElement("dt");
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.textContent = v;
      return [dt, dd];
    }));

    renderSteps(job);
    renderBrief(job);
    renderFlow(job);
    renderActions(job);
    renderThread(job);
  }

  // Job brief (step 8) and consent record (step 9): what the tenant agreed to share
  function renderBrief(job) {
    const box = $("d-brief");
    const rows = [];
    if (job.answers && job.answers.length) rows.push(["Tenant's answers", job.answers.join(" · ")]);
    if (job.linkedCase) rows.push(["Linked case", `${job.linkedCase.id}, ${job.linkedCase.unit}: “${job.linkedCase.text}”. One visit covers both.`]);
    rows.push(["Repair policy", `Up to €${fmt(POLICY.preApprovedLimit)} net pre-approved. Above that, ${POLICY.manager} approves your quote first.`]);
    if (job.consent) rows.push(["Consent", `Given ${job.consent.at} via ${job.consent.channel.toLowerCase()}`]);
    const dl = document.createElement("dl");
    dl.className = "props";
    rows.forEach(([k, v]) => {
      const dt = document.createElement("dt");
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.textContent = v;
      dl.append(dt, dd);
    });
    const label = document.createElement("p");
    label.className = "wf-label";
    label.textContent = "Not shared with you";
    const withheld = document.createElement("ul");
    withheld.className = "wf-withheld";
    POLICY.withheld.forEach((w) => {
      const li = document.createElement("li");
      li.innerHTML = `<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">${ICONS.lock}</svg>`;
      li.append(w);
      withheld.append(li);
    });
    box.replaceChildren(dl, label, withheld);
  }

  // The partner's steps of the workflow, with done / current markers
  function renderFlow(job) {
    const at = STAGE_AT[job.stage] ?? 0;
    $("d-flow").replaceChildren(...FLOW.map((s, i) => {
      const li = document.createElement("li");
      li.className = i < at ? "is-done" : i === at ? "is-current" : "";
      if (i === at) li.setAttribute("aria-current", "step");
      li.textContent = s;
      return li;
    }));
  }

  // Progress line: New → Scheduled → In progress → Done
  function renderSteps(job) {
    const order = Object.keys(STATUS);
    const at = order.indexOf(job.status);
    $("d-steps").replaceChildren(...order.map((s, i) => {
      const li = document.createElement("li");
      li.className = i < at ? "is-done" : i === at ? "is-current" : "";
      if (i === at) li.setAttribute("aria-current", "step");
      li.textContent = STATUS[s];
      return li;
    }));
  }

  // The next step for this job, based on its stage in the final workflow.
  // Every real step has Undo; "Demo:" buttons play the tenant or the manager.
  function renderActions(job) {
    const box = $("d-actions");
    const card = document.createElement("div");
    card.className = "wf-card";
    const title = document.createElement("p");
    title.className = "wf-label";
    title.textContent = job.stage === "closed" ? "Case closed" : "Next step";
    card.append(title);

    const chat = document.createElement("button");
    chat.type = "button";
    chat.className = "btn-ghost btn-lg";
    chat.innerHTML = `<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">${ICONS.chat}</svg>`;
    chat.append(" Message");
    chat.setAttribute("aria-label", `Message ${job.tenant}`);
    chat.addEventListener("click", () => {
      $("dt-chat").click();
      input.focus();
    });

    const build = STAGES[job.stage] || STAGES.review;
    build(job, card);
    const row = document.createElement("div");
    row.className = "wf-row";
    row.append(chat);
    box.replaceChildren(card, row);
  }

  const STAGES = {
    // Step 10: the manager dispatched this job to you. Accept it.
    review(job, card) {
      card.append(note("The manager dispatched this job to you. Check the brief, then accept it."));
      card.append(primary("Accept job", "check", () => go(job, "Job accepted. Propose 3 time windows next.", () => {
        job.status = "scheduled";
        job.stage = "propose";
        job.slot = "Waiting for your 3 time windows";
        log(job, "centrix", "Job accepted. The tenant has been notified.");
      })));
    },

    // Step 11: propose 3 time windows (typed or dictated). 12b sends you back here.
    propose(job, card) {
      card.append(note("Propose 3 time windows. The tenant picks one, by tap or by voice."));
      const fields = [0, 1, 2].map((i) => {
        const wrap = document.createElement("label");
        wrap.className = "wf-field";
        const span = document.createElement("span");
        span.textContent = `Window ${i + 1}`;
        const inp = document.createElement("input");
        inp.type = "text";
        inp.autocomplete = "off";
        inp.placeholder = POLICY.suggestedWindows[i];
        wrap.append(span, inp);
        card.append(wrap);
        return inp;
      });
      const error = errorLine();
      const tools = document.createElement("div");
      tools.className = "wf-tools";
      const suggest = textBtn("Use suggested times", () => {
        fields.forEach((f, i) => { f.value = POLICY.suggestedWindows[i]; });
        error.textContent = "";
      });
      tools.append(suggest, micBtn((text) => {
        const empty = fields.find((f) => !f.value.trim()) || fields[2];
        empty.value = text;
      }));
      card.append(tools, error);
      card.append(primary("Send 3 windows to the tenant", "send", () => {
        const values = fields.map((f) => f.value.trim());
        if (values.some((v) => !v)) { error.textContent = "Fill in all 3 windows, or use the suggested times."; fields[values.findIndex((v) => !v)].focus(); return false; }
        if (new Set(values.map((v) => v.toLowerCase())).size < 3) { error.textContent = "The 3 windows must be different."; return false; }
        return go(job, "Windows sent. The tenant picks one.", () => {
          job.windows = values;
          job.stage = "awaiting_pick";
          job.slot = "Tenant is choosing";
          log(job, "partner", `I can come: ${values.join(", ")}.`);
        });
      }));
    },

    // Step 12: the tenant picks one, or none fit.
    awaiting_pick(job, card) {
      card.append(note("Waiting for the tenant to pick one of your windows:"));
      card.append(list(job.windows));
      card.append(...job.windows.map((w, i) => demo(`Demo: tenant picks window ${i + 1}`, () => change(job, () => {
        job.stage = "booked";
        job.slot = w;
        job.reminder = "Day-before reminder scheduled for the tenant";
        log(job, "tenant", `${w} works for me.`);
        log(job, "centrix", `Confirmation sent to ${job.tenant} and ${POLICY.manager}: ${w}.`);
      }))));
      card.append(demo("Demo: none of these fit", () => change(job, () => {
        job.stage = "propose";
        job.slot = "Waiting for new time windows";
        log(job, "tenant", "None of these times work for me. Could you propose new ones?");
      })));
    },

    // Steps 13–15: booked, reminder, then "on the way" with a spoken ETA.
    booked(job, card) {
      card.append(note(`Booked: ${job.slot}.${job.reminder ? ` ${job.reminder}.` : ""}`));
      const label = document.createElement("p");
      label.className = "wf-label";
      label.textContent = "ETA when you leave";
      const seg = document.createElement("div");
      seg.className = "wf-seg";
      seg.setAttribute("role", "radiogroup");
      seg.setAttribute("aria-label", "ETA in minutes");
      let eta = 15;
      [10, 15, 20, 30].forEach((m) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = `${m} min`;
        b.setAttribute("role", "radio");
        b.setAttribute("aria-checked", String(m === eta));
        b.addEventListener("click", () => {
          eta = m;
          seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
        });
        seg.append(b);
      });
      card.append(label, seg);
      card.append(primary("I'm on the way", "van", () => go(job, `The tenant hears your ETA: about ${eta} minutes.`, () => {
        job.status = "in_progress";
        job.stage = "on_the_way";
        job.eta = eta;
        log(job, "centrix", `Spoken ETA sent to ${job.tenant}: about ${eta} minutes.`);
      })));
    },

    on_the_way(job, card) {
      card.append(note(`On the way. The tenant expects you in about ${job.eta || 15} minutes.`));
      card.append(primary("I've arrived", "pin", () => go(job, "Check the cost before you start.", () => {
        job.stage = "cost_check";
        log(job, "partner", "I've arrived.");
      })));
    },

    // Step 16: on-site cost check against the pre-approved limit (16b: manager approves).
    cost_check(job, card) {
      card.append(note(`Before you start: does the repair stay within €${fmt(POLICY.preApprovedLimit)} net?`));
      const { wrap, inp } = numberField("Your quote, € net", job.quote || "");
      const error = errorLine();
      card.append(wrap, error);
      card.append(primary("Check cost", "euro", () => {
        const net = Number(inp.value);
        if (!inp.value || !(net > 0)) { error.textContent = "Enter your quote in euros, for example 140."; inp.focus(); return false; }
        const within = net <= POLICY.preApprovedLimit;
        return go(job, within ? "Within the limit. You can start." : "Over the limit. Waiting for the manager.", () => {
          job.quote = net;
          job.stage = within ? "working" : "approval";
          log(job, "centrix", within
            ? `Quote €${fmt(net)} net is within the €${fmt(POLICY.preApprovedLimit)} pre-approved limit. Repair can start.`
            : `Quote €${fmt(net)} net is over the €${fmt(POLICY.preApprovedLimit)} limit. Sent to ${POLICY.manager} for approval.`);
        });
      }));
    },

    approval(job, card) {
      card.append(note(`Your quote of €${fmt(job.quote)} net is with ${POLICY.manager}. Don't start until it's approved.`));
      card.append(demo("Demo: manager approves the quote", () => change(job, () => {
        job.stage = "working";
        log(job, "centrix", `${POLICY.manager} approved the quote of €${fmt(job.quote)} net. You can start.`);
      })));
    },

    // Step 17: repair done, with a typed or dictated work note.
    working(job, card) {
      card.append(note("Repair in progress. When you're done, add a work note: what you found and what you fixed."));
      const area = document.createElement("textarea");
      area.className = "wf-input";
      area.rows = 3;
      area.placeholder = "Found a loose nut on the trap. Tightened it, replaced the seal, tested 10 minutes.";
      area.value = job.workNote || "";
      area.setAttribute("aria-label", "Work note");
      const error = errorLine();
      const tools = document.createElement("div");
      tools.className = "wf-tools";
      tools.append(micBtn((text) => { area.value = (area.value ? area.value + " " : "") + text; }));
      card.append(area, tools, error);
      card.append(primary("Mark repair done", "flag", () => {
        const text = area.value.trim();
        if (text.length < 10) { error.textContent = "Write a short work note first (at least a sentence)."; area.focus(); return false; }
        return go(job, "Work note saved. The tenant is asked to confirm the fix.", () => {
          job.workNote = text;
          job.stage = "confirm";
          log(job, "partner", `Work note: ${text}`);
          log(job, "centrix", `${job.tenant} is asked to confirm the repair worked.`);
        });
      }));
    },

    // Step 18: the tenant confirms the fix. No invoice before that.
    confirm(job, card) {
      card.append(note("Waiting for the tenant to confirm the problem is fixed. The invoice opens after that."));
      card.append(demo("Demo: tenant confirms it's fixed", () => change(job, () => {
        job.tenantConfirmed = true;
        job.stage = "invoice";
        log(job, "tenant", "Yes, it's fixed. Thank you!");
      })));
      card.append(demo("Demo: tenant says it's not fixed", () => change(job, () => {
        job.status = "scheduled";
        job.stage = "propose";
        job.slot = "Return visit: propose new windows";
        log(job, "tenant", "It's still not right, unfortunately.");
        log(job, "centrix", "Return visit needed at no extra cost. Propose new time windows.");
      })));
    },

    // Step 19: invoice from the work note, linked to the case and the unit.
    invoice(job, card) {
      card.append(note("Build the invoice from your work note. It's linked to the case and the unit."));
      const hours = numberField("Labour, hours", 1, 0.25);
      const parts = numberField("Parts, € net", Math.max(0, Math.round((job.quote || 140) - POLICY.callOut - POLICY.hourly)));
      const lines = document.createElement("ul");
      lines.className = "wf-lines";
      const error = errorLine();
      const calc = () => {
        const h = Math.max(0, Number(hours.inp.value) || 0);
        const pt = Math.max(0, Number(parts.inp.value) || 0);
        const net = POLICY.callOut + h * POLICY.hourly + pt;
        const vat = Math.round(net * POLICY.vat) / 100;
        return { h, pt, net, vat, gross: net + vat };
      };
      const warn = document.createElement("p");
      warn.className = "wf-note wf-warn";
      const draw = () => {
        const c = calc();
        warn.textContent = job.quote && c.net > job.quote ? `This is €${money(c.net - job.quote)} above your quote of €${fmt(job.quote)} net. Explain the difference in a message.` : "";
        lines.replaceChildren(
          line("Call-out", POLICY.callOut),
          line(`Labour ${c.h} h × €${POLICY.hourly}`, c.h * POLICY.hourly),
          line("Parts", c.pt),
          line("Net", c.net),
          line(`VAT ${POLICY.vat}%`, c.vat),
          line("Total", c.gross, true)
        );
      };
      [hours.inp, parts.inp].forEach((i) => i.addEventListener("input", draw));
      draw();
      const grid = document.createElement("div");
      grid.className = "wf-grid";
      grid.append(hours.wrap, parts.wrap);
      card.append(grid, lines, warn, error);
      card.append(primary("Send invoice", "send", () => {
        const c = calc();
        if (!(c.h > 0)) { error.textContent = "Add the labour time."; hours.inp.focus(); return false; }
        return go(job, "Invoice sent and linked to the unit.", () => {
          job.invoice = { number: `INV-${job.id.slice(4)}-01`, net: c.net, vat: c.vat, gross: c.gross };
          job.status = "done";
          job.stage = "follow_up";
          job.slot = "Done today";
          log(job, "centrix", `Invoice ${job.invoice.number} (€${money(c.gross)}) sent to ${POLICY.manager} and linked to ${job.caseId} and ${job.address}.`);
          job.feedback = { rating: "Great", onTime: "Yes" };
          log(job, "centrix", "Tenant feedback: service “Great”, plumber on time.");
        });
      }));
    },

    // Step 21: seven-day follow-up, then the case closes.
    follow_up(job, card) {
      card.append(summary(job));
      card.append(note("centrix checks with the tenant in seven days that it stayed fixed."));
      card.append(demo("Demo: seven days later", () => change(job, () => {
        job.stage = "closed";
        job.followUp = "Still fixed after seven days. Unit record updated.";
        log(job, "centrix", `Seven-day check: still fixed. ${job.caseId} closed and the unit record updated.`);
      })));
    },

    closed(job, card) {
      card.append(summary(job));
      card.append(note(job.followUp || "This job is closed. The work report and invoice are linked to the unit in centrix."));
    }
  };

  // Apply a real step with a busy state, then offer Undo
  function go(job, toastText, apply) {
    change(job, apply, toastText);
    return true;
  }

  function change(job, apply, toastText) {
    const before = JSON.stringify(job);
    apply();
    refreshAll(job);
    const next = $("d-actions").querySelector(".wf-card input, .wf-card textarea, .btn-primary, .demo-btn");
    if (next) next.focus();
    toast(toastText || "Updated.", {
      label: "Undo",
      run: () => {
        Object.keys(job).forEach((k) => delete job[k]);
        Object.assign(job, JSON.parse(before));
        refreshAll(job);
        toast("Change undone.");
      }
    });
  }

  function log(job, from, text) { job.messages.push({ from, time: now(), text }); }

  function primary(label, icon, run) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn-primary btn-lg wf-primary";
    b.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">${ICONS[icon]}</svg><span class="btn-label"></span>`;
    b.querySelector(".btn-label").textContent = label;
    b.addEventListener("click", () => {
      // short busy state, so the click clearly "lands"
      b.disabled = true;
      b.setAttribute("aria-busy", "true");
      b.classList.add("is-loading");
      setTimeout(() => {
        if (run() === false) {
          b.disabled = false;
          b.removeAttribute("aria-busy");
          b.classList.remove("is-loading");
        }
      }, 350);
    });
    return b;
  }

  function demo(label, run) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "demo-btn";
    b.textContent = label;
    b.addEventListener("click", run);
    return b;
  }

  function note(text) {
    const p = document.createElement("p");
    p.className = "wf-note";
    p.textContent = text;
    return p;
  }

  function list(items) {
    const ul = document.createElement("ul");
    ul.className = "wf-windows";
    items.forEach((w) => {
      const li = document.createElement("li");
      li.innerHTML = `<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">${ICONS.clock}</svg>`;
      li.append(w);
      ul.append(li);
    });
    return ul;
  }

  function errorLine() {
    const p = document.createElement("p");
    p.className = "wf-error";
    p.setAttribute("role", "alert");
    return p;
  }

  function textBtn(label, run) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "text-btn";
    b.textContent = label;
    b.addEventListener("click", run);
    return b;
  }

  function numberField(labelText, value, step) {
    const wrap = document.createElement("label");
    wrap.className = "wf-field";
    const span = document.createElement("span");
    span.textContent = labelText;
    const inp = document.createElement("input");
    inp.type = "number";
    inp.min = "0";
    inp.step = String(step || 1);
    inp.inputMode = "decimal";
    inp.value = value;
    wrap.append(span, inp);
    return { wrap, inp };
  }

  function line(label, value, total) {
    const li = document.createElement("li");
    if (total) li.className = "is-total";
    const k = document.createElement("span");
    k.textContent = label;
    const v = document.createElement("span");
    v.textContent = `€${money(value)}`;
    li.append(k, v);
    return li;
  }

  function summary(job) {
    const ul = document.createElement("ul");
    ul.className = "wf-lines";
    const rows = [];
    if (job.quote) rows.push(["Quote", `€${fmt(job.quote)} net`]);
    if (job.invoice) rows.push([`Invoice ${job.invoice.number}`, `€${money(job.invoice.gross)}`]);
    rows.push(["Tenant confirmed", job.tenantConfirmed ? "Yes" : "No"]);
    if (job.feedback) rows.push(["Feedback", `${job.feedback.rating}, on time: ${job.feedback.onTime}`]);
    rows.forEach(([k, v]) => {
      const li = document.createElement("li");
      const a = document.createElement("span");
      a.textContent = k;
      const b = document.createElement("span");
      b.textContent = v;
      li.append(a, b);
      ul.append(li);
    });
    return ul;
  }

  // Dictation for time windows and work notes. Uses the browser's recogniser as a
  // stand-in; in production this is ElevenLabs speech-to-text (Scribe).
  function micBtn(onText) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "text-btn wf-mic";
    b.setAttribute("aria-pressed", "false");
    b.innerHTML = `<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">${ICONS.mic}</svg>`;
    b.append(" Dictate");
    let rec = null;
    b.addEventListener("click", () => {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { toast("Dictation isn't available in this browser. Type instead."); return; }
      if (rec) { rec.stop(); return; }
      rec = new SR();
      rec.lang = navigator.language || "en-GB";
      rec.onresult = (e) => onText([...e.results].map((r) => r[0].transcript).join(" "));
      rec.onerror = () => toast("Couldn't hear you. Check microphone access, or type instead.");
      rec.onend = () => { rec = null; b.classList.remove("is-live"); b.setAttribute("aria-pressed", "false"); };
      b.classList.add("is-live");
      b.setAttribute("aria-pressed", "true");
      rec.start();
    });
    return b;
  }

  function refreshAll(job) {
    renderFilters();
    renderList();
    refreshPins();
    if (current() === job) renderDetail(job);
    if (popupJobId === job.id) popup.setDOMContent(popupContent(job));
    markers[job.id].el.setAttribute("aria-label", `${job.service}, ${job.address}. ${STATUS[job.status]}.`);
  }

  function renderThread(job) {
    $("d-msg-count").textContent = job.messages.length || "";
    $("d-thread").replaceChildren(...job.messages.map((m) => {
      const li = document.createElement("li");
      li.className = `msg msg-${m.from}`;
      const p = document.createElement("p");
      p.textContent = m.text;
      const small = document.createElement("small");
      const who = m.from === "partner" ? "You" : m.from === "tenant" ? job.tenant : "centrix";
      const state = m.state === "sending" ? " · Sending…" : m.state === "sent" ? " · Sent ✓" : "";
      small.textContent = `${who} · ${m.time}${state}`;
      li.append(p, small);
      return li;
    }));
    const pane = $("dp-chat");
    pane.scrollTop = pane.scrollHeight;
  }

  function badge(text, status, urgent) {
    const el = document.createElement("span");
    el.className = "badge" + (urgent ? " is-urgent" : "");
    if (status) {
      el.dataset.status = status;
      const dot = document.createElement("span");
      dot.className = "dot";
      dot.setAttribute("aria-hidden", "true");
      el.append(dot);
    }
    el.append(text);
    return el;
  }

  function popupContent(job) {
    const wrap = document.createElement("div");
    const kicker = document.createElement("p");
    kicker.className = "pop-kicker";
    kicker.dataset.status = job.status;
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.setAttribute("aria-hidden", "true");
    kicker.append(dot, ` ${STATUS[job.status]}${job.urgency === "urgent" && job.status !== "done" ? " · Urgent" : ""}`);
    const title = document.createElement("p");
    title.className = "pop-title";
    title.textContent = job.service;
    const dl = document.createElement("dl");
    dl.className = "pop-table";
    [["Job", job.id], ["Street", job.address], ["Area", job.district], ["Slot", job.slot]]
      .forEach(([k, v]) => {
        const dt = document.createElement("dt");
        dt.textContent = k;
        const dd = document.createElement("dd");
        dd.textContent = v;
        dl.append(dt, dd);
      });
    const route = document.createElement("a");
    route.className = "pop-link";
    route.href = `https://www.openstreetmap.org/directions?to=${job.lat}%2C${job.lng}`;
    route.target = "_blank";
    route.rel = "noopener";
    route.textContent = "Directions ↗";
    wrap.append(kicker, title, dl, route);
    return wrap;
  }

  // ---------- toast with optional action (Undo) ----------

  let toastTimer = null;
  function toast(text, action) {
    const box = $("toast");
    clearTimeout(toastTimer);
    const msg = document.createElement("span");
    msg.textContent = text;
    const parts = [msg];
    if (action) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "toast-action";
      btn.textContent = action.label;
      btn.addEventListener("click", () => { hide(); action.run(); });
      parts.push(btn);
    }
    const close = document.createElement("button");
    close.type = "button";
    close.className = "toast-close";
    close.setAttribute("aria-label", "Dismiss");
    close.innerHTML = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    close.addEventListener("click", hide);
    parts.push(close);
    box.replaceChildren(...parts);
    box.classList.add("is-open");
    const arm = () => { toastTimer = setTimeout(hide, 6000); };
    box.onmouseenter = () => clearTimeout(toastTimer);
    box.onmouseleave = arm;
    arm();
    function hide() {
      clearTimeout(toastTimer);
      box.classList.remove("is-open");
    }
  }

  // ---------- map helpers ----------

  // A map control is any object with onAdd/onRemove
  function FitAllControl() {
    return { onAdd: fitAllControlEl, onRemove() {} };
  }
  function fitAllControlEl() {
    const wrap = document.createElement("div");
    wrap.className = "maplibregl-ctrl maplibregl-ctrl-group";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ctrl-fit";
    btn.setAttribute("aria-label", "Show all jobs");
    btn.title = "Show all jobs";
    btn.innerHTML = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    btn.addEventListener("click", () => fitAll(true));
    wrap.append(btn);
    return wrap;
  }

  function refreshPins() {
    JOBS.forEach((job) => {
      const { el, pin } = markers[job.id];
      pin.dataset.status = job.status;
      el.classList.toggle("is-urgent", job.urgency === "urgent" && job.status !== "done");
      el.classList.toggle("is-active", job.id === selectedId);
      el.hidden = !(filter === "all" || job.status === filter);
      el.style.zIndex = job.id === selectedId ? "2" : "";
    });
    if (popupJobId && filter !== "all" && current() && current().status !== filter) popup.remove();
  }

  function mapPadding() {
    if (window.innerWidth <= 760) return { top: 40, bottom: 300, left: 30, right: 30 };
    return { top: 70, bottom: 50, left: 390, right: selectedId ? 430 : 70 };
  }

  function fitAll(animate) {
    const shown = JOBS.filter((j) => filter === "all" || j.status === filter);
    const list = shown.length ? shown : JOBS;
    const bounds = new maplibregl.LngLatBounds();
    list.forEach((j) => bounds.extend([j.lng, j.lat]));
    map.fitBounds(bounds, { padding: mapPadding(), duration: animate ? 700 : 0, maxZoom: 16 });
  }

  function restyle() { window.CentrixMap.restyle(map); }

  // ---------- small helpers ----------

  // Tabs with arrow-key support (WAI-ARIA tabs pattern)
  function setupTabs(ids) {
    const tabs = ids.map((id) => document.getElementById(id));
    const activate = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
      });
      if (focus) tab.focus();
    };
    tabs.forEach((tab, i) => {
      tab.tabIndex = tab.getAttribute("aria-selected") === "true" ? 0 : -1;
      tab.addEventListener("click", () => activate(tab, false));
      tab.addEventListener("keydown", (event) => {
        const moves = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
        if (!(event.key in moves)) return;
        event.preventDefault();
        activate(tabs[(moves[event.key] + tabs.length) % tabs.length], true);
      });
    });
  }

  function current() {
    return JOBS.find((j) => j.id === selectedId) || null;
  }

  function rank(job) {
    const order = { new: 0, in_progress: 1, scheduled: 2, done: 3 };
    return order[job.status] * 2 + (job.urgency === "urgent" ? 0 : 1);
  }

  function initials(name) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  }

  function fmt(n) { return Number(n).toLocaleString("en-GB"); }
  function money(n) { return Number(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  function now() {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
})();
