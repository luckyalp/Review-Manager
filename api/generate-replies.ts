import type { VercelRequest, VercelResponse } from '@vercel/node'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

// ============================================================
// MODUS-ERKENNUNG
// ============================================================

function detectMode(rating: number, reviewText: string): 'POSITIVE_NO_TEXT' | 'RECOVERY_NO_TEXT' | 'STANDARD' {
  const wordCount = reviewText.trim().split(/\s+/).filter(Boolean).length
  const hasText = wordCount >= 10

  if (!hasText && rating >= 4) return 'POSITIVE_NO_TEXT'
  if (!hasText && rating <= 2) return 'RECOVERY_NO_TEXT'
  if (!hasText && rating <= 2 && wordCount < 10) return 'RECOVERY_NO_TEXT'

  return 'STANDARD'
}

// ============================================================
// PROMPT BUILDER — Voice of Ton
// ============================================================

function buildPrompt(
  reviewText: string,
  rating: number,
  settings: any
): string {
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
  const mode = detectMode(rating, reviewText)

  // Restaurantprofil Block
  const profileBlock = [
    `Name: ${businessName}`,
    description        && `Beschreibung: ${description}`,
    restaurantType     && `Typ: ${restaurantType}`,
    cuisineType        && `Küche: ${cuisineType}`,
    priceRange         && `Preisklasse: ${priceRange}`,
    targetAudience     && `Zielgruppe: ${targetAudience}`,
    foundedYear        && `Gegründet: ${foundedYear}`,
    signatureDishes    && `Signature-Gerichte: ${signatureDishes}`,
    dietaryOptions     && `Ernährungsoptionen: ${dietaryOptions}`,
    uniqueSellingPoints && `Was uns besonders macht: ${uniqueSellingPoints}`,
    brandValues        && `Unsere Werte: ${brandValues}`,
    preferredPhrases   && `Bevorzugte Formulierungen: ${preferredPhrases}`,
    avoidPhrases       && `Zu vermeidende Formulierungen: ${avoidPhrases}`,
    contactEmail       && `Kontakt-E-Mail: ${contactEmail}`,
  ].filter(Boolean).join('\n')

  // -------------------------------------------------------
  // MODUS A: Positiv, kein Text
  // -------------------------------------------------------
  if (mode === 'POSITIVE_NO_TEXT') {
    return `
Du schreibst eine kurze Antwort auf eine positive Google-Bewertung ohne Text für das Restaurant "${businessName}".
Antworte auf Deutsch. Verwende: ${duSie}

## RESTAURANT-PROFIL
${profileBlock}

## AUFGABE
Der Gast hat ${rating} Sterne gegeben aber nichts geschrieben.
Schreibe 3 kurze, herzliche Antworten. Maximal 2-3 Sätze je Antwort.
Kein "Vielen Dank für Ihr wertvolles Feedback". Kein Korporativ-Sprech.
Menschlich, direkt, warm. Wie jemand der sich wirklich freut.
Jede Antwort endet mit: ${signature}

## AUSGABE-FORMAT
Antworte NUR mit diesem JSON — kein Text davor oder danach:

{
  "variant1": { "label": "Kurz & herzlich", "text": "..." },
  "variant2": { "label": "Kurz & herzlich", "text": "..." },
  "variant3": { "label": "Kurz & herzlich", "text": "..." }
}

## DIE BEWERTUNG
Sterne: ${rating} von 5
Bewertungstext: (kein Text)
`
  }

  // -------------------------------------------------------
  // MODUS B: Negativ, kein oder kaum Text
  // -------------------------------------------------------
  if (mode === 'RECOVERY_NO_TEXT') {
    return `
Du schreibst eine Recovery-Antwort auf eine negative Google-Bewertung ohne ausreichenden Text für das Restaurant "${businessName}".
Antworte auf Deutsch. Verwende: ${duSie}

## RESTAURANT-PROFIL
${profileBlock}

## AUFGABE
Der Gast hat ${rating} Sterne gegeben aber kaum oder nichts geschrieben.
Schreibe 3 Antworten die:
- Anerkennen dass etwas nicht gestimmt hat
- Ehrlich sagen dass wir gerne mehr wüssten
- Den Gast einladen sich direkt zu melden — ohne Druck
- Ruhig, menschlich, ohne Drama bleiben
${contactEmail ? `- Kontakt erwähnen: ${contactEmail}` : ''}

Maximal 3-4 Sätze. Kein Kriechen. Keine leeren Entschuldigungen.
Jede Antwort endet mit: ${signature}

VERBOTEN: Diskussion, Rechtfertigung, "Wir nehmen Feedback ernst", Bitte um Löschung.

## AUSGABE-FORMAT
Antworte NUR mit diesem JSON — kein Text davor oder danach:

{
  "variant1": { "label": "Einladend & ruhig", "text": "..." },
  "variant2": { "label": "Einladend & ruhig", "text": "..." },
  "variant3": { "label": "Einladend & ruhig", "text": "..." }
}

## DIE BEWERTUNG
Sterne: ${rating} von 5
Bewertungstext: "${reviewText || '(kein Text)'}"
`
  }

  // -------------------------------------------------------
  // MODUS C: Standard — volles Voice of Ton System
  // -------------------------------------------------------
  return `
Du bist ein Kommunikationsexperte für das Restaurant "${businessName}".
Deine Aufgabe: Schreibe 3 unterschiedliche Antworten auf eine Google-Bewertung.
Antworte ausschließlich auf Deutsch.
Verwende durchgehend die Anredeform: ${duSie}

---

## RESTAURANT-PROFIL
${profileBlock}

---

## KERN-PHILOSOPHIE

Der Gast der sich die Mühe macht eine Bewertung zu schreiben sucht eines: gehört werden.

Das einzige Ziel einer Antwort ist es, Gefühle zu verändern — nicht Fakten zu korrigieren.

Jede Antwort folgt diesem Weg:
Empathie → Verbindung → Vertrauen

Wichtig: Antworten wirken nicht nur auf den ursprünglichen Reviewer.
Sie wirken auf Mitleser, zukünftige Gäste, die soziale Wahrnehmung des Restaurants.
Schreibe immer für beide.

---

## SCHRITT 1: BEWERTUNG ANALYSIEREN

Erkenne die Emotion hinter der Bewertung:
- Frustration (Ablauf, Service, Wartezeit)
- Ärger (echter Fehler, Grenzüberschreitung)
- Enttäuschung (Erwartung nicht erfüllt)
- Unsicherheit (Missverständnis, unvollständige Info)
- Stille Enttäuschung (höflich, kein Drama — aber Rückzug, hohes Abwanderungsrisiko)
- Neutral-kritisch (sachlich, keine Emotion)
- Positiv (Lob, Begeisterung)

Risiko-Level:
- Low Risk → kleine Irritation, keine Eskalation
- Medium Risk → klarer Fehler + Emotion
- High Risk → aggressive Sprache, persönliche Angriffe

---

## SCHRITT 2: DAS RICHTIGE MUSTER WÄHLEN

### Muster 1 — Mirror → Validate → Contain
Für: Frustration, operative Probleme, Wartezeit, Service

### Muster 2 — Mirror → Context Expansion → Stabilize
Für: Missverständnisse, unvollständige Wahrnehmung
Wichtig: Nie "Du hast es falsch verstanden" — neue Perspektive hinzufügen

### Muster 3 — Mirror → Responsibility Absorption → Repair Orientation
Für: Echte Fehler, Qualitätsprobleme, berechtigte Kritik

### Muster 4 — Mirror → Reframing of Meaning → Identity Signal
Für: Dinge die Qualitätsmerkmale sind, keine Fehler
⚠️ NUR wenn das Reframing objektiv wahr ist

Referenzbeispiel:
Bewertung: "Das Brisket war super — aber ich fand ein BLATT in meinen Baked Beans."
Antwort: "Das war ein Lorbeerblatt — ein Zeichen dafür, dass jemand Zeit und Mühe investiert hat, das Essen frisch zu kochen. Wir verwenden nie Dosenware. Es tut mir leid, dass es dich überrascht hat."

### Muster 5 — Mirror → De-escalation → Closure
Für: Aggressive Bewertungen, emotionale Überreaktionen

---

## SCHRITT 3: MIRROR-TIEFE

Level 1 — schwach, vermeiden: "Wir verstehen Ihre Frustration."
Level 2 — mittel: "Sie mussten lange warten."
Level 3 — stark, anstreben: "Sie kamen für einen entspannten Abend und haben stattdessen etwas erlebt, das sich nicht wie Willkommen angefühlt hat."

→ Je stärker die Emotion, desto tiefer der Mirror.

---

## SCHRITT 4: REFRAMING-CHECK

Erlaubt: objektiver Kontext fehlt / Missverständnis / erklärbare Logik existiert
Verboten: reine subjektive Erfahrung / keine Zusatzinfo / Gefahr valide Wahrnehmung umzudeuten

---

## SCHRITT 5: TON & STIL

Natürlichkeit ist das oberste Gebot.
Kein "Sehr geehrter Herr/Frau", kein "Vielen Dank für Ihr wertvolles Feedback".
Wie ein Mensch schreibt der wirklich da ist.

Humor erlaubt als Haltung — nie bei echter Enttäuschung oder echtem Fehler.

Referenzstil:
- "Ich glaube du hast das Restaurant verwechselt. Wir sind in der 1. Etage 🙈" → leicht, menschlich
- "Das haben wir selbst auch wahrgenommen." → ehrlich, ohne Drama
- "Wir setzen auf Qualität und Frische, das hat auch seinen Preis." → klar, mit Haltung

DIESE EXAKTEN SÄTZE SIND ABSOLUT VERBOTEN — NIEMALS VERWENDEN:
- "nehmen wir sehr ernst"
- "nehmen wir ernst"
- "ist uns wichtig"
- "Wir nehmen Ihr/dein Feedback ernst"
- "Vielen Dank für Ihr/dein Feedback"
- "Vielen Dank für Ihre/deine Bewertung"
- "Wir nehmen das zur Kenntnis"
- "Das ist uns eine Herzensangelegenheit"
- "Wir arbeiten ständig daran"
- "Wir werden das intern prüfen"

Wenn du einen dieser Sätze schreiben willst — stopp. Schreib stattdessen was konkret passiert oder was konkret gefühlt wird.

Außerdem verboten:
- Unterwürfigkeit, endlose Entschuldigungen
- Defensivität, Rechtfertigung
- Das Wort "eigentlich"
- Annahmen über den Gast die nicht in der Bewertung stehen

---

## SCHRITT 6: DIE 3 VARIANTEN

VARIANTE 1 — Nah & persönlich
Klingt wie der Besitzer selbst. Echte Emotion, direkte Verbindung.
MAXIMAL 4 SÄTZE. Nicht mehr.

VARIANTE 2 — Freundlich & professionell
Warm aber nicht intim. Respektvoll, klar, menschlich.
MAXIMAL 4 SÄTZE. Nicht mehr.

VARIANTE 3 — Klar & knapp
MAXIMAL 3 SÄTZE. Kein Wort zu viel.

Alle drei enden mit: ${signature}

---

## QUALITÄTSCHECK

- Würde der Gast denken: "Die haben mich wirklich gehört"?
- Würde ein Mitleser denken: "Da gehe ich hin"?
- Klingt es wie ein Mensch oder wie eine Vorlage?
- Gibt es ein Wort das ich streichen könnte ohne Verlust? → Streichen.

---

## AUSGABE-FORMAT

Antworte NUR mit diesem JSON — kein Text davor oder danach:

{
  "variant1": { "label": "Nah & persönlich", "text": "..." },
  "variant2": { "label": "Freundlich & professionell", "text": "..." },
  "variant3": { "label": "Klar & knapp", "text": "..." }
}

---

## DIE BEWERTUNG

Sterne: ${rating} von 5
Bewertungstext: "${reviewText}"
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
    const startIdx = jsonStr.indexOf('{')
    const endIdx = jsonStr.lastIndexOf('}')

    if (startIdx === -1 || endIdx === -1) {
      return res.status(500).json({ error: 'Kein JSON gefunden', raw: text })
    }

    jsonStr = jsonStr.substring(startIdx, endIdx + 1)
    const parsed = JSON.parse(jsonStr)

    // In Array-Format umwandeln das die App erwartet
    const answers = [
      { label: parsed.variant1?.label || '💬 Nah & persönlich',        text: parsed.variant1?.text || '' },
      { label: parsed.variant2?.label || '👔 Freundlich & professionell', text: parsed.variant2?.text || '' },
      { label: parsed.variant3?.label || '⚡ Klar & knapp',             text: parsed.variant3?.text || '' },
    ]

    return res.status(200).json({ success: true, answers })

  } catch (error) {
    return res.status(500).json({ error: 'Serverfehler', details: String(error) })
  }
}
