import { lazy, Suspense, useEffect, useRef, useState } from 'react'

import { InvoiceCard } from '../components/InvoiceCard.tsx'
import { RepairPhotoInput } from '../components/RepairPhotoInput.tsx'
import { caseTitle } from '../domain/caseFlow.ts'
import type { CaseStatus, RepairCase, RepairPhoto, ReportPriority } from '../domain/caseFlow.ts'
import {
  partner,
  unit,
} from '../domain/demoData.ts'
import { formatDayTime, formatSlot, formatTime } from '../domain/format.ts'
import { formatPhotoEstimate } from '../domain/photoReview.ts'
import { actions } from '../store.ts'

const VoiceIntake = lazy(() => import('../components/VoiceIntake.tsx').then(
  ({ VoiceIntake }) => ({ default: VoiceIntake }),
))

const STEPS = ['Reported', 'Plumber assigned', 'Visit booked', 'Repaired']

const STEPS_DONE: Record<CaseStatus, number> = {
  gathering_details: 1,
  manager_review: 1,
  awaiting_dispatch: 1,
  dispatched: 2,
  slots_proposed: 2,
  scheduled: 3,
  completed: 4,
  invoiced: 4,
}

export function TenantView({ repairCase }: { repairCase: RepairCase | null }) {
  return (
    <div className="portal">
      <header className="portal-head">
        <p className="eyebrow">Resident portal</p>
        <h1>{repairCase ? 'Your repair request' : 'Report a repair'}</h1>
        <p className="portal-home">
          {unit.tenant.firstName} · {unit.label} · {unit.property.address}
        </p>
      </header>

      {repairCase ? <RepairRequest c={repairCase} /> : <ReportIntake />}
    </div>
  )
}

function ReportIntake() {
  const [priority, setPriority] = useState<ReportPriority>()
  const [channel, setChannel] = useState<'website' | 'sms'>('website')

  return (
    <>
      <section className="card" aria-labelledby="report-priority">
        <h2 id="report-priority">Is the repair urgent?</h2>
        <div className="answer-options" role="group" aria-labelledby="report-priority">
          <button type="button" className="answer-option" aria-pressed={priority === 'urgent'} onClick={() => setPriority('urgent')}>Urgent</button>
          <button type="button" className="answer-option" aria-pressed={priority === 'standard'} onClick={() => setPriority('standard')}>Not urgent</button>
        </div>
      </section>
      {priority === 'urgent' && <Suspense fallback={null}><VoiceIntake /></Suspense>}
      {priority === 'standard' && (
        <section className="card" aria-labelledby="report-channel">
          <h2 id="report-channel">How would you like to report it?</h2>
          <div className="answer-options" role="group" aria-labelledby="report-channel">
            <button type="button" className="answer-option" aria-pressed={channel === 'website'} onClick={() => setChannel('website')}>Website</button>
            <button type="button" className="answer-option" aria-pressed={channel === 'sms'} onClick={() => setChannel('sms')}>SMS demo</button>
          </div>
        </section>
      )}
      {priority && <ReportComposer key={priority} priority={priority} sms={priority === 'standard' && channel === 'sms'} />}
    </>
  )
}

function ReportComposer({ priority, sms }: { priority: ReportPriority; sms: boolean }) {
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [photo, setPhoto] = useState<RepairPhoto>()
  const [readingPhoto, setReadingPhoto] = useState(false)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])

  return (
    <form
      className="card composer"
      onSubmit={async (event) => {
        event.preventDefault()
        if (request.current || readingPhoto || !text.trim()) return
        const controller = new AbortController()
        request.current = controller
        setSubmitting(true)
        try {
          await actions.submitReport(text.trim(), controller.signal, { priority, method: sms ? 'sms' : undefined, photo })
        } finally {
          request.current = null
          if (!controller.signal.aborted) setSubmitting(false)
        }
      }}
    >
      <label htmlFor="report" className="composer-label">
        {sms ? 'Write a simulated SMS' : 'Type your report'}
      </label>
      <p className="muted">{sms ? 'This message stays in the demo. Describe what happened and where.' : 'Tell us what happened and where you noticed it.'}</p>
      <textarea
        id="report"
        rows={3}
        maxLength={2000}
        disabled={submitting}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="e.g. The tap in the bathroom keeps dripping"
      />
      <RepairPhotoInput photo={photo} setPhoto={setPhoto} reading={readingPhoto} setReading={setReadingPhoto} />
      <button type="submit" className="btn btn-primary btn-block" disabled={submitting || readingPhoto || !text.trim()}>
        {submitting ? 'Checking your report…' : sms ? 'Send demo SMS' : 'Send report'}
      </button>
    </form>
  )
}

