import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  addInvoice,
  answerFollowUp,
  validateAvailability,
  setDispatchUrgency,
  triageReport,
  chooseSlot,
  completeRepair,
  continueAsPlumbing,
  dispatchJob,
  ESTIMATE_REVIEW_LIMIT_CENTS,
  initialState,
  nextStep,
  proposeSlots,
  submitReport,
} from './caseFlow.ts'
import {
  DEMO_NON_PLUMBING_REPORT,
  DEMO_REPORT,
  DEMO_UNCERTAIN_REPORT,
  DEMO_WORK_NOTE,
  unit,
} from './demoData.ts'
import { classifyReport } from './plumbingTriage.ts'
import type { DemoState } from './caseFlow.ts'

const at = (minutes: number) => new Date(2026, 10, 20, 17, minutes)
const windows = [
  { date: '2026-11-21', start: '09:00', end: '10:30' },
  { date: '2026-11-22', start: '14:00', end: '15:00' },
  { date: '2026-11-24', start: '11:00', end: '12:00' },
]


function answerAllQuestions(state: DemoState, startMinute = 1): DemoState {
  let result = state
  let minute = startMinute
  while (result.case?.status === 'gathering_details') {
    const question = result.case.followUpQuestions.find(
      (candidate) => !result.case!.followUpAnswers.some((answer) => answer.questionId === candidate.id),
    )
    assert.ok(question)
    const preferred =
      question.options.find((option) => ['continuous', 'steady', 'no'].includes(option.value)) ?? question.options[0]
    result = answerFollowUp(result, question.id, preferred.value, at(minute++))
  }
  return result
}

function readyPlumbingCase(): DemoState {
  return answerAllQuestions(submitReport(initialState, DEMO_REPORT, at(0)))
}

function reviewedPhoto(highCents: number | null) {
  return {
    dataUrl: 'sample-photo',
    review: { finding: 'Example finding', estimate: highCents === null ? null : { lowCents: 10000, highCents } },
  }
}

test('a plumbing photo estimate below €3,000 dispatches automatically after follow-up', () => {
  const state = submitReport(initialState, DEMO_REPORT, at(0), undefined, {
    method: 'sms',
    priority: 'standard',
    photo: reviewedPhoto(ESTIMATE_REVIEW_LIMIT_CENTS - 1),
  })
  assert.equal(state.case?.status, 'gathering_details')
  const ready = answerAllQuestions(state)
  assert.equal(ready.case?.status, 'dispatched')
  assert.equal(ready.case?.report.method, 'sms')
  assert.ok(ready.case?.consent.dataShared.includes('repair photo'))
  assert.equal(ready.case?.timeline.at(-1)?.actor, 'system')
  assert.equal(nextStep(ready.case).role, 'plumber')
})

test('estimates at or above €3,000, and inconclusive photos, wait for the manager', () => {
  for (const estimateCents of [ESTIMATE_REVIEW_LIMIT_CENTS, ESTIMATE_REVIEW_LIMIT_CENTS + 1, null]) {
    const state = submitReport(initialState, DEMO_REPORT, at(0), undefined, {
      priority: 'urgent',
      method: 'voice',
      photo: reviewedPhoto(estimateCents),
    })
    const ready = answerAllQuestions(state)
    assert.equal(ready.case?.status, 'awaiting_dispatch')
    assert.equal(ready.case?.dispatchedAt, undefined)
    assert.equal(ready.case?.job?.urgent, true)
    assert.equal(dispatchJob(ready, at(5)).case?.timeline.at(-1)?.actor, 'manager')
  }
})

test('a low estimate cannot route a non-plumbing report to a plumber', () => {
  const state = submitReport(initialState, DEMO_NON_PLUMBING_REPORT, at(0), undefined, {
    photo: reviewedPhoto(27500),
  })
  assert.equal(state.case?.status, 'manager_review')
  assert.equal(state.case?.job, undefined)
})

