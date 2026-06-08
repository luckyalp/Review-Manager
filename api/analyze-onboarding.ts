import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

async function callClaude(userMessage: string, systemPrompt: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })
  if (!response.ok) {
    const err = await response.json()
    throw new Error(`Claude API Fehler: ${JSON.stringify(err)}`)
  }
  const data = await response.json()
  return data.content?.[0]?.text || ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert' })
  }

  const { data: tokens, error } = await supabase
    .from('google_tokens')
    .select('user_id')

  if (error || !tokens || tokens.length === 0) {
    return res.status(200).json({ message: 'Keine verbundenen Accounts' })
  }

  const results: any[] = []

  for (const token of tokens) {
    const userId = token.user_id

    try {
      // Prüfen ob dieser User schon Einträge in profile_questions hat
      const { data: existing } = await supabase
        .from('profile_questions')
        .select('id')
        .eq('user_id', userId)
        .limit(1)

      if (existing && existing.length > 0) {
        results.push({ userId, status: 'übersprungen — bereits analysiert' })
        continue
      }

      // Bewertungen der letzten 12 Monate aus Supabase laden
      const cutoff = new Date()
      cutoff.setMonth(cutoff.getMonth() - 12)

      const { data: reviews } = await supabase
        .from('reviews')
        .select('stars, review_text')
        .eq('user_id', userId)
        .gte('review_date', cutoff.toISOString())
        .not('review_text', 'is', null)

      if (!reviews || reviews.length === 0) {
        results.push({ userId, status: 'keine Bewertungen gefunden' })
        continue
      }

      const reviewLines = reviews
        .map((r: any, i: number) => `[${i + 1}] ${r.stars}★ — ${r.review_text}`)
        .join('\n')

      const systemPrompt = `Du bist ein Gastro-Berater. Analysiere Bewertungen sachlich.
Antworte NUR mit dem angeforderten JSON — kein anderer Text, keine Markdown-Backticks.`

      const userMessage = `Analysiere diese ${reviews.length} Restaurant-Bewertungen:

${reviewLines}

Antworte NUR mit diesem JSON:
{
  "positiv": [
    {"thema": "Freundlicher Service", "anzahl": 5},
    {"thema": "Essen & Qualität", "anzahl": 3}
  ],
  "negativ": [
    {"thema": "Wartezeit", "anzahl": 8},
    {"thema": "Wasserpreis", "anzahl": 4}
  ]
}

Regeln:
- Max. 6 Themen pro Kategorie
- Kurze Begriffe (2-4 Wörter)
- "anzahl" = wie oft dieses Thema in den Bewertungen vorkommt
- Nur echte Muster — keine Themen erfinden
- Wenn keine negativen Themen: "negativ": []
- Wenn keine positiven Themen: "positiv": []`

      const raw = await callClaude(userMessage, systemPrompt)

      let jsonStr = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      const start = jsonStr.indexOf('{')
      const end = jsonStr.lastIndexOf('}')
      if (start === -1 || end === -1) throw new Error('Kein JSON in Antwort: ' + raw)
      jsonStr = jsonStr.substring(start, end + 1)
      const parsed = JSON.parse(jsonStr)

      const inserts: any[] = []

      for (const item of (parsed.positiv || [])) {
        inserts.push({
          user_id: userId,
          thema: item.thema,
          anzahl: item.anzahl || 1,
          typ: 'positiv',
          status: 'offen',
        })
      }

      for (const item of (parsed.negativ || [])) {
        inserts.push({
          user_id: userId,
          thema: item.thema,
          anzahl: item.anzahl || 1,
          typ: 'negativ',
          status: 'offen',
        })
      }

      if (inserts.length > 0) {
        await supabase.from('profile_questions').insert(inserts)
      }

      results.push({
        userId,
        status: 'analysiert',
        positiv: parsed.positiv?.length || 0,
        negativ: parsed.negativ?.length || 0,
      })

    } catch (err) {
      console.error('Fehler bei User', userId, err)
      results.push({ userId, status: 'Fehler', error: String(err) })
    }
  }

  return res.status(200).json({ message: 'Onboarding-Analyse abgeschlossen', results })
}
