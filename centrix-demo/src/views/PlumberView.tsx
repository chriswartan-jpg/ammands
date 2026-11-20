import { useState } from 'react'

import { InvoiceCard } from '../components/InvoiceCard.tsx'
import { buildInvoice, buildSampleInvoice, validateAvailability } from '../domain/caseFlow.ts'
import type { AvailabilityWindow, RepairCase } from '../domain/caseFlow.ts'
import { DEMO_WORK_NOTE, partner } from '../domain/demoData.ts'
import { formatDayTime, formatSlot } from '../domain/format.ts'
import { actions } from '../store.ts'

const JOB_STATUS = {
  dispatched: 'New job',
  slots_proposed: 'Waiting for tenant',
  scheduled: 'Scheduled',
  completed: 'Done, invoice open',
  invoiced: 'Closed',
} as const

export function PlumberView({ repairCase }: { repairCase: RepairCase | null }) {
  // The partner only sees the job once the manager has dispatched it.
  const partnerStatuses = ['dispatched', 'slots_proposed', 'scheduled', 'completed', 'invoiced']
  const job = repairCase && partnerStatuses.includes(repairCase.status) && repairCase.job ? repairCase : null

  return (
    <div className="jobboard">
      <header className="jobboard-head">
        <div>
          <p className="eyebrow">Partner job board</p>
          <h1>{partner.name}</h1>
        </div>
        <p className="muted">
          {partner.trade} · {partner.area}
          <br />
          Signed in as {partner.technician}
        </p>
      </header>

      {job ? (
        <Job c={job} />
      ) : (
        <section className="card empty">
          <h2>No open jobs</h2>
          <p className="muted">New jobs from Centrix appear here as soon as a property manager dispatches them.</p>
        </section>
      )}
    </div>
  )
}

