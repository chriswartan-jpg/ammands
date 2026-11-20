import { appendFileSync } from 'node:fs'

const apiKey = process.env.ELEVENLABS_API_KEY
if (!apiKey) throw new Error('Set ELEVENLABS_API_KEY in .env.local first.')
if (process.env.ELEVENLABS_AGENT_ID) {
  throw new Error('An agent is already configured in .env.local.')
}

const prompt = `You are the Centrix repair intake voice assistant. Keep the conversation short and friendly.
After the tenant describes the problem, call prepare_repair_intake with their original description, preserving the details they actually gave. Never infer an answer or include contact information.
The tool returns JSON with next_question and ready_for_review. If next_question is present, ask only that question out loud. You can mention its options if helpful. Wait for the tenant's answer. When it clearly matches an option, call record_repair_answer with the current question ID and that option's exact value. If the tenant says they don't know, choose the Not sure option. If the answer doesn't clearly match any option, ask them to clarify or offer the available options. Never guess.
Repeat using each new next_question from the tool. If the tool returns an error, use its current question if present, or ask the tenant to finish using the portal.
When ready_for_review is true, tell the tenant to review and click Send voice report in Centrix. A draft is not a submitted report. Never claim that a plumber has been booked, give repair instructions, or promise a response time. After telling them how to submit, wait for them to end the call.`

function clientTool(name, description, fields) {
  return {
    type: 'client',
    name,
    description,
    expects_response: true,
    parameters: {
      type: 'object',
      required: Object.keys(fields),
      properties: Object.fromEntries(Object.entries(fields).map(([field, description]) => [
        field, { type: 'string', description },
      ])),
    },
  }
}

const tools = [
  clientTool('prepare_repair_intake', 'Classifies the initial report and returns the first follow-up question, if any.', {
    report: 'The tenant’s initial repair description, using only the details they actually gave.',
  }),
  clientTool('record_repair_answer', 'Records one spoken answer and returns the next question or indicates the draft is ready.', {
    question_id: 'The exact ID of the current question returned by Centrix.',
    option_value: 'The exact value of the option that matches the tenant’s spoken answer.',
  }),
]

const result = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
  method: 'POST',
  headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
  signal: AbortSignal.timeout(25_000),
  body: JSON.stringify({
    name: 'Talk to Centrix',
    conversation_config: {
      conversation: { max_duration_seconds: 180 },
      agent: {
        language: 'en',
        first_message: 'Hi, I’m the Centrix voice assistant. What needs fixing?',
        prompt: { prompt, llm: 'gpt-4.1-mini', enable_parallel_tool_calls: false, tools },
      },
    },
    platform_settings: {
      auth: { enable_auth: true },
      privacy: { record_voice: false },
      call_limits: { agent_concurrency_limit: 1, bursting_enabled: false },
    },
  }),
})

if (!result.ok) {
  const details = await result.json().catch(() => null)
  const issues = Array.isArray(details?.detail)
    ? details.detail.map(({ loc, msg }) => `${(loc ?? []).join('.')}: ${msg}`).join('; ')
    : details?.detail?.message ?? ''
  throw new Error(`ElevenLabs agent setup failed (HTTP ${result.status}). ${issues}`)
}

const { agent_id: agentId } = await result.json()
if (typeof agentId !== 'string' || !/^agent_[a-z0-9]+$/i.test(agentId)) {
  throw new Error('ElevenLabs did not return a valid agent ID.')
}
appendFileSync('.env.local', `\nELEVENLABS_AGENT_ID=${agentId}\n`, { mode: 0o600 })
console.log('Created Talk to Centrix and saved its agent ID in .env.local. Restart Vite to load it.')
