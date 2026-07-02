// Lokaler Test-Harness für die Generator→Guardrail→Retry-Pipeline in
// api/generate-replies-v5.ts. Ruft den Handler direkt auf (kein HTTP,
// kein Deploy nötig) und druckt Rohtext, Guardrail-Urteil und finalen Text.
//
// Setup: .env.local im Projekt-Root mit
//   ANTHROPIC_API_KEY=...
//   GROQ_API_KEY=...
// (wird von .gitignore via "*.local" ignoriert)
//
// Ausführen: npm run test:pipeline

try {
  process.loadEnvFile('.env.local')
} catch {
  console.warn('Kein .env.local gefunden — nutze bereits gesetzte Umgebungsvariablen.')
}

import { testCases } from './synthetic-cases.ts'

function mockRes() {
  let statusCode = 200
  let body: unknown = null
  return {
    status(code: number) { statusCode = code; return this },
    json(payload: unknown) { body = payload; return this },
    send(payload: unknown) { body = payload; return this },
    get result() { return { statusCode, body } },
  }
}

async function run() {
  const { default: handler } = await import('../api/generate-replies-v5.ts')

  for (const tc of testCases) {
    console.log('\n' + '='.repeat(90))
    console.log(tc.name)
    console.log('='.repeat(90))
    const req = { method: 'POST', body: { review: tc.review, settings: tc.settings, ownerVoice: tc.ownerVoice } }
    const res = mockRes()
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await handler(req as any, res as any)
      console.log(JSON.stringify(res.result, null, 2))
    } catch (err) {
      console.error('FEHLER:', err)
    }
  }
}

run()