function Job({ c }: { c: RepairCase }) {
  if (!c.job) return null
  const job = c.job
  const status = c.status as keyof typeof JOB_STATUS

  return (
    <>
      <section className="card job" aria-label="Job details">
        <div className="case-title-row">
          <div>
            <p className="eyebrow">
              Job {c.id} · from Centrix{c.dispatchedAt && ` · received ${formatDayTime(c.dispatchedAt)}`}
            </p>
            <h2>{job.title}</h2>
          </div>
          <span className={`pill pill-${c.status}`}>{JOB_STATUS[status]}</span>
        </div>

        <details className="job-disclosure">
          <summary>Job brief <span>{job.shared.length} details</span></summary>
          <dl className="job-sheet">
            {job.shared.map((field) => (
              <div key={field.label}>
                <dt>{field.label}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
          </dl>
        </details>
      </section>

      {c.status === 'dispatched' && <ProposeSlots />}

      {c.status === 'slots_proposed' && (
        <section className="card" aria-label="Proposed slots">
          <p className="eyebrow">Waiting for the tenant</p>
          <h3>You proposed {c.proposedSlots.length} appointment windows</h3>
          <ul className="plain-list">
            {c.proposedSlots.map((slot) => (
              <li key={slot.id}>{formatSlot(slot)}</li>
            ))}
          </ul>
          <p className="muted">The tenant picks one in their portal. The booking shows up here right away.</p>
        </section>
      )}

      {c.appointment && (
        <section className="card appointment" aria-label="Appointment">
          <p className="eyebrow">Appointment, confirmed by the tenant</p>
          <p className="key-fact">{formatSlot(c.appointment)}</p>
        </section>
      )}

      {c.status === 'scheduled' && <CompleteRepair />}

      {c.status === 'completed' && c.completion && (
        <EditInvoice caseId={c.id} completedAt={c.completion.at} />
      )}

      {c.status === 'invoiced' && c.completion && c.invoice && (
        <section className="card" aria-label="Job closed">
          <p className="eyebrow">Job closed</p>
          <h3>Repair complete and invoiced</h3>
          <p className="muted">
            Completed {formatDayTime(c.completion.at)}: {c.completion.note}
          </p>
          <InvoiceCard invoice={c.invoice} />
        </section>
      )}
    </>
  )
}

function ProposeSlots() {
  const [error, setError] = useState('')

  return (
    <section className="card action-card" aria-label="Propose appointment windows">
      <h3>Propose three appointment windows</h3>
      <p className="muted">Enter three times you’re available. The tenant chooses one.</p>
      <form onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        const windows: AvailabilityWindow[] = [1, 2, 3].map((index) => ({
          date: String(data.get(`date-${index}`)),
          start: String(data.get(`start-${index}`)),
          end: String(data.get(`end-${index}`)),
        }))
        const result = validateAvailability(windows, new Date())
        if (typeof result === 'string') {
          setError(result)
          return
        }
        actions.proposeSlots(windows)
      }}>
        {[1, 2, 3].map((index) => (
          <fieldset key={index} className="availability-window">
            <legend>Window {index}</legend>
            {(['date', 'start', 'end'] as const).map((field) => (
              <label key={field}>
                {{ date: 'Date', start: 'Start time', end: 'End time' }[field]}
                <input
                  type={field === 'date' ? 'date' : 'time'}
                  required
                  name={`${field}-${index}`}
                  onInput={() => setError('')}
                />
              </label>
            ))}
          </fieldset>
        ))}
        {error && <p role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary">Send 3 windows to tenant</button>
      </form>
    </section>
  )
}

function EditInvoice({ caseId, completedAt }: { caseId: string; completedAt: string }) {
  const issuedAt = new Date(completedAt)
  const [rows, setRows] = useState(() => buildSampleInvoice(issuedAt).lines.map((line, id) => ({
    id,
    description: line.description,
    amount: (line.amountCents / 100).toFixed(2),
  })))
  const [nextId, setNextId] = useState(rows.length)
  const lines = rows.map(({ description, amount }) => ({
    description: description.trim(),
    amountCents: /^\d{1,6}(?:[.,]\d{1,2})?$/.test(amount)
      ? Math.round(Number(amount.replace(',', '.')) * 100)
      : NaN,
  }))
  const valid = lines.every((line) => line.description && Number.isFinite(line.amountCents))

  return (
    <section className="card action-card" aria-label="Edit invoice">
      <p className="eyebrow">Repair completed {formatDayTime(completedAt)}</p>
      <h3>Edit the invoice</h3>
      <form onSubmit={(event) => {
        event.preventDefault()
        if (valid) actions.addInvoice(lines)
      }}>
        {rows.map((row, index) => (
          <fieldset key={row.id} className="invoice-edit-row">
            <legend>Line {index + 1}</legend>
            <label>
              Description
              <input value={row.description} required onChange={(event) => {
                const description = event.target.value
                setRows((current) => current.map((item) => item.id === row.id ? { ...item, description } : item))
              }} />
            </label>
            <label>
              Net amount (€)
              <input inputMode="decimal" value={row.amount} required onChange={(event) => {
                const amount = event.target.value
                setRows((current) => current.map((item) => item.id === row.id ? { ...item, amount } : item))
              }} />
            </label>
            <button type="button" className="btn" aria-label={`Remove line ${index + 1}`}
              disabled={rows.length === 1}
              onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}
            >
              Remove
            </button>
          </fieldset>
        ))}
        <button type="button" className="btn" onClick={() => {
          setRows((current) => [...current, { id: nextId, description: '', amount: '' }])
          setNextId(nextId + 1)
        }}>
          Add line
        </button>
        {valid ? <InvoiceCard invoice={buildInvoice(issuedAt, lines)} draft /> : (
          <p className="muted">Enter a description and a non-negative amount with up to two decimal places for each line.</p>
        )}
        <div className="dispatch-actions">
          <button type="submit" className="btn btn-primary" disabled={!valid}>Send invoice to Centrix</button>
          <span className="muted">The invoice is linked to {caseId} and the unit.</span>
        </div>
      </form>
    </section>
  )
}

function CompleteRepair() {
  const [note, setNote] = useState(DEMO_WORK_NOTE)

  return (
    <section className="card action-card" aria-label="Mark repair complete">
      <p className="eyebrow">Your move</p>
      <h3>Mark the repair complete</h3>
      <label htmlFor="work-note" className="field-label">
        Work done
      </label>
      <textarea id="work-note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
      <div className="dispatch-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!note.trim()}
          onClick={() => actions.completeRepair(note)}
        >
          Mark repair complete
        </button>
        <span className="muted">The tenant and the property manager are updated immediately.</span>
      </div>
    </section>
  )
}
