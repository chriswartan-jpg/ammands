import { useEffect, useState } from 'react'

import { nextStep } from './domain/caseFlow.ts'
import type { CaseStatus, Role } from './domain/caseFlow.ts'
import { actions, setRole, useDemoState, useRole } from './store.ts'
import { ManagerView } from './views/ManagerView.tsx'
import { PlumberView } from './views/PlumberView.tsx'
import { TenantView } from './views/TenantView.tsx'

const VIEWS: { role: Role; label: string }[] = [
  { role: 'tenant', label: 'Tenant' },
  { role: 'manager', label: 'Property Manager' },
  { role: 'plumber', label: 'Plumber' },
]

const MILESTONES = ['Report', 'Review and routing', 'Appointment', 'Repair', 'Invoice']
const MILESTONE_BY_STATUS: Record<CaseStatus, number> = {
  gathering_details: 0,
  manager_review: 1,
  awaiting_dispatch: 1,
  dispatched: 2,
  slots_proposed: 2,
  scheduled: 3,
  completed: 4,
  invoiced: 5,
}

export function App() {
  const { case: repairCase } = useDemoState()
  const role = useRole()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [role])

  const next = nextStep(repairCase)
  const nextLabel = VIEWS.find((view) => view.role === next.role)!.label

  return (
    <div className={`app role-${role}`}>
      <header className="demo-bar">
        <div className="demo-inner">
          <div className="demo-brand">
            <span className="brand-mark" aria-hidden="true">C</span>
            <div>
              <strong>Centrix</strong>
              <span>Repair demo</span>
            </div>
          </div>

          <nav className="view-tabs" aria-label="Switch view">
            {VIEWS.map((view) => (
              <button
                key={view.role}
                type="button"
                className={`view-tab tab-${view.role}`}
                aria-current={role === view.role ? 'page' : undefined}
                onClick={() => setRole(view.role)}
              >
                {view.label}
                {!next.done && next.role === view.role && (
                  <span className="tab-dot" title="Next action is in this view" />
                )}
              </button>
            ))}
          </nav>

          <ResetButton
            needsConfirm={repairCase !== null}
            onReset={() => {
              actions.reset()
              setRole('tenant')
            }}
          />
        </div>
      </header>

      <section className="demo-flow" aria-label="Repair progress">
        <div className="demo-flow-inner">
          <div className="flow-handoff">
            <div aria-live="polite">
              <p className="eyebrow">{next.done ? 'Outcome' : 'Up next'}</p>
              <p className="flow-action">{next.label}</p>
            </div>
            {role !== next.role && (
              <button type="button" className="btn btn-primary" onClick={() => setRole(next.role)}>
                Open {nextLabel} view <span aria-hidden="true">→</span>
              </button>
            )}
          </div>
          <FlowProgress status={repairCase?.status} />
        </div>
      </section>

      <main className="stage">
        {role === 'tenant' && <TenantView repairCase={repairCase} />}
        {role === 'manager' && <ManagerView repairCase={repairCase} />}
        {role === 'plumber' && <PlumberView repairCase={repairCase} />}
      </main>

      <footer className="demo-foot">Demo data. SMS, photo estimates, dispatch, and portal notifications are simulated.</footer>
    </div>
  )
}

function FlowProgress({ status }: { status?: CaseStatus }) {
  const step = status ? MILESTONE_BY_STATUS[status] : 0
  const milestones = status === 'manager_review' ? MILESTONES.slice(0, 2) : MILESTONES
  return (
    <ol className="flow-steps" aria-label="Workflow milestones">
      {milestones.map((label, index) => (
        <li key={label} aria-current={index === step ? 'step' : undefined} className={index < step ? 'is-complete' : ''}>
          <span className="flow-dot" aria-hidden="true">{index < step ? '✓' : ''}</span>
          {label}
          {index < step && <span className="sr-only"> complete</span>}
        </li>
      ))}
    </ol>
  )
}

/** Second click confirms, so a stray click mid-pitch does not wipe the case. */
function ResetButton({ needsConfirm, onReset }: { needsConfirm: boolean; onReset: () => void }) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const timer = setTimeout(() => setArmed(false), 5000)
    return () => clearTimeout(timer)
  }, [armed])

  return (
    <button
      type="button"
      className={`reset-btn${armed ? ' is-armed' : ''}`}
      onClick={() => {
        if (needsConfirm && !armed) {
          setArmed(true)
          return
        }
        setArmed(false)
        onReset()
      }}
    >
      {armed ? 'Click again to reset' : 'Reset demo'}
    </button>
  )
}
