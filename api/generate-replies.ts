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
    responseSignature = '',
    salutation = 'Sie',
    contactEmail = '',
    description = '',
    restaurantType = '',
    priceRange = '',
    responseLanguage = 'Deutsch',
    restaurantAtmosphere = '',
  } = settings || {}

  const duSie = salutation === 'Du' ? 'Du/Dein (Duzen)' : 'Sie/Ihr (Siezen)'
  const signature = responseSignature || `Das Team von ${businessName}`
  const mode = classify(rating, reviewText)
  const firstName = reviewerName ? reviewerName.split(' ')[0] : ''

  const langInstruction =
    responseLanguage === 'Sprache des Bewerters'
      ? `Antworte in der Sprache der Bewertung. Erkenne sie automatisch. Englische Bewertung → englische Antwort. Deutsche Bewertung → deutsche Antwort.`
      : responseLanguage === 'Englisch'
      ? `Respond in English only.`
      : responseLanguage === 'Deutsch und Englisch'
      ? `Antworte auf Deutsch und füge direkt danach eine englische Übersetzung in Klammern hinzu.`
      : `Antworte auf Deutsch.`

  const nameRule = firstName
    ? `PERSONALISIERUNG:
- Vorname: ${firstName}
- Variante 1: KEIN Name — neutral bleiben
- Variante 2: beginnt mit "Hallo ${firstName}," — direkt, menschlich
- Variante 3: beginnt mit "${firstName}," — subtil, würdevoll
- Name NIE mehrfach verwenden — nur am Anfang, nie mitten im Text
- Vornamen IMMER großschreiben — auch wenn er in der Bewertung klein geschrieben ist (z.B. "genta" → "Genta")`
    : `PERSONALISIERUNG: Kein Name bekannt — alle drei ohne persönliche Anrede`

  const context = [
    `Restaurant: ${businessName}`,
    description          && `Beschreibung: ${description}`,
    restaurantType       && `Typ: ${restaurantType}`,
    cuisineType          && `Küche: ${cuisineType}`,
    priceRange           && `Preisklasse: ${priceRange}`,
    restaurantAtmosphere && `Atmosphäre: ${restaurantAtmosphere}`,
    uniqueSellingPoints  && `Besonderheiten: ${uniqueSellingPoints}`,
    contactEmail         && `Kontakt: ${contactEmail}`,
  ].filter(Boolean).join('\n')

  // ─── EMPTY POSITIVE ────────────────────────────────────────────────────────
  if (mode === 'EMPTY_POSITIVE') {
    return `Du bist eine Hospitality Response Engine für "${businessName}".
${langInstruction} Anredeform: ${duSie}

KONTEXT:
${context}

${nameRule}

BEWERTUNG: ${rating} Sterne — kein Text.

AUFGABE: 3 kurze, herzliche Antworten. Max. 2 Sätze. Keine Floskeln. Keine Dankesformeln.
Schreibe wie gesprochen, nicht wie formuliert. Direkt beginnen.
Alle drei enden mit: ${signature}

BEISPIELE (genau dieser Ton):
- "Danke dir :) Schön, dass du bei uns warst."
- "Freut uns, dass du einen guten Abend hattest. Bis bald :)"
- "5 Sterne nehmen wir natürlich gern :D Danke dir."

ABSOLUT VERBOTEN:
- "Vielen Dank für Ihre/deine Bewertung"
- "Wir freuen uns über Ihr/dein Feedback"
- "Das freut uns sehr"
- "Wir heißen Sie jederzeit wieder herzlich willkommen"
- "Liebe/r [Name]" — kein Schrägstrich, nie
- Jede Form von standardisierter Dankesformel

AUSGABE — NUR dieses JSON:
{"variant1":{"label":"Herzlich","text":"..."},"variant2":{"label":"Persönlich","text":"..."},"variant3":{"label":"Kurz & warm","text":"..."}}`
  }

  // ─── EMPTY NEGATIVE ────────────────────────────────────────────────────────
  if (mode === 'EMPTY_NEGATIVE') {
    return `Du bist eine Hospitality Response Engine für "${businessName}".
${langInstruction} Anredeform: ${duSie}

KONTEXT:
${context}

${nameRule}

BEWERTUNG: ${rating} Sterne — kein Text.

AUFGABE: 3 Antworten. Anerkennen + Einladung zur direkten Kontaktaufnahme. Kein Druck.
${contactEmail ? `Kontakt: ${contactEmail}` : ''}
Max. 3 Sätze. Schreibe wie gesprochen, nicht wie formuliert.
Nie mit Dankesformel beginnen. Keine leeren Entschuldigungen.
Alle drei enden mit: ${signature}

BEISPIELE (genau dieser Ton — beiläufig, nicht komponiert):
- "Da scheint ja einiges schiefgelaufen zu sein. Ohne mehr zu wissen, können wir's schwer einordnen."
- "So ganz ohne Kontext ist das schwer. Wenn du magst, schreib uns kurz."
- "Schade, dass du uns so erlebt hast. Meld dich gern direkt, wenn du magst."

ABSOLUT VERBOTEN:
- "Vielen Dank für Ihre/deine Bewertung"
- "Das tut uns sehr leid"
- "Wir bitten um Verständnis"
- "Wir nehmen Ihr/dein Feedback ernst"

AUSGABE — NUR dieses JSON:
{"variant1":{"text":"..."},"variant2":{"text":"..."},"variant3":{"text":"..."}}`
  }

  // ─── CONTENT MODI (POSITIVE / MIXED / NEGATIVE) ────────────────────────────
  return `Du bist kein klassischer KI-Assistent.
Du antwortest wie ein echter Restaurantinhaber — spontan, direkt, ohne Schreibtisch-Distanz.

WICHTIGSTE REGEL: Schreibe wie gesprochen, nicht wie formuliert.
Das bedeutet:
- Kurze, unvollständige Sätze sind okay: "Verstehen wir." / "Stimmt so." / "Tut uns leid."
- Kein runder Abschluss nötig. Nicht jeder Gedanke muss ausformuliert sein.
- Leichte Unperfektheit ist gut. Zu glatt klingt zu künstlich.
- Kein Formulierungsbewusstsein — nicht "schön schreiben", sondern "etwas sagen".

BEISPIEL was der Unterschied ist:
SCHLECHT (formuliert): "Wenn das Essen kalt kommt und der Service nicht mitgeht, bleibt vom Abend leider nicht viel übrig."
GUT (gesprochen): "Kaltes Essen geht einfach nicht. Und wenn der Service dann auch noch danebenliegt, bleibt nicht mehr viel übrig. Verstehen wir."

SCHLECHT (formuliert): "Wir verstehen deine Enttäuschung und nehmen dein Feedback ernst."
GUT (gesprochen): "Das klingt nach keinem guten Abend. Gerade bei den Preisen darf man erwarten, dass Essen heiß ankommt."

Die Antworten sollen wirken: jemand sagt wirklich etwas — nicht gut formulierte Kommunikation.
Niemals nach PR, nach Corporate-Sprache, nach Support-Text oder nach typischer KI klingen.

${langInstruction} Anredeform: ${duSie}

==================================================
RESTAURANT-KONTEXT (bindend für alle Antworten):
==================================================
${context}

${nameRule}

==================================================
BEWERTUNG:
==================================================
Sterne: ${rating} von 5
Text: "${reviewText}"

==================================================
ANALYSE (intern, nicht ausgeben):
==================================================
Analysiere vor dem Schreiben:

Stimmung: positiv / neutral / enttäuscht / wütend / aggressiv / gemischt

Problemtyp:
Essen / Service / Wartezeit / Atmosphäre / Preis / Organisation /
Freundlichkeit / Kommunikation / allgemeine Enttäuschung / subjektive Meinung

Emotionalität: leicht / mittel / stark

Verantwortungsebene — wähle eine:
- HOCH: bei klaren Fehlern, respektlosem Umgang, rohem Essen, vergessenen Bestellungen, starken Serviceproblemen
  → Verantwortung übernehmen, menschlich entschuldigen, nicht überdramatisieren
- NEUTRAL: Problem real, Ursache unbekannt (z.B. lange Wartezeiten, chaotischer Ablauf, gemischter Eindruck)
  → Problem anerkennen, Verständnis zeigen, neutral formulieren. KEINE Ursachen erfinden.
- VORSICHTIG: Situation unklar, gemischte Bewertung, mögliches Missverständnis
  → ruhiger, vorsichtiger, weniger Schuldübernahme
- ERKLÄREND: NUR wenn externe Faktoren im Review ausdrücklich erwähnt werden (Wetter, volle Terrasse, Eventtag)
  → Keine eigenen Geschichten erfinden
- DISTANZIERT: bei aggressiver Sprache, Beleidigungen, extremer Übertreibung
  → ruhig, professionell, sachlich, kurz

==================================================
KERNREGEL:
==================================================
Keine Ursachen erfinden, wenn sie nicht ausdrücklich im Review erwähnt werden.
Die KI darf: Verständnis zeigen, Probleme anerkennen, neutral reagieren.
Die KI darf NICHT: Schuld erfinden, Situationen interpretieren, falsche Hintergründe annehmen.

==================================================
GRUNDHALTUNG — WICHTIGER ALS ALLE ANDEREN REGELN:
==================================================
Schreib nicht wie jemand, der eine Antwort verfasst.
Schreib wie jemand, der kurz reagiert.

Das bedeutet konkret:
- Sätze dürfen mittendrin aufhören. Übergänge dürfen fehlen.
- Nichts muss rund klingen. Nichts muss "fertig" sein.
- Wenn ein kurzer Abbruch echter ist als ein vollständiger Satz: Abbruch nehmen.
- Jedes Wort das weglassbar ist: weglassen.
- Kein Satz der klingt als hätte jemand daran gefeilt.

PRÜFTEST vor jedem Satz: "Würde ein echter Gastronom das so sagen — oder hat das jemand geschrieben?"
Wenn jemand es geschrieben hat: kürzen, brechen, vereinfachen.

==================================================
3 VARIANTEN — JEDE HAT EINE ANDERE KOMMUNIKATIONS-LOGIK:
==================================================

VARIANTE 1 — RUHIG & DIREKT:
Zielgefühl: souverän, klar, professionell — ohne Distanz.
- Beginnt sofort mit dem Problem. Kein Aufwärmsatz, keine Anrede.
- Kurze Sätze. Wenig Adjektive. Kein Kommentar zur eigenen Reaktion.
- Darf mit Halbsatz enden: "Verstehen wir." / "Stimmt so." / "Das war nicht gut."
- Emotionale Temperatur: kühl bis neutral — aber nicht abweisend

SPRACHMUSTER VARIANTE 1 (so klingt echter Betreiber-Ton):
"Kaltes Essen geht einfach nicht. Verstehen wir."
"Zwei Stunden Wartezeit ist zu lang. Da haben wir ein Problem."
"Das hätte so nicht laufen dürfen. Wir wissen das."
"So ein Abend tut weh — für beide Seiten."
"Wer reserviert, darf mehr erwarten. Das ist berechtigt."
→ Kurz. Klar. Kein Ausweichen. Kein Erklären.

VARIANTE 2 — MENSCHLICH & NAH:
Zielgefühl: warm, empathisch, verbindend — echter Kontakt, kein Support-Ton.
- Holt den Gast zuerst als Mensch ab — BEVOR das Problem benannt wird.
- Beginnt mit Name oder direkter persönlicher Ansprache.
- Dann erst Klarheit über das Problem. Nie andersrum.
- Rhythmus: etwas fließender, einladend aber direkt — nicht weich.
- Emotionale Temperatur: warm, persönlich

SPRACHMUSTER VARIANTE 2 (so klingt echter Betreiber-Ton):
"Hallo Anna, das klingt nach einem richtig schlechten Abend — das tut uns leid."
"Stefan, so ein Besuch bleibt hängen. Zu Recht."
"Hallo Julia, ehrlich gesagt: das klingt nach einem Abend, der nicht hätte so laufen sollen."
"Das ist nicht das Erlebnis, das wir uns für dich gewünscht hätten."
"Ich versteh, dass das frustriert. Wirklich."
→ Mensch zuerst. Dann Problem. Nie umgekehrt.

VARIANTE 3 — KURZ & BEILÄUFIG:
Zielgefühl: locker, unkompliziert, natürlich — kein Aufheben, kein Drama.
- Eine knappe Feststellung. Maximal 2 Sätze. Nichts erklären.
- Klingt wie jemand der kurz was sagt und dann aufhört.
- NICHT nachdenklich. NICHT bedeutungsschwer. NICHT literarisch.
- Emotionale Temperatur: nüchtern, beiläufig — aber nicht gleichgültig

SPRACHMUSTER VARIANTE 3 (so klingt echter Betreiber-Ton):
"Da fehlt uns komplett der Hintergrund. Meld dich gern kurz."
"So ohne Info ist das schwer für uns einzuordnen."
"Schade, dass du uns so erlebt hast."
"Das war offenbar kein guter Abend. Schade."
"Thomas, da scheint einiges schiefgelaufen zu sein."
→ Kein vollständiger Gedanke nötig. Kein runder Abschluss.

WICHTIG: Die drei Varianten sollen dieselbe Kernaussage transportieren — aber sich in Rhythmus, Einstieg, emotionaler Temperatur und Satzbau KLAR unterscheiden. Nicht drei Versionen desselben Texts mit Synonymen.

Länge: 2–4 kurze Sätze pro Variante. Keine langen Erklärungen. Keine Rechtfertigungen.

KONTAKT- ODER LÖSUNGSANGEBOTE nur bei: starker Enttäuschung, echter Eskalation, sinnvoller Wiedergutmachung.
NICHT bei: kleinen Beschwerden, aggressiven Gästen, neutralen Bewertungen, kleinen Hinweisen.
${contactEmail ? `Kontakt wenn sinnvoll: ${contactEmail}` : ''}

==================================================
SPIEGELUNG — BINDEND:
==================================================
SCHLECHT (nur Kategorien):
- "Wir verstehen Ihre Frustration."
- "Das tut uns leid."

GUT (konkrete Momente):
- "Wer reserviert und draußen sitzt, hat zu Recht eine andere Erwartung."
- "Zwei Stunden auf das Essen zu warten ist zu lang — das wissen wir."

Spiegelung muss IMMER konkret auf diese Bewertung eingehen. Niemals generisch.

==================================================
ABSOLUT VERBOTEN (alle Varianten):
==================================================
- "Wir bedauern Ihre Erfahrung" / "Wir bedauern deine Erfahrung"
- "entspricht nicht unserem Anspruch"
- "Vielen Dank für Ihr wertvolles Feedback" / "Vielen Dank für dein wertvolles Feedback"
- "Ihre Zufriedenheit ist unser Ziel" / "deine Zufriedenheit ist unser Ziel"
- "nehmen wir sehr ernst"
- "Das tut uns sehr leid"
- "Wir bitten um Verständnis"
- "Wir arbeiten daran" ohne konkreten Inhalt
- "intern daran arbeiten"
- "Maßnahmen ergriffen" / "Maßnahmen wurden ergriffen"
- "Das nehmen wir ernst" / "Das nehmen wir sehr ernst"
- "Wir versichern" / "es wurde versichert"
- "Wir verstehen deine/Ihre Enttäuschung" — zu Support-mäßig
- "Das wissen wir" — klingt geschrieben, nicht gesprochen
- Alle Kritikpunkte einzeln aufzählen
- Rechtfertigungen oder Überentschuldigungen
- Literarisch glatte Sätze die zu "fertig" klingen
- Sätze die rund und vollständig wirken wenn ein kurzer Abbruch echter wäre
- Formulierungen die man so in einer Hotelbroschüre lesen würde
- Sätze mit mehr als einem Nebensatz — zu konstruiert
- "manchmal kippt ein Abend" — zu literarisch
- "lässt uns ratlos zurück" — zu komponiert, niemand redet so
- "tut weh" als emotionale Eröffnung — zu bewusst eingesetzt
- Mit dem Problem beginnen in Variante 2 — dort erst Mensch abholen
- Falsche Anredeform — IMMER ${duSie} verwenden, nie mischen
- "Hi [Name]" — zu locker, stattdessen Name direkt oder "Hallo [Name]"
- Großgeschriebenes "Dir" / "Dein" außer am Satzanfang

Alle drei Varianten enden mit: ${signature}

==================================================
AUSGABE — NUR dieses JSON, kein anderer Text:
==================================================
Vergib für jede Variante ein kurzes Label (2–3 Wörter) das den tatsächlichen Ton widerspiegelt.
Nicht immer dieselben Labels.

{
  "variant1": {"label": "...", "text": "..."},
  "variant2": {"label": "...", "text": "..."},
  "variant3": {"label": "...", "text": "..."}
}`
}

