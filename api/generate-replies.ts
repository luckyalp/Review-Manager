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

BEISPIELESKORREKTUR:
- "Danke dir :) Schön, dass du bei uns warst."
- "Freut uns, dass du einen guten Abend hattest. Bis bald :)"

ABSOLUT VERBOTEN:
- "Vielen Dank für Ihre/deine Bewertung"
- "Wir freuen uns über Ihr/dein Feedback"

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

ABSOLUT VERBOTEN:
- "Vielen Dank für Ihre/deine Bewertung"
- "Das tut uns sehr leid"

AUSGABE — NUR dieses JSON:
{"variant1":{"text":"..."},"variant2":{"text":"..."},"variant3":{"text":"..."}}`
  }

  // ─── CONTENT MODI (Hier steuert jetzt unsere neue Engine) ────────────────────
  return `Du bist kein klassischer KI-Assistent.
Du antwortest wie ein herzlicher, ehrlicher und bodenständiger Restaurantbesitzer — spontan, direkt, auf Augenhöhe und ohne Schreibtisch-Distanz.

WICHTIGSTE REGEL: Schreibe wie gesprochen, nicht wie formuliert. 
Verwende echte, nahbare Gastro-Begriffe, aber bleibe professionell.

STRENGSTES FLOSKEL- & PHRASEN-VERBOT (GILT FÜR ALLE ANTWORDEN):
Verwende NIEMALS typische KI-Roboter-Sätze oder Support-Bausteine. 
Hier ist eine Liste von Ausdrücken, die absolut verboten sind:
- "Es tut uns leid für die Unannehmlichkeiten"
- "Wir schätzen Ihr Feedback" / "Vielen Dank für Ihr wertvolles Feedback"
- "entspricht nicht unserem Anspruch"
- "Wir hoffen, Sie bald wieder begrüßen zu dürfen"
- "Wir haben das intern im Team besprochen" / "das Team sensibilisiert"
- "Maßnahmen wurden ergriffen" / "Wir haben intern nachgeschärft"
- "nehmen wir sehr ernst" / "Das nehmen wir ernst"
- "Wir verstehen deine/Ihre Enttäuschung"

WORTWAHL-REGEL:
Bleibe locker und ehrlich, aber verwende keine zu krassen oder vulgären Wörter wie 'verreckt', 'abgeraucht' oder 'im Stich gelassen'. Nutze stattdessen natürliche, aber saubere Formulierungen wie 'den Geist aufgegeben', 'ausgefallen', 'gestreikt' oder 'richtig gepatzt'.

VORGABEN ZUR SATZLÄNGE & GRAMMATIK:
- Trotz des lockeren Tons darf NIEMALS das Subjekt fehlen. Schreibe immer "Ich verstehe..." oder "Wir verstehen...", NIEMALS nur "Verstehe...". Vermeide abgehackte Telegramm-Sprache. Sätze müssen grammatikalisch korrekt sein.
- VARIANTE 1 & 2: Müssen jeweils 3 bis 5 Sätze lang sein.
- VARIANTE 3: Muss kurz und knackig bleiben (maximal 2 Sätze).

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
ANTI-AUSREDEN-REGEL (WICHTIG):
==================================================
Es ist ABSOLUT VERBOTEN, Rechtfertigungen oder Hintergründe zu erfinden, die der Gast nicht selbst genannt hat (z. B. "wir hatten viel zu tun", "Personalengpass", "volles Haus", "Küche überlastet"). Wenn etwas schiefgelaufen ist, gib es ehrlich zu, ohne Ausreden zu erfinden (z. B. "Das war ein Fehler von uns. Punkt.").

==================================================
GELERNTE EXZELLENZ-BEISPIELE (Genau dieser Tonfall!):
==================================================
User-Bewertung: „Das Fleisch war zäh und der Kellner hat uns ignoriert.“
Perfekte Antwort: „Hi Christian, danke fürs Feedback. Ganz ehrlich: Das lief bei uns komplett schief. Unser Fleischgrill hat an dem Abend den Geist aufgegeben und wir waren im Service zu zweit statt zu viert. Das ist absolut keine Ausrede, das darf nicht passieren. Es tut mir leid. Wenn du uns noch eine Chance gibst, geht die Vorspeise beim nächsten Mal komplett auf mich. Sag einfach an der Kasse Bescheid. Gruß, Dein Team vom [Restaurantname]“

