import { InvoiceCard } from '../components/InvoiceCard.tsx'
import { caseTitle, STATUS_LABEL } from '../domain/caseFlow.ts'
import type { Actor, CaseStatus, JobDraft, RepairCase } from '../domain/caseFlow.ts'
import { partner, unit } from '../domain/demoData.ts'
import { formatDate, formatDayTime, formatMoney, formatSlot, formatTime } from '../domain/format.ts'
import { actions } from '../store.ts'

const ACTOR_LABEL: Record<Actor, string> = {
  tenant: 'Tenant',
  manager: 'Manager',
  plumber: 'Plumber',
  system: 'Centrix',
}

type DownstreamStatus = Exclude<CaseStatus, 'gathering_details' | 'manager_review' | 'awaiting_dispatch'>

const WAITING_ON: Record<DownstreamStatus, string> = {
  dispatched: `Waiting for ${partner.shortName} to propose appointment slots`,
  slots_proposed: `Waiting for ${unit.tenant.name} to pick an appointment window`,
  scheduled: 'Appointment booked. Waiting for the repair',
  completed: 'Repair complete. Waiting for the invoice',
  invoiced: `Case closed. Invoice linked to ${unit.label}`,
}

export function ManagerView({ repairCase }: { repairCase: RepairCase | null }) {
  return (
    <div className="workspace">
      <header className="workspace-head">
        <p className="eyebrow">Properties / Musterstraße 12</p>
        <h1>{unit.label}</h1>
        <p className="muted">{unit.property.address}</p>
      </header>

      <div className="workspace-grid">
        <div className="workspace-main">
          {repairCase ? (
            <CasePanel c={repairCase} />
          ) : (
            <section className="card empty">
              <h2>No open cases on {unit.label}</h2>
              <p className="muted">
                Every tenant report opens a case here. Only confirmed plumbing problems continue into the partner
                workflow.
              </p>
            </section>
          )}
        </div>
        <UnitRecord c={repairCase} />
      </div>
    </div>
  )
}