test('a confirmed plumbing report with no follow-up questions still routes by estimate', () => {
  const state = submitReport(initialState, DEMO_REPORT, at(0), {
    classification: classifyReport(DEMO_REPORT), questions: [],
  }, { photo: reviewedPhoto(27500) })
  assert.equal(state.case?.status, 'dispatched')
  assert.equal(state.case?.timeline.at(-1)?.actor, 'system')
})

test('a photo without a live review stays with the manager', () => {
  const oldPhoto = { dataUrl: 'sample-photo', estimateCents: 27500 }
  const state = submitReport(initialState, DEMO_REPORT, at(0), undefined, { photo: oldPhoto })
  assert.equal(answerAllQuestions(state).case?.status, 'awaiting_dispatch')
})

test('full flow: tenant report to invoice linked on Unit 4B', () => {
  let state = submitReport(initialState, DEMO_REPORT, at(0))
  assert.equal(state.case?.status, 'gathering_details')
  assert.equal(state.case?.classification.route, 'plumbing')
  assert.equal(state.case?.followUpQuestions.length, 3)
  assert.equal(state.case?.job, undefined)
  assert.equal(nextStep(state.case).role, 'tenant')

  state = answerAllQuestions(state)
  assert.equal(state.case?.status, 'awaiting_dispatch')
  assert.equal(state.case?.unitId, 'unit_4b')
  assert.equal(state.case?.job?.title, 'Water leak (kitchen sink)')
  assert.equal(state.case?.triage?.urgent, true)
  assert.equal(state.case?.followUpAnswers.length, 3)
  assert.equal(nextStep(state.case).role, 'manager')

  state = dispatchJob(state, at(4))
  assert.equal(state.case?.status, 'dispatched')

  state = proposeSlots(state, windows, at(5))
  const candidates = state.case!.proposedSlots
  assert.equal(state.case?.status, 'slots_proposed')
  assert.equal(candidates.length, 3)
  assert.equal(candidates[2].start, new Date('2026-11-24T11:00').toISOString())
  assert.equal(nextStep(state.case).role, 'tenant')

  state = chooseSlot(state, candidates[2].id, at(6))
  assert.equal(state.case?.status, 'scheduled')
  assert.deepEqual(state.case?.appointment, candidates[2])

  state = completeRepair(state, DEMO_WORK_NOTE, at(7))
  assert.equal(state.case?.status, 'completed')
  assert.equal(state.case?.completion?.note, DEMO_WORK_NOTE)

  assert.equal(addInvoice(state, at(8), [{ description: 'Invalid', amountCents: -1 }]), state)
  state = addInvoice(state, at(8), [
    { description: 'Trip and diagnosis', amountCents: 5600 },
    { description: 'Repair', amountCents: 14400 },
  ])
  assert.equal(state.case?.invoice?.lines[0].description, 'Trip and diagnosis')
  assert.equal(state.case?.status, 'invoiced')
  assert.equal(state.case?.invoice?.netCents, 20000)
  assert.equal(state.case?.invoice?.vatCents, 3800)
  assert.equal(state.case?.invoice?.grossCents, 23800)
  assert.equal(state.case?.invoice?.withinPreApprovedLimit, true)
  assert.ok(nextStep(state.case).done)

  assert.deepEqual(
    state.case?.timeline.map((event) => event.kind),
    [
      'reported',
      'case_created',
      'classified',
      'details_collected',
      'job_prepared',
      'dispatched',
      'slots_proposed',
      'appointment',
      'completed',
      'invoice',
    ],
  )
  const ids = state.case!.timeline.map((event) => event.id)
  assert.equal(new Set(ids).size, ids.length)
})

