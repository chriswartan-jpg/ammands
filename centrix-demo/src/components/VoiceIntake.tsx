import { ConversationProvider, useConversation } from '@elevenlabs/react'
import { useEffect, useRef, useState } from 'react'

import { RepairPhotoInput } from './RepairPhotoInput.tsx'
import type { RepairPhoto } from '../domain/caseFlow.ts'
import { classifyReport, questionsFor } from '../domain/plumbingTriage.ts'
import type { IntakeTriage } from '../domain/plumbingTriage.ts'
import { actions, requestTriage } from '../store.ts'

interface VoiceDraft {
  report: string
  intake: IntakeTriage
  answers: string[]
}

export function VoiceIntake() {
  return (
    <ConversationProvider>
      <VoiceControls />
    </ConversationProvider>
  )
}

function VoiceControls() {
  const [draft, setDraft] = useState<VoiceDraft>()
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const [photo, setPhoto] = useState<RepairPhoto>()
  const [readingPhoto, setReadingPhoto] = useState(false)
  const session = useRef<AbortController | null>(null)
  const currentDraft = useRef<VoiceDraft | null>(null)
  const preparing = useRef(false)

  const { status, isSpeaking, startSession, endSession } = useConversation({
    onError: () => {
      session.current?.abort()
      setError('Could not start or continue voice intake. Check microphone access or type your report.')
    },
    onDisconnect: () => session.current?.abort(),
    clientTools: {
      prepare_repair_intake: async ({ report }: { report: string }) => {
        const signal = session.current?.signal
        if (!signal || signal.aborted) return 'No active voice intake.'
        if (preparing.current || currentDraft.current) return 'A report is already being processed.'
        if (typeof report !== 'string' || !report.trim() || report.length > 2000) {
          return 'Provide a repair description of up to 2,000 characters.'
        }
        const text = report.trim()
        preparing.current = true
        try {
          let intake = await requestTriage(text, signal)
          if (signal.aborted) return 'Voice intake ended.'
          if (!intake) {
            const classification = classifyReport(text)
            intake = { classification, questions: questionsFor(classification) }
          }
          currentDraft.current = { report: text, intake, answers: [] }
          setDraft(currentDraft.current)
          return JSON.stringify({
            route: intake.classification.route,
            next_question: intake.questions[0] ?? null,
            ready_for_review: intake.questions.length === 0,
          })
        } finally {
          preparing.current = false
        }
      },
      record_repair_answer: ({ question_id, option_value }: { question_id: string; option_value: string }) => {
        const saved = currentDraft.current
        if (!saved || !session.current || session.current.signal.aborted) return 'No active repair draft.'
        const question = saved.intake.questions[saved.answers.length]
        if (!question || question.id !== question_id || !question.options.some((option) => option.value === option_value)) {
          return JSON.stringify({ error: 'Use the current question ID and one of its option values.', next_question: question ?? null })
        }
        const updated = { ...saved, answers: [...saved.answers, option_value] }
        currentDraft.current = updated
        setDraft(updated)
        const next = updated.intake.questions[updated.answers.length]
        return JSON.stringify({ next_question: next ?? null, ready_for_review: !next })
      },
    },
  })

  useEffect(() => () => session.current?.abort(), [])

  async function begin() {
    if (session.current && !session.current.signal.aborted) return
    const controller = new AbortController()
    session.current = controller
    currentDraft.current = null
    setDraft(undefined)
    setPhoto(undefined)
    setError('')
    setStarting(true)
    try {
      const response = await fetch('/api/voice-session', {
        method: 'POST',
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
      })
      const result = await response.json()
      if (!response.ok || typeof result.signedUrl !== 'string') {
        setError(result.error ?? 'Voice intake is unavailable. You can still type your report.')
        controller.abort()
        return
      }
      if (!controller.signal.aborted) {
        startSession({ signedUrl: result.signedUrl, connectionType: 'websocket' })
      }
    } catch {
      if (!controller.signal.aborted) {
        setError('Could not start voice intake. Check microphone access or type your report.')
        controller.abort()
      }
    } finally {
      setStarting(false)
    }
  }

  const currentQuestion = draft?.intake.questions[draft.answers.length]
  const ready = draft && !currentQuestion
  const connected = status === 'connected'
  const canStart = status === 'disconnected' || status === 'error'

  return (
    <section className="card voice-intake" aria-label="Voice repair intake">
      <div className="voice-intake-main">
        <div className="voice-copy">
          <h2>Talk to Centrix about an urgent repair</h2>
          <p>Describe the issue out loud. Centrix will ask follow-up questions and prepare a report for you to review.</p>
        </div>
        <div className={`voice-meter${connected ? ' is-live' : ''}`} aria-hidden="true">
          {[4, 10, 17, 26, 17, 10, 4].map((height, index) => <i key={index} style={{ height }} />)}
        </div>
      </div>
      <div className="voice-controls">
        {connected ? (
          <button type="button" className="btn voice-start" onClick={() => void endSession()}>End conversation</button>
        ) : !ready && (
          <button type="button" className="btn voice-start" disabled={starting || !canStart} onClick={() => void begin()}>
            {starting || status === 'connecting' ? 'Connecting…' : 'Talk to Centrix'}
          </button>
        )}
        {connected ? <p role="status">{isSpeaking ? 'Centrix is speaking…' : 'Centrix is listening…'}</p> : !ready && (
          <p className="voice-privacy">Microphone audio is processed by ElevenLabs.</p>
        )}
      </div>
      {error && <p className="voice-error" role="alert">{error}</p>}
      {draft && (
        <div className="voice-review">
          <h3>{ready ? 'Review your voice report' : 'Voice report in progress'}</h3>
          <p>{draft.report}</p>
          {currentQuestion && (
            <div className="voice-question" aria-live="polite">
              <span className="eyebrow">Question {draft.answers.length + 1} of {draft.intake.questions.length}</span>
              <p>{currentQuestion.text}</p>
            </div>
          )}
          {draft.answers.length > 0 && (
            <dl>
              {draft.answers.map((answer, index) => {
                const question = draft.intake.questions[index]
                return (
                  <div key={question.id}>
                    <dt>{question.text}</dt>
                    <dd>{question.options.find((option) => option.value === answer)?.label}</dd>
                  </div>
                )
              })}
            </dl>
          )}
          {ready && <RepairPhotoInput photo={photo} setPhoto={setPhoto} reading={readingPhoto} setReading={setReadingPhoto} />}
          <div className="voice-review-actions">
            {ready && (
              <button type="button" className="btn btn-primary" disabled={readingPhoto} onClick={() => {
                session.current?.abort()
                void endSession()
                actions.submitVoiceReport(draft.report, draft.intake, draft.answers, photo)
              }}>
                Send voice report
              </button>
            )}
            {ready && !connected && (
              <button type="button" className="btn btn-secondary" disabled={readingPhoto} onClick={() => {
                currentDraft.current = null
                setDraft(undefined)
                setPhoto(undefined)
              }}>
                Discard draft
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