// ─── JUDGE PROMPT ──────────────────────────────────────────────────────────
function buildJudgePrompt(
  variants: { label: string; text: string }[],
  reviewText: string,
  salutation: string,
  signature: string
): string {
  const duSie = salutation === 'Du' ? 'Du/Dein (Duzen)' : 'Sie/Ihr (Siezen)'

  return `Du bist ein Qualitätsprüfer für Restaurant-Antworten. Du bekommst 3 generierte Antworten auf eine Gästebewertung.

BEWERTUNG:
"${reviewText}"

GENERIERTE VARIANTEN:
Variante 1 (${variants[0]?.label}): "${variants[0]?.text}"
Variante 2 (${variants[1]?.label}): "${variants[1]?.text}"
Variante 3 (${variants[2]?.label}): "${variants[2]?.text}"

==================================================
DEINE AUFGABE:
==================================================
Prüfe diese 3 Varianten nach folgenden Kriterien:

1. DIFFERENZIERUNG: Unterscheiden sie sich in Ton, Einstieg und emotionaler Temperatur?
   - Variante 1 sollte problem-first sein (sachliche Feststellung zuerst, kein Aufwärmsatz)
   - Variante 2 sollte mensch-first sein (Gast als Mensch abholen, bevor das Problem kommt)
   - Variante 3 sollte kurz & beiläufig sein (knappe Feststellung, max. 2 Sätze, nichts ausformuliert — KEIN literarisch-dichter Ton)
   Wenn zwei Varianten denselben Einstiegstyp haben → eine ist schwach.

2. TEMPLATE-SPRACHE: Klingt eine Variante nach KI-Standard oder Corporate-Sprache?
   Verboten: "entspricht nicht unserem Anspruch" / "nehmen wir sehr ernst" /
   "Das tut uns sehr leid" / "Vielen Dank für Ihr Feedback" / "Maßnahmen ergriffen"

3. SPIEGELUNG: Greift mindestens eine Variante konkret auf einen Moment der Bewertung ein?
   Schlecht: "Wir verstehen Ihre Frustration."
   Gut: konkreter Moment aus der Bewertung wird direkt benannt.

4. ANREDEFORM: Wird ${duSie} konsequent eingehalten — kein Wechsel innerhalb einer Antwort?

5. ABSCHLUSS: Enden alle mit: ${signature}?

==================================================
ENTSCHEIDUNG — DU BIST KORREKTOR, NICHT ZWEITER AUTOR:
==================================================
- Wenn alle 3 bestehen: setze "changed": null — gib alle drei EXAKT unverändert zurück
- Wenn genau eine schwach ist: rewrite NUR diese eine — setze "changed": 1, 2 oder 3
- Maximal EINE Variante rewriten — nie mehr
- Die beiden anderen gibst du WORTGENAU unverändert zurück (gleicher Text, gleiches Label)

Beim Rewrite: neue Version muss sich klar von den anderen beiden abheben.
Gleiche Länge (2–4 Sätze). Label nur ändern wenn es zum neuen Ton nicht mehr passt.

==================================================
AUSGABE — NUR dieses JSON, kein anderer Text:
==================================================
{
  "changed": null,
  "variant1": {"label": "...", "text": "..."},
  "variant2": {"label": "...", "text": "..."},
  "variant3": {"label": "...", "text": "..."}
}`
}

