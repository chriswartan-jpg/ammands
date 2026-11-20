import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Classification, IntakeTriage } from '../src/domain/plumbingTriage.ts'

const subtypes = ['leak', 'blocked_drain', 'toilet', 'hot_water', 'water_pressure', 'fixture', 'general']

function shortText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 240
}

export function parseTriage(value: unknown): IntakeTriage {
  if (!value || typeof value !== 'object') throw new Error('Missing triage result')
  const { route, subtype, explanation, evidence, questions } = value as Record<string, unknown>
  if (
    (route !== 'plumbing' && route !== 'not_plumbing' && route !== 'uncertain') ||
    !shortText(explanation) || !Array.isArray(evidence) || evidence.length > 3 ||
    !evidence.every(shortText) || !Array.isArray(questions) || questions.length > 3
  ) throw new Error('Invalid triage result')

  const classification: Classification = {
    route,
    label: route === 'plumbing' ? 'Plumbing issue' : route === 'not_plumbing' ? 'Non-plumbing issue' : 'Needs manager review',
    confidence: route === 'uncertain' ? 'low' : 'medium',
    explanation,
    evidence,
  }

  if (route !== 'plumbing') return { classification, questions: [] }
  if (typeof subtype !== 'string' || !subtypes.includes(subtype)) throw new Error('Invalid plumbing subtype')
  classification.subtype = subtype as Classification['subtype']

  return {
    classification,
    questions: questions.map((question, index) => {
      if (!question || !shortText(question.fact) || !shortText(question.text) ||
        !Array.isArray(question.options) || question.options.length < 2 ||
        question.options.length > 4 || !question.options.every(shortText)
      ) throw new Error('Invalid follow-up question')

      const labels: string[] = [...new Set<string>(question.options.map((option: string) => option.trim()))]
      const options = labels.filter((label) => label.toLowerCase() !== 'not sure')
      if (options.length < 2) throw new Error('Missing distinct options')
      return {
        id: `n8n-${index + 1}`,
        fact: question.fact.trim().replace(/[_-]+/g, ' ').replace(/^./, (first: string) => first.toUpperCase()),
        text: question.text,
        options: [
          ...options.map((label, i) => ({
            value: subtype === 'leak' && /^(?:even (?:when|with) (?:the )?(?:tap(?:s)?|faucet)(?: is| are)? off|continuously|constantly|water is spreading|spreading)[.!]?$/i.test(label)
              ? `active-water-leak-${i + 1}`
              : `option-${i + 1}`,
            label,
          })),
          { value: 'unsure', label: 'Not sure' },
        ],
      }
    }),
  }
}

export function triageHandler(url: string, secret: string) {
  return async (request: IncomingMessage, response: ServerResponse) => {
    const send = (status: number, data: unknown) => {
      response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      response.end(JSON.stringify(data))
    }
    if (request.method !== 'POST') return send(405, { error: 'Use POST' })
    if (!url || !secret) return send(503, { error: 'n8n is not configured' })

    let body = ''
    for await (const chunk of request) {
      body += chunk.toString()
      if (body.length > 8_192) return send(413, { error: 'Report is too long' })
    }
    let report: unknown
    try {
      report = JSON.parse(body)?.report
    } catch {
      return send(400, { error: 'Invalid JSON' })
    }
    if (typeof report !== 'string' || !report.trim() || report.length > 2_000) {
      return send(400, { error: 'Provide a report of 1 to 2000 characters' })
    }
    try {
      const result = await fetch(url, {
        method: 'POST',
        redirect: 'error',
        headers: { 'Content-Type': 'application/json', 'X-Centrix-Webhook-Key': secret },
        body: JSON.stringify({ report: report.trim() }),
        signal: AbortSignal.timeout(8_000),
      })
      if (!result.ok) throw new Error('Webhook request failed')
      return send(200, parseTriage(await result.json()))
    } catch {
      return send(502, { error: 'Triage unavailable' })
    }
  }
}
