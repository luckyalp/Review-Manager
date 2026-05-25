import type { VercelRequest, VercelResponse } from '@vercel/node'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { review, settings } = req.body

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY nicht konfiguriert' })
  }

  const {
    businessName = 'das Restaurant',
    cuisineType = '',
    uniqueSellingPoints = '',
    brandValues = '',
    preferredPhrases = '',
    avoidPhrases = '',
    responseSignature = '',
    salutation = 'Sie',
    contactEmail = '',
    description = '',
  } = settings || {}

  const duzen = salutation === 'Du'
  const anrede = duzen ? 'Du' : 'Sie'
  const sig = responseSignature || `Das Team von ${businessName}`
  const isMidRating = review.stars === 3

  let muster = ''
  if (review.stars >= 4) {
    muster = 'MUSTER 1 — LOB: Freude zurückspiegeln, Verbindung stärken, Wiederkommen einladen.'
  } else if (isMidRating) {
    muster = 'MUSTER 2 — GEMISCHT: Positives aufgreifen, Kritik ernst nehmen ohne Rechtfertigung.'
  } else {
    muster = `MUSTER 3 — RECOVERY (1-2 Sterne): Deeskalation, ruhig und professionell.
VERBOTEN: Rechtfertigen, Diskutieren, defensive Sprache.
PFLICHT: Erfahrung anerkennen, Entschuldigung, Kontakt anbieten: ${contactEmail || 'kontakt@restaurant.de'}`
  }

  const prompt = `Du bist ein Experte für authentische Restaurant-Kommunikation.

KERN-PHILOSOPHIE: Verändere Gefühle — korrigiere keine Fakten.

RESTAURANT:
- Name: ${businessName}
- Beschreibung: ${description || 'nicht angegeben'}
- Küche: ${cuisineType || 'nicht angegeben'}
- Besonderheiten: ${uniqueSellingPoints || 'nicht angegeben'}
- Werte: ${brandValues || 'nicht angegeben'}
- Bevorzugte Formulierungen: ${preferredPhrases || 'natürlich und authentisch'}
- Nie verwenden: ${avoidPhrases || 'Floskeln, übertriebene Entschuldigungen'}
- Anredeform: "${anrede}" — IMMER konsequent ${duzen ? '"Du/Dein/Dich"' : '"Sie/Ihr/Ihnen"'} verwenden!
- Signatur: ${sig}

SITUATION: ${muster}

BEWERTUNG:
Von: ${review.reviewerName} | Sterne: ${review.stars}/5
"${review.reviewText}"

REGELN:
1. Deutsch
2. 3-5 Sätze
3. Keine Marketingsprache
4. Kein "eigentlich"
5. Nicht mit "Wir" anfangen
6. Anrede IMMER: "${anrede}"
7. Am Ende unterschreiben mit: "${sig}"

Antworte NUR mit einem JSON Array, ohne Markdown, ohne Erklärungen:

[
  {"label": "💬 Herzlich & persönlich", "text": "..."},
  {"label": "👔 Professionell & freundlich", "text": "..."},
  {"label": "⚡ Kurz & direkt", "text": "..."}
]`

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1500 }
        })
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return res.status(500).json({ error: 'Gemini API Fehler', details: data })
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    
    // JSON extrahieren — mit oder ohne Code-Block
    let jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const jsonMatch = jsonStr.match(/\[[\s\S]*\]/)

    if (!jsonMatch) {
      return res.status(500).json({ error: 'Kein JSON gefunden', raw: text })
    }

    const answers = JSON.parse(jsonMatch[0])
    return res.status(200).json({ success: true, answers })

  } catch (error) {
    return res.status(500).json({ error: 'Serverfehler', details: String(error) })
  }
}
