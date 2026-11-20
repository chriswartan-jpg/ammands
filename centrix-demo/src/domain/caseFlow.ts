// The single shared repair case and every transition in the demo flow.
// Pure functions: (state, input, now) -> state. An action that is not valid in
// the current status returns the state unchanged.

import { partner, unit } from './demoData.ts'
import { formatMoney, formatSlot } from './format.ts'
import {
  answerQuestion,
  classifyReport,
  generalPlumbingClassification,
  questionsFor,
} from './plumbingTriage.ts'
import type {
  Classification,
  FollowUpAnswer,
  FollowUpQuestion,
  IntakeTriage,
  PlumbingSubtype,
} from './plumbingTriage.ts'

export type Role = 'tenant' | 'manager' | 'plumber'
export type Actor = Role | 'system'

export type CaseStatus =
  | 'gathering_details'
  | 'manager_review'
  | 'awaiting_dispatch'
  | 'dispatched'
  | 'slots_proposed'
  | 'scheduled'
  | 'completed'
  | 'invoiced'

export type EventKind =
  | 'reported'
  | 'case_created'
  | 'classified'
  | 'details_collected'
  | 'manager_override'
  | 'job_prepared'
  | 'dispatched'
  | 'slots_proposed'
  | 'appointment'
  | 'completed'
  | 'invoice'

export interface TimelineEvent {
  id: string
  at: string
  actor: Actor
  kind: EventKind
  /** Manager-facing wording. */
  title: string
  detail?: string
  /** Tenant-facing wording. Events without it are not shown in the tenant portal. */
  tenantText?: string
}

export interface Triage {
  issue: string
  location: string
  urgent: boolean
  urgencyLabel: string
}

export type FieldSource =
  | 'Tenant report'
  | 'Tenant follow-up'
  | 'Manager review'
  | 'Auto-triage'
  | 'Unit record'
  | 'Tenant contact'
  | 'Repair policy'

export interface JobField {
  label: string
  value: string
  source: FieldSource
}

export interface JobDraft {
  partnerId: string
  title: string
  urgent: boolean
  /** Exactly what the partner receives on dispatch. */
  shared: JobField[]
  /** On file for the unit, deliberately not sent. */
  withheld: { label: string; reason: string }[]
}

export interface Slot {
  id: string
  start: string
  end: string
}

export interface InvoiceLine {
  description: string
  amountCents: number
}

export interface Invoice {
  number: string
  issuedAt: string
  from: string
  billTo: string
  reference: string
  lines: InvoiceLine[]
  netCents: number
  vatRatePercent: number
  vatCents: number
  grossCents: number
  withinPreApprovedLimit: boolean
}

export interface RepairCase {
  id: string
  unitId: string
  createdAt: string
  status: CaseStatus
  report: { text: string; submittedAt: string; channel: 'Tenant portal'; method?: 'voice' }
  consent: { dataShared: string[]; givenAt: string; channel: 'Tenant portal' }
  classification: Classification
  followUpQuestions: FollowUpQuestion[]
  followUpAnswers: FollowUpAnswer[]
  triage?: Triage
  job?: JobDraft
  dispatchedAt?: string
  proposedSlots: Slot[]
  appointment?: Slot
  completion?: { at: string; note: string }
  invoice?: Invoice
  timeline: TimelineEvent[]
}

export interface DemoState {
  case: RepairCase | null
}

export const initialState: DemoState = { case: null }

export const CASE_ID = 'CASE-1042'

// --- Simulated triage -------------------------------------------------------
// Classification decides whether this specialised workflow is allowed to run.
// Unknown and non-plumbing reports stay with the property-management team.

const PLUMBING_ISSUE: Record<PlumbingSubtype, string> = {
  leak: 'Water leak',
  blocked_drain: 'Blocked drain',
  toilet: 'Toilet problem',
  hot_water: 'Hot-water problem',
  water_pressure: 'Water-pressure problem',
  fixture: 'Plumbing fixture problem',
  general: 'Plumbing issue',
}

