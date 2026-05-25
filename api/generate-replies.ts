import type { VercelRequest, VercelResponse } from '@vercel/node'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { review, settings } = req.body

  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({ error: 'OPENROUTER_API_KEY nicht konfiguriert' })
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
  const possessiv = duzen ? 'Dein' : 'Ihr'
  const isLowRating = review.stars <= 2
  const isMidRating = review.stars === 3
  const sig = responseSignature || `Das Team von ${businessName}`

  let muster = ''
  if (review.stars >= 4) {
    muster = 'MUSTER 1 — ECHTES LOB: Bewertung enthält aufrichtige Begeisterung. Ziel: Freude zurückspiegeln, Verbindung stärken, Wiederkommen einladen.'
  } else if (isMidRating) {
    muster = 'MUSTER 2 — GEMISCHTE BEWERTUNG: Enthält Positives und Kritik. Positives aufgreifen, Kritik ernst nehmen ohne Rechtfertigung.'
  } else {
    muster = `MUSTER 3 — RECOVERY (1-2 Sterne): Deeskalation, Vertrauen wiederherstellen.
VERBOTEN: Rechtfertigen, Diskutieren, defensive Sprache.
PFLICHT: Erfahrung anerkennen, Entschuldigung, Kontakt anbieten: ${contactEmail || 'kontakt@restaurant.de'}`
  }

  const prompt = `Du bist ein Experte für authentische Restaurant-Kommunikation.

KERN-PHILOSOPHIE: Verändere Gefühle — korrigiere keine Fakten.

RESTAURANT-STIMMPROFIL:
- Name: ${businessName}
- Beschreibung: ${description || 'nicht angegeben'}
- Küche: ${cuisineType || 'nicht angegeben'}
- Was uns besonders macht: ${uniqueSellingPoints || 'nicht angegeben'}
- Unsere Werte: ${brandValues || 'nicht angegeben'}
- Bevorzugte Formulierungen: ${preferredPhrases || 'natürlich und authentisch'}
- Nie verwenden: ${avoidPhrases || 'Floskeln, "eigentlich", übertriebene Entschuldigungen'}
- Anredeform: "${anrede}" — WICHTIG: Konsequent ${duzen ? '"Du/Dein/Dich"' : '"Sie/Ihr/Ihnen"'} verwenden!
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
7. Am Ende: "${sig}"

Antworte NUR mit diesem JSON Array, keine Erklärungen:

[
  {"label": "💬 Herzlich & persönlich", "text": "..."},
  {"label": "👔 Professionell & freundlich", "text": "..."},
  {"label": "⚡ Kurz & direkt", "text": "..."}
]`

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://review-manager-mu.vercel.app',
        'X-Title': 'ReviewMonitor',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1500,
      })
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(500).json({ error: 'OpenRouter API Fehler', details: data })
    }

    const text = data.choices?.[0]?.message?.content || ''
    
    // JSON extrahieren
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
