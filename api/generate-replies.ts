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

  let muster = ''
  if (review.stars >= 4) {
    muster = 'Positive Bewertung: Freude zurückspiegeln, Verbindung stärken, Wiederkommen einladen.'
  } else if (review.stars === 3) {
    muster = 'Gemischte Bewertung: Positives aufgreifen, Kritik ernst nehmen ohne Rechtfertigung.'
  } else {
    muster = `Negative Bewertung (1-2 Sterne): Deeskalation, ruhig und professionell.
Erfahrung anerkennen, kurze Entschuldigung, Kontakt anbieten: ${contactEmail || 'kontakt@restaurant.de'}
VERBOTEN: Rechtfertigen, Diskutieren, defensive Sprache.`
  }

  const prompt = `Du bist ein Experte für Restaurant-Kommunikation.

Restaurant: ${businessName}
Beschreibung: ${description || 'nicht angegeben'}
Küche: ${cuisineType || 'nicht angegeben'}
Besonderheiten: ${uniqueSellingPoints || 'nicht angegeben'}
Werte: ${brandValues || 'nicht angegeben'}
Anredeform: ${anrede} (konsequent verwenden!)
Signatur: ${sig}
Bevorzugte Formulierungen: ${preferredPhrases || 'natürlich und authentisch'}
Verbotene Formulierungen: ${avoidPhrases || 'Floskeln, übertriebene Entschuldigungen'}

Situation: ${muster}

Bewertung von ${review.reviewerName} (${review.stars}/5 Sterne):
"${review.reviewText}"

Schreibe genau 3 verschiedene Antworten auf Deutsch.
Jede Antwort: 3-5 Sätze, natürlich, keine Marketingsprache, nicht mit "Wir" anfangen, endet mit "${sig}".
Anredeform immer: ${anrede}

Antworte NUR mit einem JSON Array aus 3 Strings, genau so:
["antwort1", "antwort2", "antwort3"]`

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 3000 }
        })
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return res.status(500).json({ error: 'Gemini API Fehler', details: data })
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    
    // JSON extrahieren
    let jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const startIdx = jsonStr.indexOf('[')
    const endIdx = jsonStr.lastIndexOf(']')
    
    if (startIdx === -1 || endIdx === -1) {
      return res.status(500).json({ error: 'Kein JSON gefunden', raw: text })
    }
    
    jsonStr = jsonStr.substring(startIdx, endIdx + 1)
    const parsed = JSON.parse(jsonStr)
    
    // Beide Formate unterstützen: Strings ODER Objekte mit text-Feld
    const answers = parsed.map((item: any, i: number) => {
      const labels = ['💬 Herzlich & persönlich', '👔 Professionell & freundlich', '⚡ Kurz & direkt']
      const text = typeof item === 'string' ? item : (item.text || item.content || item.response || JSON.stringify(item))
      return { label: labels[i] || `Antwort ${i+1}`, text }
    })

    return res.status(200).json({ success: true, answers })

  } catch (error) {
    return res.status(500).json({ error: 'Serverfehler', details: String(error) })
  }
}
