import type { VercelRequest, VercelResponse } from '@vercel/node'

const RESEND_API_KEY = process.env.RESEND_API_KEY

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { to, reviewerName, stars, reviewText, answers } = req.body

  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY nicht konfiguriert' })
  }

  if (!to) {
    return res.status(400).json({ error: 'Keine E-Mail-Adresse angegeben' })
  }

  const starsDisplay = '★'.repeat(stars) + '☆'.repeat(5 - stars)

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Plus Jakarta Sans', Arial, sans-serif; background: #f3f4f6; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: #0f172a; padding: 24px 28px; }
    .header h1 { color: #fff; margin: 0; font-size: 20px; font-weight: 600; }
    .header p { color: #94a3b8; margin: 4px 0 0; font-size: 14px; }
    .body { padding: 24px 28px; }
    .review-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 24px; }
    .reviewer { font-weight: 600; font-size: 15px; color: #111827; margin-bottom: 4px; }
    .stars { color: #F0B100; font-size: 18px; margin-bottom: 8px; }
    .review-text { color: #374151; font-size: 14px; line-height: 1.6; }
    .section-title { font-weight: 600; font-size: 15px; color: #111827; margin-bottom: 12px; }
    .answer-box { border: 1.5px solid #e5e7eb; border-radius: 8px; padding: 14px; margin-bottom: 10px; cursor: pointer; }
    .answer-label { font-weight: 600; font-size: 12px; color: #4f46e5; margin-bottom: 6px; }
    .answer-text { font-size: 13px; color: #374151; line-height: 1.6; }
    .footer { padding: 16px 28px; background: #f8fafc; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏪 ReviewMonitor</h1>
      <p>Neue Bewertung eingegangen</p>
    </div>
    <div class="body">
      <div class="review-box">
        <div class="reviewer">${reviewerName}</div>
        <div class="stars">${starsDisplay}</div>
        <div class="review-text">${reviewText}</div>
      </div>

      <div class="section-title">✨ 3 KI-Antwortvorschläge</div>

      ${answers.map((a: { label: string, text: string }) => `
        <div class="answer-box">
          <div class="answer-label">${a.label}</div>
          <div class="answer-text">${a.text}</div>
        </div>
      `).join('')}
    </div>
    <div class="footer">
      Diese E-Mail wurde automatisch von ReviewMonitor generiert.
    </div>
  </div>
</body>
</html>
  `

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'ReviewMonitor <onboarding@resend.dev>',
        to: [to],
        subject: `⭐ Neue Bewertung von ${reviewerName} (${stars} Sterne)`,
        html,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(500).json({ error: 'E-Mail konnte nicht gesendet werden', details: data })
    }

    return res.status(200).json({ success: true, id: data.id })
  } catch (error) {
    return res.status(500).json({ error: 'Serverfehler', details: String(error) })
  }
}
