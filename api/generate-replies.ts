import type { VercelRequest, VercelResponse } from '@vercel/node'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

// ============================================================
// KLASSIFIKATION
// Entscheidet welcher Modus aktiviert wird
// ============================================================

function classify(rating: number, reviewText: string): {
  mode: 'EMPTY_POSITIVE' | 'EMPTY_NEGATIVE' | 'CONTENT_POSITIVE' | 'CONTENT_MIXED' | 'CONTENT_NEGATIVE'
  hasText: boolean
  wordCount: number
} {
  const wordCount = reviewText.trim().split(/\s+/).filter(Boolean).length
  const hasText = wordCount >= 8

  if (!hasText && rating >= 4) return { mode: 'EMPTY_POSITIVE', hasText, wordCount }
  if (!hasText && rating <= 2) return { mode: 'EMPTY_NEGATIVE', hasText, wordCount }
  if (rating >= 4) return { mode: 'CONTENT_POSITIVE', hasText, wordCount }
  if (rating === 3) return { mode: 'CONTENT_MIXED', hasText, wordCount }
  return { mode: 'CONTENT_NEGATIVE', hasText, wordCount }
}

// ============================================================
// PROMPT BUILDER
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
    targetAudience = '',
    foundedYear = '',
    signatureDishes = '',
    dietaryOptions = '',
  } = settings || {}

  const duSie = salutation === 'Du' ? 'Du/Dein (Duzen)' : 'Sie/Ihr (Siezen)'
  const signature = responseSignature || `Das Team von ${businessName}`
  const { mode } = classify(rating, reviewText)

  const profileBlock = [
    `Restaurant: ${businessName}`,
    description         && `Beschreibung: ${description}`,
    restaurantType      && `Typ: ${restaurantType}`,
    cuisineType         && `Küche: ${cuisineType}`,
    priceRange          && `Preisklasse: ${priceRange}`,
    targetAudience      && `Zielgruppe: ${targetAudience}`,
    foundedYear         && `Gegründet: ${foundedYear}`,
    signatureDishes     && `Spezialitäten: ${signatureDishes}`,
    dietaryOptions      && `Ernährungsoptionen: ${dietaryOptions}`,
    uniqueSellingPoints && `Besonderheiten: ${uniqueSellingPoints}`,
    brandValues         && `Werte: ${brandValues}`,
    preferredPhrases    && `Bevorzugte Formulierungen: ${preferredPhrases}`,
    avoidPhrases        && `Verbotene Formulierungen: ${avoidPhrases}`,
    contactEmail        && `Kontakt: ${contactEmail}`,
  ].filter(Boolean).join('\n')

  // -------------------------------------------------------
  // TON-REGEL (gilt für alle Modi)
  // Atlas-Prinzip: ruhig, direkt, verlässlich
  // -------------------------------------------------------
  const tonRegel = `
## TON-REGEL (immer gültig)

Schreibe wie jemand der weiß was passiert ist, es ernst nimmt, und bereits weiß was als nächstes passiert.
Ruhig. Direkt. Verlässlich. Nicht kalt, nicht überschwänglich. Einfach da.

NIEMALS diese Sätze:
- "Wir nehmen Ihr/dein Feedback ernst"
- "Vielen Dank für Ihre/deine Bewertung"  
- "Wir bitten um Verständnis"
- "Wir bedauern sehr"
- "Das ist uns eine Herzensangelegenheit"
- "Wir arbeiten ständig daran"

Kein Marketington. Keine künstliche Emotion. Keine Entschuldigungs-Kaskaden.
Anredeform: ${duSie}
Signatur: ${signature}
`

  // -------------------------------------------------------
  // MODUS: EMPTY POSITIVE (4-5 Sterne, kein Text)
  // -------------------------------------------------------
  if (mode === 'EMPTY_POSITIVE') {
    return `
Du schreibst eine kurze Antwort auf eine positive Bewertung ohne Text.
Antworte auf Deutsch.
${tonRegel}

## RESTAURANT-PROFIL
${profileBlock}

## AUFGABE
${rating} Sterne, kein Text.
Schreibe 3 kurze Antworten. Maximal 2 Sätze je Antwort.
Kurz, echt, direkt. Kein "Vielen Dank für Ihre Bewertung".

## AUSGABE — NUR dieses JSON, kein Text davor oder danach:
{
  "variant1": { "label": "Kurz & herzlich", "text": "..." },
  "variant2": { "label": "Kurz & herzlich", "text": "..." },
  "variant3": { "label": "Kurz & herzlich", "text": "..." }
}

Bewertung: ${rating} Sterne, kein Text.
`
  }

  // -------------------------------------------------------
  // MODUS: EMPTY NEGATIVE (1-2 Sterne, kein Text)
  // -------------------------------------------------------
  if (mode === 'EMPTY_NEGATIVE') {
    return `
Du schreibst eine Antwort auf eine negative Bewertung ohne Text.
Antworte auf Deutsch.
${tonRegel}

## RESTAURANT-PROFIL
${profileBlock}

## AUFGABE
${rating} Sterne, kein Text.
Schreibe 3 Antworten die:
- Anerkennen dass etwas nicht gestimmt hat
- Einladen sich zu melden — ohne Druck
- Ruhig und direkt bleiben
${contactEmail ? `- Kontakt erwähnen: ${contactEmail}` : ''}
Maximal 3 Sätze. Kein Kriechen.

## AUSGABE — NUR dieses JSON, kein Text davor oder danach:
{
  "variant1": { "label": "Einladend & ruhig", "text": "..." },
  "variant2": { "label": "Einladend & ruhig", "text": "..." },
  "variant3": { "label": "Einladend & ruhig", "text": "..." }
}

Bewertung: ${rating} Sterne, kein Text.
`
  }

  // -------------------------------------------------------
  // MODI MIT TEXT: POSITIVE / MIXED / NEGATIVE
  // -------------------------------------------------------

  let aufgabe = ''

  if (mode === 'CONTENT_POSITIVE') {
    aufgabe = `
## AUFGABE
Positive Bewertung. Fokus auf Bestätigung + Einladung.

STRUKTUR:
1. Name ansprechen (wenn bekannt)
2. Konkretes Lob aufnehmen — exakt was der Gast positiv erwähnt hat
3. Kurzer Dank + Einladung wiederzukommen

KEIN Wiederholen von Problemen. KEIN übertriebener Dank.
`
  }

  if (mode === 'CONTENT_MIXED') {
    aufgabe = `
## AUFGABE
Gemischte Bewertung (3 Sterne). Balance zwischen Problem und Positivem.

STRUKTUR — IMMER in dieser Reihenfolge:
1. Name ansprechen (wenn bekannt)
2. Problem spiegeln — neutral formuliert, nie als Beschwerde wiederholen
   Beispiel: nicht "Sie mussten warten" sondern "Wenn es zu einer Wartezeit kommt"
3. Positives aufnehmen
4. Kurze ruhige Einordnung (nur wenn ein konkreter Kontext existiert)

WICHTIG: Erst Erlebnis, dann Einordnung — nie umgekehrt.
`
  }

  if (mode === 'CONTENT_NEGATIVE') {
    aufgabe = `
## AUFGABE
Negative Bewertung (1-2 Sterne). Deeskalation + Einladung zur direkten Kontaktaufnahme.

STRUKTUR:
1. Name ansprechen (wenn bekannt)  
2. Das Erlebte kurz anerkennen — OHNE die Fehler aufzulisten
   Nicht: "Eine Stunde warten, falsches Essen, unhöfliches Personal"
   Sondern: einen Satz der zeigt dass verstanden wurde was passiert ist
3. Klare Haltung: das entspricht nicht unserem Anspruch
4. Einladung sich zu melden
${contactEmail ? `   Kontakt: ${contactEmail}` : ''}

VERBOTEN:
- Fehler aufzählen (der Gast weiß was passiert ist)
- Endlose Entschuldigungen
- Defensive Erklärungen
- "Das war kein guter Abend" (zu weich)
- "Komplettes Versagen" (zu dramatisch)
`
  }

  return `
Du schreibst 3 verschiedene Antworten auf eine Google-Bewertung für "${businessName}".
Antworte auf Deutsch.
${tonRegel}

## RESTAURANT-PROFIL
${profileBlock}

${aufgabe}

## DIE 3 VARIANTEN

Alle drei basieren auf derselben Analyse.
Sie unterscheiden sich NUR in Haltung und Länge:

VARIANTE 1 — Nah & direkt
Klingt wie der Besitzer persönlich. Maximal 3 Sätze.

VARIANTE 2 — Ruhig & professionell  
Klar, respektvoll, verlässlich. Maximal 3 Sätze.

VARIANTE 3 — Kurz & klar
2 Sätze. Nicht mehr.

Alle drei enden mit: ${signature}

## QUALITÄTSCHECK
Vor jeder Variante fragen:
- Würde der Gast denken "die haben verstanden was passiert ist"?
- Klingt es wie ein Mensch oder wie eine Vorlage?
- Gibt es ein Wort das gestrichen werden kann? → Streichen.

## AUSGABE — NUR dieses JSON, kein Text davor oder danach:
{
  "variant1": { "label": "Nah & direkt", "text": "..." },
  "variant2": { "label": "Ruhig & professionell", "text": "..." },
  "variant3": { "label": "Kurz & klar", "text": "..." }
}

## DIE BEWERTUNG
Sterne: ${rating} von 5
Text: "${reviewText}"
`
}

