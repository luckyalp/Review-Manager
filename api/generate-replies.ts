import type { VercelRequest, VercelResponse } from '@vercel/node'

const GROK_API_KEY = process.env.GROK_API_KEY

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { review, settings } = req.body

  if (!GROK_API_KEY) {
    return res.status(500).json({ error: 'GROK_API_KEY nicht konfiguriert' })
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

Antworte NUR mit diesem JSON Array:

[
  {"label": "💬 Herzlich & persönlich", "text": "..."},
  {"label": "👔 Professionell & freundlich", "text": "..."},
  {"label": "⚡ Kurz & direkt", "text": "..."}
]`

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-3-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1500,
      })
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(500).json({ error: 'Grok API Fehler', details: data })
    }

    const text = data.choices?.[0]?.message?.content || ''
    
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
