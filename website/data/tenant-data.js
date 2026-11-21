/*
 * Demo data for the tenant portal.
 *
 * Made-up hackathon data. The plumbers are fictional companies, the prices are
 * example ranges [assumption] for Aachen, and the map points are approximate.
 * "home" is what centrix already knows about the tenant, so the tenant never
 * has to type it in.
 */
window.CENTRIX_TENANT = {
  home: {
    tenant: "Lena Hoffmann",
    photo: "assets/avatars/lena-hoffmann.jpg",
    unit: "Unit 4B",
    address: "Musterstraße 12, 52062 Aachen",
    floor: "2nd floor, lift",
    phone: "+49 151 00000000",
    access: "Spare key with the caretaker, Mr. Braun",
    building: "Built 1972 · gas central heating",
    shutoff: "Blue tap under the kitchen sink, behind the bin. Main valve in the cellar, room K4.",
    history: ["Mar 2025 · bathroom tap cartridge replaced"],
    lat: 50.7766, lng: 6.0838
  },

  // Repair policy from the property manager (final workflow, step 16)
  policy: {
    preApprovedLimit: 3000,   // € net. Above this the manager approves the quote first.
    vat: 19,                  // % VAT on the invoice
    invoiceTo: "Hausverwaltung Example GmbH",
    manager: "Hausverwaltung Example GmbH"
  },

  // The one partner the manager dispatches in the demo (final workflow, step 10)
  dispatchTo: "p1",

  // What the plumber never receives (final workflow, step 8)
  withheld: ["Your email address", "Owner details", "Lease and rent", "Meter numbers"],

  // Open cases in the same building, for the duplicate check (final workflow, step 4)
  openCases: [
    { id: "CASE-1038", unit: "Unit 3B (the flat below you)", problem: "leak", text: "Damp patch on the kitchen ceiling", reported: "Yesterday, 19:20" }
  ],

  // Words that tell centrix which language the tenant writes in (final workflow, step 2)
  languages: {
    de: { name: "German", words: ["wasser", "küche", "kueche", "undicht", "tropft", "kein", "nicht", "spüle", "bitte", "ich", "und"] },
    nl: { name: "Dutch", words: ["lekt", "lek", "keuken", "gootsteen", "geen", "niet", "water onder", "ik", "het"] },
    tr: { name: "Turkish", words: ["su", "mutfak", "sızıntı", "akıyor", "musluk", "yok"] },
    pl: { name: "Polish", words: ["woda", "kuchnia", "przecieka", "kran", "nie ma", "zlew"] }
  },

  // What the assistant recognises, with a price range per problem [assumption]
  problems: {
    leak: {
      label: "Leak",
      title: "Leak under the kitchen sink",
      words: ["leak", "leaking", "drip", "dripping", "water under", "wet", "lek", "lekt", "nass", "undicht"],
      followUps: [
        { q: "Is water still coming out right now?", options: [["Yes, it's still leaking", true], ["No, it has stopped", false]] },
        { q: "Is the water reaching the floor or other rooms?", options: [["Yes, it's spreading", true], ["No, it stays in the cupboard", false]] },
        { q: "Since when?", options: [["Today", false], ["A few days", false], ["Longer", false]] }
      ],
      price: [90, 160],
      causes: ["Loose nut on the trap under the sink", "Worn seal on the tap connection"]
    },
    blockage: {
      label: "Blocked drain",
      title: "Blocked drain",
      words: ["block", "blocked", "clog", "drain", "slow", "verstopt", "verstopft"],
      followUps: [
        { q: "Is the water not draining at all?", options: [["Nothing drains", true], ["It drains slowly", false]] },
        { q: "Is it one drain or several?", options: [["Just this one", false], ["Several drains", true]] },
        { q: "Since when?", options: [["Today", false], ["A few days", false], ["Longer", false]] }
      ],
      price: [70, 130],
      causes: ["Hair and soap in the trap", "Blockage further down the pipe"]
    },
    hotwater: {
      label: "No hot water",
      title: "No hot water",
      words: ["hot water", "warm water", "cold water", "boiler", "geen warm", "kein warm"],
      followUps: [
        { q: "Is there no hot water anywhere in the flat?", options: [["Nowhere in the flat", true], ["Only one tap", false]] },
        { q: "Does the water heater show an error?", options: [["Yes, an error", false], ["No / I don't know", false]] },
        { q: "Since when?", options: [["Today", false], ["A few days", false], ["Longer", false]] }
      ],
      price: [110, 220],
      causes: ["Water heater tripped or faulty", "Low water pressure in the building"]
    },
    toilet: {
      label: "Toilet keeps running",
      title: "Toilet keeps running",
      words: ["toilet", "flush", "cistern", "wc", "running"],
      followUps: [
        { q: "Is water running into the bowl all the time?", options: [["Yes, all the time", true], ["Only now and then", false]] },
        { q: "Is there another toilet in the flat?", options: [["No, this is the only one", true], ["Yes, there's another", false]] },
        { q: "Since when?", options: [["Today", false], ["A few days", false], ["Longer", false]] }
      ],
      price: [60, 120],
      causes: ["Worn flush valve seal", "Fill valve set too high"]
    }
  },

  callOut: 45,

  // A few vetted plumbers around the building [assumption]
  plumbers: [
    {
      id: "p1", name: "Example Plumbing GmbH", initials: "EP", photo: "assets/avatars/example-plumbing.jpg",
      distance: "1.2 km", rating: 4.8, reviews: 126, eta: "18 min",
      next: "Tomorrow", from: 45,
      slots: ["Today 16:00–18:00", "Tomorrow 10:00–12:00", "Tomorrow 14:00–16:00"],
      moreSlots: ["Tomorrow 17:00–19:00", "Sat 09:00–11:00", "Mon 07:30–09:30"],
      start: [50.7686, 6.0973]
    },
    {
      id: "p2", name: "Rohr & Rinne Aachen", initials: "RR",
      distance: "2.4 km", rating: 4.6, reviews: 88, eta: "25 min",
      next: "Tomorrow", from: 49,
      slots: ["Tomorrow 08:00–10:00", "Fri 12:00–14:00"],
      start: [50.7860, 6.0700]
    },
    {
      id: "p3", name: "Sanitär Becker", initials: "SB",
      distance: "3.1 km", rating: 4.9, reviews: 54, eta: "30 min",
      next: "Fri", from: 55,
      slots: ["Fri 09:00–11:00", "Mon 13:00–15:00"],
      start: [50.7650, 6.0610]
    }
  ]
};
