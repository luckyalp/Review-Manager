import type { VercelRequest, VercelResponse } from '@vercel/node'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY

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

  const slot4 = rating <= 2
    ? `Slot 4 – Brueckenbauer: Biete persoenliche Kontaktaufnahme an. ${contactLine}`
    : rating === 3
    ? 'Slot 4 – Brueckenbauer: Leichte Offenheit, Gespraechsmoeglichkeit anbieten.'
    : 'Slot 4 – Brueckenbauer: Nicht notwendig. Optional kurzer Dank.'

  const alreadyHandled = (reviewText.toLowerCase().includes('massnahmen') ||
    reviewText.toLowerCase().includes('reagiert') ||
    reviewText.toLowerCase().includes('versichert') ||
    reviewText.toLowerCase().includes('aufgenommen'))
    ? `WICHTIG: Der Gast erwaehnt, dass das Team bereits vor Ort reagiert hat.
Anerkenne diese Reaktion kurz — aber mache klar: sie hebt den Schrecken oder Vertrauensverlust nicht auf.
Nicht so tun als waere noch nichts passiert.`
    : ''

  // System-Prompt: Original Google AI Studio Instructions — kurz und sauber
  const systemPrompt = `Erstelle natuerliche, menschliche und professionelle Antworten auf Google-Bewertungen.
Die Antworten sollen nicht wie PR-Texte, Agenturtexte oder KI-Texte wirken.
Keine uebertriebene Freundlichkeit, keine Rechtfertigungen, keine Standardfloskeln.

Grundregeln:
Beschwerden nicht aufzaehlen oder wiederholen.
Kritik nicht spiegeln.
Keine Ursachen erfinden.
Keine internen Ablaeufe erklaeren.
Keine leeren Floskeln verwenden.
Kurz und natuerlich schreiben.
Eher wie ein Gastronom als wie eine Pressestelle.

Antwortstruktur:

Slot 1 - Emotionaler Stossdaempfer:
Erste emotionale Reaktion. Verstaendnis zeigen. Keine Erklaerung, keine Verteidigung.

Slot 2 - Abstraktion / Einordnung:
Das Problem auf hoeherer Ebene einordnen ohne die Beschwerde zu wiederholen.
Kategorien: Qualitaet / Ablauf / Umgang / Sorgfalt
Mehrere gleichwertige Probleme: Komplexfall-Satz, keine Aufzaehlung.

Slot 3 - Commitment:
Zeigen dass die Kritik intern Wirkung hat. Nur: Was machen wir mit dieser Rueckmeldung?
Fokus: Verantwortungsuebernahme, Reaktion, Verbesserungsbereitschaft.

Slot 4 - Brueckenbauer: wird in der Aufgabe vorgegeben.

Slot 5 - Abschluss: Kurz und professionell. Keine neue Information.

Sprachstil:
Die Antwort soll wirken als haette sie ein aufmerksamer Gastronom geschrieben.
Nicht wie Kundenservice, Konzernkommunikation, Rechtsabteilung, Marketingagentur oder KI.
Natuerliche Sprache, kurze Saetze, glaubwuerdige Formulierungen, ruhige Professionalitaet.

Oberstes Prinzip:
Der Gast soll das Gefuehl haben dass seine Kritik gelesen, verstanden und ernst genommen wurde
ohne dass die Antwort die Bewertung nacherzaehlt oder sich rechtfertigt.

Wortwahl: Locker und ehrlich, aber keine vulgaeren Formulierungen.
Natuerliche Alternativen wie "den Geist aufgegeben", "ausgefallen", "gestreikt".`

  // User-Message: nur die Daten — Bewertung + Kontext + Aufgabe
  const userMessage = `${langInstruction}

RESTAURANT: ${businessName}
${context}

${nameRule}

BEWERTUNG (${rating} Sterne):
"${reviewText}"

${alreadyHandled}

${slot4}
Abschluss: Waehle passend zum Ton "Viele Gruesse, ${signature}" oder "Herzliche Gruesse, ${signature}" oder "Beste Gruesse, ${signature}"

Schreibe 3 Varianten:
Variante 1 – Direkt & Ehrlich: Anredeform Du/dein. Direkt, klar.
Variante 2 – Ruhig & Professionell: Anredeform Sie/Ihr. Ruhig, Mensch zuerst.
Variante 3 – Fokus auf Klaerung: Anredeform ${duSieV3}. Kuerzer, max. 3 Saetze, Slot 4 im Vordergrund.

AUSGABE — NUR dieses JSON, kein anderer Text:
{
  "variant1": {"label": "Direkt & Ehrlich", "text": "..."},
  "variant2": {"label": "Ruhig & Professionell", "text": "..."},
  "variant3": {"label": "Fokus auf Klaerung", "text": "..."}
}`

  return JSON.stringify({ _system: systemPrompt, _user: userMessage })
}

