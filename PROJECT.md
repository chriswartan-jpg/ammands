# reltix × centrix: plumbing integration

Project description for the reltix challenge "Plug a Partner into centrix" (24 hours).
Based on `Reltix-Track-Description.pdf`. Parts marked **[assumption]** do not come from the document and still need to be checked.

---

## 1. What is this about?

### The problem
A property manager sits between owners and tenants on one side and every service provider around the building on the other (craftsmen, caretakers, insurers, utilities). Communication between them still runs by phone, email and paper. A single broken heater can take a dozen calls and emails before anyone shows up.

Every service is its own silo with its own forms. Providers don't know when a resident needs them, residents enter the same details over and over, and the property manager has no easy way to connect it all.

### reltix and centrix
- **reltix** manages properties itself and builds the platform it runs on: **centrix**.
- In centrix, property managers and AI agents work side by side. Everything about a property is in one structured record: units, owners, tenants, contracts, cases and communication.
- Because reltix brings thousands of its own units onto the platform from day one, centrix can become a **marketplace**: partners get customers without acquisition costs, residents get better service, and every new partner makes the network more valuable.

### What exists today
- **centrix**: the workspace of the property managers (inbox, cases, documents, contracts, onboarding), all linked to the property record.
- **Owner and tenant portal**: view documents and reports, follow the status of requests and communicate with reltix.

What is missing: **partners are not part of the platform yet.** That is the gap we fill.

---

## 2. The challenge

> Pick one partner and integrate it into centrix. Turn a moment in a property's life into a finished outcome, **with zero forms**.

Every solution must go through four steps:

1. **Detect the moment**: when and for whom is the service needed?
2. **Hand over context**: pre-fill what the partner needs, so the user has to do as little as possible.
3. **Hold the conversation**: make the interaction as easy as possible, through the channel that fits best.
4. **Close the loop**: keep everyone updated until it's done, and link the result back to the property in centrix.

We don't get access to reltix's systems. We build our own lightweight stand-in.

---

## 3. Our focus: plumbing

We focus **only on plumbing**. Other partners (internet, energy, heating, insurance) can be added later. That is why the setup must be generic enough for the next partner to plug in the same way.

**Type of partner:** a partner that **delivers** a service, not one that sells something.

**Example reports [assumption]:**
- leaks (tap, pipe, under the sink);
- blocked drains (sink, shower, toilet);
- a toilet that keeps running;
- no hot water.

**Why plumbing [assumption, to be backed up with answers from reltix]:**
- it happens often and is often urgent (water damage);
- it currently involves a lot of back-and-forth: who goes, when is the tenant home, how to get in, who pays;
- the process has a clear start and end, from report to invoice.

---

## 4. The end-to-end flow

| Step | What happens | Who |
|---|---|---|
| 1. Detect the moment | The tenant reports a problem (e.g. "leak under the kitchen sink") in the portal. centrix creates a case and recognises it as plumbing. | Tenant → centrix |
| 2. Hand over context | centrix fills in everything it already knows (address, floor, contact, previous cases) and only asks for what is missing: photos, since when, urgency, access. | centrix |
| 3. Hold the conversation | The right plumber is selected. The tenant picks a time slot from the plumber's availability and consents to sharing their data. | Tenant, partner, optionally property manager |
| 4. Do the job | The plumber receives the job with all context, accepts it, and reports "on the way", "in progress" and "done", with photos afterwards. | Partner |
| 5. Close the loop | The invoice and work report are linked to the case and the unit in centrix. The tenant confirms the problem is solved. | Partner → centrix → tenant |

**Job statuses [assumption]:**
`reported` → `triaged` → `assigned` → `scheduled` → `in_progress` → `completed` → `invoiced` → `closed`

---

## 5. What we build

### 5.1 Tenant portal
The channel that reaches the resident directly (required: at least one channel must do this).

- **Report a problem without a form**: a chat or short question-and-answer flow that only asks what centrix doesn't know yet. Photo upload.
- **Give consent**: clearly show which data will be shared with the plumber (name, phone, address, problem, photos, access).
- **Pick a time slot**: from the plumber's availability, in one click.
- **Arrange access**: at home, or key with the caretaker or neighbours.
- **Follow the status**: scheduled → plumber on the way → in progress → done.
- **Close**: confirm that the problem is solved.

### 5.2 Partner portal (plumber)
Shows how the partner receives the job and reports back.

- **Incoming jobs** with all context: address, floor, problem, photos, urgency, access, contact details (only what may be shared).
- **Accept or decline**.
- **Share availability** (time slots).
- **Update status**: on the way, in progress, done.
- **Close**: upload work report, after photos and invoice.

