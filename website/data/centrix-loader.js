/*
 * Connects the portals to the Maastricht data set in data/centrix/*.json.
 *
 * The portals were built on two hand-written files (data/tenant-data.js and
 * data/partner-jobs.js). This loader reads the JSON collections, picks the
 * logged-in tenant or plumber (session.id from the demo login) and builds the
 * same window.CENTRIX_TENANT / CENTRIX_PARTNER_JOBS / CENTRIX_PARTNER_POLICY
 * objects from it. Accounts without an id (the old Aachen demo) keep the
 * hand-written data. If the JSON can't be loaded (e.g. opened as file://),
 * the portals also fall back to the old data.
 *
 * Use: CentrixData.boot("tenant" | "partner", ["ai.js?v=1", "tenant.js?v=7"])
 */
(function () {
  "use strict";

  const FILES = ["property_manager", "properties", "units", "contacts", "contracts", "partners", "cases", "jobs",
    "consents", "appointments", "work_reports", "invoices", "communications"];
  const LANG = { nl: "Dutch", en: "English", de: "German", pl: "Polish", tr: "Turkish", fr: "French", ar: "Arabic" };
  const NEVER_SHARED = {
    tenant_email: "Your email address", owner_details: "Owner details", lease_and_rent: "Lease and rent",
    meter_numbers: "Meter numbers", other_tenants: "Other tenants' details", payment_history: "Payment history"
  };
  const NEVER_SHARED_PARTNER = Object.assign({}, NEVER_SHARED, { tenant_email: "Tenant email address" });
  const PROBLEM_KEY = { leak: "leak", burst_pipe: "leak", blockage: "blockage", no_hot_water: "hotwater", running_toilet: "toilet" };
  const CATEGORY_LABEL = {
    leak: "Leak", burst_pipe: "Leak", blockage: "Blockage", no_hot_water: "Hot water", running_toilet: "Toilet",
    dripping_tap: "Tap", low_pressure: "Water pressure", sewer_smell: "Drain smell", radiator: "Heating", socket: "Electrical"
  };
  const CAUSES = {
    leak: [["Loose compression nut on the trap", 45], ["Worn seal on the tap or hose connection", 35], ["Cracked waste pipe", 20]],
    burst_pipe: [["Corroded supply pipe", 60], ["Failed fitting", 30], ["Frost or impact damage", 10]],
    blockage: [["Hair, soap or grease build-up in the trap", 65], ["Blockage further down the branch pipe", 25], ["Poor slope on the drain", 10]],
    no_hot_water: [["Boiler fault (ignition or pressure)", 55], ["Low system pressure", 30], ["Faulty diverter valve", 15]],
    running_toilet: [["Fill valve not closing", 55], ["Worn flush valve seal", 35], ["Float set too high", 10]],
    dripping_tap: [["Worn washer or cartridge", 75], ["Damaged valve seat", 20], ["Loose packing nut", 5]],
    low_pressure: [["Narrowed or corroded supply pipe", 50], ["Partly closed valve", 30], ["Clogged aerators", 20]],
    sewer_smell: [["Dried-out trap", 50], ["Loose or missing drain seal", 30], ["Venting problem on the soil stack", 20]]
  };
  const CHANNEL = { portal: "Tenant portal (tap)", voice: "Voice agent (spoken yes)", whatsapp: "WhatsApp (one tap)", email: "Email (one click)" };
  const RATING = { 5: "Great", 4: "Good", 3: "OK", 2: "Poor", 1: "Bad" };

  // ---------- small helpers ----------
  const byId = (list, key) => Object.fromEntries(list.map((x) => [x[key], x]));
  const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pad = (n) => String(n).padStart(2, "0");
  let NOW = new Date();

  // Data times are UTC; show them as Maastricht local time.
  const local = (iso) => new Date(new Date(iso).toLocaleString("en-US", { timeZone: "Europe/Amsterdam" }));
  const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  function when(iso) {
    const d = local(iso), n = local(NOW.toISOString());
    const days = Math.round((new Date(n.toDateString()) - new Date(d.toDateString())) / 864e5);
    if (days === 0) return `Today, ${hm(d)}`;
    if (days === 1) return `Yesterday, ${hm(d)}`;
    if (days === -1) return `Tomorrow, ${hm(d)}`;
    return `${DAY[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}, ${hm(d)}`;
  }
  function windowText(start, end) {
    const s = local(start), e = local(end);
    return `${when(start).replace(/, \d\d:\d\d$/, "")} ${hm(s)}–${hm(e)}`;
  }
  const ordinal = (n) => n + (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th");
  function floorText(unit) {
    const f = unit.floor === 0 ? "Ground floor" : `${ordinal(unit.floor)} floor`;
    return `${f}, ${unit.lift ? "lift" : "no lift"}`;
  }
  const initials = (name) => name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  function km(a, b) {
    const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(h));
  }
  const street = (p) => `${p.address.street} ${p.address.number}`;
  const fullAddress = (p) => `${street(p)}, ${p.address.postcode} ${p.address.city}`;

  async function loadAll() {
    const parts = await Promise.all(FILES.map((f) => fetch(`data/centrix/${f}.json`).then((r) => {
      if (!r.ok) throw new Error(`${f}.json: ${r.status}`);
      return r.json();
    })));
    const db = Object.fromEntries(FILES.map((f, i) => [f, parts[i]]));
    const meta = await fetch("data/centrix/_meta.json").then((r) => r.json()).catch(() => null);
    // The data set is a snapshot: show "today" as the snapshot's day so the relative dates make sense.
    if (meta && meta.now) NOW = new Date(meta.now);
    return db;
  }

  // ---------- tenant portal ----------
  function buildTenant(db, contactId) {
    const contacts = byId(db.contacts, "contact_id");
    const units = byId(db.units, "unit_id");
    const props = byId(db.properties, "property_id");
    const me = contacts[contactId];
    if (!me || !me.unit_id) return null;
    const unit = units[me.unit_id];
    const prop = props[unit.property_id];
    const pm = db.property_manager;
    const caretaker = prop.caretaker_contact_id ? contacts[prop.caretaker_contact_id] : null;
    const old = window.CENTRIX_TENANT || {};

    const plumbers = db.partners
      .filter((p) => p.category.startsWith("plumbing") && p.technicians.length &&
        p.service_area_postcodes.some((pc) => prop.address.postcode.startsWith(pc)))
      .map((p) => {
        const dist = km(p.base, prop);
        const slots = p.availability.map((w) => windowText(w.start, w.end));
        const tech = p.technicians[0];
        return {
          id: p.partner_id, name: p.name, contact: tech.name, initials: initials(tech.name), photo: tech.avatar,
          distance: `${dist.toFixed(1)} km`, rating: p.rating, reviews: p.jobs_done_for_us * 3,
          eta: `${Math.max(8, Math.round(dist * 4 + 6))} min`,
          next: slots.length ? slots[0].split(" ").slice(0, slots[0].startsWith("To") ? 1 : 3).join(" ") : "Next week",
          from: p.rates_eur_excl_vat.call_out,
          slots: slots.slice(0, 3), moreSlots: slots.slice(3, 6),
          start: [p.base.lat, p.base.lng]
        };
      })
      .sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));

    const openCases = db.cases
      .filter((c) => c.property_id === prop.property_id && c.reported_by !== contactId && !["closed", "follow_up"].includes(c.status))
      .map((c) => {
        const u = units[c.unit_id];
        const rel = u.floor === unit.floor - 1 ? " (the flat below you)" : u.floor === unit.floor + 1 ? " (the flat above you)" : "";
        return { id: c.case_id, unit: `${u.label}${rel}`, problem: PROBLEM_KEY[c.problem_type] || c.problem_type, text: c.summary, reported: when(c.reported_at) };
      });

    const year = Number(NOW.toISOString().slice(0, 4));
    const lastNo = Math.max(...db.cases.map((c) => Number(c.case_id.split("-")[2])));
    const dispatch = plumbers[0];

    return Object.assign({}, old, {
      home: {
        tenant: me.name, photo: me.avatar, unit: /^\d/.test(unit.label) || /^[A-Z]\d/.test(unit.label) ? `Unit ${unit.label}` : unit.label, address: fullAddress(prop),
        floor: floorText(unit), phone: me.phone,
        access: caretaker ? `Spare key with the caretaker, ${caretaker.name}` : prop.key_location,
        building: `Built ${prop.building_year} · ${prop.heating}`,
        shutoff: `${unit.water_shutoff}. Main valve: ${prop.water_main}.`,
        history: unit.history.slice().reverse().map((h) => {
          const d = new Date(h.date);
          return `${MON[d.getMonth()]} ${d.getFullYear()} · ${h.note.charAt(0).toLowerCase()}${h.note.slice(1)}`;
        }),
        lat: prop.lat, lng: prop.lng
      },
      policy: {
        preApprovedLimit: pm.repair_policy.pre_approved_limit_eur, vat: pm.repair_policy.vat_rate_pct,
        invoiceTo: pm.name, manager: pm.name
      },
      dispatchTo: dispatch ? dispatch.id : null,
      withheld: pm.never_shared_with_partners.map((k) => NEVER_SHARED[k] || k),
      openCases,
      plumbers,
      callOut: dispatch ? dispatch.from : old.callOut,
      nextCaseId: `C-${year}-${pad(lastNo + 1).padStart(4, "0")}`,
      // Raw records, for screens that want more than the portal shows today
      source: { contact: me, unit, property: prop, cases: db.cases.filter((c) => c.reported_by === contactId) }
    });
  }

  // ---------- partner portal ----------
  const JOB_STAGE = {
    offered: ["new", "review"], accepted: ["scheduled", "propose"], windows_proposed: ["scheduled", "awaiting_pick"],
    scheduled: ["scheduled", "booked"], in_progress: ["in_progress", "cost_check"], quote_pending_approval: ["in_progress", "approval"],
    done: ["in_progress", "confirm"], invoiced: ["done", "follow_up"], closed: ["done", "closed"]
  };
  const STEP_TEXT = {
    dispatched: (c) => `Job dispatched to you by ${c.pm}.`,
    accepted: () => "Job accepted.",
    windows_proposed: () => "3 time windows sent to the tenant.",
    slot_chosen: (c, s) => `The tenant picked ${s.note}.`,
    reminder_sent: () => "Day-before reminder sent to the tenant.",
    on_the_way: () => "On the way, ETA sent to the tenant.",
    work_started: () => "Arrived, work started.",
    quote_submitted: (c, s) => `Quote ${s.note}.`,
    quote_approved: () => "The manager approved the quote.",
    work_done: (c, s) => `Repair done: ${s.note}.`,
    tenant_confirmed: () => "The tenant confirmed it's fixed.",
    invoice_linked: (c, s) => `Invoice sent: ${s.note}.`,
    feedback_given: (c, s) => `Tenant feedback: ${s.note}.`,
    closed: (c, s) => `Case closed after the seven-day check${s.note ? `: ${s.note.toLowerCase()}` : ""}.`
  };

  function buildPartner(db, technicianId) {
    const partner = db.partners.find((p) => p.technicians.some((t) => t.technician_id === technicianId));
    if (!partner) return null;
    const tech = partner.technicians.find((t) => t.technician_id === technicianId);
    const contacts = byId(db.contacts, "contact_id");
    const units = byId(db.units, "unit_id");
    const props = byId(db.properties, "property_id");
    const cases = byId(db.cases, "case_id");
    const consents = byId(db.consents, "consent_id");
    const appts = byId(db.appointments, "appointment_id");
    const reports = byId(db.work_reports, "report_id");
    const invoices = byId(db.invoices, "invoice_id");
    const pm = db.property_manager;
    const rates = partner.rates_eur_excl_vat;

    const jobs = db.jobs
      .filter((j) => j.partner_id === partner.partner_id && (j.technician_id === technicianId || !j.technician_id))
      .map((j) => {
        const c = cases[j.case_id];
        const unit = units[c.unit_id];
        const prop = props[unit.property_id];
        const tenant = contacts[c.reported_by];
        const consent = j.consent_id ? consents[j.consent_id] : null;
        const appt = j.appointment_id ? appts[j.appointment_id] : null;
        const report = j.work_report_id ? reports[j.work_report_id] : null;
        const inv = j.invoice_id ? invoices[j.invoice_id] : null;
        const [status, stage] = JOB_STAGE[j.status] || ["new", "review"];
        const linked = c.linked_case_ids.map((id) => cases[id]).filter(Boolean)[0];
        const slot = appt ? windowText(appt.window_start, appt.window_end)
          : stage === "awaiting_pick" ? "Tenant is choosing" : stage === "propose" ? "Waiting for your 3 time windows" : "Not booked yet";
        const ctx = { pm: pm.name };
        const dispatchedAt = c.timeline.findIndex((s) => s.step === "dispatched");
        const messages = c.timeline.slice(Math.max(0, dispatchedAt)).filter((s) => STEP_TEXT[s.step]).map((s) => ({
          from: ["accepted", "windows_proposed", "on_the_way", "work_started", "quote_submitted", "work_done", "invoice_linked"].includes(s.step) ? "partner"
            : ["tenant_confirmed", "feedback_given"].includes(s.step) ? "tenant" : "centrix",
          time: when(s.at), text: STEP_TEXT[s.step](ctx, s)
        }));
        if (stage === "review") messages.unshift({ from: "centrix", time: when(j.created_at), text: `New job from a tenant report (${CHANNEL[consent ? consent.channel : "portal"] || "portal"}). Brief, photos and access details are attached.` });
        const translated = c.language !== "en";
        return {
          id: j.job_id, caseId: c.case_id,
          service: c.summary, category: CATEGORY_LABEL[c.problem_type] || "Plumbing",
          status, stage, urgency: c.urgency === "normal" || !c.urgency ? "normal" : "urgent",
          reported: when(c.reported_at),
          address: `${street(prop)}, ${unit.label}`, district: `Maastricht-${prop.address.district}`,
          floor: floorText(unit), lat: prop.lat, lng: prop.lng,
          tenant: `${tenant.first_name} ${tenant.last_name.charAt(0)}.`, tenantPhoto: tenant.avatar,
          access: j.brief.access, slot,
          description: translated ? `${c.summary}. In ${LANG[c.language]}: ${c.original_text}` : c.original_text,
          photos: c.photos.length,
          causes: (CAUSES[c.problem_type] || CAUSES.leak).map(([name, likelihood]) => ({ name, likelihood })),
          messages,
          language: LANG[c.language] || c.language,
          answers: c.follow_up_answers.map((x) => x.a),
          consent: consent ? { at: when(consent.given_at), channel: CHANNEL[consent.channel] || consent.channel } : null,
          linkedCase: linked ? { id: linked.case_id, unit: units[linked.unit_id].label, text: linked.summary } : null,
          shutoff: `${unit.water_shutoff}. Main valve: ${prop.water_main}.`,
          windows: j.proposed_windows.map((w) => windowText(w.start, w.end)),
          reminder: appt && appt.reminder_sent_at ? "Day-before reminder sent to the tenant" : null,
          eta: 20,
          quote: j.quote ? j.quote.amount_eur_excl_vat : inv ? inv.subtotal_eur : null,
          workNote: report ? `${report.finding}. ${report.work_done}.` : "",
          tenantConfirmed: !!(report && report.tenant_confirmed_at),
          invoice: inv ? { number: inv.invoice_id, net: inv.subtotal_eur, vat: inv.vat_eur, gross: inv.total_eur } : null,
          feedback: c.feedback ? { rating: RATING[c.feedback.rating] || String(c.feedback.rating), onTime: "Yes" } : null,
          followUp: c.follow_up_7d && c.follow_up_7d.result ? `${c.follow_up_7d.result}. Unit record updated.` : null
        };
      });

    const order = { new: 0, in_progress: 1, scheduled: 2, done: 3 };
    jobs.sort((a, b) => order[a.status] - order[b.status]);
    const windows = partner.availability.map((w) => windowText(w.start, w.end));
    return {
      jobs,
      company: partner.name,
      policy: {
        photo: tech.avatar, manager: pm.name, briefLanguage: "English",
        preApprovedLimit: pm.repair_policy.pre_approved_limit_eur, vat: pm.repair_policy.vat_rate_pct,
        callOut: rates.call_out, hourly: rates.hourly,
        withheld: pm.never_shared_with_partners.map((k) => NEVER_SHARED_PARTNER[k] || k),
        suggestedWindows: windows.slice(0, 3).length === 3 ? windows.slice(0, 3) : (window.CENTRIX_PARTNER_POLICY || {}).suggestedWindows
      }
    };
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`Could not load ${src}`));
      document.body.append(s);
    });
  }

  async function boot(role, scripts) {
    let session = null;
    try { session = JSON.parse(sessionStorage.getItem("centrix.session")); } catch (e) { /* no session */ }
    if (session && session.id) {
      try {
        const db = await loadAll();
        if (role === "tenant") {
          const data = buildTenant(db, session.id);
          if (data) window.CENTRIX_TENANT = data;
        } else {
          const data = buildPartner(db, session.id);
          if (data) {
            window.CENTRIX_PARTNER_JOBS = data.jobs;
            window.CENTRIX_PARTNER_POLICY = data.policy;
            const sub = document.querySelector(".panel-sub");
            if (sub && sub.firstChild && sub.firstChild.nodeType === Node.TEXT_NODE) sub.firstChild.nodeValue = `${data.company} · Maastricht `;
          }
        }
        window.CENTRIX_DB = db;
      } catch (e) {
        console.warn("centrix: could not load data/centrix/*.json, using the built-in data instead.", e);
      }
    }
    for (const src of scripts) await loadScript(src);
  }

  window.CentrixData = { boot, loadAll, buildTenant, buildPartner };
})();
