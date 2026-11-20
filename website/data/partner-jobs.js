/*
 * Sample plumbing jobs for the partner dashboard.
 *
 * Made-up demo data for the hackathon: the tenants are not real people and the
 * map positions are approximate points in Aachen. Phase 2 replaces this with
 * the shared fake data set.
 *
 * status: new | scheduled | in_progress | done
 * urgency: urgent | normal
 */
window.CENTRIX_PARTNER_JOBS = [
  {
    id: "JOB-1042",
    service: "Leak under the kitchen sink",
    category: "Leak",
    status: "new",
    urgency: "urgent",
    reported: "Today, 08:12",
    address: "Musterstraße 12, unit 4B",
    district: "Aachen-Mitte",
    floor: "2nd floor, lift",
    lat: 50.7766, lng: 6.0838,
    tenant: "Lena Hoffmann",
    access: "Tenant at home until 13:00. Otherwise key with the caretaker.",
    slot: "Not booked yet",
    description: "Water collects in the cupboard under the kitchen sink. It started last night and the floor of the cupboard is soft.",
    photos: 2,
    causes: [
      { name: "Loose compression nut on the trap", likelihood: 55 },
      { name: "Worn seal on the tap connection", likelihood: 30 },
      { name: "Cracked waste pipe", likelihood: 15 }
    ],
    messages: [
      { from: "centrix", time: "08:12", text: "New job from a tenant report. Photos and access details are attached." },
      { from: "tenant", time: "08:14", text: "I put a bucket under it. I'm home all morning." }
    ]
  },
  {
    id: "JOB-1039",
    service: "Blocked shower drain",
    category: "Blockage",
    status: "scheduled",
    urgency: "normal",
    reported: "Yesterday, 17:40",
    address: "Pontstraße 88, unit 2A",
    district: "Aachen-Mitte",
    floor: "2nd floor, no lift",
    lat: 50.7790, lng: 6.0805,
    tenant: "Jonas Weber",
    access: "Tenant at home.",
    slot: "Tomorrow, 10:00 to 12:00",
    description: "The shower drains very slowly and the water stands about 3 cm high after a shower.",
    photos: 1,
    causes: [
      { name: "Hair and soap build-up in the trap", likelihood: 70 },
      { name: "Blockage further down the branch pipe", likelihood: 20 },
      { name: "Poor slope on the drain", likelihood: 10 }
    ],
    messages: [
      { from: "centrix", time: "17:40", text: "Job assigned to you. The tenant picked tomorrow 10:00 to 12:00." },
      { from: "partner", time: "18:02", text: "Confirmed, see you tomorrow morning." }
    ]
  },
  {
    id: "JOB-1037",
    service: "No hot water",
    category: "Hot water",
    status: "new",
    urgency: "urgent",
    reported: "Today, 07:05",
    address: "Jakobstraße 41, unit 1",
    district: "Aachen-Mitte",
    floor: "Ground floor",
    lat: 50.7737, lng: 6.0791,
    tenant: "Familie Yilmaz",
    access: "Key with the caretaker, Mr. Braun.",
    slot: "Not booked yet",
    description: "No hot water in the kitchen or the bathroom since this morning. The boiler display shows an error.",
    photos: 1,
    causes: [
      { name: "Instantaneous water heater tripped or faulty", likelihood: 60 },
      { name: "Low water pressure in the building", likelihood: 25 },
      { name: "Faulty mixing valve", likelihood: 15 }
    ],
    messages: [
      { from: "centrix", time: "07:05", text: "Urgent: household with two small children. The caretaker can let you in." }
    ]
  },
  {
    id: "JOB-1033",
    service: "Toilet keeps running",
    category: "Toilet",
    status: "in_progress",
    urgency: "normal",
    reported: "Mon, 14:20",
    address: "Theaterstraße 9, unit 3C",
    district: "Aachen-Mitte",
    floor: "3rd floor, lift",
    lat: 50.7728, lng: 6.0870,
    tenant: "Sofia Marino",
    access: "Tenant at home.",
    slot: "Today, 09:00 to 11:00",
    description: "The toilet cistern keeps filling and you can hear water running all the time.",
    photos: 0,
    causes: [
      { name: "Worn flapper or flush valve seal", likelihood: 65 },
      { name: "Fill valve set too high", likelihood: 25 },
      { name: "Faulty fill valve", likelihood: 10 }
    ],
    messages: [
      { from: "partner", time: "09:12", text: "On site now." },
      { from: "tenant", time: "09:13", text: "Great, the door is open." }
    ]
  },
  {
    id: "JOB-1030",
    service: "Dripping bathroom tap",
    category: "Leak",
    status: "scheduled",
    urgency: "normal",
    reported: "Mon, 09:47",
    address: "Wilhelmstraße 63, unit 5",
    district: "Frankenberger Viertel",
    floor: "1st floor",
    lat: 50.7706, lng: 6.0951,
    tenant: "Thomas Becker",
    access: "Key in the key safe, code shared on the day.",
    slot: "Fri, 14:00 to 16:00",
    description: "The washbasin tap keeps dripping, even when it is closed tightly.",
    photos: 1,
    causes: [
      { name: "Worn cartridge", likelihood: 60 },
      { name: "Limescale on the valve seat", likelihood: 30 },
      { name: "Damaged O-ring", likelihood: 10 }
    ],
    messages: [
      { from: "centrix", time: "09:50", text: "Slot booked for Friday. The tenant works, so use the key safe." }
    ]
  },
  {
    id: "JOB-1028",
    service: "Blocked kitchen sink",
    category: "Blockage",
    status: "done",
    urgency: "normal",
    reported: "Last week",
    address: "Lousbergstraße 20, unit 2",
    district: "Lousberg",
    floor: "2nd floor",
    lat: 50.7838, lng: 6.0842,
    tenant: "Anna Schulz",
    access: "Tenant at home.",
    slot: "Done on Thu",
    description: "The kitchen sink was fully blocked.",
    photos: 3,
    causes: [
      { name: "Grease build-up in the trap", likelihood: 80 },
      { name: "Food waste in the branch pipe", likelihood: 20 }
    ],
    messages: [
      { from: "partner", time: "Thu", text: "Cleared the trap and branch pipe. Report and invoice uploaded." },
      { from: "tenant", time: "Thu", text: "Works perfectly again, thank you!" }
    ]
  },
  {
    id: "JOB-1026",
    service: "Low water pressure",
    category: "Pressure",
    status: "new",
    urgency: "normal",
    reported: "Today, 10:31",
    address: "Oppenhoffallee 47, unit 3",
    district: "Frankenberger Viertel",
    floor: "3rd floor, no lift",
    lat: 50.7688, lng: 6.0898,
    tenant: "Mehmet Kaya",
    access: "Tenant at home after 16:00.",
    slot: "Not booked yet",
    description: "Very low pressure on all taps, mostly in the morning.",
    photos: 0,
    causes: [
      { name: "Clogged aerators or filter", likelihood: 45 },
      { name: "Partly closed stop valve", likelihood: 35 },
      { name: "Building pressure problem", likelihood: 20 }
    ],
    messages: [
      { from: "centrix", time: "10:31", text: "New job. Other units in this building have not reported the same yet." }
    ]
  }
];