// ─── RECOVERY PROMPT ───────────────────────────────────────────────────────
function buildRecoveryPrompt(reviewText: string, reviewerName: string, settings: any): string {
  const {
    businessName = 'das Restaurant',
    salutation = 'Sie',
    contactEmail = '',
    responseSignature = '',
    responseLanguage = 'Deutsch',
  } = settings || {}

  const duSie = salutation === 'Du' ? 'Du/Dein (Duzen)' : 'Sie/Ihr (Siezen)'
  const signature = responseSignature || `Das Team von ${businessName}`
  const firstName = reviewerName ? reviewerName.split(' ')[0] : ''

  const langInstruction = responseLanguage === 'Sprache des Bewerters'
    ? `Antworte in der Sprache der Bewertung.`
    : responseLanguage === 'Englisch'
    ? `Respond in English only.`
    : `Antworte auf Deutsch.`

  return `Du antwortest für das Restaurant "${businessName}" auf eine sehr negative Bewertung (1–2 Sterne).

${langInstruction} Anredeform: ${duSie}

BEWERTUNG von ${firstName || 'einem Gast'}:
"${reviewText}"

DEINE AUFGABE:
Schreibe EINE kurze, deeskalierende Antwort. Ziel: Vertrauen zurückgewinnen, direkte Kontaktaufnahme anbieten.

REGELN:
- Schreibe wie gesprochen, nicht wie formuliert — kurze Sätze, ruhiger Ton
- Konkret auf diese Bewertung eingehen — mindestens einen spezifischen Punkt benennen
- Kein Kleinreden, keine Rechtfertigung
- Kontaktangebot einbauen: ${contactEmail || 'unsere E-Mail'}
- Anredeform konsequent: ${duSie}
- Max. 3 Sätze
- Endet mit: ${signature}

ABSOLUT VERBOTEN:
- "Hi [Name]" — stattdessen Name direkt oder "Hallo [Name]"
- Großgeschriebenes "Dir" / "Dein" außer am Satzanfang
- "Vielen Dank für Ihr/dein Feedback"
- "Das tut uns sehr leid"
- "Wir nehmen das ernst"
- "Wir verstehen deine Enttäuschung"
- Generische Floskeln ohne Bezug zur Bewertung

AUSGABE — NUR dieses JSON:
{"label":"Deeskalierend","text":"..."}`
}

