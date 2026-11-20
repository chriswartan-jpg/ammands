# Centrix Repair Demo

Hackathon prototype for Reltix's Centrix challenge. It demonstrates one shared repair case across tenant, property-manager, and plumber views—from intelligent intake through appointment booking, repair completion, and invoicing.

Urgent reports can use ElevenLabs voice intake, with a website form as a fallback. Non-urgent reports can use the website or the simulated SMS form. Both paths ask for a photo when it is safe to take one. When configured, OpenAI reviews the photo as soon as it is selected and returns visible findings and an indicative price range when possible.

Confirmed plumbing jobs go directly to the plumber after any follow-up questions when the upper end of the range is below €3,000. A missing or inconclusive estimate, or a range reaching €3,000, goes to the manager before dispatch. Non-plumbing and uncertain reports remain with the property manager, who can override the classification. Completion updates and the edited invoice appear in the relevant portals.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite. Use **Reset demo** to return the flow to its starting state.

## Enable automatic photo review

Set `OPENAI_API_KEY` in the Git-ignored `.env.local` file and restart Vite. Centrix sends a resized copy of the photo to OpenAI from the server. Use a synthetic or approved demo image. If the service or estimate is unavailable, the tenant can still submit the photo and the manager receives the case. Protect the metered endpoint with authentication and rate limits before exposing it to the public.

## Connect n8n Cloud

1. Import `n8n/centrix-triage.json` into your n8n workspace.
2. In **Receive repair report**, select or create a **Header Auth** credential. Set the header name to `X-Centrix-Webhook-Key` and use a long random value. You can generate one with `openssl rand -hex 32`.
3. In **Classify and write questions**, select or create an **OpenAI** credential using your OpenAI API key. The workflow uses one GPT-5 nano call per report. n8n and OpenAI API usage are metered separately.
4. Publish the workflow. Copy the webhook's **Production URL**, then copy `.env.example` to `.env.local` and set `N8N_TRIAGE_URL` to that URL and `N8N_TRIAGE_SECRET` to the Header Auth value. Restart Vite.
5. Submit a demo report. Try “There is a puddle under the kitchen sink” for follow-ups, then reset and try “My front door lock is jammed” for manager review.

The model sees only the report text supplied to Centrix. Use synthetic reports during the demo. Answers are collected in Centrix and added to the job draft before routing. The plumber receives the scope and the existing quote policy through the simulated dispatch. A webhook error or missing credentials triggers the built-in rules.

The route runs on the local Vite dev or preview server. For a public deployment, host the route server-side with access controls and rate limiting. A static deployment of `dist` alone uses the built-in rules.

## Verify

```bash
npm test
npm run build
```

All people, properties, partners, and integrations in this prototype use synthetic or simulated demo data.

## Connect Talk to Centrix

Voice intake uses a private ElevenLabs agent with two browser tools. It runs the same
triage as typed reports. The tenant hears the follow-ups, reviews the draft on screen,
and clicks **Send voice report** to open the case.

1. Add `ELEVENLABS_API_KEY` to the Git-ignored `.env.local`. The setup key needs ElevenAgents write access.
2. From the project folder, run `node --env-file=.env.local scripts/create-voice-agent.mjs` once. It creates the private agent and saves its ID.
3. Restart Vite, open the tenant view, and click **Talk to Centrix**. Allow microphone access and use a synthetic repair report.

The setup script includes urgent safety guidance and a reminder to attach a photo. If you reuse an existing agent, its prompt needs those instructions in ElevenLabs.

Localhost and HTTPS support browser microphone access. If deploying outside the local demo,
protect the session endpoint with app authentication and rate limits before exposing it.
