import type { VercelRequest, VercelResponse } from '@vercel/node'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

function classify(rating: number, reviewText: string) {
  const wordCount = reviewText.trim().split(/\s+/).filter(Boolean).length
  const hasText = wordCount >= 8
  if (!hasText && rating >= 4) return 'EMPTY_POSITIVE'
  if (!hasText && rating <= 2) return 'EMPTY_NEGATIVE'
  if (rating >= 4) return 'CONTENT_POSITIVE'
  if (rating === 3) return 'CONTENT_MIXED'
  return 'CONTENT_NEGATIVE'
}

function buildPrompt(reviewText: string, rating: number, reviewerName: string, settings: any): string {
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
    restaurantType = '',
    priceRange = '',
    signatureDishes = '',
  } = settings || {}

  const duSie = salutation === 'Du' ? 'Du/Dein (Duzen)' : 'Sie/Ihr (Siezen)'
  const signature = responseSignature || `Das Team von ${businessName}`
  const mode = classify(rating, reviewText)
  const firstName = reviewerName ? reviewerName.split(' ')[0] : ''

  const nameRule = firstName
    ? `PERSONALISIERUNG:
- Vorname des Gastes: ${firstName}
- Variante A: KEIN Name — bleibt neutral
- Variante B: beginnt mit "Hallo ${firstName}," — direkt, menschlich
- Variante C: beginnt mit "${firstName}," — subtil, würdevoll
- Name NIE mehrfach wiederholen — nur am Anfang
- Kein CRM-Gefühl`
    : `PERSONALISIERUNG: Kein Name bekannt — ohne persönliche Anrede`

  const context = [
    `Restaurant: ${businessName}`,
    description         && `Beschreibung: ${description}`,
    restaurantType      && `Typ: ${restaurantType}`,
    cuisineType         && `Küche: ${cuisineType}`,
    priceRange          && `Preisklasse: ${priceRange}`,
    signatureDishes     && `Spezialitäten: ${signatureDishes}`,
    uniqueSellingPoints && `Besonderheiten: ${uniqueSellingPoints}`,
    brandValues         && `Werte: ${brandValues}`,
    preferredPhrases    && `Bevorzugte Formulierungen: ${preferredPhrases}`,
    avoidPhrases        && `Verbotene Formulierungen: ${avoidPhrases}`,
    contactEmail        && `Kontakt-E-Mail: ${contactEmail}`,
  ].filter(Boolean).join('\n')

  if (mode === 'EMPTY_POSITIVE') {
    return `Du bist ein Response-Engine-System für das Restaurant "${businessName}".
Antworte auf Deutsch. Anredeform: ${duSie}

RESTAURANT-KONTEXT:
${context}

${nameRule}

BEWERTUNG: ${rating} Sterne — kein Text.

AUFGABE: 3 kurze herzliche Antworten (max. 2 Sätze). Keine Floskeln.
Alle drei enden mit: ${signature}

AUSGABE — NUR dieses JSON:
{"variant1":{"label":"Ruhig & klar","text":"..."},"variant2":{"label":"Warm & einladend","text":"..."},"variant3":{"label":"Atmosphärisch","text":"..."}}`
  }

  if (mode === 'EMPTY_NEGATIVE') {
    return `Du bist ein Response-Engine-System für das Restaurant "${businessName}".
Antworte auf Deutsch. Anredeform: ${duSie}

RESTAURANT-KONTEXT:
${context}

${nameRule}

BEWERTUNG: ${rating} Sterne — kein Text.

AUFGABE: 3 Antworten. Anerkennen + einladen sich zu melden. Ohne Druck.${contactEmail ? `\nKontakt: ${contactEmail}` : ''}
Max. 3 Sätze. Keine leeren Entschuldigungen.
NIEMALS mit 'Vielen Dank für deine/Ihre Bewertung' anfangen. NIEMALS Floskeln. Direkt und menschlich beginnen — z.B. 'Schade, dass...' oder 'Das tut uns leid...' aber niemals mit Dankesfloskeln.
Alle drei enden mit: ${signature}

AUSGABE — NUR dieses JSON:
{"variant1":{"label":"Ruhig & klar","text":"..."},"variant2":{"label":"Warm & einladend","text":"..."},"variant3":{"label":"Atmosphärisch","text":"..."}}`
  }

  return `Du bist ein Response-Engine-System für Hospitality-Bewertungen.
Antworte auf Deutsch. Anredeform: ${duSie}

---

RESTAURANT-KONTEXT (bindend):
${context}

---

${nameRule}

---

BEWERTUNG:
Sterne: ${rating} von 5
Text: "${reviewText}"

---

DEINE AUFGABE:

SCHRITT 1: ANALYSE
- Emotion: Frustration / Ärger / Enttäuschung / stille Enttäuschung / neutral-kritisch / positiv
- Problemtyp: operativ / Erwartung / Missverständnis / echter Fehler / kein Problem
- Spannungsniveau: Low / Medium / High

SCHRITT 2: ENTSCHEIDUNG
- Erklärlevel: 0 = keine Erklärung / 1 = 1 Satz Kontext / 2 = neutrale Systembeschreibung
- Reframing erlaubt? NUR wenn objektiver Kontext fehlt oder Missverständnis
- Verantwortung? NUR bei echtem Fehler

SCHRITT 3: 3 VARIANTEN
Alle drei: gleiche Bedeutung, gleiche Strategie — nur Ton und Rhythmus unterschiedlich.

VARIANTE A — Calm Professional
Ruhig, sachlich, präzise. Kein Name. Minimale Emotionalität.

VARIANTE B — Warm Hospitality
Menschlich, einladend, wärmer. Beginnt mit "Hallo ${firstName || '[Name]'}," wenn Name bekannt.

VARIANTE C — Reflective Elegant
Bedeutungsdicht, atmosphärisch, würdevoll. Beginnt mit "${firstName || '[Name]'}," wenn Name bekannt.

---

ABSOLUTE VERBOTE:
- NIEMALS: "Wir nehmen Ihr/dein Feedback ernst"
- NIEMALS: "Vielen Dank für Ihre/deine Bewertung"
- NIEMALS: "Wir bitten um Verständnis"
- Keine Rechtfertigungen, keine Überentschuldigungen
- Nicht mit dem Problem anfangen — erst den Menschen abholen

REFERENZTON:
- "Das haben wir selbst auch wahrgenommen." → ehrlich, ohne Drama
- "Wir setzen auf Qualität und Frische, das hat auch seinen Preis." → klar, mit Haltung
- "Als kleine Wiedergutmachung laden wir Sie herzlich ein." → warm, konkret

LORBEERBLATT-PRINZIP: Wenn etwas wie ein Problem aussieht aber ein Qualitätsmerkmal ist →
zeige die Bedeutung ohne zu rechtfertigen.

Alle drei enden mit: ${signature}

---

AUSGABE — NUR dieses JSON:
{
  "variant1": {"label": "Ruhig & klar", "text": "..."},
  "variant2": {"label": "Warm & einladend", "text": "..."},
  "variant3": {"label": "Atmosphärisch", "text": "..."}
}`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { review, settings } = req.body

  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert' })
  }

  const prompt = buildPrompt(
    review.reviewText || '',
    review.stars || 3,
    review.reviewerName || '',
    settings
  )

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      })
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(500).json({ error: 'Claude API Fehler', details: data })
    }

    const text = data.content?.[0]?.text || ''

    let jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const startIdx = jsonStr.indexOf('{')
    const endIdx = jsonStr.lastIndexOf('}')

    if (startIdx === -1 || endIdx === -1) {
      return res.status(500).json({ error: 'Kein JSON gefunden', raw: text })
    }

    jsonStr = jsonStr.substring(startIdx, endIdx + 1)
    const parsed = JSON.parse(jsonStr)

    const answers = [
      { label: parsed.variant1?.label || 'Ruhig & klar',     text: parsed.variant1?.text || '' },
      { label: parsed.variant2?.label || 'Warm & einladend', text: parsed.variant2?.text || '' },
      { label: parsed.variant3?.label || 'Atmosphärisch',    text: parsed.variant3?.text || '' },
    ]

    if (review.stars <= 2) {
      const contact = settings?.contactEmail || 'kontakt@restaurant.de'
      const meld = settings?.salutation === 'Du' ? 'Melde Dich' : 'Melden Sie sich'
      answers.push({
        label: '🔴 Persönliche Kontaktaufnahme',
        text: `Es tut uns leid von dieser Erfahrung zu hören. ${meld} direkt bei uns: ${contact}`
      })
    }

    return res.status(200).json({ success: true, answers })

  } catch (error) {
    return res.status(500).json({ error: 'Serverfehler', details: String(error) })
  }
}
