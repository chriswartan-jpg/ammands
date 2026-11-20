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
  // The one next step for each status, with the button label, icon and toast text
  const NEXT = {
    new: { to: "scheduled", label: "Accept job", icon: "check", toast: "Job accepted. The tenant can now pick a time slot." },
    scheduled: { to: "in_progress", label: "I'm on the way", icon: "van", toast: "The tenant knows you're on the way." },
    in_progress: { to: "done", label: "Mark as done", icon: "flag", toast: "Job marked as done. Upload the work report next." }
  };
  const ICONS = {
    check: '<path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
    van: '<path d="M1.5 4.5h8v6h-8zM9.5 6.5h3l2 2v2h-5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="4.5" cy="11.5" r="1.4" fill="currentColor"/><circle cx="12" cy="11.5" r="1.4" fill="currentColor"/>',
    flag: '<path d="M4 14V2.5M4 3h8l-1.8 3L12 9H4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
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
      ["Address", job.address],
      ["Area", job.district],
      ["Floor", job.floor],
      ["Tenant", job.tenant],
      ["Access", job.access],
      ["Time slot", job.slot],
      ["Reported", job.reported]
    ];
    $("d-props").replaceChildren(...props.flatMap(([k, v]) => {
      const dt = document.createElement("dt");
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.textContent = v;
      return [dt, dd];
    }));

    renderSteps(job);
    renderActions(job);
    renderThread(job);
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

  function renderActions(job) {
    const box = $("d-actions");
    const step = NEXT[job.status];
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

    if (!step) {
      const p = document.createElement("p");
      p.className = "status-note";
      p.textContent = "This job is closed. The work report and invoice are linked to the unit in centrix.";
      box.replaceChildren(p, chat);
      return;
    }

    const primary = document.createElement("button");
    primary.type = "button";
    primary.className = "btn-primary btn-lg";
    primary.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">${ICONS[step.icon]}</svg><span class="btn-label"></span>`;
    primary.querySelector(".btn-label").textContent = step.label;
    primary.addEventListener("click", () => {
      // short busy state, so the click clearly "lands"
      primary.disabled = true;
      primary.setAttribute("aria-busy", "true");
      primary.classList.add("is-loading");
      const before = { status: job.status, slot: job.slot, messages: job.messages.length };
      setTimeout(() => {
        job.status = step.to;
        if (step.to === "scheduled" && job.slot === "Not booked yet") job.slot = "Waiting for the tenant to pick a slot";
        job.messages.push({ from: "centrix", time: now(), text: `Status changed to “${STATUS[step.to]}”. The tenant has been notified.` });
        refreshAll(job);
        const next = $("d-actions").querySelector(".btn-primary, .btn-ghost");
        if (next) next.focus();
        toast(step.toast, {
          label: "Undo",
          run: () => {
            job.status = before.status;
            job.slot = before.slot;
            job.messages.length = before.messages;
            refreshAll(job);
            toast("Change undone.");
          }
        });
      }, 450);
    });
    box.replaceChildren(primary, chat);
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

  function now() {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
})();
