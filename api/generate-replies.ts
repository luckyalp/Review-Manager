
import type { VercelRequest, VercelResponse } from '@vercel/node'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

function buildSimpleEnginePrompt(reviewText: string, stars: number, name: string) {
  return `
Du schreibst Antworten auf Google-Bewertungen für ein Restaurant.

Ziel:
Klar, souverän, nicht entschuldigend, nicht floskelhaft.

REGELN:
- Kein "tut uns leid"
- Kein "wir nehmen das ernst"
- Kein "intern"
- Kein Marketington
- Keine langen Erklärungen
- Maximal 4 Sätze

LOGIK:
1. IDENTIFIZIERE:
- KONZEPT (systembedingt)
- FEHLER (organisatorisch schiefgelaufen)
- WAHRNEHMUNG (subjektiv)

2. REAGIERE:
- Konzept → sachlich einordnen, ohne Schuld
- Fehler → klar benennen ohne Drama
- Wahrnehmung → respektieren, nicht diskutieren

3. ABSCHLUSS:
Ein konkreter Satz, wie künftig damit umgegangen wird (ohne Versprechen)

BEWERTUNG:
"${reviewText}"
Sterne: ${stars}
Name: ${name}

AUSGABE:
Nur der Text, keine JSON.
`
}

async function callClaude(prompt: string) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      temperature: 0.4,
      messages: [{ role: "user", content: prompt }]
    })
  })

  const data = await response.json()
  return data.content?.[0]?.text || ""
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const { review, settings } = req.body

    const reviewText = review?.reviewText || ""
    const stars = Number(review?.stars || 0)
    const name = review?.reviewerName || ""

    const prompt = buildSimpleEnginePrompt(reviewText, stars, name)
    const text = await callClaude(prompt)

    return res.status(200).json({
      success: true,
      answers: [
        {
          label: "Simple Engine",
          text: text.trim()
        }
      ]
    })
  } catch (e: any) {
    return res.status(500).json({
      error: "Serverfehler",
      details: e?.message || String(e)
    })
  }
}
