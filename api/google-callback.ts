import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, state: userId } = req.query

  if (!code) {
    return res.status(400).send('Kein Code erhalten')
  }

  const redirectUri = 'https://review-manager-mu.vercel.app/api/google-callback'

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: code as string,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  const tokenData = await tokenRes.json()

  if (!tokenData.access_token) {
    return res.status(500).send('Token-Fehler: ' + JSON.stringify(tokenData))
  }

  await supabase.from('google_tokens').upsert({
    user_id: userId as string,
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + tokenData.expires_in,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  res.redirect('/?google=connected')
}
