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
  const possessiv = duzen ? 'Dein' : 'Ihr'
  const dativ = duzen ? 'Dir' : 'Ihnen'
  const reflexiv = duzen ? 'Dich' : 'Sie sich'
  const isLowRating = review.stars <= 2
  const isMidRating = review.stars === 3
  const sig = responseSignature || `Das Team von ${businessName}`

  // Muster bestimmen basierend auf Sternanzahl und Inhalt
  let muster = ''
  if (review.stars >= 4) {
    muster = 'MUSTER 1 — ECHTES LOB: Bewertung enthält aufrichtige Begeisterung. Ziel: Freude zurückspiegeln, Verbindung stärken, Wiederkommen einladen. Keine Übertreibung, keine leeren Phrasen.'
  } else if (isMidRating) {
    muster = 'MUSTER 2 — GEMISCHTE BEWERTUNG: Bewertung enthält sowohl Positives als auch Kritik. Ziel: Positives aufgreifen, Kritik ernst nehmen ohne Rechtfertigung, offen für Verbesserung zeigen.'
  } else {
    muster = `MUSTER 3 — NIEDRIGE BEWERTUNG (Recovery): Gast hat schlechte Erfahrung gemacht. 
Ziel: Deeskalation, Vertrauen wiederherstellen, in private Kommunikation überführen.
VERBOTEN: Rechtfertigen, Diskutieren, Schuldzuweisung, defensive Sprache.
PFLICHT: Erfahrung anerkennen, kurze Entschuldigung, Kontaktangebot: ${contactEmail || 'kontakt@restaurant.de'}
Struktur: 1. Anerkennung 2. Entschuldigung 3. Kontakteinladung`
  }

  const prompt = `Du bist ein Experte für authentische Restaurant-Kommunikation.

KERN-PHILOSOPHIE (wichtigster Grundsatz):
Verändere Gefühle — korrigiere keine Fakten.
Auch wenn der Gast übertrieben hat: Es geht nicht darum wer Recht hat. Es geht darum, dass der Gast sich gehört fühlt und du als Mensch antwortest — nicht als Unternehmen.

RESTAURANT-STIMMPROFIL:
- Name: ${businessName}
- Beschreibung: ${description || 'nicht angegeben'}
- Küche: ${cuisineType || 'nicht angegeben'}  
- Was uns besonders macht: ${uniqueSellingPoints || 'nicht angegeben'}
- Unsere Werte: ${brandValues || 'nicht angegeben'}
- Bevorzugte Formulierungen: ${preferredPhrases || 'natürlich und authentisch'}
- Nie verwenden: ${avoidPhrases || 'Floskeln, "eigentlich", übertriebene Entschuldigungen'}
- Anredeform für Gäste: "${anrede}" — WICHTIG: Konsequent ${duzen ? '"Du/Dein/Dich"' : '"Sie/Ihr/Ihnen"'} verwenden!
- Signatur: ${sig}

AKTUELLE SITUATION:
${muster}

BEWERTUNG:
Von: ${review.reviewerName} | Sterne: ${review.stars}/5
"${review.reviewText}"

REGELN FÜR ALLE ANTWORTEN:
1. Sprache: Deutsch
2. Länge: 3-5 Sätze — nicht mehr, nicht weniger
3. Keine Marketingsprache ("erstklassig", "einzigartig", "von Herzen")
4. Kein Wort "eigentlich"
5. Nicht mit "Wir" anfangen — persönlicher einsteigen
6. Anrede IMMER: "${anrede}" — niemals wechseln
7. Jede Antwort anders im Ton, gleich in der Aussage
8. Am Ende immer unterschreiben mit: "${sig}"

QUALITÄTSCHECK (vor jeder Antwort prüfen):
- Fühlt sich der Gast gehört — egal ob er Recht hatte?
- Klingt das wie ein Mensch oder wie ein Unternehmen?
- Würde ich das selbst sagen wollen?

Erstelle GENAU 3 Antworten. Antworte NUR mit dem JSON Array, keine Erklärungen davor oder danach:

[
  {
    "label": "💬 Herzlich & persönlich",
    "text": "... (warm, nah, emotional, persönlich)"
  },
  {
    "label": "👔 Professionell & freundlich",
    "text": "... (ruhig, klar, respektvoll, sachlich)"
  },
  {
    "label": "⚡ Kurz & direkt",
    "text": "... (kompakt, auf den Punkt, keine Füllwörter)"
  }
]`

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.75, maxOutputTokens: 2000 }
        })
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return res.status(500).json({ error: 'Gemini API Fehler', details: data })
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const jsonMatch = text.match(/\[[\s\S]*\]/)

    if (!jsonMatch) {
      return res.status(500).json({ error: 'Kein JSON gefunden', raw: text })
    }

    const answers = JSON.parse(jsonMatch[0])
    return res.status(200).json({ success: true, answers })

  } catch (error) {
    return res.status(500).json({ error: 'Serverfehler', details: String(error) })
  }
}
