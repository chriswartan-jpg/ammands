import type { IncomingMessage, ServerResponse } from 'node:http'

export function voiceSessionHandler(apiKey: string, agentId: string) {
  return async (request: IncomingMessage, response: ServerResponse) => {
    const send = (status: number, body: object) => {
      response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      response.end(JSON.stringify(body))
    }

    if (request.method === 'GET') return send(200, { available: Boolean(apiKey && agentId) })
    if (request.method !== 'POST') return send(405, { error: 'Use POST to start a session.' })
    if (!apiKey || !agentId) return send(503, { error: 'Voice intake is not configured.' })

    const origin = request.headers.origin
    if (origin && origin !== `http://${request.headers.host}` && origin !== `https://${request.headers.host}`) {
      return send(403, { error: 'Start voice intake from Centrix.' })
    }

    try {
      const url = new URL('https://api.elevenlabs.io/v1/convai/conversation/get-signed-url')
      url.searchParams.set('agent_id', agentId)
      url.searchParams.set('include_conversation_id', 'true')
      const result = await fetch(url, {
        headers: { 'xi-api-key': apiKey },
        signal: AbortSignal.timeout(8_000),
      })
      if (!result.ok) throw new Error('ElevenLabs rejected the session request')
      const { signed_url: signedUrl } = await result.json()
      if (typeof signedUrl !== 'string' || new URL(signedUrl).origin !== 'wss://api.elevenlabs.io') {
        throw new Error('Missing signed voice URL')
      }
      return send(200, { signedUrl })
    } catch {
      return send(502, { error: 'Centrix could not connect to ElevenLabs. You can still type your report.' })
    }
  }
}