function CasePanel({ c }: { c: RepairCase }) {
  return (
    <>
      <section className="card case-head">
        <div className="case-title-row">
          <div>
            <p className="eyebrow">
              {c.id} · {formatDayTime(c.createdAt)} · {c.report.method === 'voice' ? 'Voice intake' : c.report.channel}
            </p>
            <h2>{caseTitle(c)}</h2>
          </div>
          <span className={`pill pill-${c.status}`}>{STATUS_LABEL[c.status]}</span>
        </div>
        <div className="case-summary">
          <div>
            <h3>Tenant report</h3>
            <blockquote className="quote">“{c.report.text}”<cite>{unit.tenant.name}</cite></blockquote>
          </div>
          {c.followUpAnswers.length > 0 && (
            <div>
              <h3>What the tenant confirmed</h3>
              <dl className="confirmed-facts">
                {c.followUpAnswers.map((answer) => (
                  <div key={answer.questionId}>
                    <dt>{answer.question}</dt>
                    <dd>{answer.label}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </section>

      {c.status === 'manager_review' && <ManagerReviewCard c={c} />}
      {c.status === 'gathering_details' && <WaitingForDetails c={c} />}
      {c.status === 'awaiting_dispatch' && <DispatchCard c={c} />}
      {!['manager_review', 'gathering_details', 'awaiting_dispatch'].includes(c.status) && (
        <CurrentState c={c} status={c.status as DownstreamStatus} />
      )}

      <ClassificationCard c={c} />

      <details className="card case-disclosure">
        <summary>Case timeline <span>{c.timeline.length} updates</span></summary>
        <ol className="timeline">
          {[...c.timeline].reverse().map((event) => (
            <li key={event.id} className="timeline-item">
              <time>{formatDayTime(event.at)}</time>
              <div>
                <p className="timeline-title">
                  <span className={`actor actor-${event.actor}`}>{ACTOR_LABEL[event.actor]}</span>
                  {event.title}
                </p>
                {event.detail && <p className="timeline-detail">{event.detail}</p>}
                {event.kind === 'invoice' && c.invoice && (
                  <details className="timeline-doc">
                    <summary>View invoice</summary>
                    <InvoiceCard invoice={c.invoice} />
                  </details>
                )}
              </div>
            </li>
          ))}
        </ol>
      </details>
    </>
  )
}

function ClassificationCard({ c }: { c: RepairCase }) {
  const routeLabel =
    c.classification.route === 'plumbing'
      ? 'Plumbing workflow'
      : c.classification.route === 'not_plumbing'
        ? 'Usual property-management workflow'
        : 'Property-manager review'

  return (
    <section className="card classification" aria-label="Routing decision">
      <div className="classification-head">
        <div>
          <p className="eyebrow">Centrix routing decision</p>
          <h3>{routeLabel}</h3>
        </div>
        <span className={`confidence confidence-${c.classification.confidence}`}>
          {c.classification.confidence} confidence
        </span>
      </div>
      <p>{c.classification.explanation}</p>
      <ul className="evidence">
        {(c.classification.evidence.length ? c.classification.evidence : ['No decisive plumbing signals']).map(
          (item) => (
            <li key={item}>{item}</li>
          ),
        )}
      </ul>
      <p className="privacy-note">
        {c.dispatchedAt
          ? `Approved job data was shared with ${partner.shortName}.`
          : 'No external partner has received any information.'}
      </p>
    </section>
  )
}

function ManagerReviewCard({ c }: { c: RepairCase }) {
  return (
    <section className="card manager-review" aria-label="Property manager review">
      <div>
        <p className="eyebrow">Usual route</p>
        <h3>Continue in the property-management team</h3>
        <p className="muted">
          No plumber job was created. Reply to {unit.tenant.firstName} and handle this case through the normal Centrix
          workflow.
        </p>
      </div>
      <div className="manager-review-actions">
        <span className="route-ok">No partner data shared</span>
        <button type="button" className="btn btn-secondary" onClick={actions.continueAsPlumbing}>
          Continue as plumbing instead
        </button>
      </div>
      {c.classification.route === 'uncertain' && (
        <p className="fine-print">Centrix defaulted to the manager because the report was uncertain.</p>
      )}
    </section>
  )
}

function WaitingForDetails({ c }: { c: RepairCase }) {
  return (
    <section className="card current-state" aria-label="Waiting for plumbing details">
      <p className="eyebrow">Waiting for tenant</p>
      <h3>
        {unit.tenant.name} is answering plumbing follow-up questions ({c.followUpAnswers.length}/
        {c.followUpQuestions.length})
      </h3>
      <p className="muted">The plumber job will be prepared only after the required details are collected.</p>
    </section>
  )
}

function DispatchCard({ c }: { c: RepairCase }) {
  if (!c.job) return null
  const job = c.job
  return (
    <section className="card dispatch" aria-label="Prepared plumber job">
      <div className="dispatch-head">
        <div>
          <p className="eyebrow">Prepared for you</p>
          <h3>Plumber job for {partner.name}</h3>
          <p className="muted">
            Review the priority and what the plumber will receive.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={actions.dispatchJob}>
          Dispatch to {partner.shortName}
        </button>
      </div>

      <label className="dispatch-priority">
        Dispatch priority
        <select
          value={job.urgent ? 'urgent' : 'standard'}
          onChange={(event) => actions.setDispatchUrgency(event.target.value === 'urgent')}
        >
          <option value="standard">Standard</option>
          <option value="urgent">Urgent</option>
        </select>
      </label>
      <details className="job-disclosure">
        <summary>What the plumber receives <span>{job.shared.length} details</span></summary>
        <JobFieldTable job={job} />

        <div className="withheld">
          <h4>Stays in Centrix, not sent</h4>
          <ul>
            {job.withheld.map((item) => (
              <li key={item.label}>
                <strong>{item.label}</strong>
                <span>{item.reason}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="consent">
          Tenant consent: {unit.tenant.name} agreed in the {c.consent.channel.toLowerCase()} at{' '}
          {formatTime(c.consent.givenAt)} to share {c.consent.dataShared.join(', ')} with the assigned repair company.
        </p>
      </details>
    </section>
  )
}

function CurrentState({ c, status }: { c: RepairCase; status: DownstreamStatus }) {
  if (!c.job) return null
  return (
    <section className="card current-state" aria-label="Current state">
      <p className="eyebrow">{status === 'invoiced' ? 'Result' : 'No action needed from you'}</p>
      <h3>{WAITING_ON[status]}</h3>
      <details>
        <summary>
          {c.job.shared.length} details sent to {partner.shortName}
          {c.dispatchedAt && ` at ${formatTime(c.dispatchedAt)}`}
        </summary>
        <JobFieldTable job={c.job} />
      </details>
    </section>
  )
}

function JobFieldTable({ job }: { job: JobDraft }) {
  return (
    <table className="job-fields">
      <thead>
        <tr>
          <th scope="col">Detail</th>
          <th scope="col">What the plumber sees</th>
          <th scope="col">Taken from</th>
        </tr>
      </thead>
      <tbody>
        {job.shared.map((field) => (
          <tr key={field.label}>
            <th scope="row">{field.label}</th>
            <td>{field.value}</td>
            <td>
              <span className="source">{field.source}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function UnitRecord({ c }: { c: RepairCase | null }) {
  return (
    <aside className="unit-record" aria-label={`${unit.label} record`}>
      <details className="card case-disclosure">
        <summary>{unit.label} property record</summary>
        <dl className="record">
          <div>
            <dt>Tenant</dt>
            <dd>
              {unit.tenant.name}
              <small>{unit.tenant.email}</small>
              <small>{unit.tenant.phone}</small>
              <small>Moved in {formatDate(unit.tenant.moveIn)}</small>
            </dd>
          </div>
          <div>
            <dt>Owner</dt>
            <dd>{unit.owner.name}</dd>
          </div>
          <div>
            <dt>Lease</dt>
            <dd>€{unit.lease.rentColdEur} cold rent per month</dd>
          </div>
          <div>
            <dt>Unit</dt>
            <dd>
              {unit.details.floor} · {unit.details.sizeSqm} m² · {unit.details.rooms} rooms
            </dd>
          </div>
          <div>
            <dt>Building</dt>
            <dd>
              Built {unit.property.buildingYear} · {unit.property.heating}
              <small>Energy class {unit.property.energyCertificate.class}</small>
            </dd>
          </div>
          <div>
            <dt>Meters</dt>
            <dd>
              {unit.details.meters.map((meter) => (
                <small key={meter.number}>
                  {meter.type} {meter.number}
                </small>
              ))}
            </dd>
          </div>
        </dl>
      </details>

      <section className="card" aria-label={`Linked to ${unit.label}`}>
        <p className="eyebrow">Linked to {unit.label}</p>
        {c ? (
          <ul className="linked">
            <li>
              <span className="linked-type">Repair case</span>
              <span className="linked-main">
              {c.id} · {caseTitle(c)}
              </span>
              <span className="linked-sub">{STATUS_LABEL[c.status]}</span>
            </li>
            {c.appointment && (
              <li>
                <span className="linked-type">Appointment</span>
                <span className="linked-main">{formatSlot(c.appointment)}</span>
                <span className="linked-sub">{partner.name}</span>
              </li>
            )}
            {c.completion && (
              <li>
                <span className="linked-type">Completion report</span>
                <span className="linked-main">Repaired {formatDayTime(c.completion.at)}</span>
                <span className="linked-sub">{partner.name}</span>
              </li>
            )}
            {c.invoice && (
              <li className="linked-new">
                <span className="linked-type">Invoice</span>
                <span className="linked-main">
                  {c.invoice.number} · {formatMoney(c.invoice.grossCents)}
                </span>
                <span className="linked-sub">
                  {c.invoice.from}, {formatDate(c.invoice.issuedAt)}
                </span>
              </li>
            )}
          </ul>
        ) : (
          <p className="muted">Nothing linked yet.</p>
        )}
      </section>
    </aside>
  )
}