export function triageReport(text: string, answers: FollowUpAnswer[] = [], subtype?: PlumbingSubtype): Triage {
  const t = text.toLowerCase()

  const leak = /leak|drip|flood|burst/.test(t)
  const blocked = /clog|block/.test(t)
  const toilet = /toilet|wc|flush/.test(t)
  const hotWater = /hot water/.test(t)
  const pressure = /pressure|weak flow/.test(t)
  const issue = leak
    ? 'Water leak'
    : blocked
      ? 'Blocked drain'
      : toilet
        ? 'Toilet problem'
        : hotWater
          ? 'Hot-water problem'
          : pressure
            ? 'Water-pressure problem'
            : 'Plumbing issue'

  const area = /kitchen/.test(t) ? 'kitchen' : /bath|shower|toilet|wc/.test(t) ? 'bathroom' : null
  const fixture = /sink/.test(t)
    ? 'sink'
    : /toilet|wc/.test(t)
      ? 'toilet'
      : /shower/.test(t)
        ? 'shower'
        : /tap|faucet/.test(t)
          ? 'tap'
          : null
  const answeredLocation = answers.find((answer) => answer.fact === 'Exact location')?.label.toLowerCase()
  const inferredLocation = [area, fixture].filter(Boolean).join(' ') || 'location not specified'
  const location = answeredLocation ?? inferredLocation
  const activeLeak = answers.some(({ fact, value }) =>
    (fact === 'Current state' && value === 'continuous') ||
    (fact === 'Amount of water' && (value === 'steady' || value === 'spreading')) ||
    value.startsWith('active-water-leak-'),
  )
  const urgent = (subtype === 'leak' || leak) && activeLeak

  return {
    issue: subtype ? PLUMBING_ISSUE[subtype] : issue,
    location,
    urgent,
    urgencyLabel: urgent ? 'Priority: active water leak' : 'Standard priority',
  }
}

export function buildJobDraft(reportText: string, triage: Triage, answers: FollowUpAnswer[] = []): JobDraft {
  const title = `${triage.issue} (${triage.location})`
  return {
    partnerId: partner.id,
    title,
    urgent: triage.urgent,
    shared: [
      { label: 'Problem reported', value: `“${reportText}”`, source: 'Tenant report' },
      { label: 'Issue type', value: title, source: 'Auto-triage' },
      { label: 'Urgency', value: triage.urgencyLabel, source: 'Auto-triage' },
      ...answers.map((answer) => ({
        label: answer.fact,
        value: answer.label,
        source: 'Tenant follow-up' as const,
      })),
      { label: 'Address', value: unit.property.address, source: 'Unit record' },
      { label: 'Unit', value: `${unit.label}, ${unit.details.floor}`, source: 'Unit record' },
      { label: 'Access', value: unit.details.access, source: 'Unit record' },
      { label: 'Water shut-off', value: unit.details.waterShutOff, source: 'Unit record' },
      { label: 'Pipework', value: unit.details.pipework, source: 'Unit record' },
      { label: 'On-site contact', value: `${unit.tenant.name}, ${unit.tenant.phone}`, source: 'Tenant contact' },
      {
        label: 'Cost approval',
        value: `Up to ${formatMoney(unit.repairPolicy.preApprovedNetLimitCents)} net is pre-approved. Send a quote first for anything above.`,
        source: 'Repair policy',
      },
      {
        label: 'Invoice to',
        value: `${unit.repairPolicy.invoiceRecipient}. Reference ${CASE_ID}.`,
        source: 'Repair policy',
      },
    ],
    withheld: [
      { label: 'Tenant email', reason: 'Scheduling happens in the tenant portal.' },
      { label: 'Owner name and contact', reason: 'Invoices go through property management.' },
      { label: 'Lease and rent', reason: 'Not needed for a repair.' },
      { label: 'Meter numbers, energy certificate', reason: 'Not needed for a repair.' },
    ],
  }
}

export interface AvailabilityWindow {
  date: string
  start: string
  end: string
}

