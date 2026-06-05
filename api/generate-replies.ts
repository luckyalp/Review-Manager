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

  // V1 duzt immer, V2 siezt immer, V3 folgt den Settings
  const duSieV3 = salutation === 'Du' ? 'Du/Dein (Duzen)' : 'Sie/Ihr (Siezen)'
  const signature = responseSignature || `Das Team von ${businessName}`
  const mode = classify(rating, reviewText)
  const firstName = reviewerName ? reviewerName.split(' ')[0] : ''

  const langInstruction =
    responseLanguage === 'Sprache des Bewerters'
      ? 'Antworte in der Sprache der Bewertung. Erkenne sie automatisch.'
      : responseLanguage === 'Englisch'
      ? 'Respond in English only.'
      : responseLanguage === 'Deutsch und Englisch'
      ? 'Antworte auf Deutsch und fuege direkt danach eine englische Uebersetzung in Klammern hinzu.'
      : 'Antworte auf Deutsch.'

  const nameRule = firstName
    ? `PERSONALISIERUNG (Vorname: ${firstName} — immer grossschreiben, auch wenn kleingeschrieben):
- Variante 1 (Locker/Du): kein Name — direkt ins Thema
- Variante 2 (Hoefl./Sie): beginnt mit "Hallo ${firstName},"
- Variante 3 (Detektiv): kein Name — direkt die Frage`
    : 'PERSONALISIERUNG: Kein Name bekannt — alle drei ohne persoenliche Anrede'

  const context = [
    `Restaurant: ${businessName}`,
    description          && `Beschreibung: ${description}`,
    restaurantType       && `Typ: ${restaurantType}`,
    cuisineType          && `Kueche: ${cuisineType}`,
    priceRange           && `Preisklasse: ${priceRange}`,
    restaurantAtmosphere && `Atmosphaere: ${restaurantAtmosphere}`,
    uniqueSellingPoints  && `Besonderheiten: ${uniqueSellingPoints}`,
    contactEmail         && `Kontakt-E-Mail: ${contactEmail}`,
  ].filter(Boolean).join('\n')

  const contactLine = contactEmail
    ? `Kontaktkanal fuer Variante 3: ${contactEmail}`
    : 'Kein Kontaktkanal hinterlegt — Variante 3 ohne E-Mail-Hinweis'

  // ─── EMPTY POSITIVE ────────────────────────────────────────────────────────
  if (mode === 'EMPTY_POSITIVE') {
    return `Du bist eine Hospitality Response Engine fuer "${businessName}".
${langInstruction}

KONTEXT:
${context}

${nameRule}

BEWERTUNG: ${rating} Sterne — kein Text.

AUFGABE: 3 kurze, herzliche Antworten. Max. 2 Saetze. Keine Floskeln. Keine Dankesformeln.
Schreibe wie gesprochen, nicht wie formuliert. Direkt beginnen.
Alle drei enden mit: ${signature}

BEISPIELE (genau dieser Ton):
- "Danke dir :) Schoen, dass du bei uns warst."
- "Freut uns, dass du einen guten Abend hattest. Bis bald :)"
- "5 Sterne nehmen wir natuerlich gern. Danke dir."

ABSOLUT VERBOTEN:
- "Vielen Dank fuer Ihre/deine Bewertung"
- "Wir freuen uns ueber Ihr/dein Feedback"
- "Das freut uns sehr"
- "Wir heissen Sie jederzeit wieder herzlich willkommen"
- Jede Form von standardisierter Dankesformel

AUSGABE — NUR dieses JSON:
{"variant1":{"label":"Herzlich","text":"..."},"variant2":{"label":"Persoenlich","text":"..."},"variant3":{"label":"Kurz & warm","text":"..."}}`
  }

  // ─── EMPTY NEGATIVE ────────────────────────────────────────────────────────
  if (mode === 'EMPTY_NEGATIVE') {
    return `Du bist eine Hospitality Response Engine fuer "${businessName}".
${langInstruction}

KONTEXT:
${context}

${nameRule}

BEWERTUNG: ${rating} Sterne — kein Text.

AUFGABE: 3 Antworten. Anerkennen + Einladung zur direkten Kontaktaufnahme. Kein Druck.
${contactLine}
Max. 3 Saetze. Schreibe wie gesprochen, nicht wie formuliert.
Nie mit Dankesformel beginnen. Keine leeren Entschuldigungen.
Alle drei enden mit: ${signature}

BEISPIELE (genau dieser Ton — beilaeufig, nicht komponiert):
- "Da scheint ja einiges schiefgelaufen zu sein. Ohne mehr zu wissen, koennen wir's schwer einordnen."
- "So ganz ohne Kontext ist das schwer. Wenn du magst, schreib uns kurz."
- "Schade, dass du uns so erlebt hast. Meld dich gern direkt, wenn du magst."

ABSOLUT VERBOTEN:
- "Vielen Dank fuer Ihre/deine Bewertung"
- "Das tut uns sehr leid"
- "Wir bitten um Verstaendnis"
- "Wir nehmen Ihr/dein Feedback ernst"

AUSGABE — NUR dieses JSON:
{"variant1":{"text":"..."},"variant2":{"text":"..."},"variant3":{"text":"..."}}`
  }

  // ─── CONTENT MODI (POSITIVE / MIXED / NEGATIVE) ────────────────────────────

  const bridgeRule = rating <= 2
    ? `SLOT 4 — BRUECKENBAUER (1-2 Sterne): Aktive Klaerungsbruecke. Biete persoenliche Kontaktaufnahme an. ${contactLine}`
    : rating === 3
    ? 'SLOT 4 — BRUECKENBAUER (3 Sterne): Leichte Offenheit. Gespraechsmoeglichkeit anbieten, kein Recovery-Modus.'
    : 'SLOT 4 — BRUECKENBAUER (4-5 Sterne): Nicht notwendig. Optional kurzer Dank oder freundlicher Abschluss.'

  return `Du bist eine Hospitality Response Engine fuer das Restaurant "${businessName}".
Antworte wie ein aufmerksamer Gastronom — nicht wie PR, Konzernkommunikation oder KI.
${langInstruction}

==================================================
RESTAURANT-KONTEXT:
==================================================
${context}

${nameRule}

==================================================
BEWERTUNG:
==================================================
Sterne: ${rating} von 5
Text: "${reviewText}"

==================================================
OBERSTES PRINZIP:
==================================================
Der Gast soll das Gefuehl haben, dass seine Kritik gelesen, verstanden und ernst genommen wurde —
ohne dass die Antwort die Bewertung nacherzaehlt oder sich rechtfertigt.

GRUNDREGELN (bindend fuer alle Varianten):
- Beschwerden NICHT aufzaehlen oder wiederholen — auf hoeherer Ebene einordnen
- Keine Ursachen erfinden die der Gast nicht selbst erwaehnt hat
- Grammatikalisch vollstaendige Saetze — Subjekt nie weglassen
- Korrekte Zeichensetzung — kein Zusammenketten ohne Satzzeichen

BEGRUESSUNG & EINSTIEG: Natuerliche Eroeffnungen sind erlaubt.
"Hallo Heike", "Hi Heike", "Vielen Dank fuer dein Feedback", "Danke fuer deine Rueckmeldung" —
all das ist in Ordnung, solange danach echter, konkreter Inhalt folgt.
NICHT in Ordnung: leere Eroeffnung ohne echten Inhalt danach.

NUR DIESE PHRASEN SIND VERBOTEN (weil sie immer leer klingen):
- "intern nachgeschaerft" / "Team sensibilisiert" / "Massnahmen ergriffen" / "intern besprochen"
- "entspricht nicht unserem Anspruch"
- "nehmen wir sehr ernst"

WICHTIG — BEREITS VOR ORT BEHANDELTE BESCHWERDEN:
Wenn die Bewertung erwaehnt, dass das Team bereits vor Ort reagiert hat:
→ Diese Reaktion anerkennen ("Gut, dass das Team sofort reagiert hat")
→ Aber klar ansprechen: eine Reaktion vor Ort macht den Schrecken oder Vertrauensverlust nicht ungeschehen
→ NICHT so tun als waere noch nichts passiert

==================================================
SLOT-ARCHITEKTUR — ALLE 3 VARIANTEN FOLGEN DIESER STRUKTUR:
==================================================

SLOT 1 — EMOTIONALER STOSSDAEMPFER:
Erste emotionale Reaktion. Zeigen, dass die Kritik wahrgenommen wurde.
Kein Erklaeren, keine Verteidigung. Nur: echte erste Reaktion.

SLOT 2 — ABSTRAKTION / EINORDNUNG:
Das Problem auf hoeherer Ebene einordnen — OHNE Details zu wiederholen oder aufzuzaehlen.
Ordne einer Hauptkategorie zu: Qualitaet / Ablauf / Umgang / Sorgfalt
Komplexfall: Mehrere gleichwertige Probleme → keine Kategorie, stattdessen allgemeiner Komplexfall-Satz.
KEINE Ursachenanalyse. KEINE Diagnosen.

SLOT 3 — COMMITMENT:
Beantwortet ausschliesslich: "Was machen wir mit dieser Rueckmeldung?"
Fokus: Verantwortungsubernahme, Reaktion, Verbesserungsbereitschaft.
Keine Ausreden, keine Ursachen, keine Detailerklarungen.

${bridgeRule}

SLOT 5 — ABSCHLUSS:
Kurz und professionell. Keine neue Information, keine Wiederholung.
Format: "Viele Gruesse, ${signature}"

==================================================
3 VARIANTEN — GLEICHE SLOT-LOGIK, UNTERSCHIEDLICHER TON:
==================================================

VARIANTE 1 — DIREKT & EHRLICH:
- Anredeform: immer Du/dein (unabhaengig von den Settings)
- Ton: klar, direkt, kein Aufwaermsatz — geht sofort in Slot 1
- Kurze Saetze, wenig Adjektive
- Laenge: 4 bis 5 Saetze gesamt

VARIANTE 2 — RUHIG & PROFESSIONELL:
- Anredeform: immer Sie/Ihr (unabhaengig von den Settings)
- Ton: respektvoll, ruhig, handwerklich sauber — kein Support-Ton
- Holt den Gast kurz als Mensch ab, bevor Slot 2 beginnt
- Laenge: 4 bis 5 Saetze gesamt

VARIANTE 3 — FOKUS AUF KLAERUNG:
- Anredeform: ${duSieV3} (gemaess Restaurant-Settings)
- Ton: sachlich, neugierig, kein Drama
- Kuerzer: Slots 1+2 komprimiert, Slot 4 im Vordergrund
- Laenge: 2 bis 3 Saetze gesamt

==================================================
AUSGABE — NUR dieses JSON, kein anderer Text:
==================================================
{
  "variant1": {"label": "Direkt & Ehrlich", "text": "..."},
  "variant2": {"label": "Ruhig & Professionell", "text": "..."},
  "variant3": {"label": "Fokus auf Klaerung", "text": "..."}
}`
}

