// Ruft die aktive Engine (generate-replies-v7) fuer jeden Fall aus
// scripts/baseline-cases.json auf und schreibt eine Markdown-Scorecard mit
// Checkboxen zum manuellen Abhaken (Floskel / Grammatik-Unsinn /
// zusammengeklebt). Kein HTTP, kein Deploy noetig — ruft den Handler direkt.
//
// Voraussetzung: npm run baseline:collect wurde vorher ausgefuehrt.
// Ausfuehren: npm run baseline:run

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import type { TestCase } from './synthetic-cases.ts'

try {
  process.loadEnvFile('.env.local')
} catch {
  console.warn('Kein .env.local gefunden — nutze bereits gesetzte Umgebungsvariablen.')
}

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
  const raw = readFileSync('scripts/baseline-cases.json', 'utf-8')
  const cases: TestCase[] = JSON.parse(raw)
  const { default: handler } = await import('../api/generate-replies-v7.ts')

  const lines: string[] = [
    '# Baseline-Auswertung generate-replies-v7',
    '',
    `Erzeugt am: ${new Date().toISOString()}`,
    `Anzahl Testfälle: ${cases.length}`,
    '',
    'Für jede Antwort: Kästchen ankreuzen, falls das Problem zutrifft.',
    '',
  ]

  for (const tc of cases) {
    lines.push(
      '---', '',
      `## ${tc.name}`, '',
      `**Bewertung (${tc.review.stars}★, ${tc.review.reviewerName}):**`, '',
      `> ${tc.review.reviewText || '(kein Text)'}`, ''
    )

    const req = { method: 'POST', body: { review: tc.review, settings: tc.settings } }
    const res = mockRes()
    try {
      await handler(req as any, res as any)
      const { body } = res.result as { body: any }
      if (body?.success && body.answers?.length) {
        for (const a of body.answers) {
          lines.push(
            `**Antwort (${a.label}):**`, '',
            a.text, '',
            '- [ ] Floskel enthalten',
            '- [ ] Grammatikfehler / ergibt keinen Sinn',
            '- [ ] wirkt zusammengeklebt / abgehackt',
            ''
          )
        }
      } else {
        lines.push(`**Kein Ergebnis:** ${JSON.stringify(body)}`, '')
      }
    } catch (err) {
      lines.push(`**FEHLER:** ${err instanceof Error ? err.message : String(err)}`, '')
    }
  }

  mkdirSync('scripts/baseline-results', { recursive: true })
  const outPath = `scripts/baseline-results/${new Date().toISOString().replace(/[:.]/g, '-')}.md`
  writeFileSync(outPath, lines.join('\n'))
  console.log(`Baseline-Scorecard geschrieben nach ${outPath}`)
}

run()
