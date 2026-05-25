import type { VercelRequest, VercelResponse } from '@vercel/node'

const RESEND_API_KEY = process.env.RESEND_API_KEY

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { to, reviewerName, stars, reviewText, answers, isTest, restaurantName, reviewId } = req.body

  if (!to || !reviewerName || !stars || !reviewText || !answers || !RESEND_API_KEY) {
    return res.status(400).json({ error: 'Fehlende Parameter oder RESEND_API_KEY' })
  }

  const initials = reviewerName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
  const starsFilled = '★'.repeat(stars)
  const starsEmpty = '☆'.repeat(5 - stars)
  const answerColors = ['#4f46e5', '#0891b2', '#059669']
  const answerLabels = ['💬 Herzlich & persönlich', '✍️ Professionell & sachlich', '⚡ Kurz & direkt']

  // Basis-URL für confirm-reply Links
  const BASE_URL = 'https://review-manager-mu.vercel.app'

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Neue Bewertung – ${reviewerName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f3f4f6; }
    .wrapper { max-width: 600px; margin: 0 auto; padding: 32px 16px; }
    .header { background: #0f172a; border-radius: 12px 12px 0 0; padding: 20px 28px; display: flex; align-items: center; gap: 12px; }
    .logo { background: #4f46e5; border-radius: 8px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
    .logo-text { color: #fff; font-size: 16px; font-weight: 700; }
    .body { background: #fff; padding: 28px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; }
    .test-banner { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 10px 16px; margin-bottom: 20px; font-size: 13px; color: #92400e; }
    .review-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; }
    .reviewer-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .avatar { width: 40px; height: 40px; border-radius: 50%; background: #4f46e5; color: #fff; font-size: 15px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .reviewer-name { font-weight: 700; font-size: 15px; color: #111827; }
    .reviewer-meta { display: flex; align-items: center; gap: 8px; margin-top: 2px; }
    .stars { font-size: 16px; color: #f59e0b; }
    .google-badge { font-size: 12px; color: #6b7280; }
    .review-text { font-size: 14px; color: #374151; line-height: 1.6; font-style: italic; }
    .section-title { font-size: 15px; font-weight: 700; color: #111827; margin-bottom: 16px; }
    .answer-box { border: 2px solid #e5e7eb; border-radius: 10px; padding: 16px 20px; margin-bottom: 12px; }
    .answer-label { display: inline-block; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; margin-bottom: 10px; }
    .answer-text { font-size: 14px; color: #374151; line-height: 1.6; margin-bottom: 14px; }
    .answer-btn { display: inline-block; padding: 10px 20px; color: #fff; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: 600; }
    .footer { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px; padding: 16px 28px; text-align: center; }
    .footer a { color: #4f46e5; text-decoration: none; font-size: 14px; font-weight: 600; }
    .footer-note { font-size: 12px; color: #9ca3af; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo">🏪</div>
      <div class="logo-text">ReviewMonitor${restaurantName ? ` – ${restaurantName}` : ''}</div>
    </div>

    <div class="body">
      ${isTest ? `<div class="test-banner">🧪 <strong>Test-E-Mail</strong> — So sieht Ihre echte Benachrichtigung aus</div>` : ''}

      <div class="review-box">
        <div class="reviewer-row">
          <div class="avatar">${initials}</div>
          <div>
            <div class="reviewer-name">${reviewerName}</div>
            <div class="reviewer-meta">
              <span class="stars">${starsFilled}<span style="color:#d1d5db">${starsEmpty}</span></span>
              <span class="google-badge">Google Bewertung · ${stars}/5 Sterne</span>
            </div>
          </div>
        </div>
        <div class="review-text">"${reviewText}"</div>
      </div>

      <div class="section-title">✨ Wählen Sie eine Antwort — 1 Klick genügt:</div>

      ${answers.map((a: { label: string, text: string }, i: number) => {
        // Echter Link zu confirm-reply (nur wenn reviewId vorhanden, sonst # für Test)
        const confirmUrl = reviewId
          ? `${BASE_URL}/api/confirm-reply?reviewId=${reviewId}&answer=${i}`
          : '#'
        return `
        <div class="answer-box" style="border-color:${answerColors[i]}40">
          <span class="answer-label" style="background:${answerColors[i]}20; color:${answerColors[i]}">${answerLabels[i]}</span>
          <div class="answer-text">${a.text}</div>
          <a href="${confirmUrl}" class="answer-btn" style="background:${answerColors[i]}">✓ Diese Antwort auswählen &amp; senden</a>
        </div>`
      }).join('')}

      <div class="footer">
        <a href="${BASE_URL}">Dashboard öffnen →</a>
        <div class="footer-note">Diese E-Mail wurde automatisch von ReviewMonitor generiert.</div>
      </div>
    </div>
  </div>
</body>
</html>`

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'ReviewMonitor <noreply@hiptoys.de>',
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