export function validateAvailability(windows: AvailabilityWindow[], now: Date): Slot[] | string {
  if (windows.length !== 3) return 'Enter three appointment windows.'
  const slots: Slot[] = []
  for (const [index, window] of windows.entries()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(window.date) ||
        !/^\d{2}:\d{2}$/.test(window.start) || !/^\d{2}:\d{2}$/.test(window.end)) {
      return 'Enter a date, start time and end time for each window.'
    }
    const start = new Date(`${window.date}T${window.start}`)
    const end = new Date(`${window.date}T${window.end}`)
    if (!Number.isFinite(+start) || !Number.isFinite(+end) || start <= now) {
      return 'Choose a valid future start time for each window.'
    }
    if (end <= start) return 'Each end time must be later than its start time.'
    slots.push({ id: `slot-${index + 1}`, start: start.toISOString(), end: end.toISOString() })
  }
  slots.sort((a, b) => a.start.localeCompare(b.start))
  if (slots.some((slot, index) => index > 0 && slot.start < slots[index - 1].end)) {
    return 'Choose three windows that do not overlap.'
  }
  return slots
}

// --- Sample invoice ---------------------------------------------------------

export function buildSampleInvoice(now: Date): Invoice {
  const lines: InvoiceLine[] = [
    { description: 'Call-out, Aachen city', amountCents: 3900 },
    { description: 'Labour, 1.0 h', amountCents: 7200 },
    { description: 'Sink trap and compression seals', amountCents: 2400 },
  ]
  return buildInvoice(now, lines)
}

export function buildInvoice(now: Date, lines: InvoiceLine[]): Invoice {
  const netCents = lines.reduce((sum, line) => sum + line.amountCents, 0)
  const vatRatePercent = 19
  const vatCents = Math.round((netCents * vatRatePercent) / 100)
  return {
    number: `KS-${now.getFullYear()}-0417`,
    issuedAt: now.toISOString(),
    from: partner.name,
    billTo: unit.repairPolicy.invoiceRecipient,
    reference: `${CASE_ID}, ${unit.label}`,
    lines,
    netCents,
    vatRatePercent,
    vatCents,
    grossCents: netCents + vatCents,
    withinPreApprovedLimit: netCents <= unit.repairPolicy.preApprovedNetLimitCents,
  }
}

// --- Transitions ------------------------------------------------------------

// The demo is clicked through in minutes, but the visit is booked for a later
// day. Events that can only happen after the visit are stamped no earlier than
// the visit itself, so the case record reads in a believable order.
const VISIT_DURATION_MINUTES = 75
const INVOICE_DELAY_MINUTES = 20

function notBefore(now: Date, earliestIso: string, plusMinutes: number): Date {
  const earliest = new Date(new Date(earliestIso).getTime() + plusMinutes * 60_000)
  return now > earliest ? now : earliest
}

function withEvents(c: RepairCase, events: Omit<TimelineEvent, 'id'>[]): TimelineEvent[] {
  return [...c.timeline, ...events.map((event, i) => ({ ...event, id: `evt-${c.timeline.length + i + 1}` }))]
}

