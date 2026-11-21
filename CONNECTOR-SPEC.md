# centrix Partner Connector Spec

**Version 1.0** · Team Amands · reltix challenge "Plug a Partner into centrix"
**Reference partner:** plumbing (Jekerdal Loodgieters). **Built for:** any partner that delivers or sells a service around a property.

This spec lists what a partner has to give centrix to plug in, and what it gets back. Plumbing is our worked example, but every field is generic. An electrician, a heat-pump installer or an internet provider connects through the same six blocks and the same job lifecycle. Our sample data already has two non-plumbing partners (Wyck Elektro and Heuvelland Warmtepompen) described in this format, with no extra fields.

---

## 1. How a partner plugs in

A partner gives centrix **one profile** (blocks A to C below) when it joins. After that, each job goes through the **same lifecycle** (blocks D to F), whatever the trade.

| Block | Question it answers | Who provides it | When |
|---|---|---|---|
| **A. Services** | What does the partner deliver or sell? | Partner | At onboarding |
| **B. Eligibility** | For which regions, properties and problems? | Partner | At onboarding |
| **C. Availability** | When can the partner come? | Partner | Kept up to date |
| **D. Placing a job** | What does centrix send along? | centrix → partner | For each job |
| **E. Status updates** | How does the partner report progress? | Partner → centrix | For each job |
| **F. Result** | What closes the job? | Partner → centrix | For each job |

**Design rules that hold for every partner**

1. **Zero forms for the resident.** centrix pre-fills everything it already knows. It only asks the resident what it can't know, at most 3 questions.
2. **Consent before data.** The partner receives no personal data until the resident has agreed to this specific job. That consent is logged with the time, the channel and the exact wording.
3. **Data minimisation.** The partner gets only what the job needs. The rest is listed as withheld (see D).
4. **The result lands on the unit.** Every work report and invoice is linked to the case *and* the unit, so the home record grows with each job.
5. **The partner chooses its channel.** It can use the portal, an API/webhook, WhatsApp or email. centrix normalises all of them into the same status events.

---

## 2. Partner profile (blocks A to C)

### A. Services

| Field | Type | Example (plumbing) | Example (electrician) |
|---|---|---|---|
| `partner_id` | string | `p_01` | `p_04` |
| `name`, `kvk` | string | Jekerdal Loodgieters, `00000001` | Wyck Elektro |
| `category` | enum | `plumbing` | `electrical` |
| `services[]` | list of service codes | `leak`, `blockage`, `burst_pipe`, `running_toilet`, `dripping_tap`, `low_pressure`, `sewer_smell`, `lead_pipe_replacement` | `socket`, `fuse`, `lighting`, … |
| `rates_eur_excl_vat` | object | `call_out` 45, `hourly` 62, `emergency_call_out` 95, `evening_weekend_surcharge_pct` 50 | same fields |
| `languages[]` | ISO 639-1 | `nl`, `en`, `de` | |
| `technicians[]` | id, name, phone, languages | Bram Peters (`nl`, `en`) | |

Each service code maps to a **trigger**, the moment in a property's life when centrix should offer it. For plumbing, the trigger is a resident report that centrix classifies as plumbing. For a partner that sells something, it could be a centrix event such as `contract.move_in`.

### B. Eligibility rules

| Field | Type | Example |
|---|---|---|
| `service_area_postcodes[]` | list of PC4 codes | `6211`, `6212`, `6213`, `6221`, … |
| `property_types[]` | enum | `apartment`, `house`, `commercial` |
| `emergency_24_7` | bool | `true` |
| `response_time_hours` | per urgency level | emergency 2, urgent 24, normal 72 |
| `excluded[]` | free list | e.g. gas work (separate certification) |

centrix uses these fields to choose the partner: it **filters** on category, postcode, service and urgency, then **ranks** by rating, by `jobs_done_for_us` and by the earliest free slot.

### C. Availability

The partner publishes a list of free windows, and centrix never books outside them.

```json
"availability": [
  { "start": "2026-11-23T08:00:00+01:00", "end": "2026-11-23T10:00:00+01:00" },
  { "start": "2026-11-23T11:00:00+01:00", "end": "2026-11-23T13:00:00+01:00" }
]
```

For each job, the partner **proposes 3 windows** (`proposed_windows[]`), and the resident picks one or asks for new ones. Partners that have a calendar can expose it as an iCal or CalDAV feed, and the others type or dictate their windows in the portal.

### Connector settings

```json
"connector": {
  "channel": "partner_portal",            // or "api", "whatsapp", "email"
  "job_notifications": ["portal", "whatsapp"],
  "status_updates": "portal buttons + dictation",
  "invoice_format": "UBL e-invoice + PDF"
}
```

---

## 3. Job lifecycle (blocks D to F)

```
offered ─► windows_proposed ─► scheduled ─► in_progress ─► done ─► invoiced ─► closed
                  ▲    │                         │
                  └────┘ resident: "none fit"    └─► quote_pending_approval (over the pre-approved limit)
```

