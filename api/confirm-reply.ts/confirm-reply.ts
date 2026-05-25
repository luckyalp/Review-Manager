import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { reviewId, answer } = req.query

  if (!reviewId) {
    return res.status(400).send(errorPage('Fehlende Parameter', 'Kein reviewId angegeben.'))
  }

  // Antwort-Index (0, 1, 2) aus URL lesen
  const answerIndex = parseInt(answer as string ?? '0')

  // Antworttext aus Supabase laden
  const { data: review, error: fetchError } = await supabase
    .from('reviews')
    .select('*')
    .eq('id', reviewId)
    .single()

  if (fetchError || !review) {
    return res.status(404).send(errorPage('Bewertung nicht gefunden', 'Diese Bewertung existiert nicht mehr.'))
  }

  // Prüfen ob bereits beantwortet
  if (review.status === 'Beantwortet') {
    return res.status(200).send(alreadyAnsweredPage(review))
  }

  // KI-Antworten aus dem gespeicherten JSON holen
  const answers = review.ai_answers ?? []
  const selectedAnswer = answers[answerIndex]?.text ?? answers[0]?.text ?? ''

  // Supabase updaten
  const { error: updateError } = await supabase
    .from('reviews')
    .update({
      status: 'Beantwortet',
      selected_answer: selectedAnswer,
      answered_at: new Date().toISOString(),
    })
    .eq('id', reviewId)

  if (updateError) {
    return res.status(500).send(errorPage('Fehler', 'Die Bewertung konnte nicht aktualisiert werden.'))
  }

  return res.status(200).send(successPage(review, selectedAnswer))
}

// ─── HTML SEITEN ──────────────────────────────────────────────────────────────

function successPage(review: any, selectedAnswer: string) {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Antwort bestätigt – ReviewMonitor</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f3f4f6; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: #fff; border-radius: 16px; padding: 40px 32px; max-width: 520px; width: 100%; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 8px; }
    .sub { color: #6b7280; font-size: 15px; margin-bottom: 28px; }
    .answer-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; text-align: left; margin-bottom: 28px; }
    .answer-label { font-size: 11px; font-weight: 600; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
    .answer-text { font-size: 14px; color: #374151; line-height: 1.6; }
    .reviewer { font-size: 13px; color: #9ca3af; margin-bottom: 24px; }
    .btn { display: inline-block; padding: 12px 28px; background: #4f46e5; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600; }
    .btn:hover { background: #4338ca; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>Antwort wurde gespeichert!</h1>
    <p class="sub">Die Bewertung von <strong>${escapeHtml(review.reviewer_name)}</strong> wurde als beantwortet markiert.</p>
    <div class="answer-box">
      <div class="answer-label">Ihre gewählte Antwort</div>
      <div class="answer-text">${escapeHtml(selectedAnswer)}</div>
    </div>
    <p class="reviewer">Bewertung: ${'★'.repeat(review.stars)}${'☆'.repeat(5 - review.stars)} · ${escapeHtml(review.reviewer_name)}</p>
    <a href="https://review-manager-mu.vercel.app" class="btn">→ Zum Dashboard</a>
  </div>
</body>
</html>`
}

function alreadyAnsweredPage(review: any) {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bereits beantwortet – ReviewMonitor</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f3f4f6; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: #fff; border-radius: 16px; padding: 40px 32px; max-width: 520px; width: 100%; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 8px; }
    .sub { color: #6b7280; font-size: 15px; margin-bottom: 28px; }
    .btn { display: inline-block; padding: 12px 28px; background: #4f46e5; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">ℹ️</div>
    <h1>Bereits beantwortet</h1>
    <p class="sub">Diese Bewertung von <strong>${escapeHtml(review.reviewer_name)}</strong> wurde bereits beantwortet.</p>
    <a href="https://review-manager-mu.vercel.app" class="btn">→ Zum Dashboard</a>
  </div>
</body>
</html>`
}

function errorPage(title: string, message: string) {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} – ReviewMonitor</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f3f4f6; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: #fff; border-radius: 16px; padding: 40px 32px; max-width: 520px; width: 100%; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 8px; }
    .sub { color: #6b7280; font-size: 15px; margin-bottom: 28px; }
    .btn { display: inline-block; padding: 12px 28px; background: #4f46e5; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">❌</div>
    <h1>${escapeHtml(title)}</h1>
    <p class="sub">${escapeHtml(message)}</p>
    <a href="https://review-manager-mu.vercel.app" class="btn">→ Zum Dashboard</a>
  </div>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