// ─── HELPER: API CALL ──────────────────────────────────────────────────────
async function callClaude(prompt: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(`Claude API Fehler: ${JSON.stringify(err)}`)
  }

  const data = await response.json()
  return data.content?.[0]?.text || ''
}

// ─── HELPER: JSON PARSE ────────────────────────────────────────────────────
function parseVariants(raw: string): { label: string; text: string }[] {
  let jsonStr = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  const startIdx = jsonStr.indexOf('{')
  const endIdx = jsonStr.lastIndexOf('}')

  if (startIdx === -1 || endIdx === -1) {
    throw new Error('Kein JSON gefunden: ' + raw)
  }

  jsonStr = jsonStr.substring(startIdx, endIdx + 1)
  const parsed = JSON.parse(jsonStr)

  const cleanText = (t: string) => t.replace(/\n\n/g, ' ').replace(/\n/g, ' ').trim()

  return [
    { label: parsed.variant1?.label || 'Variante 1', text: cleanText(parsed.variant1?.text || '') },
    { label: parsed.variant2?.label || 'Variante 2', text: cleanText(parsed.variant2?.text || '') },
    { label: parsed.variant3?.label || 'Variante 3', text: cleanText(parsed.variant3?.text || '') },
  ]
}

// ─── HANDLER ───────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { review, settings } = req.body

  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert' })
  }

  const reviewText = review.reviewText || ''
  const stars = review.stars || 3
  const reviewerName = review.reviewerName || ''

  const salutation = settings?.salutation || 'Sie'
  const businessName = settings?.businessName || 'das Restaurant'
  const signature = settings?.responseSignature || `Das Team von ${businessName}`

  try {
    // ── SCHRITT 1: Generator ───────────────────────────────────────────────
    const generatorPrompt = buildPrompt(reviewText, stars, reviewerName, settings)
    const generatorRaw = await callClaude(generatorPrompt)
    const generatedVariants = parseVariants(generatorRaw)

    // ── SCHRITT 2: Judge (nur für CONTENT-Modi, nicht für EMPTY) ──────────
    const mode = classify(stars, reviewText)
    let finalVariants = generatedVariants

    if (mode !== 'EMPTY_POSITIVE' && mode !== 'EMPTY_NEGATIVE') {
      const judgePrompt = buildJudgePrompt(generatedVariants, reviewText, salutation, signature)
      const judgeRaw = await callClaude(judgePrompt)

      // Judge patcht nur die gemeldete schwache Variante — Rest bleibt Original
      let judgeJson = judgeRaw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      const s = judgeJson.indexOf('{')
      const e = judgeJson.lastIndexOf('}')

      if (s !== -1 && e !== -1) {
        judgeJson = judgeJson.substring(s, e + 1)
        const judgeResult = JSON.parse(judgeJson)
        const cleanText = (t: string) => t.replace(/\n\n/g, ' ').replace(/\n/g, ' ').trim()
        const changed: number | null = judgeResult.changed ?? null

        if (changed === 1 && judgeResult.variant1?.text) {
          finalVariants = [
            { label: judgeResult.variant1.label || generatedVariants[0].label, text: cleanText(judgeResult.variant1.text) },
            generatedVariants[1],
            generatedVariants[2],
          ]
        } else if (changed === 2 && judgeResult.variant2?.text) {
          finalVariants = [
            generatedVariants[0],
            { label: judgeResult.variant2.label || generatedVariants[1].label, text: cleanText(judgeResult.variant2.text) },
            generatedVariants[2],
          ]
        } else if (changed === 3 && judgeResult.variant3?.text) {
          finalVariants = [
            generatedVariants[0],
            generatedVariants[1],
            { label: judgeResult.variant3.label || generatedVariants[2].label, text: cleanText(judgeResult.variant3.text) },
          ]
        }
        // changed === null → finalVariants bleibt unverändert (Generator-Output)
      }
    }

    // ── SCHRITT 3: Recovery (nur bei 1–2 Sternen) ─────────────────────────
    if (stars <= 2) {
      try {
        const recoveryPrompt = buildRecoveryPrompt(reviewText, reviewerName, settings)
        const recoveryRaw = await callClaude(recoveryPrompt)
        let recoveryJson = recoveryRaw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
        const rs = recoveryJson.indexOf('{')
        const re = recoveryJson.lastIndexOf('}')
        if (rs !== -1 && re !== -1) {
          recoveryJson = recoveryJson.substring(rs, re + 1)
          const parsed = JSON.parse(recoveryJson)
          if (parsed.text) {
            const cleanText = (t: string) => t.replace(/\n\n/g, ' ').replace(/\n/g, ' ').trim()
            finalVariants = [
              ...finalVariants,
              { label: parsed.label || 'Deeskalierend', text: cleanText(parsed.text), isRecovery: true }
            ]
          }
        }
      } catch (e) {
        console.warn('Recovery generation failed', e)
        // Kein Fallback nötig — die 3 Hauptvarianten sind bereits da
      }
    }

    return res.status(200).json({ success: true, answers: finalVariants })

  } catch (error) {
    return res.status(500).json({ error: 'Serverfehler', details: String(error) })
  }
}
