import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  return res.json()
}

function starRatingToNumber(rating: string): number {
  const map: Record<string, number> = {
    FIVE: 5, FOUR: 4, THREE: 3, TWO: 2, ONE: 1
  }
  return map[rating] ?? 3
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { data: tokens, error } = await supabase
    .from('google_tokens')
    .select('*')

  if (error || !tokens || tokens.length === 0) {
    return res.status(200).json({ message: 'Keine verbundenen Accounts' })
  }

  let totalNew = 0

  for (const token of tokens) {
    try {
      let accessToken = token.access_token

      if (token.expires_at < Math.floor(Date.now() / 1000)) {
        const refreshed = await refreshAccessToken(token.refresh_token)
        if (!refreshed.access_token) continue

        accessToken = refreshed.access_token
        await supabase
          .from('google_tokens')
          .update({
            access_token: refreshed.access_token,
            expires_at: Math.floor(Date.now() / 1000) + refreshed.expires_in,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', token.user_id)
      }

      const accountsRes = await fetch(
        'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const accountsData = await accountsRes.json()
      const account = accountsData.accounts?.[0]
      if (!account) continue

      const locationsRes = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const locationsData = await locationsRes.json()
      const location = locationsData.locations?.[0]
      if (!location) continue

      // location.name Format: "locations/123456" oder "accounts/xxx/locations/xxx"
      // Für Reviews brauchen wir: accounts/{accountId}/locations/{locationId}
      const locationName = location.name.startsWith('accounts/')
        ? location.name
        : `${account.name}/locations/${location.name.split('/').pop()}`

      const reviewsRes = await fetch(
        `https://mybusiness.googleapis.com/v4/${locationName}/reviews`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const reviewsData = await reviewsRes.json()
      const reviews = reviewsData.reviews || []

      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - 90)

      for (const review of reviews) {
        const reviewDate = new Date(review.createTime)
        if (reviewDate < cutoff) continue
        if (review.reviewReply) continue

        const { data: existing } = await supabase
          .from('reviews')
          .select('id')
          .eq('google_review_id', review.reviewId)
          .single()

        if (existing) continue

        await supabase.from('reviews').insert({
          google_review_id: review.reviewId,
          review_text: review.comment || '',
          review_date: review.createTime,
          status: 'Ausstehend',
          user_id: token.user_id,
          reviewer_name: review.reviewer?.displayName || 'Anonym',
          stars: starRatingToNumber(review.starRating),
        })
        totalNew++

        // ── E-Mail Benachrichtigung ──────────────────────────────────────────
        try {
          // Settings des Gastronoms laden
          const { data: settingsRow } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'restaurant_profile')
            .eq('user_id', token.user_id)
            .single()

          const settings = settingsRow?.value || {}
          const notificationEmail = settings.notificationEmail
          if (!notificationEmail) continue

          // Google-Übersetzung rausfiltern — nur Originaltext behalten
          const rawText: string = review.comment || ''
          const translationMatch = rawText.match(/\(Original\)\s*(.+)$/s)
          const cleanText = translationMatch ? translationMatch[1].trim() : rawText

          const reviewData = {
            reviewerName: review.reviewer?.displayName || 'Anonym',
            stars: starRatingToNumber(review.starRating),
            reviewText: cleanText,
          }

          // KI-Antworten generieren
          const baseUrl = 'https://review-manager-mu.vercel.app'
          const repliesRes = await fetch(`${baseUrl}/api/generate-replies`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ review: reviewData, settings }),
          })
          const repliesData = await repliesRes.json()

          if (repliesData.missingContext) {
            // E-Mail mit Hinweis senden
            await fetch(`${baseUrl}/api/send-email`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: notificationEmail,
                ...reviewData,
                googleReviewId: review.reviewId,
                restaurantName: settings.businessName || '',
                salutation: settings.salutation || 'Sie',
                missingContext: true,
                missingInfo: repliesData.missingInfo,
                answers: [],
              }),
            })
          } else if (repliesData.success && repliesData.answers) {
            // Normale E-Mail mit Antworten senden
            await fetch(`${baseUrl}/api/send-email`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: notificationEmail,
                ...reviewData,
                googleReviewId: review.reviewId,
                restaurantName: settings.businessName || '',
                salutation: settings.salutation || 'Sie',
                answers: repliesData.answers,
              }),
            })
          }
        } catch (emailErr) {
          console.error('E-Mail Versand fehlgeschlagen:', emailErr)
          // Kein Abbruch — Bewertung ist gespeichert, das ist Priorität
        }
        // ── Ende E-Mail ──────────────────────────────────────────────────────
      }
    } catch (err) {
      console.error('Fehler bei User', token.user_id, err)
    }
  }

  return res.status(200).json({ message: `${totalNew} neue Bewertungen synchronisiert` })
}