/** Tenant sends a report: opens a case and decides whether plumbing automation may continue. */
export function submitReport(state: DemoState, text: string, now: Date, intake?: IntakeTriage): DemoState {
  const reportText = text.trim()
  if (state.case || !reportText) return state

  const at = now.toISOString()
  const classification = intake?.classification ?? classifyReport(reportText)
  const followUpQuestions = classification.route === 'plumbing'
    ? intake?.questions ?? questionsFor(classification)
    : []
  const isPlumbing = classification.route === 'plumbing'
  const ready = isPlumbing && followUpQuestions.length === 0
  const triage = ready ? triageReport(reportText, [], classification.subtype) : undefined
  const draft: RepairCase = {
    id: CASE_ID,
    unitId: unit.id,
    createdAt: at,
    status: ready ? 'awaiting_dispatch' : isPlumbing ? 'gathering_details' : 'manager_review',
    ...(triage && { triage, job: buildJobDraft(reportText, triage) }),
    report: { text: reportText, submittedAt: at, channel: 'Tenant portal' },
    consent: { dataShared: ['name', 'phone number', 'address'], givenAt: at, channel: 'Tenant portal' },
    classification,
    followUpQuestions,
    followUpAnswers: [],
    proposedSlots: [],
    timeline: [],
  }
  const timeline = withEvents(draft, [
    {
      at,
      actor: 'tenant',
      kind: 'reported',
      title: `${unit.tenant.name} reported a problem in the tenant portal`,
      detail: `“${reportText}”`,
      tenantText: 'You sent your report.',
    },
    {
      at,
      actor: 'system',
      kind: 'case_created',
      title: `${CASE_ID} opened on ${unit.label}`,
      detail: 'The original report is saved before any routing decision is made.',
      tenantText: `We opened repair request ${CASE_ID}.`,
    },
    {
      at,
      actor: 'system',
      kind: 'classified',
      title: isPlumbing ? 'Report classified as plumbing' : 'Report routed to the property-management team',
      detail: `${classification.explanation} Evidence: ${
        classification.evidence.length ? classification.evidence.join('; ') : 'no decisive plumbing signals'
      }.`,
      tenantText: isPlumbing
        ? ready
          ? 'Your property manager will review the plumbing request before dispatch.'
          : `This looks like a plumbing problem. Please answer ${followUpQuestions.length} quick ${followUpQuestions.length === 1 ? 'question' : 'questions'} so we can send the right details.`
        : 'Your property-management team will review this request and contact you through the portal.',
    },
  ])
  const c = { ...draft, timeline }
  if (ready) {
    c.timeline = withEvents(c, [{
      at,
      actor: 'system',
      kind: 'job_prepared',
      title: `Plumber job prepared for ${partner.name}`,
      detail: `Combined the original report and the ${unit.label} record. Waiting for manager approval.`,
    }])
  }
  return { case: c }
}

/** Tenant answers the current plumbing question. The job is prepared after the final answer. */
export function answerFollowUp(
  state: DemoState,
  questionId: string,
  value: string,
  now: Date,
): DemoState {
  const c = state.case
  if (!c || c.status !== 'gathering_details') return state
  const nextQuestion = c.followUpQuestions.find(
    (question) => !c.followUpAnswers.some((answer) => answer.questionId === question.id),
  )
  if (!nextQuestion || nextQuestion.id !== questionId) return state
  const answer = answerQuestion(nextQuestion, value)
  if (!answer) return state

  const followUpAnswers = [...c.followUpAnswers, answer]
  const complete = followUpAnswers.length === c.followUpQuestions.length
  if (!complete) return { case: { ...c, followUpAnswers } }

  const modelSubtype = c.followUpQuestions[0]?.id.startsWith('n8n-') ? c.classification.subtype : undefined
  const triage = triageReport(c.report.text, followUpAnswers, modelSubtype)
  const job = buildJobDraft(c.report.text, triage, followUpAnswers)
  const at = now.toISOString()
  return {
    case: {
      ...c,
      status: 'awaiting_dispatch',
      followUpAnswers,
      triage,
      job,
      timeline: withEvents(c, [
        {
          at,
          actor: 'tenant',
          kind: 'details_collected',
          title: `${unit.tenant.name} answered ${followUpAnswers.length} plumbing follow-up questions`,
          detail: followUpAnswers.map((item) => `${item.fact}: ${item.label}`).join(' · '),
          tenantText: 'Thanks — your plumbing details have been sent to your property manager for review.',
        },
        {
          at,
          actor: 'system',
          kind: 'job_prepared',
          title: `Plumber job prepared for ${partner.name}`,
          detail: `Combined the original report, ${followUpAnswers.length} tenant answers and the ${unit.label} record. Waiting for manager approval.`,
        },
      ]),
    },
  }
}

