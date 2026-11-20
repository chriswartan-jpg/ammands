// Demo data only. The unit snapshot extends the example payload from the Reltix
// brief; everything else (partner, access notes, repair policy) is invented.

export const unit = {
  id: 'unit_4b',
  label: 'Unit 4B',
  property: {
    address: 'Musterstraße 12, 52062 Aachen',
    buildingYear: 1972,
    heating: 'Gas central heating',
    energyCertificate: { class: 'E', validUntil: '2029-03-31' },
  },
  details: {
    floor: '2nd floor',
    sizeSqm: 68,
    rooms: 3,
    meters: [
      { type: 'Electricity', number: '1ESY1160123456' },
      { type: 'Cold water', number: 'WZ-4B-0077120' },
    ],
    access: 'Doorbell “Hoffmann”, 2nd floor left. No lift.',
    waterShutOff: 'Unit stop valve in the hallway riser cupboard, next to the bathroom door.',
    pipework: 'Built 1972. In-unit pipework renewed 2009.',
  },
  owner: { contactId: 'c_101', name: 'Maria Becker' },
  tenant: {
    contactId: 'c_202',
    name: 'Lena Hoffmann',
    firstName: 'Lena',
    email: 'lena@example.com',
    phone: '+49 151 00000000',
    moveIn: '2024-03-01',
  },
  lease: { rentColdEur: 780, start: '2024-03-01' },
  repairPolicy: {
    preApprovedNetLimitCents: 25000,
    invoiceRecipient: 'Centrix Property Management, for Musterstraße 12',
  },
}

export const partner = {
  id: 'p_klarfluss',
  name: 'Klarfluss Sanitär GmbH',
  shortName: 'Klarfluss Sanitär',
  trade: 'Plumbing and sanitary repairs',
  area: 'Aachen',
  technician: 'Jonas Weber',
}

export const DEMO_REPORT = 'There’s water leaking from the pipe under my kitchen sink.'
export const DEMO_NON_PLUMBING_REPORT = 'The electrical socket in my bedroom has stopped working.'
export const DEMO_UNCERTAIN_REPORT = 'There is a damp patch growing on my kitchen wall.'

export const DEMO_WORK_NOTE =
  'Replaced the leaking trap and both compression seals under the kitchen sink. Ran water for 10 minutes, all joints dry.'