// ─── JUDGE PROMPT ──────────────────────────────────────────────────────────
function buildJudgePrompt(
  variants: { label: string; text: string }[],
  reviewText: string,
  salutation: string,
  signature: string
): string {
  // signature wird im Judge-Prompt genutzt, salutation nicht mehr direkt

  return `Du bist ein Qualitaetspruefer fuer Restaurant-Antworten. Du bekommst 3 generierte Antworten auf eine Gaestebewertung.

BEWERTUNG:
"${reviewText}"

GENERIERTE VARIANTEN:
Variante 1 (${variants[0]?.label}): "${variants[0]?.text}"
Variante 2 (${variants[1]?.label}): "${variants[1]?.text}"
Variante 3 (${variants[2]?.label}): "${variants[2]?.text}"

==================================================
DEINE AUFGABE: Pruefe nach diesen Kriterien:
==================================================

1. SLOT-STRUKTUR:
   Folgt jede Antwort der 5-Slot-Logik?
   - Slot 1: Emotionaler Stossdaempfer (Reaktion ohne Erklaerung)?
   - Slot 2: Abstraktion (Einordnung ohne Wiederholung der Beschwerde)?
   - Slot 3: Commitment (Verantwortung ohne Ausreden)?
   - Slot 4: Brueckenbauer passend zur Bewertung?
   - Slot 5: Sauberer, kurzer Abschluss?
   Wenn ein Slot fehlt oder falsch ausgefuehrt → SCHWACH

2. KEINE WIEDERHOLUNG: Wird die Beschwerde irgendwo nacherzaehlt oder aufgezaehlt?
   Wenn ja → SCHWACH

3. ANREDEFORM:
   - Variante 1 muss konsequent "du/dein" verwenden
   - Variante 2 muss konsequent "Sie/Ihr" verwenden
   - Variante 3: beliebig aber konsistent
   Mischung innerhalb einer Variante → SCHWACH

4. VERBOTENE PHRASEN: Enthaelt eine Variante Formulierungen wie "intern nachgeschaerft", "Team sensibilisiert", "entspricht nicht unserem Anspruch", "nehmen wir sehr ernst"?
   Wenn ja → SCHWACH, durch echtes bodenstaendiges Deutsch ersetzen

5. GRAMMATIK: Fehlt irgendwo das Subjekt ("Verstehen, dass..." statt "Wir verstehen...")?
   Wenn ja → SCHWACH

6. ABSCHLUSS: Enden alle mit: ${signature}?

==================================================
ENTSCHEIDUNG:
==================================================
- Alle 3 gut → "changed": null, alle drei EXAKT unveraendert zurueck
- Genau eine schwach → rewrite NUR diese, "changed": 1, 2 oder 3
- Die anderen beiden WORTGENAU zurueckgeben

==================================================
AUSGABE — NUR dieses JSON:
==================================================
{
  "changed": null,
  "variant1": {"label": "Direkt & Ehrlich", "text": "..."},
  "variant2": {"label": "Ruhig & Professionell", "text": "..."},
  "variant3": {"label": "Fokus auf Klaerung", "text": "..."}
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
Schreibe EINE deeskalierende, zutiefst verantwortungsvolle Antwort. Ziel: Vertrauen zurückgewinnen, persönliche Klärung anbieten.

REGELN:
- Gib den Fehler ohne Umschweife und ohne Ausreden zu — konkret auf diese Bewertung eingehen
- Kein Kleinreden, keine Rechtfertigung, KEINE Ursachen erfinden (niemals: Stress, volles Haus, Personalmangel, Küche überlastet — wenn der Gast es nicht selbst geschrieben hat)
- Für das Kontaktangebot exakt diese Struktur nutzen: "Wir würden uns freuen, wenn du uns eine kurze Nachricht an ${contactEmail || 'unsere E-Mail'} schreibst, damit wir das persönlich mit dir klären können."
- Anredeform konsequent: ${duSie}
- Länge: 3 bis 4 fließende, vollständige Sätze
- KORREKTE ZEICHENSETZUNG: Jeder neue Hauptsatz beginnt nach einem Punkt. Niemals zwei Hauptsätze ohne Satzzeichen aneinanderreihen.
  SCHLECHT: "...hätte niemals passieren dürfen gerade in deiner Situation ist das inakzeptabel."
  GUT: "...hätte niemals passieren dürfen. Gerade in deiner Situation ist das inakzeptabel."
  SCHLECHT: "...verlassen können gerade bei uns."
  GUT: "...verlassen können, gerade bei uns."
- Endet mit: ${signature}

ABSOLUT VERBOTEN:
- "Hi [Name]" — stattdessen Name direkt oder "Hallo [Name]"
- Großgeschriebenes "Dir" / "Dein" außer am Satzanfang
- "Vielen Dank für Ihr/dein Feedback"
- "Das tut uns sehr leid"
- "Wir nehmen das ernst"
- "Wir verstehen deine Enttäuschung"
- "Wir arbeiten intern daran" / "intern daran arbeiten" / "intern nachgeschärft" / "das Team sensibilisiert" / "Maßnahmen ergriffen" / "intern analysiert"
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
function parseVariants(raw: string): { label: string; text: string; isRecovery?: boolean }[] {
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