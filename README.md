# reltix × centrix: plumbing integration

Our entry for the reltix hackathon challenge **"Plug a Partner into centrix"** (24 hours).

A property manager sits between residents and the service providers around a building, and most of that contact still happens by phone, email and paper. One broken heater can take a dozen calls before anyone turns up. **centrix** is reltix's platform for property managers. It keeps everything about a property in one record, but partners aren't part of it yet.

We plug in **one partner, a plumber**, and take a report all the way to a finished repair **without the tenant filling in a single form**:

1. **Detect the moment**: a tenant reports a problem ("leak under the kitchen sink") and centrix recognises it as plumbing.
2. **Hand over context**: centrix pre-fills what it already knows (address, floor, contact, previous cases) and only asks for what is missing (photos, since when, urgency, access).
3. **Hold the conversation**: the right plumber is picked, and the tenant gives consent and chooses a time slot.
4. **Close the loop**: the plumber updates the status, and the work report and invoice are linked back to the case and the unit.

The setup is generic, so other partners (internet, energy, heating, insurance) can plug in the same way later.

## What's in this repo

| Path | What it is |
|---|---|
| [`PROJECT.md`](PROJECT.md) | Full project description: the problem, the challenge, the end-to-end flow and what we build |
| [`BUILD-PLAN.md`](BUILD-PLAN.md) | Build plan in phases: screens, fake data, automation |
| [`website/`](website/) | The prototype: a static site in plain HTML, CSS and JavaScript |

### The website

| Page | Purpose |
|---|---|
| `index.html` | Landing page |
| `what-centrix-does.html`, `who-it-helps.html`, `the-difference.html` | Information pages |
| `login.html` | Demo login for tenants and partners |
| `tenant.html` | Tenant portal: report a problem, give consent, pick a time slot, follow the status |
| `partner.html` | Partner (plumber) portal: incoming jobs, job details, status updates |
| `data/` | Fake sample data: demo accounts, tenant data and partner jobs |

### The final workflow (plumbing repair case)

Both portals follow the 21-step final workflow, from the tenant's report to the seven-day follow-up:

| Phase | Tenant portal (`tenant.html`) | Partner portal (`partner.html`) |
|---|---|---|
| Report (1–7) | Type or speak the problem, language detection, classification (or manager review), duplicate check with linked cases, up to 3 follow-up questions, optional photo, urgent path with the shut-off valve | Job brief shows the tenant's answers, language, linked case and shut-off valve |
| Brief and consent (8–10) | Job brief with what is shared and what is never shared, access choice, consent logged with time and channel, manager dispatch | Consent record and "Not shared with you" list; accept the dispatched job |
| Visit (11–15) | Pick one of the plumber's 3 windows or ask for new ones, confirmation, day-before reminder with rebooking, live ETA | Propose 3 windows (typed, suggested or dictated), ETA picker for "I'm on the way" |
| Repair (16–18) | Cost check against the €3,000 pre-approved limit, manager approval above it, work note, "Is it dry now?" | Enter the quote (over €3,000 goes to the manager), dictate the work note, wait for the tenant's confirmation |
| Close (19–21) | Invoice with 19% VAT linked to the case and unit, two feedback questions, seven-day check that updates the home record | Build the invoice from hours and parts, see feedback and the seven-day follow-up |

The manager and the other side of the conversation are played by the dashed **Demo:** buttons. Voice uses the browser's own speech recognition and speech synthesis as a stand-in for the ElevenLabs voice agent, so it needs no API key; where the browser has no speech support, the portals say so and you can type instead.

There's no backend. All data is fake and lives in `website/data/`, and the login only checks it in the browser.

## Running it locally

No build step and no dependencies to install. Serve the `website` folder with any static server, for example:

```bash
cd website && python3 -m http.server 8000
```

Then open <http://localhost:8000>. The maps (MapLibre), the globe (D3) and the fonts load from public CDNs, so you need an internet connection.

### Demo accounts

The test accounts are in [`website/data/demo-accounts.js`](website/data/demo-accounts.js). They're fake and protect nothing. Pick the matching role (Tenant or Partner) on the login page.

## Tech

- Plain HTML, CSS and JavaScript
- [MapLibre GL](https://maplibre.org/) for the maps in the portals
- [D3](https://d3js.org/) and TopoJSON for the landing page globe
