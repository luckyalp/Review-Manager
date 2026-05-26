import type { VercelRequest, VercelResponse } from '@vercel/node'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

// ============================================================
// KLASSIFIKATION
// ============================================================

function classify(rating: number, reviewText: string) {
  const wordCount = reviewText.trim().split(/\s+/).filter(Boolean).length
  const hasText = wordCount >= 8
  if (!hasText && rating >= 4) return 'EMPTY_POSITIVE'
  if (!hasText && rating <= 2) return 'EMPTY_NEGATIVE'
  if (rating >= 4) return 'CONTENT_POSITIVE'
  if (rating === 3) return 'CONTENT_MIXED'
  return 'CONTENT_NEGATIVE'
}

// ============================================================
// V2 ENGINE PROMPT
// ============================================================

function buildPrompt(reviewText: string, rating: number, settings: any): string {
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

BEWERTUNG: ${rating} Sterne — kein Text.

AUFGABE:
Erstelle 3 kurze Antworten (max. 2 Sätze) auf eine positive Bewertung ohne Text.
Natürlich, menschlich, keine Floskeln wie "Vielen Dank für Ihre Bewertung".
Alle drei enden mit: ${signature}

AUSGABE — NUR dieses JSON:
{"variant1":{"label":"Ruhig & klar","text":"..."},"variant2":{"label":"Warm & einladend","text":"..."},"variant3":{"label":"Atmosphärisch","text":"..."}}`
  }

  if (mode === 'EMPTY_NEGATIVE') {
    return `Du bist ein Response-Engine-System für das Restaurant "${businessName}".
Antworte auf Deutsch. Anredeform: ${duSie}

RESTAURANT-KONTEXT:
${context}

BEWERTUNG: ${rating} Sterne — kein Text.

AUFGABE:
Erstelle 3 kurze Antworten. Anerkenne dass etwas nicht gestimmt hat.
Lade den Gast ein sich zu melden — ohne Druck.${contactEmail ? `\nKontakt: ${contactEmail}` : ''}
Max. 3 Sätze. Keine leeren Entschuldigungen.
Alle drei enden mit: ${signature}

AUSGABE — NUR dieses JSON:
{"variant1":{"label":"Ruhig & klar","text":"..."},"variant2":{"label":"Warm & einladend","text":"..."},"variant3":{"label":"Atmosphärisch","text":"..."}}`
  }

  return `Du bist ein Response-Engine-System für Hospitality-Bewertungen.
Deine Aufgabe ist nicht, Texte zu schreiben, sondern aus einem Input-System drei fertige Antwortvarianten zu generieren.
Antworte auf Deutsch. Anredeform: ${duSie}

---

RESTAURANT-KONTEXT (bindend):
${context}

---

BEWERTUNG:
Sterne: ${rating} von 5
Text: "${reviewText}"

---

DEINE AUFGABE — führe diese 3 Schritte aus:

SCHRITT 1: ANALYSE
- Emotion des Gastes erkennen (Frustration / Ärger / Enttäuschung / stille Enttäuschung / neutral-kritisch / positiv)
- Art des Problems bestimmen (operativ / Erwartung / Missverständnis / echter Fehler / kein Problem)
- Spannungsniveau: Low / Medium / High

SCHRITT 2: ENTSCHEIDUNG
- Erklärlevel festlegen:
  0 = keine Erklärung nötig
  1 = 1 Satz Kontext
  2 = klare neutrale Systembeschreibung
- Ist Reframing erlaubt? (NUR wenn objektiver Kontext fehlt oder Missverständnis vorliegt)
- Verantwortung übernehmen? (NUR bei echtem Fehler)

SCHRITT 3: 3 VARIANTEN ERZEUGEN
Alle drei Varianten:
- enthalten DENSELBEN Inhalt (gleiche Bedeutung, gleiche Strategie)
- unterscheiden sich NUR in Ton, Rhythmus und Sprachstil
- fügen KEINE neuen Informationen hinzu

VARIANTE A — Calm Professional
Ruhig, sachlich, präzise, souverän. Minimale Emotionalität.

VARIANTE B — Warm Hospitality
Menschlich, einladend, leicht wärmer, weichere Sprache.

VARIANTE C — Reflective Elegant
Ruhig-intelligent, höhere Bedeutungsdichte, atmosphärisch, würdevoll.
Mehr Wahrnehmung und implizite Bedeutung pro Satz — nicht mehr Emotion.

---

ABSOLUTE VERBOTE:
- NIEMALS: "Wir nehmen Ihr/dein Feedback ernst"
- NIEMALS: "Vielen Dank für Ihre/deine Bewertung"
- NIEMALS: "Wir bitten um Verständnis"
- NIEMALS: "Das ist uns eine Herzensangelegenheit"
- Keine Rechtfertigungen
- Keine Überentschuldigungen
- Keine defensiven Formulierungen
- Nicht mit dem Problem anfangen — erst den Menschen abholen

REFERENZTON (echte Antworten von Henry's Sandbar):
- "Ich glaube du hast das Restaurant verwechselt. Wir sind in der 1. Etage 🙈" → leicht, menschlich
- "Das haben wir selbst auch wahrgenommen." → ehrlich, ohne Drama
- "Wir setzen auf Qualität und Frische, das hat auch seinen Preis." → klar, mit Haltung

LORBEERBLATT-PRINZIP:
Wenn etwas wie ein Problem aussieht aber eigentlich ein Qualitätsmerkmal ist →
zeige die Bedeutung dahinter ohne zu rechtfertigen.

Alle drei Varianten enden mit: ${signature}

---

AUSGABE — NUR dieses JSON, kein Text davor oder danach:
{
  "variant1": {"label": "Ruhig & klar", "text": "..."},
  "variant2": {"label": "Warm & einladend", "text": "..."},
  "variant3": {"label": "Atmosphärisch", "text": "..."}
}`
}

// ============================================================
// HAUPTFUNKTION
// ============================================================

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
