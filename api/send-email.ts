import type { VercelRequest, VercelResponse } from '@vercel/node'

const RESEND_API_KEY = process.env.RESEND_API_KEY

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { to, reviewerName, stars, reviewText, answers, restaurantName, isTest, salutation, contactEmail, missingContext, missingInfo, googleReviewId } = req.body
  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY nicht konfiguriert' })
  }

  if (!to) {
    return res.status(400).json({ error: 'Keine E-Mail-Adresse angegeben' })
  }

  const starsFilled = '★'.repeat(stars)
  const starsEmpty = '☆'.repeat(5 - stars)
  const initials = reviewerName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  // Petrol-Palette — kein Lila
  const petrol      = '#0f4c5c'
  const petrolMid   = '#155e75'
  const petrolLight = '#1e7a8c'
  const teal        = '#0e7490'
  const sand        = '#f7f5f2'
  const border      = '#e2ddd8'
  const bgBody      = '#f7f5f2'

  // ─── MISSING CONTEXT EMAIL ─────────────────────────────────────────────────
  if (missingContext) {
    const missingHtml = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root { color-scheme: light only; }
    body { background-color: ${bgBody} !important; color: #1a1a1a !important; }
  </style>
</head>
<body style="margin:0; padding:20px; background-color:${bgBody} !important; font-family: Arial, sans-serif; color: #1a1a1a;" bgcolor="${bgBody}">
  <div style="max-width: 580px; margin: 0 auto;">

    <div style="background: linear-gradient(135deg, ${petrol} 0%, ${petrolMid} 100%); border-radius: 14px 14px 0 0; padding: 20px 24px;">
      <table cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td style="vertical-align: middle; width: 48px;">
            <div style="background-color: ${petrolLight}; border-radius: 10px; width: 40px; height: 40px; line-height: 40px; text-align: center; font-size: 22px;">⭐</div>
          </td>
          <td style="vertical-align: middle; padding-left: 12px;">
            <div style="color: #ffffff; font-size: 17px; font-weight: 700; letter-spacing: -0.2px;">Rezpond</div>
            <div style="color: #a5c8d0; font-size: 13px; margin-top: 2px;">${restaurantName || 'Neue Bewertung eingegangen'}</div>
          </td>
        </tr>
      </table>
    </div>

    <div style="background-color: #ffffff; padding: 24px; border-radius: 0 0 14px 14px; border: 1px solid ${border}; border-top: none;">

      <!-- Bewertung -->
      <div style="border: 1px solid ${border}; border-radius: 12px; padding: 16px; margin-bottom: 24px; background-color: #fdfcfa;">
        <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 10px;" role="presentation">
          <tr>
            <td style="vertical-align: middle; width: 48px;">
              <div style="width: 40px; height: 40px; border-radius: 50%; background-color: #e2ddd8; line-height: 40px; text-align: center; font-weight: 700; font-size: 14px; color: #374151;">${initials}</div>
            </td>
            <td style="vertical-align: middle; padding-left: 12px;">
              <div style="font-weight: 700; font-size: 15px; color: #111827;">${reviewerName}</div>
              <div style="margin-top: 3px;">
                <span style="color: #F0B100; font-size: 16px;">${starsFilled}</span><span style="color: #d1d5db; font-size: 16px;">${starsEmpty}</span>
                <span style="font-size: 11px; color: #6b7280; background-color: #f3f0ec; padding: 2px 8px; border-radius: 10px; margin-left: 6px;">Google · ${stars}/5 Sterne</span>
              </div>
            </td>
          </tr>
        </table>
        <div style="font-size: 14px; color: #374151; line-height: 1.6; font-style: italic;">"${reviewText}"</div>
      </div>

      <!-- Hinweis-Block -->
      <div style="border: 1.5px solid #d97706; border-left: 4px solid #d97706; border-radius: 12px; padding: 20px; background: #fffbeb; margin-bottom: 20px;">
        <div style="font-size: 22px; margin-bottom: 10px;">🤔</div>
        <div style="font-weight: 700; font-size: 15px; color: #92400e; margin-bottom: 10px;">Kurz eine Frage, bevor ich antworte...</div>
        <div style="font-size: 14px; color: #78350f; line-height: 1.6; margin-bottom: 14px;">
          Diese Bewertung enthält einen konkreten Vorwurf — ich möchte keine Antwort erfinden, die vielleicht nicht stimmt.<br><br>
          <strong>Was mir fehlt:</strong> ${missingInfo || 'Fehlende Informationen im Restaurantprofil'}<br><br>
          Wenn du das kurz in deinem Profil ergänzt, kann ich beim nächsten Mal direkt eine passende Antwort liefern.
        </div>
        <a href="https://review-manager-mu.vercel.app" style="display: inline-block; padding: 10px 20px; background: #d97706; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: 600;">→ Jetzt Profil ergänzen</a>
      </div>

      <div style="text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid ${border};">
        <a href="https://review-manager-mu.vercel.app" style="color: ${petrol}; font-size: 13px; text-decoration: none; font-weight: 600;">Dashboard öffnen →</a>
        <div style="font-size: 11px; color: #9ca3af; margin-top: 8px;">Automatisch generiert von Rezpond</div>
      </div>
    </div>
  </div>
</body>
</html>`

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Rezpond <noreply@hiptoys.de>',
        to: [to],
        subject: `⚠️ Neue Bewertung von ${reviewerName} — Profil-Ergänzung nötig`,
        html: missingHtml,
      }),
    })
    const data = await response.json()
    if (!response.ok) {
      return res.status(500).json({ error: 'E-Mail konnte nicht gesendet werden', details: data })
    }
    return res.status(200).json({ success: true, id: data.id })
  }
  // ─── END MISSING CONTEXT ───────────────────────────────────────────────────

  // Petrol-Abstufungen für die 3 normalen Karten
  const normalColors = [petrol, petrolMid, petrolLight]

  const allAnswers: { label: string, text: string, isRecovery?: boolean }[] = answers
  const normalAnswers = allAnswers.filter(a => !a.isRecovery)
  const recoveryAnswer = allAnswers.find(a => a.isRecovery)

  const renderNormalCard = (a: { label: string, text: string }, i: number) => `
    <div style="border: 1.5px solid ${border}; border-radius: 12px; padding: 16px; margin-bottom: 10px; background: #ffffff; box-shadow: 0 1px 4px rgba(15,76,92,0.06);">
      <div style="display: inline-block; font-size: 10px; font-weight: 700; padding: 3px 10px; border-radius: 20px; margin-bottom: 10px; letter-spacing: 0.6px; background: ${normalColors[i] || petrol}1a; color: ${normalColors[i] || petrol}; text-transform: uppercase; border: 1px solid ${normalColors[i] || petrol}30;">${a.label}</div>
      <div style="font-size: 13px; color: #374151; line-height: 1.65; margin-bottom: 14px;">${a.text}</div>
      <table cellpadding="0" cellspacing="0" width="100%" role="presentation">
        <tr>
          <td style="padding-right: 6px; width: 50%;">
            <a href="https://review-manager-mu.vercel.app/api/confirm-reply?reviewId=${encodeURIComponent(googleReviewId || '')}&answerIndex=${i}&answerText=${encodeURIComponent(a.text)}"
              style="display: block; text-align: center; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; color: #ffffff; text-decoration: none; background: ${normalColors[i] || petrol};">
              ✓ Sofort senden
            </a>
          </td>
          <td style="padding-left: 6px; width: 50%;">
            <a href="https://review-manager-mu.vercel.app?reviewId=${encodeURIComponent(googleReviewId || '')}&edit=true"
              style="display: block; text-align: center; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; color: ${petrol}; text-decoration: none; background: #ffffff; border: 1.5px solid ${border};">
              ✏ Bearbeiten
            </a>
          </td>
        </tr>
      </table>
    </div>
  `

  const renderRecoveryCard = (a: { label: string, text: string }, idx: number) => `
    <div style="margin: 20px 0 10px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 12px;" role="presentation">
        <tr>
          <td style="border-top: 1px solid ${border}; width: 40%;"></td>
          <td style="padding: 0 10px; white-space: nowrap; font-size: 10px; font-weight: 700; color: ${teal}; text-transform: uppercase; letter-spacing: 0.08em; text-align: center;">Empfohlen bei 1–2 Sternen</td>
          <td style="border-top: 1px solid ${border}; width: 40%;"></td>
        </tr>
      </table>
      <div style="border: 1.5px solid ${teal}; border-left: 3px solid ${teal}; border-radius: 12px; padding: 16px; background: #ffffff; box-shadow: 0 1px 4px rgba(14,116,144,0.08);">
        <div style="font-size: 11px; color: ${teal}; margin-bottom: 6px; opacity: 0.9;">Fokus auf Vertrauen und Deeskalation.</div>
        <div style="display: inline-block; font-size: 10px; font-weight: 700; padding: 3px 10px; border-radius: 20px; margin-bottom: 10px; letter-spacing: 0.6px; background: ${teal}1a; color: ${teal}; text-transform: uppercase; border: 1px solid ${teal}30;">${a.label}</div>
        <div style="font-size: 13px; color: #374151; line-height: 1.65; margin-bottom: 14px;">${a.text}</div>
        <table cellpadding="0" cellspacing="0" width="100%" role="presentation">
          <tr>
            <td style="padding-right: 6px; width: 50%;">
              <a href="https://review-manager-mu.vercel.app/api/confirm-reply?reviewId=${encodeURIComponent(googleReviewId || '')}&answerIndex=${idx}&answerText=${encodeURIComponent(a.text)}"
                style="display: block; text-align: center; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; color: #ffffff; text-decoration: none; background: ${teal};">
                ✓ Sofort senden
              </a>
            </td>
            <td style="padding-left: 6px; width: 50%;">
              <a href="https://review-manager-mu.vercel.app?reviewId=${encodeURIComponent(googleReviewId || '')}&edit=true"
                style="display: block; text-align: center; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; color: ${teal}; text-decoration: none; background: #ffffff; border: 1.5px solid ${border};">
                ✏ Bearbeiten
              </a>
            </td>
          </tr>
        </table>
      </div>
    </div>
  `

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <style>
    :root { color-scheme: light only; }
    body { background-color: ${bgBody} !important; color: #1a1a1a !important; }
  </style>
</head>
<body style="margin:0; padding:20px; background-color:${bgBody} !important; font-family: Arial, sans-serif; color: #1a1a1a;" bgcolor="${bgBody}">

  <div style="max-width: 580px; margin: 0 auto;">

    <!-- Header: Petrol-Verlauf, kein Lila -->
    <div style="background: linear-gradient(135deg, ${petrol} 0%, ${petrolMid} 100%); border-radius: 14px 14px 0 0; padding: 20px 24px;">
      <table cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td style="vertical-align: middle; width: 48px;">
            <div style="background-color: ${petrolLight}; border-radius: 10px; width: 40px; height: 40px; line-height: 40px; text-align: center; font-size: 22px;">⭐</div>
          </td>
          <td style="vertical-align: middle; padding-left: 12px;">
            <div style="color: #ffffff; font-size: 17px; font-weight: 700; letter-spacing: -0.2px;">Rezpond</div>
            <div style="color: #a5c8d0; font-size: 13px; margin-top: 2px;">${restaurantName || 'Neue Bewertung eingegangen'}</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Body -->
    <div style="background-color: #ffffff; padding: 24px; border-radius: 0 0 14px 14px; border: 1px solid ${border}; border-top: none;">

      <!-- Bewertung -->
      <div style="border: 1px solid ${border}; border-radius: 12px; padding: 16px; margin-bottom: 24px; background-color: #fdfcfa;">
        <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 10px;" role="presentation">
          <tr>
            <td style="vertical-align: middle; width: 48px;">
              <div style="width: 40px; height: 40px; border-radius: 50%; background-color: #e2ddd8; line-height: 40px; text-align: center; font-weight: 700; font-size: 14px; color: #374151;">${initials}</div>
            </td>
            <td style="vertical-align: middle; padding-left: 12px;">
              <div style="font-weight: 700; font-size: 15px; color: #111827;">${reviewerName}</div>
              <div style="margin-top: 3px;">
                <span style="color: #F0B100; font-size: 16px;">${starsFilled}</span><span style="color: #d1d5db; font-size: 16px;">${starsEmpty}</span>
                <span style="font-size: 11px; color: #6b7280; background-color: #f3f0ec; padding: 2px 8px; border-radius: 10px; margin-left: 6px;">Google · ${stars}/5 Sterne</span>
              </div>
            </td>
          </tr>
        </table>
        <div style="font-size: 14px; color: #374151; line-height: 1.6; font-style: italic;">"${reviewText}"</div>
      </div>

      <!-- Antworten Titel -->
      <div style="font-weight: 700; font-size: 15px; color: #111827; margin-bottom: 14px;">
        ✨ ${salutation === 'Du' ? 'Wähle eine Antwort' : 'Wählen Sie eine Antwort'} — 1 Klick genügt:
      </div>

      <!-- Normale Antworten -->
      ${normalAnswers.map((a, i) => renderNormalCard(a, i)).join('')}

      <!-- Recovery Antwort -->
      ${recoveryAnswer ? renderRecoveryCard(recoveryAnswer, allAnswers.indexOf(recoveryAnswer)) : ''}

      <!-- Footer -->
      <div style="text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid ${border};">
        <a href="https://review-manager-mu.vercel.app" style="color: ${petrol}; font-size: 13px; text-decoration: none; font-weight: 600;">Dashboard öffnen →</a>
        <div style="font-size: 11px; color: #9ca3af; margin-top: 8px;">Automatisch generiert von Rezpond</div>
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
        from: 'Rezpond <noreply@hiptoys.de>',
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
