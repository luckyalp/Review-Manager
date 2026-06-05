import type { VercelRequest, VercelResponse } from '@vercel/node'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

async function callGemini(userMessage: string, systemPrompt?: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`

  const body: any = {
    contents: [{ parts: [{ text: userMessage }] }],
    generationConfig: { maxOutputTokens: 2000, temperature: 0.5 },
  }
  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(`Gemini API Fehler: ${JSON.stringify(err)}`)
  }

  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY nicht konfiguriert' })
  }

  const { reviews, language = 'Deutsch' } = req.body

  if (!reviews || reviews.length === 0) {
    return res.status(400).json({ error: 'Keine Bewertungen übergeben' })
  }

  // Bewertungstexte zusammenbauen
  const reviewLines = reviews
    .map((r: any, i: number) => `[${i + 1}] ${r.stars}★ — ${r.text || '(kein Text)'}`)
    .join('\n')

  const systemPrompt = `Du bist ein erfahrener Gastro-Berater der Restaurants dabei hilft ihre Gästekommunikation zu verstehen und zu verbessern.
Analysiere die Bewertungen sachlich, direkt und konkret.
Schreibe wie ein Berater — nicht wie eine KI, nicht wie ein Marketingtext.
Antworte immer auf ${language}.
Antworte NUR mit dem angeforderten JSON — kein anderer Text, keine Erklärungen, keine Markdown-Backticks.`

  const userMessage = `Analysiere diese ${reviews.length} Restaurant-Bewertungen:

${reviewLines}

Antworte NUR mit diesem JSON (kein anderer Text):
{
  "positiv": ["Thema 1", "Thema 2", "Thema 3"],
  "negativ": ["Thema 1", "Thema 2", "Thema 3"],
  "empfehlungen": [
    "Konkrete Empfehlung 1 — direkt und umsetzbar",
    "Konkrete Empfehlung 2 — direkt und umsetzbar",
    "Konkrete Empfehlung 3 — direkt und umsetzbar"
  ]
}

Regeln:
- "positiv": Was loben Gäste am häufigsten? Max. 4 Themen, kurze Begriffe (z.B. "Essen & Qualität", "Freundlicher Service")
- "negativ": Was kritisieren Gäste am häufigsten? Max. 4 Themen, kurze Begriffe
- "empfehlungen": 3 konkrete, umsetzbare Ratschläge basierend auf den Bewertungen. Direkt, klar, wie ein Berater der es ernst meint — nicht wie ein Motivationscoach.
- Wenn es keine negativen Themen gibt: "negativ": []
- Wenn es keine positiven Themen gibt: "positiv": []`

  try {
    const raw = await callGemini(userMessage, systemPrompt)

    // JSON aus Antwort extrahieren
    let jsonStr = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const start = jsonStr.indexOf('{')
    const end = jsonStr.lastIndexOf('}')
    if (start === -1 || end === -1) {
      throw new Error('Kein JSON in Antwort: ' + raw)
    }
    jsonStr = jsonStr.substring(start, end + 1)
    const parsed = JSON.parse(jsonStr)

    return res.status(200).json({
      success: true,
      positiv: parsed.positiv || [],
      negativ: parsed.negativ || [],
      empfehlungen: parsed.empfehlungen || [],
    })
  } catch (error) {
    console.error('analyze-reviews Fehler:', error)
    return res.status(500).json({ error: 'Analyse fehlgeschlagen', details: String(error) })
  }
}