test('completion and invoice are dated after the booked visit, never before it', () => {
  let state = readyPlumbingCase()
  state = dispatchJob(state, at(4))
  state = proposeSlots(state, windows, at(5))
  const second = state.case!.proposedSlots[1]
  state = chooseSlot(state, second.id, at(6))

  // Clicked through minutes after booking, days before the visit.
  const early = addInvoice(completeRepair(state, DEMO_WORK_NOTE, at(4)), at(5)).case!
  const visitStart = new Date(second.start).getTime()
  assert.equal(new Date(early.completion!.at).getTime(), visitStart + 75 * 60_000)
  assert.equal(new Date(early.invoice!.issuedAt).getTime(), visitStart + 95 * 60_000)
  const times = early.timeline.map((event) => new Date(event.at).getTime())
  assert.deepEqual(times, [...times].sort((a, b) => a - b))

  // Clicked after the visit really happened: the real time is kept.
  const afterVisit = new Date(visitStart + 3 * 60 * 60_000)
  const late = completeRepair(state, DEMO_WORK_NOTE, afterVisit).case!
  assert.equal(late.completion!.at, afterVisit.toISOString())
})

test('the job shares the report and unit details, and withholds the rest', () => {
  const { job } = readyPlumbingCase().case!
  assert.ok(job)
  const sent = JSON.stringify(job.shared)

  assert.ok(sent.includes(DEMO_REPORT))
  assert.ok(sent.includes(unit.property.address))
  assert.ok(sent.includes(unit.tenant.phone))
  assert.ok(sent.includes('Yes, continuously'))
  assert.ok(sent.includes('A steady flow'))

  assert.ok(!sent.includes(unit.tenant.email))
  assert.ok(!sent.includes(unit.owner.name))
  assert.ok(!sent.includes(String(unit.lease.rentColdEur)))
  for (const meter of unit.details.meters) assert.ok(!sent.includes(meter.number))
})

test('the tenant portal receives completion and invoice updates without internal events', () => {
  let state = readyPlumbingCase()
  state = dispatchJob(state, at(4))
  state = proposeSlots(state, windows, at(5))
  state = chooseSlot(state, state.case!.proposedSlots[0].id, at(6))
  state = completeRepair(state, DEMO_WORK_NOTE, at(7))
  state = addInvoice(state, at(8))

  const tenantKinds = state.case!.timeline.filter((event) => event.tenantText).map((event) => event.kind)
  assert.deepEqual(tenantKinds, [
    'reported',
    'case_created',
    'classified',
    'details_collected',
    'dispatched',
    'slots_proposed',
    'appointment',
    'completed',
    'invoice',
  ])
  const invoiceUpdate = state.case!.timeline.find((event) => event.kind === 'invoice')
  assert.ok(invoiceUpdate?.tenantText?.includes(state.case!.invoice!.number))
})

test('out-of-order and invalid actions leave the case unchanged', () => {
  assert.equal(submitReport(initialState, '   ', at(0)), initialState)
  assert.equal(dispatchJob(initialState, at(0)), initialState)

  const reported = submitReport(initialState, DEMO_REPORT, at(0))
  assert.equal(submitReport(reported, 'A second report', at(1)), reported)
  assert.equal(proposeSlots(reported, windows, at(1)), reported)
  assert.equal(addInvoice(reported, at(1)), reported)
  assert.equal(dispatchJob(reported, at(1)), reported)
  assert.equal(answerFollowUp(reported, 'not-current', 'no', at(1)), reported)

  const ready = answerAllQuestions(reported)
  const dispatched = dispatchJob(ready, at(4))
  assert.equal(dispatchJob(dispatched, at(2)), dispatched)
  assert.equal(proposeSlots(dispatched, windows.slice(0, 1), at(2)), dispatched)
  assert.equal(proposeSlots(dispatched, [windows[0], windows[0], windows[1]], at(2)), dispatched)
  assert.equal(proposeSlots(dispatched, [{ ...windows[0], end: '08:30' }, ...windows.slice(1)], at(2)), dispatched)
  assert.equal(completeRepair(dispatched, DEMO_WORK_NOTE, at(2)), dispatched)

  const proposed = proposeSlots(dispatched, windows, at(2))
  assert.equal(chooseSlot(proposed, 'slot-4', at(3)), proposed)

  const scheduled = chooseSlot(proposed, 'slot-2', at(3))
  assert.equal(completeRepair(scheduled, '  ', at(4)), scheduled)
  assert.equal(addInvoice(scheduled, at(4)), scheduled)
})