/** Manager can move a misclassified case into plumbing; the tenant is then asked for details. */
export function continueAsPlumbing(state: DemoState, now: Date): DemoState {
  const c = state.case
  if (!c || c.status !== 'manager_review') return state
  const classification = generalPlumbingClassification()
  const followUpQuestions = questionsFor(classification)
  const at = now.toISOString()
  return {
    case: {
      ...c,
      status: 'gathering_details',
      classification,
      followUpQuestions,
      followUpAnswers: [],
      timeline: withEvents(c, [
        {
          at,
          actor: 'manager',
          kind: 'manager_override',
          title: 'Route changed to plumbing',
          detail: `The tenant was asked ${followUpQuestions.length} plumbing follow-up questions. No data has been shared with a partner.`,
          tenantText: 'Your property manager identified this as a plumbing request. Please answer three quick questions.',
        },
      ]),
    },
  }
}

export function setDispatchUrgency(state: DemoState, urgent: boolean, now: Date): DemoState {
  const c = state.case
  if (!c || c.status !== 'awaiting_dispatch' || !c.triage || !c.job || c.job.urgent === urgent) return state
  const urgencyLabel = urgent ? 'Urgent' : 'Standard priority'
  return {
    case: {
      ...c,
      triage: { ...c.triage, urgent, urgencyLabel },
      job: {
        ...c.job,
        urgent,
        shared: c.job.shared.map((field) =>
          field.label === 'Urgency' ? { ...field, value: urgencyLabel, source: 'Manager review' } : field,
        ),
      },
      timeline: withEvents(c, [{
        at: now.toISOString(),
        actor: 'manager',
        kind: 'manager_override',
        title: `Priority changed to ${urgencyLabel.toLowerCase()}`,
      }]),
    },
  }
}

/** Manager approves the prepared job and sends it to the partner. */
export function dispatchJob(state: DemoState, now: Date): DemoState {
  const c = state.case
  if (!c || c.status !== 'awaiting_dispatch' || !c.job) return state
  const at = now.toISOString()
  return {
    case: {
      ...c,
      status: 'dispatched',
      dispatchedAt: at,
      timeline: withEvents(c, [
        {
          at,
          actor: 'manager',
          kind: 'dispatched',
          title: `Job dispatched to ${partner.name}`,
          detail: `${c.job.shared.length} details shared through the partner connector (simulated).`,
          tenantText: `${partner.name} has been assigned. They will suggest visit times shortly.`,
        },
      ]),
    },
  }
}

/** Plumber proposes three available windows for the tenant to choose from. */
export function proposeSlots(state: DemoState, windows: AvailabilityWindow[], now: Date): DemoState {
  const c = state.case
  if (!c || c.status !== 'dispatched' || !c.dispatchedAt) return state
  const chosen = validateAvailability(windows, now)
  if (typeof chosen === 'string') return state
  return {
    case: {
      ...c,
      status: 'slots_proposed',
      proposedSlots: chosen,
      timeline: withEvents(c, [
        {
          at: now.toISOString(),
          actor: 'plumber',
          kind: 'slots_proposed',
          title: `${partner.shortName} proposed 3 appointment slots`,
          detail: chosen.map(formatSlot).join('  ·  '),
          tenantText: `${partner.shortName} suggested three visit times. Pick the one that suits you.`,
        },
      ]),
    },
  }
}

/** Tenant picks one of the proposed slots. */
export function chooseSlot(state: DemoState, slotId: string, now: Date): DemoState {
  const c = state.case
  if (!c || c.status !== 'slots_proposed') return state
  const appointment = c.proposedSlots.find((slot) => slot.id === slotId)
  if (!appointment) return state
  return {
    case: {
      ...c,
      status: 'scheduled',
      appointment,
      timeline: withEvents(c, [
        {
          at: now.toISOString(),
          actor: 'tenant',
          kind: 'appointment',
          title: 'Appointment confirmed by tenant',
          detail: `${formatSlot(appointment)} with ${partner.name}.`,
          tenantText: `You booked the visit for ${formatSlot(appointment)}.`,
        },
      ]),
    },
  }
}

