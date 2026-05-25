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
  } = settings || {}

  const anrede = salutation === 'Du' ? 'du' : 'Sie'
  const anredeGross = salutation === 'Du' ? 'Du' : 'Sie'
  const possessiv = salutation === 'Du' ? 'Dein' : 'Ihr'
  const isLowRating = review.stars <= 2

  const systemPrompt = `Du bist ein Experte für Restaurant-Kommunikation. Du schreibst Antworten auf Google-Bewertungen für das Restaurant "${businessName}".

RESTAURANT PROFIL:
- Name: ${businessName}
- Küche: ${cuisineType || 'nicht angegeben'}
- Besonderheiten: ${uniqueSellingPoints || 'nicht angegeben'}
- Markenwerte: ${brandValues || 'nicht angegeben'}
- Signatur: ${responseSignature || `Das Team von ${businessName}`}

KOMMUNIKATIONSREGELN:
- Anredeform: "${anredeGross}" (${salutation === 'Du' ? 'persönlich/du' : 'förmlich/Sie'})
- Bevorzugte Formulierungen: ${preferredPhrases || 'natürlich, authentisch'}
- Zu vermeiden: ${avoidPhrases || 'Floskeln, übertriebene Entschuldigungen'}
- Sprache: Deutsch
- Länge: maximal 4-6 Sätze
- Keine Marketing-Floskeln
- Natürliche, menschliche Sprache
- Gefühle ansprechen, nicht Fakten korrigieren

${isLowRating ? `WICHTIG - NIEDRIGE BEWERTUNG (${review.stars} Sterne):
- Kein Rechtfertigen oder Diskutieren
- Erfahrung anerkennen
- Kurze Entschuldigung
- Zur direkten Kontaktaufnahme einladen: ${contactEmail || 'kontakt@restaurant.de'}
- Ruhig, sachlich, menschlich` : ''}

Erstelle GENAU 3 verschiedene Antworten im JSON Format. Keine Erklärungen, nur das JSON.`

  const userPrompt = `Bewertung von ${review.reviewerName} (${review.stars} von 5 Sternen):
"${review.reviewText}"

Erstelle 3 Antworten als JSON Array:
[
  {
    "label": "💬 Herzlich & persönlich",
    "text": "..."
  },
  {
    "label": "👔 Professionell & freundlich", 
    "text": "..."
  },
  {
    "label": "⚡ Kurz & direkt",
    "text": "..."
  }
]

Jede Antwort soll einen anderen Ton haben aber dieselbe Kernaussage.
Nutze die Anredeform "${anredeGross}/${possessiv}".
Unterschreibe mit: "${responseSignature || `Das Team von ${businessName}`}"`

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: systemPrompt + '\n\n' + userPrompt }]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1500,
          }
        })
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return res.status(500).json({ error: 'Gemini API Fehler', details: data })
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // JSON aus der Antwort extrahieren
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Kein JSON in Antwort gefunden', raw: text })
    }

    const answers = JSON.parse(jsonMatch[0])

    return res.status(200).json({ success: true, answers })

  } catch (error) {
    return res.status(500).json({ error: 'Serverfehler', details: String(error) })
  }
}
