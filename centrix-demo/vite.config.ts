import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { triageHandler } from './server/triage.ts'
import { voiceSessionHandler } from './server/voiceSession.ts'
import { photoReviewHandler } from './server/photoReview.ts'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['N8N_', 'ELEVENLABS_', 'OPENAI_'])
  const handleTriage = triageHandler(env.N8N_TRIAGE_URL, env.N8N_TRIAGE_SECRET)

  const handleVoice = voiceSessionHandler(env.ELEVENLABS_API_KEY, env.ELEVENLABS_AGENT_ID)
  const handlePhoto = photoReviewHandler(env.OPENAI_API_KEY)

  return {
    plugins: [
      react(),
      {
        name: 'centrix-triage',
        configureServer(server) {
          server.middlewares.use('/api/triage', handleTriage)
          server.middlewares.use('/api/voice-session', handleVoice)
          server.middlewares.use('/api/photo-review', handlePhoto)
        },
        configurePreviewServer(server) {
          server.middlewares.use('/api/triage', handleTriage)
          server.middlewares.use('/api/voice-session', handleVoice)
          server.middlewares.use('/api/photo-review', handlePhoto)
        },
      },
    ],
  }
})