/** Plumber reports the work as done. */
export function completeRepair(state: DemoState, note: string, now: Date): DemoState {
  const c = state.case
  const workNote = note.trim()
  if (!c || c.status !== 'scheduled' || !c.appointment || !workNote) return state
  const at = notBefore(now, c.appointment.start, VISIT_DURATION_MINUTES).toISOString()
  return {
    case: {
      ...c,
      status: 'completed',
      completion: { at, note: workNote },
      timeline: withEvents(c, [
        {
          at,
          actor: 'plumber',
          kind: 'completed',
          title: `Repair marked complete by ${partner.shortName}`,
          detail: workNote,
          tenantText: `${partner.shortName} marked the repair as complete.`,
        },
      ]),
    },
  }
}

/** Plumber sends the reviewed invoice, linked to the case and the unit. */
export function addInvoice(state: DemoState, now: Date, lines?: InvoiceLine[]): DemoState {
  const c = state.case
  if (!c || c.status !== 'completed' || !c.completion) return state
  if (lines && (lines.length === 0 || lines.some(({ description, amountCents }) =>
    !description.trim() || !Number.isSafeInteger(amountCents) || amountCents < 0 ||
    amountCents > 99_999_999,
  ))) return state
  const issuedAt = notBefore(now, c.completion.at, INVOICE_DELAY_MINUTES)
  const invoice = lines
    ? buildInvoice(issuedAt, lines.map((line) => ({ ...line, description: line.description.trim() })))
    : buildSampleInvoice(issuedAt)
  return {
    case: {
      ...c,
      status: 'invoiced',
      invoice,
      timeline: withEvents(c, [
        {
          at: invoice.issuedAt,
          actor: 'plumber',
          kind: 'invoice',
          title: `Invoice ${invoice.number} received, ${formatMoney(invoice.grossCents)}`,
          detail: `Linked to ${CASE_ID} and ${unit.label}. ${
            invoice.withinPreApprovedLimit ? 'Within' : 'Above'
          } the pre-approved limit of ${formatMoney(unit.repairPolicy.preApprovedNetLimitCents)} net.`,
        },
      ]),
    },
  }
}

// --- Read helpers -----------------------------------------------------------

export const STATUS_LABEL: Record<CaseStatus, string> = {
  gathering_details: 'Waiting for tenant details',
  manager_review: 'Property-manager review',
  awaiting_dispatch: 'Ready to dispatch',
  dispatched: 'Waiting for plumber',
  slots_proposed: 'Waiting for tenant',
  scheduled: 'Appointment booked',
  completed: 'Repair complete, invoice pending',
  invoiced: 'Closed, invoice linked',
}

/** Who acts next. Drives the guide in the demo bar. */
export function nextStep(c: RepairCase | null): { role: Role; label: string; done: boolean } {
  if (!c) return { role: 'tenant', label: 'Report a repair by voice or text', done: false }
  switch (c.status) {
    case 'gathering_details':
      return { role: 'tenant', label: 'Tenant answers the repair questions', done: false }
    case 'manager_review':
      return { role: 'manager', label: 'The property manager handles this report', done: true }
    case 'awaiting_dispatch':
      return { role: 'manager', label: 'Manager reviews and dispatches the job', done: false }
    case 'dispatched':
      return { role: 'plumber', label: 'Plumber offers three appointment windows', done: false }
    case 'slots_proposed':
      return { role: 'tenant', label: 'Tenant chooses an appointment', done: false }
    case 'scheduled':
      return { role: 'plumber', label: 'Plumber marks the repair complete', done: false }
    case 'completed':
      return { role: 'plumber', label: 'Plumber reviews and sends the invoice', done: false }
    case 'invoiced':
      return { role: 'manager', label: `Invoice linked to ${unit.label}`, done: true }
  }
}

export function caseTitle(c: RepairCase): string {
  return c.job?.title ?? c.classification.label
}
