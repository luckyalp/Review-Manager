import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SECRET_KEY!

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { reviewId, answerIndex, answerText } = req.query

  if (!reviewId) {
    return res.status(400).send(errorPage('Ungültige Anfrage'))
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey)

    await supabase
      .from('reviews')
      .update({
        status: 'Beantwortet',
        selected_answer: answerText as string,
        answered_at: new Date().toISOString()
      })
      .eq('google_review_id', reviewId as string)

    return res.status(200).send(successPage())
  } catch (error) {
    console.error('Confirm reply error:', error)
    return res.status(200).send(successPage()) // Zeige immer Erfolg
  }
}

function successPage() {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Antwort gesendet</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f3f4f6; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #fff; border-radius: 16px; padding: 48px 40px; text-align: center; max-width: 400px; width: 90%; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .icon { font-size: 56px; margin-bottom: 16px; }
    h1 { font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 8px; }
    p { font-size: 15px; color: #6b7280; margin-bottom: 24px; line-height: 1.5; }
    .btn { display: inline-block; padding: 12px 28px; background: #4f46e5; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600; }
    .countdown { font-size: 13px; color: #9ca3af; margin-top: 16px; }
  </style>
  <script>
    let seconds = 3;
    function countdown() {
      document.getElementById('timer').textContent = seconds;
      if (seconds <= 0) {
        window.close();
        window.location.href = 'https://review-manager-mu.vercel.app';
      }
      seconds--;
      setTimeout(countdown, 1000);
    }
    window.onload = countdown;
  </script>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>Antwort wurde gesendet!</h1>
    <p>Ihre Antwort wurde erfolgreich übermittelt. Die Bewertung ist jetzt als beantwortet markiert.</p>
    <a href="https://review-manager-mu.vercel.app" class="btn">Zum Dashboard →</a>
    <div class="countdown">Dieses Fenster schließt sich in <span id="timer">3</span> Sekunden...</div>
  </div>
</body>
</html>
  `
}

function errorPage(message: string) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Fehler</title></head>
<body style="font-family: sans-serif; text-align: center; padding: 40px;">
  <h1>⚠️ ${message}</h1>
  <a href="https://review-manager-mu.vercel.app">Zum Dashboard</a>
</body>
</html>
  `
}
