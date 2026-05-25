import type { VercelRequest, VercelResponse } from '@vercel/node'

const RESEND_API_KEY = process.env.RESEND_API_KEY

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { to, reviewerName, stars, reviewText, answers, restaurantName, isTest } = req.body

  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY nicht konfiguriert' })
  }

  if (!to) {
    return res.status(400).json({ error: 'Keine E-Mail-Adresse angegeben' }
    )
  }

  const starsFilled = '★'.repeat(stars)
  const starsEmpty = '☆'.repeat(5 - stars)

  const initials = reviewerName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  const answerColors = ['#4f46e5', '#16a34a', '#7c3aed']
  const answerLabels = ['PROFESSIONELL', 'FREUNDLICH', 'PRÄGNANT']

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #f3f4f6; padding: 20px; }
    .wrapper { max-width: 580px; margin: 0 auto; }
    .header { background: #0f172a; border-radius: 12px 12px 0 0; padding: 20px 24px; display: flex; align-items: center; gap: 12px; }
    .header-icon { background: #4f46e5; border-radius: 8px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-size: 18px; }
    .header-text h1 { color: #fff; font-size: 18px; font-weight: 700; }
    .header-text p { color: #94a3b8; font-size: 13px; margin-top: 2px; }
    .body { background: #fff; padding: 24px; border-radius: 0 0 12px 12px; }
    .test-banner { background: #fef9c3; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 14px; margin-bottom: 20px; font-size: 13px; color: #92400e; display: flex; align-items: center; gap: 8px; }
    .review-box { border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; margin-bottom: 24px; }
    .reviewer-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
    .avatar { width: 40px; height: 40px; border-radius: 50%; background: #e5e7eb; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; color: #374151; flex-shrink: 0; }
    .reviewer-name { font-weight: 700; font-size: 15px; color: #111827; }
    .reviewer-meta { display: flex; align-items: center; gap: 8px; margin-top: 3px; }
    .stars { color: #F0B100; font-size: 16px; }
    .google-badge { font-size: 11px; color: #6b7280; background: #f3f4f6; padding: 2px 8px; border-radius: 10px; }
    .review-text { font-size: 14px; color: #374151; line-height: 1.6; font-style: italic; }
    .section-title { font-weight: 700; font-size: 15px; color: #111827; margin-bottom: 14px; display: flex; align-items: center; gap: 6px; }
    .answer-box { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; margin-bottom: 12px; }
    .answer-label { display: inline-block; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; margin-bottom: 8px; letter-spacing: 0.5px; }
    .answer-text { font-size: 13px; color: #374151; line-height: 1.6; margin-bottom: 12px; }
    .answer-btn { display: block; text-align: center; padding: 10px; border-radius: 8px; font-size: 13px; font-weight: 600; color: #fff !important; text-decoration: none; }
    .footer { text-align: center; margin-top: 20px; }
    .footer a { color: #4f46e5; font-size: 13px; text-decoration: none; }
    .footer-note { font-size: 11px; color: #9ca3af; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="header-icon">🏪</div>
      <div class="header-text">
        <h1>ReviewMonitor</h1>
        <p>${restaurantName || 'Neue Bewertung eingegangen'}</p>
      </div>
    </div>
    <div class="body">
      ${isTest ? `
      <div class="test-banner">
        🧪 <strong>Test-E-Mail</strong> — So sieht Ihre echte Benachrichtigung aus
      </div>
      ` : ''}

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

      ${answers.map((a: { label: string, text: string }, i: number) => `
        <div class="answer-box">
          <span class="answer-label" style="background:${answerColors[i]}20; color:${answerColors[i]}">${answerLabels[i]}</span>
          <div class="answer-text">${a.text}</div>
          <a href="#" class="answer-btn" style="background:${answerColors[i]}">✓ Diese Antwort auswählen & senden</a>
        </div>
      `).join('')}

      <div class="footer">
        <a href="https://review-manager-mu.vercel.app">Dashboard öffnen →</a>
        <div class="footer-note">Diese E-Mail wurde automatisch von ReviewMonitor generiert.</div>
      </div>
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
