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
    unit: "Unit 4B",
    address: "Musterstraße 12, 52062 Aachen",
    floor: "2nd floor, lift",
    phone: "+49 151 00000000",
    access: "Spare key with the caretaker, Mr. Braun",
    building: "Built 1972 · gas central heating",
    lat: 50.7766, lng: 6.0838
  },

  // What the assistant recognises, with a price range per problem [assumption]
  problems: {
    leak: {
      label: "Leak",
      title: "Leak under the kitchen sink",
      words: ["leak", "leaking", "drip", "dripping", "water under", "wet", "lek", "lekt", "nass", "undicht"],
      question: "Is water still coming out right now?",
      yes: "Yes, it's still leaking",
      no: "No, it has stopped",
      price: [90, 160],
      causes: ["Loose nut on the trap under the sink", "Worn seal on the tap connection"]
    },
    blockage: {
      label: "Blocked drain",
      title: "Blocked drain",
      words: ["block", "blocked", "clog", "drain", "slow", "verstopt", "verstopft"],
      question: "Is the water not draining at all?",
      yes: "Nothing drains",
      no: "It drains slowly",
      price: [70, 130],
      causes: ["Hair and soap in the trap", "Blockage further down the pipe"]
    },
    hotwater: {
      label: "No hot water",
      title: "No hot water",
      words: ["hot water", "warm water", "cold water", "boiler", "geen warm", "kein warm"],
      question: "Is there no hot water anywhere in the flat?",
      yes: "Nowhere in the flat",
      no: "Only one tap",
      price: [110, 220],
      causes: ["Water heater tripped or faulty", "Low water pressure in the building"]
    },
    toilet: {
      label: "Toilet keeps running",
      title: "Toilet keeps running",
      words: ["toilet", "flush", "cistern", "wc", "running"],
      question: "Is water running into the bowl all the time?",
      yes: "Yes, all the time",
      no: "Only now and then",
      price: [60, 120],
      causes: ["Worn flush valve seal", "Fill valve set too high"]
    }
  },

  callOut: 45,

  // A few vetted plumbers around the building [assumption]
  plumbers: [
    {
      id: "p1", name: "Example Plumbing GmbH", initials: "EP",
      distance: "1.2 km", rating: 4.8, reviews: 126, eta: "18 min",
      next: "Tomorrow", from: 45,
      slots: ["Today 16:00–18:00", "Tomorrow 10:00–12:00", "Tomorrow 14:00–16:00"],
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
