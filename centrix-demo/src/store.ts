// One shared case for all three views. State lives in localStorage so it
// survives a refresh and stays in sync across browser tabs or windows.

import { useSyncExternalStore } from 'react'

import {
  addInvoice,
  answerFollowUp,
  chooseSlot,
  completeRepair,
  continueAsPlumbing,
  dispatchJob,
  initialState,
  proposeSlots,
  setDispatchUrgency,
  submitReport,
} from './domain/caseFlow.ts'
import type { AvailabilityWindow, DemoState, InvoiceLine, RepairPhoto, ReportDetails, Role } from './domain/caseFlow.ts'

import type { IntakeTriage } from './domain/plumbingTriage.ts'

const STORAGE_KEY = 'centrix-demo:case:v2'

function load(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && 'case' in parsed) return parsed as DemoState
    }
  } catch {
    // Storage blocked or corrupted: fall through to a fresh demo.
  }
  return initialState
}

let state = load()
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function save() {
  try {
    if (state.case) localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage blocked: the demo still works within this tab.
  }
}

function apply(transition: (current: DemoState, now: Date) => DemoState) {
  const next = transition(state, new Date())
  if (next === state) return
  state = next
  save()
  emit()
}

window.addEventListener('storage', (event) => {
  if (event.key !== null && event.key !== STORAGE_KEY) return
  state = load()
  emit()
})

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useDemoState(): DemoState {
  return useSyncExternalStore(subscribe, () => state)
}

export async function requestTriage(text: string, signal: AbortSignal): Promise<IntakeTriage | undefined> {
  try {
    const response = await fetch('/api/triage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report: text }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
    })
    if (response.ok) return await response.json()
  } catch {
    // The built-in triage keeps intake available if the webhook is unreachable.
  }
}

export const actions = {
  submitVoiceReport: (report: string, intake: IntakeTriage, answers: string[], photo?: RepairPhoto) =>
    apply((current, now) => {
      if (current.case || answers.length !== intake.questions.length) return current
      let next = submitReport(current, report, now, intake, { priority: 'urgent', method: 'voice', photo })
      for (const [index, question] of intake.questions.entries()) {
        const answered = answerFollowUp(next, question.id, answers[index], now)
        if (answered === next) return current
        next = answered
      }
      return next
    }),
  submitReport: async (text: string, signal: AbortSignal, details?: ReportDetails) => {
    const intake = await requestTriage(text, signal)
    if (!signal.aborted) apply((s, now) => submitReport(s, text, now, intake, details))
  },
  answerFollowUp: (questionId: string, value: string) =>
    apply((s, now) => answerFollowUp(s, questionId, value, now)),
  continueAsPlumbing: () => apply(continueAsPlumbing),
  dispatchJob: () => apply(dispatchJob),
  setDispatchUrgency: (urgent: boolean) => apply((s, now) => setDispatchUrgency(s, urgent, now)),
  proposeSlots: (windows: AvailabilityWindow[]) => apply((s, now) => proposeSlots(s, windows, now)),
  chooseSlot: (slotId: string) => apply((s, now) => chooseSlot(s, slotId, now)),
  completeRepair: (note: string) => apply((s, now) => completeRepair(s, note, now)),
  addInvoice: (lines: InvoiceLine[]) => apply((s, now) => addInvoice(s, now, lines)),
  reset: () => apply(() => initialState),
}

// --- Active view, kept in the URL hash so each window can pin its own role ---

const ROLES: Role[] = ['tenant', 'manager', 'plumber']

function readRole(): Role {
  const hash = window.location.hash.slice(1)
  return ROLES.includes(hash as Role) ? (hash as Role) : 'tenant'
}

function subscribeRole(listener: () => void) {
  window.addEventListener('hashchange', listener)
  return () => window.removeEventListener('hashchange', listener)
}

export function setRole(role: Role) {
  window.location.hash = role
}

export function useRole(): Role {
  return useSyncExternalStore(subscribeRole, readRole)
}