function RepairRequest({ c }: { c: RepairCase }) {
  const done = STEPS_DONE[c.status]
  const updates = c.timeline.filter((event) => event.tenantText).reverse()

  return (
    <>
      <section className="card request" aria-label="Your repair request">
        <p className="eyebrow">Repair request {c.id}</p>
        <h2>{caseTitle(c)}</h2>

        {c.status === 'manager_review' ? (
          <ol className="standard-steps">
            <li className="is-done">Report received</li>
            <li className="is-current">Property manager review</li>
          </ol>
        ) : (
          <ol className="steps">
            {STEPS.map((step, i) => (
              <li key={step} className={i < done ? 'is-done' : i === done ? 'is-next' : ''}>
                <span className="step-mark" aria-hidden="true" />
                <span className="step-label">{step}</span>
              </li>
            ))}
          </ol>
        )}

        <RequestStatus c={c} />

        <div className="your-report">
          <p className="eyebrow">Your report, {formatTime(c.report.submittedAt)}</p>
          <p>“{c.report.text}”</p>
          {c.report.photo && <img className="repair-photo" src={c.report.photo.dataUrl} alt="Photo submitted with your repair report" />}
          {c.report.photo?.review && <p><strong>AI photo review:</strong> {c.report.photo.review.finding}</p>}
        </div>
      </section>

      {c.invoice && (
        <section className="card" aria-label="Repair invoice">
          <InvoiceCard invoice={c.invoice} />
        </section>
      )}

      <section className="updates" aria-label="Updates">
        <h3>Updates</h3>
        <ul>
          {updates.map((event) => (
            <li key={event.id}>
              <time>{formatDayTime(event.at)}</time>
              <span>{event.tenantText}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

function RequestStatus({ c }: { c: RepairCase }) {
  switch (c.status) {
    case 'gathering_details': {
      const current = c.followUpQuestions.find(
        (question) => !c.followUpAnswers.some((answer) => answer.questionId === question.id),
      )
      if (!current) return null
      return (
        <div className="status-block is-action follow-up">
          <p className="eyebrow">
            Quick question {c.followUpAnswers.length + 1} of {c.followUpQuestions.length}
          </p>
          <h3>{current.text}</h3>
          <div className="answer-options">
            {current.options.map((option) => (
              <button
                key={option.value}
                type="button"
                className="answer-option"
                onClick={() => actions.answerFollowUp(current.id, option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          {c.followUpAnswers.length > 0 && (
            <details className="answers-so-far">
              <summary>{c.followUpAnswers.length} answer(s) saved</summary>
              <dl>
                {c.followUpAnswers.map((answer) => (
                  <div key={answer.questionId}>
                    <dt>{answer.fact}</dt>
                    <dd>{answer.label}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
        </div>
      )
    }
    case 'manager_review':
      return (
        <div className="status-block">
          <h3>With your property-management team</h3>
          <p>
            This was not confidently identified as a plumbing problem, so no plumber was contacted. Your property
            manager will continue with the usual workflow and contact you here.
          </p>
        </div>
      )
    case 'awaiting_dispatch':
      return (
        <div className="status-block">
          <h3>Your details are with the property manager</h3>
          <p>{c.report.photo?.review?.estimate
            ? `The estimated cost is ${formatPhotoEstimate(c.report.photo.review.estimate)}. The manager will review it before dispatch.`
            : 'The manager will review the job because a cost estimate is unavailable.'}</p>
        </div>
      )
    case 'dispatched':
      return (
        <div className="status-block">
          <h3>A plumber is assigned</h3>
          <p>{partner.name} will suggest visit times shortly. You’ll pick one here.</p>
        </div>
      )
    case 'slots_proposed':
      return (
        <div className="status-block is-action">
          <h3>Pick a time for the visit</h3>
          <p>{partner.name} can come at one of these times.</p>
          <div className="slot-choices">
            {c.proposedSlots.map((slot) => (
              <button key={slot.id} type="button" className="slot-choice" onClick={() => actions.chooseSlot(slot.id)}>
                <span>{formatSlot(slot)}</span>
                <span className="slot-cta">Book this time</span>
              </button>
            ))}
          </div>
        </div>
      )
    case 'scheduled':
      return (
        <div className="status-block">
          <h3>Visit booked</h3>
          <p className="status-key">{c.appointment && formatSlot(c.appointment)}</p>
          <p>
            {partner.technician} from {partner.shortName} will come by. They have your phone number in case they need
            to reach you.
          </p>
        </div>
      )
    case 'completed':
    case 'invoiced':
      return (
        <div className="status-block is-success">
          <h3>Repair complete</h3>
          {c.completion && (
            <p>
              {partner.shortName} finished on {formatDayTime(c.completion.at)}: “{c.completion.note}”
            </p>
          )}
        </div>
      )
  }
}