// ─── JUDGE PROMPT ──────────────────────────────────────────────────────────
function buildJudgePrompt(
  variants: { label: string; text: string }[],
  reviewText: string,
  salutation: string,
  signature: string
): string {
  return `Du bist ein Qualitaetspruefer fuer Restaurant-Antworten. Du optimierst menschliche Tiefe und filterst KI-Floskeln heraus.

BEWERTUNG DES GASTES:
"${reviewText}"

ZUR PRUEFUNG:
Variante 1 (${variants[0]?.label}): "${variants[0]?.text}"
Variante 2 (${variants[1]?.label}): "${variants[1]?.text}"
Variante 3 (${variants[2]?.label}): "${variants[2]?.text}"

==================================================
PRUEKLISTE:
==================================================

1. SLOT-STRUKTUR:
   Folgen Variante 1 & 2 der 5-Slot-Logik?
   WICHTIG ZU VARIANTE 3: Variante 3 darf kuerzer sein (max. 3 Saetze) und muss NICHT alle 5 Slots ausformulieren.
   Sie ist gut wenn sie schnell auf Slot 1 (Stossdaempfer) und Slot 4 (Kontaktangebot) fokussiert.
   Variante 3 NIEMALS als schwach einstufen nur weil sie kurz ist!

2. NACHERZAEHLUNG:
   Wiederholt eine Variante den konkreten Fehler woertlich? (z.B. "Dass Ihnen ein falscher Cocktail serviert wurde")
   Das ist stumpfes KI-Plappern → SCHWACH. Ersetze durch abstrakte Einordnung (Sorgfalt / Ablauf / Umgang / Qualitaet).

3. VERBOTENE PHRASEN — ABSOLUT SPERREN:
   Enthaelt eine Variante: "intern nachgeschaerft" / "Team sensibilisiert" / "Konsequenzen gezogen" /
   "entspricht nicht unserem Anspruch" / "nehmen wir sehr ernst" / "intern klar gemacht" / "Massnahmen ergriffen"?
   Wenn JA → SCHWACH. Durch echtes, lebendiges Deutsch eines Gastronoms ersetzen.

4. GRAMMATIK: Fehlen Subjekte ("Verstehen Ihren Aerger" statt "Wir verstehen Ihren Aerger")? → SCHWACH

5. ABSCHLUSS: Enden alle mit: ${signature}?

==================================================
ENTSCHEIDUNG:
==================================================
- Alle 3 gut → "changed": null, alle drei WORTGENAU zurueck
- Genau eine schwach → NUR diese neu schreiben, "changed": 1, 2 oder 3
- Die anderen beiden EXAKT unveraendert kopieren

AUSGABE — NUR dieses JSON:
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

// ─── HELPER: GEMINI API CALL (Generator) ──────────────────────────────────
async function callGemini(userMessage: string, systemPrompt?: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`

  const body: any = {
    contents: [{ parts: [{ text: userMessage }] }],
    generationConfig: { maxOutputTokens: 4000, temperature: 0.7 },
  }
  if (systemPrompt) {
    body.system_instruction = { parts: [{ text: systemPrompt }] }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(`Gemini API Fehler: ${JSON.stringify(err)}`)
  }

  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

// ─── HELPER: CLAUDE API CALL (Judge & Recovery) ────────────────────────────
async function callClaude(userMessage: string, systemPrompt?: string): Promise<string> {
  const body: any = {
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: userMessage }],
  }
  if (systemPrompt) {
    body.system = systemPrompt
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
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
    // ── SCHRITT 1: Generator (Gemini) ─────────────────────────────────────
    const generatorRaw_str = buildPrompt(reviewText, stars, reviewerName, settings)
    let generatorRaw: string

    // CONTENT-Modi liefern JSON mit _system/_user — geht an Gemini
    // EMPTY-Modi liefern direkt den Prompt-String
    try {
      const parsed = JSON.parse(generatorRaw_str)
      if (parsed._system && parsed._user) {
        generatorRaw = await callGemini(parsed._user, parsed._system)
      } else {
        generatorRaw = await callGemini(generatorRaw_str)
      }
    } catch {
      generatorRaw = await callGemini(generatorRaw_str)
    }

    const generatedVariants = parseVariants(generatorRaw)

    // ── SCHRITT 2: Judge deaktiviert — Gemini Output direkt verwenden ───────
    const mode = classify(stars, reviewText)
    const finalVariants = generatedVariants

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