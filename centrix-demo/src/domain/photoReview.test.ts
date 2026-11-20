import assert from 'node:assert/strict'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import { test } from 'node:test'

import { photoReviewHandler } from '../../server/photoReview.ts'

const photo = 'data:image/jpeg;base64,/9j/4A=='

async function requestPhoto(handler: ReturnType<typeof photoReviewHandler>, input = photo) {
  const request = Object.assign(Readable.from([JSON.stringify({ photo: input })]), {
    method: 'POST', headers: { host: 'localhost' },
  })
  let status = 0
  let body: unknown
  const response = {
    writeHead(code: number) { status = code },
    end(json: string) { body = JSON.parse(json) },
  }
  await handler(request as unknown as IncomingMessage, response as unknown as ServerResponse)
  return { status, body }
}

test('the photo endpoint sends the image to OpenAI and returns a structured review', async () => {
  const review = { finding: 'The toilet bowl shows a visible crack.', estimate: { lowCents: 30000, highCents: 60000 } }
  const handler = photoReviewHandler('test-key', async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses')
    const payload = JSON.parse(String(options?.body))
    assert.equal(payload.store, false)
    assert.equal(payload.input[0].content[0].image_url, photo)
    assert.equal(payload.text.format.strict, true)
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(review) }] }] })
  })
  assert.deepEqual(await requestPhoto(handler), { status: 200, body: review })
})

test('an inconclusive review can report visible findings without an estimate', async () => {
  const review = { finding: 'A toilet is visible. The source of the leak is unclear.', estimate: null }
  const handler = photoReviewHandler('test-key', async () => Response.json({
    status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(review) }] }],
  }))
  assert.deepEqual(await requestPhoto(handler), { status: 200, body: review })
})

test('unconfigured, invalid, and failed photo reviews never return an estimate', async () => {
  const handler = photoReviewHandler('test-key', async () => new Response(null, { status: 429 }))
  assert.equal((await requestPhoto(photoReviewHandler(''))).status, 503)
  assert.equal((await requestPhoto(handler, 'data:image/jpeg;base64,cGhvdG8=')).status, 400)
  assert.equal((await requestPhoto(handler)).status, 502)
})
