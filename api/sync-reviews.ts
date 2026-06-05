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
        `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const locationsData = await locationsRes.json()
      const location = locationsData.locations?.[0]
      if (!location) continue

      const reviewsRes = await fetch(
        `https://mybusiness.googleapis.com/v4/${location.name}/reviews`,
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
      }
    } catch (err) {
      console.error('Fehler bei User', token.user_id, err)
    }
  }

  return res.status(200).json({ message: `${totalNew} neue Bewertungen synchronisiert` })
}