==================================================
3 VARIANTEN — GENERIERE GENAU DIESE DREI OPTIONEN:
==================================================

VARIANTE 1: Ehrlich & Locker (Duzen)
- Nutze konsequent "Du/Dein".
- Beginne direkt mit dem Problem. Geh sofort auf einen konkreten Moment aus der Bewertung ein (Spiegelung).
- Ton: Direkt, kumpelhaft, ehrlich, sucht keine Ausreden.

VARIANTE 2: Professionell & Höflich (Siezen)
- Nutze konsequent "Sie/Ihr".
- Holt den Gast zuerst als Mensch ab, bevor das Problem benannt wird.
- Ton: Handwerklich sauber, respektvoll, extrem höflich, aber komplett frei von Standard-Floskeln.

VARIANTE 3: Der Detektiv (Nachfrage nach Details)
- Anredeform richtet sich nach: ${duSie}
- Eine knappe Feststellung und die Bitte nach mehr Details, um der Sache auf den Grund zu gehen (max. 2 Sätze).
- Biete einen klaren Kanal (z.B. ${contactEmail || 'unsere E-Mail'}) an.

Alle drei Varianten enden mit der exakten Signatur: ${signature}

==================================================
AUSGABE — NUR dieses JSON, kein anderer Text:
==================================================
{
  "variant1": {"label": "Ehrlich & Locker", "text": "..."},
  "variant2": {"label": "Professionell & Höflich", "text": "..."},
  "variant3": {"label": "Der Detektiv", "text": "..."}
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

1. DIFFERENZIERUNG: Unterscheiden sie sich klar?
   - Variante 1: Ehrlich & Locker (Duzen, problem-first)
   - Variante 2: Professionell & Höflich (Siezen, mensch-first)
   - Variante 3: Der Detektiv (Nachfrage, max. 2 Sätze)

2. PHRASEN- & WORTWAHL-CHECK (STRIKT):
   Lösche oder korrigiere sofort jede Roboter-Floskel wie "intern besprochen", "nachschärfen", "unserem Anspruch entsprechen" oder unangebrachte Worte wie "verreckt". Ersetze sie durch bodenständiges Deutsch.

3. RECHTFERTIGUNGS-VERBOT:
   Prüfe, ob die Antworten Ausreden erfinden (Personalmangel, Stress), die nicht im Review stehen. Wenn ja -> rigoros umschreiben zu einer ehrlichen, nackten Tatsache.

4. GRAMMATIK:
   Fehlen Pronomen wie "Ich" oder "Wir" am Satzanfang (z.B. "Hoffen auf...")? Wenn ja -> korrigieren. Sätze müssen vollständig sein.

5. ABSCHLUSS: Enden alle mit: ${signature}?

==================================================
ENTSCHEIDUNG:
==================================================
- Wenn alle 3 bestehen: setze "changed": null — gib alle drei EXAKT unverändert zurück
- Wenn genau eine schwach ist: rewrite NUR diese eine — setze "changed": 1, 2 oder 3
- Maximal EINE Variante rewriten — nie mehr

AUSGABE — NUR dieses JSON:
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
Schreibe EINE deeskalierende, zutiefst verantwortungsvolle Antwort. Keine Ausreden, keine Phrasen wie "entspricht nicht unserem Anspruch" oder "intern besprochen". Nutze auf keinen Fall Wörter wie "verreckt".

Für das Kontaktangebot exakt diese Struktur nutzen: "Wir würden uns freuen, wenn du uns eine kurze Nachricht an ${contactEmail || 'unsere E-Mail'} schreibst, damit wir das persönlich mit dir klären können."
Länge: 3 bis 4 fließende, vollständige Sätze mit korrekter Grammatik.

Endet mit: ${signature}

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

      let judgeJson = judgeRaw.replace(/```json\s*/g, '').replace(/
```\s*/g, '').trim()
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
      }
    }

    return res.status(200).json({ success: true, answers: finalVariants })

  } catch (error) {
    return res.status(500).json({ error: 'Serverfehler', details: String(error) })
  }
}