// ============================================================
// HAUPTFUNKTION
// ============================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { review, settings } = req.body

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY nicht konfiguriert' })
  }

  const prompt = buildPrompt(
    review.reviewText || '',
    review.stars || 3,
    settings
  )

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2000 }
        })
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return res.status(500).json({ error: 'Gemini API Fehler', details: data })
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    let jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const startIdx = jsonStr.indexOf('{')
    const endIdx = jsonStr.lastIndexOf('}')

    if (startIdx === -1 || endIdx === -1) {
      return res.status(500).json({ error: 'Kein JSON gefunden', raw: text })
    }

    jsonStr = jsonStr.substring(startIdx, endIdx + 1)
    const parsed = JSON.parse(jsonStr)

    const answers = [
      { label: parsed.variant1?.label || 'Nah & direkt',          text: parsed.variant1?.text || '' },
      { label: parsed.variant2?.label || 'Ruhig & professionell', text: parsed.variant2?.text || '' },
      { label: parsed.variant3?.label || 'Kurz & klar',           text: parsed.variant3?.text || '' },
    ]

    // 4. Variante bei 1-2 Sternen
    if (review.stars <= 2) {
      const contactEmail = settings?.contactEmail || 'kontakt@restaurant.de'
      const duSie = settings?.salutation === 'Du' ? 'Dich' : 'Sie sich'
      answers.push({
        label: '🔴 Persönliche Kontaktaufnahme',
        text: `Es tut uns leid von dieser Erfahrung zu hören. Bitte melde${settings?.salutation === 'Du' ? ' Dich' : 'n Sie sich'} direkt bei uns: ${contactEmail}`
      })
    }

    return res.status(200).json({ success: true, answers })

  } catch (error) {
    return res.status(500).json({ error: 'Serverfehler', details: String(error) })
  }
}