test('non-plumbing and uncertain reports follow the usual manager route without a job', () => {
  for (const report of [DEMO_NON_PLUMBING_REPORT, DEMO_UNCERTAIN_REPORT]) {
    const state = submitReport(initialState, report, at(0))
    assert.equal(state.case?.status, 'manager_review')
    assert.notEqual(state.case?.classification.route, 'plumbing')
    assert.equal(state.case?.job, undefined)
    assert.equal(state.case?.followUpQuestions.length, 0)
    assert.equal(nextStep(state.case).role, 'manager')
    assert.equal(nextStep(state.case).done, true)
    assert.equal(dispatchJob(state, at(1)), state)
  }
})

test('manager can override the usual route, then tenant questions are required before dispatch', () => {
  const routed = submitReport(initialState, DEMO_UNCERTAIN_REPORT, at(0))
  const overridden = continueAsPlumbing(routed, at(1))
  assert.equal(overridden.case?.status, 'gathering_details')
  assert.equal(overridden.case?.classification.route, 'plumbing')
  assert.equal(overridden.case?.classification.confidence, 'medium')
  assert.equal(overridden.case?.followUpQuestions.length, 3)
  assert.equal(overridden.case?.job, undefined)

  const ready = answerAllQuestions(overridden, 2)
  assert.equal(ready.case?.status, 'awaiting_dispatch')
  assert.ok(ready.case?.job)
})

test('classifier recognizes plumbing subtypes and fails closed for everything else', () => {
  const examples = [
    ['The toilet will not flush and the WC is blocked.', 'plumbing', 'toilet'],
    ['The kitchen drain is clogged and the sink is blocked.', 'plumbing', 'blocked_drain'],
    ['There is no hot water at any tap.', 'plumbing', 'hot_water'],
    ['The water pressure is low at the shower.', 'plumbing', 'water_pressure'],
    ['My bathroom tap is broken.', 'plumbing', 'fixture'],
  ] as const

  for (const [report, route, subtype] of examples) {
    const result = classifyReport(report)
    assert.equal(result.route, route)
    assert.equal(result.subtype, subtype)
  }

  assert.equal(classifyReport('The bedroom window is broken.').route, 'not_plumbing')
  assert.equal(classifyReport('Something in the flat is making a strange sound.').route, 'uncertain')
  assert.equal(classifyReport('A pipe is leaking near an electrical socket.').route, 'uncertain')
})

test('custom windows are sorted and reject past or overlapping appointments', () => {
  const slots = validateAvailability([...windows].reverse(), at(5))
  assert.ok(Array.isArray(slots))
  assert.equal(slots[0].start, new Date('2026-11-21T09:00').toISOString())
  assert.match(String(validateAvailability(windows, new Date('2026-11-21T10:00'))), /future/)
  assert.match(String(validateAvailability([windows[0], windows[0], windows[2]], at(5))), /overlap/)
})

test('AI leak answers affect urgency and the manager can override before dispatch', () => {
  assert.equal(triageReport('Water under the sink', [{
    questionId: 'n8n-1', fact: 'Leak timing', question: 'When does it leak?',
    label: 'Even with tap off', value: 'active-water-leak-1',
  }], 'leak').urgent, true)
  const ready = readyPlumbingCase()
  const adjusted = setDispatchUrgency(ready, !ready.case!.job!.urgent, at(4))
  const dispatched = dispatchJob(adjusted, at(5))
  assert.equal(dispatched.case?.job?.urgent, !ready.case!.job!.urgent)
  assert.equal(dispatched.case?.job?.shared.find(field => field.label === 'Urgency')?.source, 'Manager review')
  assert.equal(setDispatchUrgency(dispatched, ready.case!.job!.urgent, at(6)), dispatched)
})