### 5.3 centrix (lightweight stand-in)
- Overview of units and cases.
- A case shows the full timeline: report, conversation, scheduling, execution, invoice.
- Optional: an assistant for the property manager that suggests the next step, with a human approving it (e.g. above a cost limit [assumption]).
- The result (completed repair + invoice) appears on the unit.

### 5.4 Partner connector spec
A document describing what **any** partner must provide to plug in, generic enough that the next partner (e.g. an electrician or internet provider) can connect without a redesign:

- **Services**: what the partner delivers (e.g. leaks, blockages).
- **Eligibility rules**: which regions, property types and problems.
- **Availability**: how time slots are shared.
- **Placing a job**: which data centrix sends along.
- **Status updates**: how the partner reports back (API, email, WhatsApp, app or dashboard).
- **Result**: work report, photos, invoice.

---

## 6. Data

There is no real reltix dataset or API. We create our own realistic sample data in a JSON file or small database. **Stay realistic**: only data a property manager actually has, and show how missing information is collected.

What centrix keeps track of, according to the document:
- **Properties and units**: address, size, building year, heating type, energy certificate, meters
- **People**: owners, tenants, contact details, move-in and move-out dates
- **Contracts**: leases, rents, service contracts
- **Cases**: tenant requests and repairs, with emails and documents
- **Communication**: every email, call and message, linked to the property

### Examples, adapted for plumbing [assumption, based on the examples in the document]

**Property record:**
```json
{
  "unit_id": "unit_4b",
  "property": {
    "address": "Musterstraße 12, 52062 Aachen",
    "building_year": 1972,
    "heating": "gas central heating"
  },
  "unit": { "floor": 2, "size_sqm": 68, "rooms": 3 },
  "owner": { "contact_id": "c_101", "name": "Maria Becker" },
  "tenant": {
    "contact_id": "c_202",
    "name": "Lena Hoffmann",
    "email": "lena@example.com",
    "phone": "+49 151 00000000"
  },
  "access": { "caretaker_has_key": true }
}
```

**Trigger event (the moment):**
```json
{
  "event": "case.created",
  "occurred_at": "2026-11-20T09:14:00Z",
  "unit_id": "unit_4b",
  "contact_id": "c_202",
  "data": {
    "case_id": "case_881",
    "category": "plumbing",
    "description": "Water leaking under the kitchen sink",
    "urgency": "high",
    "photos": ["photo_1.jpg"]
  }
}
```

**Result written back to centrix:**
```json
{
  "unit_id": "unit_4b",
  "case_id": "case_881",
  "service_job": {
    "partner": "Example Plumbing GmbH",
    "category": "plumbing",
    "status": "completed",
    "scheduled_slot": "2026-11-21T10:00:00Z",
    "completed_at": "2026-11-21T11:05:00Z",
    "work_report": "Replaced leaking siphon seal",
    "invoice": { "amount_eur": 145.00, "document": "invoice_881.pdf" },
    "consent": {
      "data_shared": ["name", "phone", "address", "description", "photos", "access"],
      "given_at": "2026-11-20T09:18:00Z",
      "channel": "portal"
    }
  }
}
```

---

## 7. Important to keep in mind

- **One flow, fully finished.** Better one chain that really works from report to invoice than many half-built features.
- **As little effort as possible** for all three: tenant, plumber and property manager. No forms; only ask what centrix doesn't know yet.
- **A sensible choice of channel.** At least one channel reaches the tenant directly. Bonus if channels share the same context (e.g. a conversation that continues in the portal).
- **Realism.** Realistic data assumptions, and write down which assumptions we make.
- **Consent and privacy.** Record which data is shared with the plumber, and when and through which channel the tenant agreed.
- **Think through the partner side.** Show how the plumber receives, schedules, does and reports back on the job.
- **Generic connector.** The next partner must be able to plug in the same way.
- **A well-argued choice.** Be able to explain clearly why plumbing and why this moment.

---

## 8. Open questions for reltix

We use the answers to check the assumptions above.

- Which type of request takes up the most time for your property managers each week?
- Which process involves the most back-and-forth calls and emails?
- How many repair requests (and how many plumbing jobs) do you get per month?
- Which repairs come up most often?
- How do you currently choose a craftsman? Is there a fixed list, and who decides?
- Does the owner need to approve anything, e.g. above a certain cost?

---

## 9. Later (out of scope for now)

- Other partners: heating, electrician, internet, energy, insurance.
- Extra channels: phone (AI voice agent), WhatsApp, one-click email.
- Automatically picking the right plumber based on region, rating and availability.