Every partner uses the same statuses. Plumbing adds no special states.

### D. Placing a job: what centrix sends

centrix sends a **job brief**, and only after the resident has given consent and the property manager has dispatched the job.

| Group | Fields | Source |
|---|---|---|
| Job | `job_id`, `case_id`, `problem_type`, `urgency`, `title` | centrix classification |
| Location | `address`, `unit`, `floor`, `lift` | unit record |
| Resident | `tenant_first_name`, `tenant_phone`, `tenant_language` | contact record |
| The problem | `description` (original), `description_translated`, `answers[]` (max 3), `photos[]` | resident, by voice or text |
| Access | `access` (e.g. "tenant at home", key safe) | resident |
| Property context | trade-specific fields from the unit record. For plumbing: `water_shutoff`, `water_main`, `boiler`, `building_year`, `pipework` | unit record |
| Money | `cost_bearer`, `pre_approved_limit_eur` (3000) | contract and repair policy |
| Links | `linked_case_ids[]` (the same issue reported by other flats) | duplicate check |
| Privacy | `consent_id`, `withheld[]` | consent log |

**Always withheld:** `tenant_email`, `owner_details`, `lease_and_rent`, `meter_numbers`, `other_tenants`, `payment_history`.

The trade-specific "property context" fields are the **only** part that differs between partners. Each category declares which unit-record fields it may read. An electrician would get the fuse box location and the meter type instead of the water shut-off.

### E. Status updates: what the partner sends back

Every update is one event, whichever channel it comes through:

```json
{
  "job_id": "J-2026-0148",
  "event": "on_the_way",
  "at": "2026-09-19T23:10:00+02:00",
  "by": "t_01",
  "data": { "eta_minutes": 20 }
}
```

| Event | Data | What centrix does |
|---|---|---|
| `accepted` / `declined` | reason if declined | If declined, offers the job to the next eligible partner |
| `windows_proposed` | 3 windows | Resident picks one by tap or by voice |
| `scheduled` | chosen window | Confirms with the resident and the manager, and sends a reminder the day before |
| `on_the_way` | `eta_minutes` | Tells the resident the ETA |
| `quote` | amount, lines | Within the limit it continues; over €3,000 the manager approves first |
| `done` | work report (see F) | Asks the resident to confirm the fix |
| `invoiced` | invoice (see F) | Links the invoice to the case and the unit |

Through the portal these are buttons plus dictation. Through the API they are `POST /jobs/{job_id}/events`. Through WhatsApp or email, centrix parses the message into the same event.

### F. Result: what closes the job

**Work report**

```json
{
  "report_id": "WR-2026-0141",
  "job_id": "J-2026-0141",
  "finding": "Worn ceramic cartridge in the mixer tap",
  "work_done": "Replaced the cartridge, tested",
  "labour_hours": 0.5,
  "parts": [{ "name": "Tap cartridge 35 mm", "qty": 1, "unit_price_eur": 24.5 }],
  "photos_after": ["photos/C-2026-0141/after_1.jpg"],
  "dictated": true,
  "tenant_confirmed_at": "2026-09-10T11:55:00+02:00",
  "home_record_update": "Kitchen mixer cartridge replaced, Sep 2026"
}
```

**Invoice:** built from the work report and the partner's rates, in UBL e-invoice format plus a PDF. It carries `invoice_id`, `job_id`, `case_id`, `unit_id`, `lines[]`, subtotal, the VAT rate for the country (21% NL, 19% DE), the total and `bill_to`.

**Closing:** the case closes when (1) the resident has confirmed the fix, (2) the invoice is linked to the unit and (3) a follow-up seven days later shows the problem stayed fixed. The `home_record_update` line is written to the unit, so the next brief for this flat is better.

---

## 4. Who has to act, and where

| Actor | Effort per job |
|---|---|
| **Resident** | Describes the problem once, by voice or text and in their own language. Answers up to 3 questions, agrees to share data, picks a time and confirms the fix. No forms. |
| **Partner** | Receives a complete brief, proposes 3 windows, taps "on the way", dictates the work note. The invoice is generated for them. |
| **Property manager** | Steps in only on exceptions: an unclear classification, an urgent case, or a quote over the pre-approved limit. |

---

## 5. Adding the next partner: checklist

1. Fill in the profile: services, eligibility, rates, technicians, languages.
2. Choose a connector channel and an invoice format.
3. Publish availability, or connect a calendar feed.
4. Declare which unit-record fields the trade needs (the "property context" in block D).
5. Map the partner's service codes to centrix triggers.

No new screens, statuses or data model are needed. Everything else (consent, the brief, status events, the result on the unit) is shared.

---

*The reference implementation is in this repo: the partner portal in `website/partner.html`, sample data in `website/data/centrix/` (`partners.json`, `jobs.json`, `consents.json`, `work_reports.json`, `invoices.json`) and the full 21-step plumbing flow in `docs/final-workflow.md`.*
