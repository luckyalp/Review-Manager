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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { userId, googleReviewId, answerText } = req.body

  if (!userId || !googleReviewId || !answerText) {
    return res.status(400).json({ error: 'userId, googleReviewId und answerText sind pflicht' })
  }

  // Token holen
  const { data: token, error } = await supabase
    .from('google_tokens')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !token) {
    return res.status(404).json({ error: 'Kein Google Token gefunden — bitte Google neu verbinden' })
  }

  // Token ggf. auffrischen
  let accessToken = token.access_token
  if (token.expires_at < Math.floor(Date.now() / 1000)) {
    const refreshed = await refreshAccessToken(token.refresh_token)
    if (!refreshed.access_token) {
      return res.status(401).json({ error: 'Token konnte nicht aufgefrischt werden' })
    }
    accessToken = refreshed.access_token
    await supabase
      .from('google_tokens')
      .update({
        access_token: refreshed.access_token,
        expires_at: Math.floor(Date.now() / 1000) + refreshed.expires_in,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
  }

  // Google Account + Location holen
  const accountsRes = await fetch(
    'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const accountsData = await accountsRes.json()
  const account = accountsData.accounts?.[0]
  if (!account) {
    return res.status(404).json({ error: 'Kein Google Business Account gefunden' })
  }

  const locationsRes = await fetch(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const locationsData = await locationsRes.json()
  const location = locationsData.locations?.[0]
  if (!location) {
    return res.status(404).json({ error: 'Kein Google Business Standort gefunden' })
  }

  // Antwort auf Google posten
  const replyRes = await fetch(
    `https://mybusiness.googleapis.com/v4/${location.name}/reviews/${googleReviewId}/reply`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ comment: answerText }),
    }
  )

  if (!replyRes.ok) {
    const err = await replyRes.json()
    console.error('Google Reply Fehler:', err)
    return res.status(500).json({ error: 'Google Reply fehlgeschlagen', details: err })
  }

  return res.status(200).json({ success: true })
}
