# Build plan: plumbing integration

The order in which we build the project. See [PROJECT.md](PROJECT.md) for the background and the flow.

| Phase | What | Result |
|---|---|---|
| 1 | Build the portals, without data | Tenant portal and partner portal exist, with empty screens |
| 2 | Create fake data | Realistic sample data, shown in the portals |
| 3 | Build the automation | The whole flow runs on its own, from report to invoice |

---

## Phase 1: Build the portals (empty data)

Goal: the screens and navigation are in place. Wherever data will appear later, there is an empty state for now (e.g. "No reports yet").

### 1a. Tenant portal
- [ ] Home screen: my home and my reports (empty)
- [ ] Report a problem: a chat or short question-and-answer flow, with photo upload
- [ ] Consent screen: which data will be shared with the plumber
- [ ] Pick a time slot (no slots yet)
- [ ] Arrange access: at home, or key with the caretaker or neighbours
- [ ] Report status page: scheduled → on the way → in progress → done
- [ ] Close: confirm that the problem is solved

### 1b. Partner portal (plumber)
- [ ] Overview of incoming jobs (empty)
- [ ] Job detail page: address, problem, photos, urgency, access, contact
- [ ] Accept or decline
- [ ] Share availability (time slots)
- [ ] Update status: on the way, in progress, done
- [ ] Close: upload work report, after photos and invoice

**Done when:** you can click through every screen of both portals, even though they are still empty.

---

## Phase 2: Create fake data

Goal: realistic sample data in a JSON file or small database, shown in the portals. Only include data a property manager would really have. Anything centrix doesn't know has to be asked from the tenant later.

- [ ] **Properties and units**: address, floor, size, building year, access (e.g. key with the caretaker)
- [ ] **People**: owners and tenants with contact details
- [ ] **Partners**: a few plumbers with service area, services and time slots
- [ ] **Cases**: a few reports in different statuses (new, scheduled, done)
- [ ] **Consents**: which data was shared, when and through which channel
- [ ] **Results**: work reports and invoices for completed jobs
- [ ] Connect the portals to the data, so the empty screens are filled
- [ ] Write down the assumptions: what we made up and why it is realistic

**Done when:** both portals show real examples, and the tenant and the plumber each see their own reports and jobs.

---

## Phase 3: Build the automation

Goal: make the four steps from the challenge work, without anyone filling in forms.

- [ ] **1. Detect the moment**: a tenant report creates a case and is recognised as plumbing (`case.created`, `category: plumbing`)
- [ ] **2. Hand over context**: centrix pre-fills what it already knows and only asks for what is missing (photos, since when, urgency, access)
- [ ] **3. Hold the conversation**:
  - [ ] pick the right plumber
  - [ ] the tenant gives consent and picks a time slot
  - [ ] optional: the property manager approves (e.g. above a cost limit)
- [ ] **4. Send the job to the partner**: the job appears in the partner portal with all context
- [ ] **5. Status updates**: every status change by the plumber is immediately visible to the tenant
- [ ] **6. Close the loop**: the work report and invoice are linked to the case and the unit in centrix, and the tenant confirms the problem is solved

**Done when:** one report runs all the way through, from "leak under the kitchen sink" to a completed repair with the invoice linked to the unit.

---

## After that

- [x] Write the **partner connector spec** ([CONNECTOR-SPEC.md](CONNECTOR-SPEC.md)): what any partner must provide to plug in (services, eligibility rules, availability, placing a job, status updates, result)
- [ ] A place where the result is visible on the unit (simple centrix view), for the demo
- [ ] Rehearse the demo: show one report live from start to finish
