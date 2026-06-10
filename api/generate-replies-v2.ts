import type { VercelRequest, VercelResponse } from '@vercel/node'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY

// ─── CLASSIFY (Sterne + Textlänge, nur für EMPTY-Modi) ────────────────────
function classify(rating: number, reviewText: string): string {
  const wordCount = reviewText.trim().split(/\s+/).filter(Boolean).length
  const hasText = wordCount >= 6
  if (!hasText && rating >= 4) return 'EMPTY_POSITIVE'
  if (!hasText && rating <= 2) return 'EMPTY_NEGATIVE'
  return 'CONTENT'
}

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────
function buildSystemPrompt(settings: any): string {
  const contactEmail = settings?.contactEmail || ''
  const emailRef = contactEmail ? ` unter ${contactEmail}` : ''

  // Mittagstisch: aus der Restaurantbeschreibung ableiten
  const hasMittagstisch = settings?.description
    ? /mittagstisch|mittagsangebot|mittagskarte|mittags/i.test(settings.description)
    : false

  const preisBlock = hasMittagstisch
    ? `  Direkt & Ehrlich:      "Wenn du mittags vorbeischaust liegt das Preisniveau uebrigens etwas anders, koennte ein fairer Test sein."
  Ruhig & Professionell: "Unser Mittagsangebot ist preislich zugaenglicher, falls das eine Alternative waere."
  Fokus auf Klaerung:    "Schau gerne mal mittags vorbei, da bekommst du einen anderen Eindruck beim Preis."`
    : `  Kein Tipp. Antwort endet nach Schritt 2 mit einer souveraenen Haltung. Keine Einladung zur Diskussion.
  Haltung (jede Variante anders formulieren): Wir setzen konsequent auf Qualitaet und frische Ware, dafuer stehen wir.`

  return `Du bist ein erfahrener Gastronom, der seit Jahren selbst hinter der Theke steht.
Du schreibst Antworten auf Google-Bewertungen — kurz, direkt, menschlich.
Deine erste Aufgabe ist immer die Wahrnehmungs-Bruecke: Du validierst wie sich der Gast gefuehlt hat, ohne Schuld beim Restaurant zu suchen.
Du klingst nie wie eine PR-Agentur, ein Konzern oder eine KI.
Du klingst wie jemand dem das Restaurant wirklich gehoert.

==================================================
DAS SOUVERAENE DREI-SCHRITT-SYSTEM
==================================================

SCHRITT 1 — BEGRUESSUNG (fest, kurz):
Unaufgeregter Gruss auf Augenhoehe. Name immer korrekt kapitalisiert — nie in Grossbuchstaben.
  Direkt & Ehrlich:      beginnt mit "Hey [Name]," oder "Hi [Name],"
  Ruhig & Professionell: beginnt mit "Hallo [Name],"
  Fokus auf Klaerung:    beginnt mit "Hi [Name]," oder "Hallo [Name],"
Kein Name bekannt: "Hey," / "Hallo," / "Hi,"

SCHRITT 2 — EMOTIONALE BRUECKE + VERDECKTES MARKETING:
Prinzip: Gefuehl validieren ohne Urteil. Situation als Qualitaetsmerkmal framen.
Schluesselwoerter (neutral, lassen offen wie es wirklich war):
"rubergekommen" / "gefuehlt" / "gewirkt" / "angekommen" / "wahrgenommen"

Jede Variante nutzt eine andere Technik:

Technik 1 — Persoenliche Resonanz (fuer Variante "Direkt & Ehrlich"):
Ich-Form, direktes Gefuehl im Moment, nah dran.
Beispiel: "Ich kann absolut nachvollziehen, dass das im ersten Moment ziemlich bloed bei dir rubergekommen ist."

Technik 2 — Vorfreude-Dynamik (fuer Variante "Ruhig & Professionell"):
Enttaeuschte Erwartung anerkennen, ruhig, einfu ehlsam.
Beispiel: "Ich verstehe vollkommen, dass das enttaeuschend gewirkt hat, wenn man mit einer anderen Erwartung zu uns kommt."

Technik 3 — Ablauf-Perspektive (fuer Variante "Fokus auf Klaerung"):
Sachlicher, loesungsorientiert, kuerzer.
Beispiel: "Ich verstehe vollkommen, dass das bloed ruberkommt, wenn der Abend ploetzlich so ins Stocken geraet."

Bruecke zum verdeckten Marketing (NICHT bei Kategorie UNFREUNDLICHKEIT verwenden):
Waehle eine dieser Varianten und baue sie natuerlich in Schritt 2 ein:
- "liegt einfach daran, dass bei uns abends oft richtig die Bude brennt und es extrem lebhaft zugeht."
- "bei uns brennt abends halt oft richtig die Bude und es geht extrem lebhaft zu."
- "man muss dazu sagen, dass bei uns abends oft richtig die Bude brennt und es extrem lebhaft zugeht."

SCHRITT 3 — GASTGEBER-AUSSTIEG (kategorie-spezifisch):
Konkreter Insider-Tipp. Kein Betteln. Keine Standard-Kontaktfloskeln. Dem Gast die Kontrolle zurueckgeben.

==================================================
KATEGORIE-ERKENNUNG — PRIORITAETSHIERARCHIE
==================================================

Analysiere die Bewertung und waehle EINE Hauptkategorie:
1. UNFREUNDLICHKEIT — persoenliche Verletzung durch Personal oder Umgang
2. SERVICE           — operativer Fehler (falsches Gericht, Wartezeit, Ablaeufe)
3. ESSEN             — Geschmack oder Zubereitung
4. PREIS             — Preis-Leistungs-Verhaeltnis, Portionsgroesse
5. ERLEBNIS          — Tisch, Lautstaerke, Atmosphaere, Ambiente

Bei mehreren Kategorien gewinnt immer die hoehere in der Hierarchie.
Sonderfall GEMISCHT: Bewertung ueberwiegend positiv mit kleinem Kritikpunkt. Kein Schritt 3, nur warme Verabschiedung.

==================================================
SCHRITT 3 BUILDING BLOCKS JE KATEGORIE
==================================================

ERLEBNIS:
  Direkt & Ehrlich:      "Frag beim naechsten Mal einfach kurz nach einem ruhigeren Platz, wir schauen was wir machen koennen."
  Ruhig & Professionell: "Bei deiner naechsten Reservierung kannst du gerne einen Platz etwas abseits des Trubels anfragen, wir schauen dann was moeglich ist."
  Fokus auf Klaerung:    "Sag beim naechsten Mal kurz Bescheid was du brauchst, wir finden eine Loesung."

ESSEN (Geschmacks-Weiche — erkenne intern: Zubereitung oder Geschmack):
  Direkt & Ehrlich:      "War es Geschmackssache oder hat in der Kueche was nicht gestimmt? Das macht fuer uns einen Unterschied."
  Ruhig & Professionell: "Damit wir das einordnen koennen, lag es am persoenlichen Geschmack oder lief bei der Zubereitung etwas schief?"
  Fokus auf Klaerung:    "Meld dich kurz, war es Geschmack oder Kueche? Das wollen wir verstehen."

SERVICE:
  Direkt & Ehrlich:      "Meld dich kurz direkt bei uns, solche Sachen wollen wir nicht einfach so stehen lassen."
  Ruhig & Professionell: "Wir wuerden das gerne persoenlich mit dir klaeren.${contactEmail ? ' Schreib uns kurz unter ' + contactEmail + '.' : ''}"
  Fokus auf Klaerung:    "Schreib uns kurz${emailRef}, dann klaeren wir das direkt."

UNFREUNDLICHKEIT (kein Framing, nur ehrliche Direktheit):
  Direkt & Ehrlich:      "Meld dich bitte kurz direkt bei uns, solche Momente wollen wir verstehen und nicht einfach ignorieren."
  Ruhig & Professionell: "Wir wuerden gerne persoenlich mit dir sprechen um zu verstehen was passiert ist.${contactEmail ? ' Du erreichst uns unter ' + contactEmail + '.' : ''}"
  Fokus auf Klaerung:    "Schreib uns direkt${emailRef}, wir moechten wissen was vorgefallen ist."

PREIS:
${preisBlock}

GEMISCHT (kein Schritt 3 — nur warme Verabschiedung am Ende):
  Direkt & Ehrlich:      "Bis beim naechsten Mal."
  Ruhig & Professionell: "Wir freuen uns auf deinen naechsten Besuch."
  Fokus auf Klaerung:    "Bis bald."

==================================================
ABSOLUT VERBOTEN
==================================================

Einzelwoerter: "entschuldigen", "entschuldigt", "Entschuldigung", "Dynamik", "Respektlosigkeit", "Schande", "Service-Exzellenz"
Phrasen:
- "logistische Rahmenbedingungen"
- "intern nachgeschaerft" / "intern adressiert" / "intern klar gemacht"
- "nehmen wir sehr ernst"
- "entspricht nicht unserem Anspruch" / "nicht das wofuer wir stehen"
- "Massnahmen ergriffen" / "Team sensibilisiert" / "Konsequenzen gezogen"
- "Das tut uns sehr leid"
- "Vielen Dank fuer Ihre/deine Bewertung"
- "Wir freuen uns ueber Ihr/dein Feedback"
- "Das freut uns sehr" / "Das freut uns riesig"
- "Wir hoffen dich bald wieder begruessen zu duerfen"
- "Das haette nicht passieren duerfen"
- "unser Team" als gesichtslose Kollektivformulierung
Formatierung:
- Keine Gedankenstriche (weder em-dash noch Bindestrich als Satzteiler)
- Keine Aufzaehlung von Beschwerdepunkten
- Kein woertliches Wiederholen der Kritik
- Nichts doppelt sagen`
}

// ─── CONTENT PROMPT BUILDER ───────────────────────────────────────────────
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

  const duSieAnrede = salutation === 'Du' ? 'Du/Dein (Duzen)' : 'Sie/Ihr (Siezen)'
  const anredeHinweis = salutation === 'Du'
    ? 'Nutze konsequent die Du-Form (du, dein, dir). Schreibe "dir" und "dein" klein.'
    : 'Nutze konsequent die Sie-Form (Sie, Ihr, Ihnen). Schreibe "Sie" und "Ihr" immer gross.'
  const signature = responseSignature || `Das Team von ${businessName}`

  const firstName = reviewerName ? reviewerName.split(' ')[0] : ''
  const firstNameCapitalized = firstName
    ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
    : ''

  const langInstruction =
    responseLanguage === 'Sprache des Bewerters'
      ? 'Antworte in der Sprache der Bewertung. Erkenne sie automatisch.'
      : responseLanguage === 'Englisch'
      ? 'Respond in English only.'
      : responseLanguage === 'Deutsch und Englisch'
      ? 'Antworte auf Deutsch und fuege direkt danach eine englische Uebersetzung in Klammern hinzu.'
      : 'Antworte auf Deutsch.'

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

  const systemPrompt = buildSystemPrompt(settings)

  const userMessage = `${langInstruction}
Anredeform fuer ALLE Varianten: ${duSieAnrede}. ${anredeHinweis}

RESTAURANT-KONTEXT:
${context}

BEWERTUNG (${rating} Sterne):
"${reviewText}"

BEWERTER: ${firstNameCapitalized || '(kein Name bekannt)'}

AUFGABE:
1. Erkenne die Hauptkategorie nach der Prioritaetshierarchie (output im "category"-Feld).
2. Pruefe ob Gemischt-Flag gilt.
3. Schreibe 3 Varianten nach dem Drei-Schritt-System mit den passenden Bausteinen.
4. Jede Variante endet mit: ${signature}

Variante 1 — Direkt & Ehrlich:
Technik 1 (Persoenliche Resonanz) fuer Schritt 2. Locker, ich-Form.
Schritt 3: Building Block "Direkt & Ehrlich" der erkannten Kategorie.

Variante 2 — Ruhig & Professionell:
Technik 2 (Vorfreude-Dynamik) fuer Schritt 2. Empathisch, ruhig.
Schritt 3: Building Block "Ruhig & Professionell" der erkannten Kategorie.

Variante 3 — Fokus auf Klaerung:
Technik 3 (Ablauf-Perspektive) fuer Schritt 2. Kuerzer, max. 3 Saetze gesamt.
Schritt 3: Building Block "Fokus auf Klaerung" der erkannten Kategorie.

AUSGABE — NUR dieses JSON, kein anderer Text:
{
  "category": "Erlebnis | Essen | Preis | Service | Unfreundlichkeit | Gemischt",
  "variant1": {"label": "Direkt & Ehrlich", "text": "..."},
  "variant2": {"label": "Ruhig & Professionell", "text": "..."},
  "variant3": {"label": "Fokus auf Klaerung", "text": "..."}
}`

  return JSON.stringify({ _system: systemPrompt, _user: userMessage })
}

// ─── EMPTY POSITIVE ───────────────────────────────────────────────────────
function buildEmptyPositivePrompt(rating: number, reviewerName: string, settings: any): string {
  const {
    businessName = 'das Restaurant',
    responseSignature = '',
    salutation = 'Sie',
    responseLanguage = 'Deutsch',
  } = settings || {}

  const signature = responseSignature || `Das Team von ${businessName}`
  const firstName = reviewerName ? reviewerName.split(' ')[0] : ''
  const firstNameCapitalized = firstName
    ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
    : ''

  const langInstruction = responseLanguage === 'Sprache des Bewerters'
    ? 'Antworte in der Sprache der Bewertung.'
    : responseLanguage === 'Englisch' ? 'Respond in English only.'
    : 'Antworte auf Deutsch.'

  const greeting = firstNameCapitalized ? `mit dem Namen "${firstNameCapitalized}"` : 'ohne Namen'

  return `Du bist eine Hospitality Response Engine fuer "${businessName}".
${langInstruction}

BEWERTUNG: ${rating} Sterne — kein Text.

AUFGABE: 3 kurze, herzliche Antworten. Max. 2 Saetze. Keine Floskeln. Keine Dankesformeln.
Schreibe wie gesprochen, nicht wie formuliert. Jede Antwort beginnt ${greeting}.
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
- Gedankenstriche

AUSGABE — NUR dieses JSON:
{"variant1":{"label":"Herzlich","text":"..."},"variant2":{"label":"Persoenlich","text":"..."},"variant3":{"label":"Kurz & warm","text":"..."}}`
}

// ─── EMPTY NEGATIVE ───────────────────────────────────────────────────────
function buildEmptyNegativePrompt(rating: number, reviewerName: string, settings: any): string {
  const {
    businessName = 'das Restaurant',
    responseSignature = '',
    salutation = 'Sie',
    contactEmail = '',
    responseLanguage = 'Deutsch',
  } = settings || {}

  const signature = responseSignature || `Das Team von ${businessName}`
  const firstName = reviewerName ? reviewerName.split(' ')[0] : ''
  const firstNameCapitalized = firstName
    ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
    : ''

  const langInstruction = responseLanguage === 'Sprache des Bewerters'
    ? 'Antworte in der Sprache der Bewertung.'
    : responseLanguage === 'Englisch' ? 'Respond in English only.'
    : 'Antworte auf Deutsch.'

  const contactLine = contactEmail
    ? `Kontaktkanal: ${contactEmail}`
    : 'Kein Kontaktkanal hinterlegt — ohne E-Mail-Hinweis'

  const greeting = firstNameCapitalized ? `mit dem Namen "${firstNameCapitalized}"` : 'ohne Namen'

  return `Du bist eine Hospitality Response Engine fuer "${businessName}".
${langInstruction}

BEWERTUNG: ${rating} Sterne — kein Text.

AUFGABE: 3 Antworten. Anerkennen + Einladung zur direkten Kontaktaufnahme. Kein Druck.
${contactLine}
Max. 3 Saetze. Schreibe wie gesprochen. Nie mit Dankesformel beginnen. Keine leeren Entschuldigungen.
Jede Antwort beginnt ${greeting}.
Alle drei enden mit: ${signature}

BEISPIELE (genau dieser Ton):
- "Da scheint ja einiges schiefgelaufen zu sein. Ohne mehr zu wissen, koennen wir's schwer einordnen."
- "So ganz ohne Kontext ist das schwer. Wenn du magst, schreib uns kurz."
- "Schade, dass du uns so erlebt hast. Meld dich gern direkt, wenn du magst."

ABSOLUT VERBOTEN:
- "Vielen Dank fuer Ihre/deine Bewertung"
- "Das tut uns sehr leid"
- "Wir bitten um Verstaendnis"
- Gedankenstriche

AUSGABE — NUR dieses JSON:
{"variant1":{"label":"Direkt & Ehrlich","text":"..."},"variant2":{"label":"Ruhig & Professionell","text":"..."},"variant3":{"label":"Fokus auf Klaerung","text":"..."}}`
}

// ─── RECOVERY PROMPT (1–2 Sterne, 4. Variante) ────────────────────────────
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
  const firstNameClean = firstName
    ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
    : ''

  const langInstruction = responseLanguage === 'Sprache des Bewerters'
    ? 'Antworte in der Sprache der Bewertung.'
    : responseLanguage === 'Englisch' ? 'Respond in English only.'
    : 'Antworte auf Deutsch.'

  const systemPrompt = `Erstelle eine deeskalierende, menschliche und verantwortungsvolle Antwort auf eine sehr negative Google-Bewertung.
Schreibe wie ein aufmerksamer Gastronom — nicht wie Kundenservice, PR-Agentur oder KI.
Grundregeln: Keine Nacherzaehlung. Keine Floskeln. Natuerliche Sprache, kurze Saetze.
Ziel: Vertrauen zurueckgewinnen und persoenliche Klaerung anbieten.
Laenge: 3 bis 4 vollstaendige Saetze.`

  const userMessage = `${langInstruction} Anredeform: ${duSie}

Restaurant: ${businessName}
${contactEmail ? `Kontakt-E-Mail: ${contactEmail}` : ''}

Bewertung von ${firstNameClean || 'einem Gast'} (1-2 Sterne):
"${reviewText}"

Schreibe EINE deeskalierende Antwort.
${firstNameClean ? `Beginne mit "Hallo ${firstNameClean},"` : 'Kein Name bekannt — ohne persoenliche Anrede beginnen.'}
${contactEmail ? `Kontaktangebot: Bitte meld dich kurz unter ${contactEmail}, damit wir das persoenlich klaeren koennen.` : ''}
Endet mit: ${signature}

AUSGABE — NUR dieses JSON:
{"label":"Deeskalierend","text":"..."}`

  return JSON.stringify({ _system: systemPrompt, _user: userMessage })
}

// ─── HELPER: CLAUDE API CALL ───────────────────────────────────────────────
async function callClaude(userMessage: string, systemPrompt?: string): Promise<string> {
  const body: any = {
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: userMessage }],
  }
  if (systemPrompt) body.system = systemPrompt

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

// ─── HELPER: GEMINI API CALL (optional, fuer zukuenftige Nutzung) ──────────
async function callGemini(userMessage: string, systemPrompt?: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`
  const body: any = {
    contents: [{ parts: [{ text: userMessage }] }],
    generationConfig: { maxOutputTokens: 4000, temperature: 0.7 },
  }
  if (systemPrompt) body.systemInstruction = { parts: [{ text: systemPrompt }] }

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

// ─── HELPER: JSON PARSE ────────────────────────────────────────────────────
function parseResponse(raw: string): {
  category: string
  variants: { label: string; text: string; isRecovery?: boolean }[]
} {
  let jsonStr = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  const startIdx = jsonStr.indexOf('{')
  const endIdx = jsonStr.lastIndexOf('}')
  if (startIdx === -1 || endIdx === -1) throw new Error('Kein JSON gefunden: ' + raw)
  jsonStr = jsonStr.substring(startIdx, endIdx + 1)

  const parsed = JSON.parse(jsonStr)
  const cleanText = (t: string) => t.replace(/\n\n/g, ' ').replace(/\n/g, ' ').trim()

  return {
    category: parsed.category || 'Unbekannt',
    variants: [
      { label: parsed.variant1?.label || 'Variante 1', text: cleanText(parsed.variant1?.text || '') },
      { label: parsed.variant2?.label || 'Variante 2', text: cleanText(parsed.variant2?.text || '') },
      { label: parsed.variant3?.label || 'Variante 3', text: cleanText(parsed.variant3?.text || '') },
    ],
  }
}

// ─── HELPER: SIMPLE VARIANTS PARSE (fuer EMPTY-Modi) ──────────────────────
function parseVariants(raw: string): { label: string; text: string }[] {
  let jsonStr = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  const startIdx = jsonStr.indexOf('{')
  const endIdx = jsonStr.lastIndexOf('}')
  if (startIdx === -1 || endIdx === -1) throw new Error('Kein JSON gefunden: ' + raw)
  jsonStr = jsonStr.substring(startIdx, endIdx + 1)

  const parsed = JSON.parse(jsonStr)
  const cleanText = (t: string) => t.replace(/\n\n/g, ' ').replace(/\n/g, ' ').trim()

  return [
    { label: parsed.variant1?.label || 'Variante 1', text: cleanText(parsed.variant1?.text || '') },
    { label: parsed.variant2?.label || 'Variante 2', text: cleanText(parsed.variant2?.text || '') },
    { label: parsed.variant3?.label || 'Variante 3', text: cleanText(parsed.variant3?.text || '') },
  ]
}

// ─── CONTEXT CHECK ─────────────────────────────────────────────────────────
async function checkContext(reviewText: string, description: string): Promise<{ ok: boolean; missing?: string }> {
  const wordCount = reviewText.trim().split(/\s+/).filter(Boolean).length
  if (wordCount < 6) return { ok: true }

  const systemPrompt = `Du bist ein strikter Qualitaetspruefer fuer Restaurant-Antworten.
Deine einzige Aufgabe: Entscheide ob das Restaurantprofil genueg Informationen enthaelt um auf diese Bewertung sicher zu antworten — ohne etwas erfinden zu muessen.

Antworte NUR mit einem dieser zwei Formate:
OK
MISSING: [kurze Beschreibung was fehlt, max. 1 Satz auf Deutsch]

Wann ist MISSING korrekt?
- Die Bewertung enthaelt einen konkreten Vorwurf ueber eine spezifische Situation oder Entscheidung des Restaurants (z.B. Platzvergabe, Reservierungspolitik, Hausregeln, spezifische Ablaeufe)
- UND das Profil enthaelt dazu keine Erklaerung oder Regel

Wann ist OK korrekt?
- Allgemeine Kritik (Essen, Service, Wartezeit, Atmosphaere)
- Das Profil enthaelt eine passende Erklaerung
- Die Bewertung ist positiv oder neutral

Sei NICHT ueberstreng. Im Zweifel: OK.`

  const userMessage = `RESTAURANTPROFIL:
${description || '(keine Beschreibung eingetragen)'}

BEWERTUNG:
"${reviewText}"

Ist das Profil ausreichend um sicher zu antworten?`

  try {
    const result = await callClaude(userMessage, systemPrompt)
    const trimmed = result.trim()
    if (trimmed.startsWith('MISSING:')) {
      return { ok: false, missing: trimmed.replace('MISSING:', '').trim() }
    }
    return { ok: true }
  } catch (e) {
    console.error('Context check failed, proceeding anyway:', e)
    return { ok: true }
  }
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

  const reviewText   = review.reviewText   || ''
  const stars        = review.stars        || 3
  const reviewerName = review.reviewerName || ''

  const businessName = settings?.businessName || 'das Restaurant'
  const signature    = settings?.responseSignature || `Das Team von ${businessName}`

  try {
    // ── SCHRITT 0: Context Check ──────────────────────────────────────────
    const description  = settings?.description || ''
    const contextCheck = await checkContext(reviewText, description)
    if (!contextCheck.ok) {
      return res.status(200).json({
        success: false,
        missingContext: true,
        missingInfo: contextCheck.missing || 'Fehlende Informationen im Restaurantprofil',
      })
    }

    const mode = classify(stars, reviewText)

    // ── SCHRITT 1: EMPTY-Modi ─────────────────────────────────────────────
    if (mode === 'EMPTY_POSITIVE') {
      const prompt = buildEmptyPositivePrompt(stars, reviewerName, settings)
      const raw    = await callClaude(prompt)
      const variants = parseVariants(raw)
      return res.status(200).json({ success: true, answers: variants })
    }

    if (mode === 'EMPTY_NEGATIVE') {
      const prompt = buildEmptyNegativePrompt(stars, reviewerName, settings)
      const raw    = await callClaude(prompt)
      const variants = parseVariants(raw)
      return res.status(200).json({ success: true, answers: variants })
    }

    // ── SCHRITT 2: Content-Generierung (3-Schritt-System) ─────────────────
    const promptStr = buildPrompt(reviewText, stars, reviewerName, settings)
    let generatorRaw: string

    try {
      const parsed = JSON.parse(promptStr)
      generatorRaw = await callClaude(parsed._user, parsed._system)
    } catch {
      generatorRaw = await callClaude(promptStr)
    }

    const { category, variants: generatedVariants } = parseResponse(generatorRaw)

    // ── SCHRITT 3: Recovery (nur bei 1–2 Sternen als 4. Variante) ─────────
    let finalVariants: { label: string; text: string; isRecovery?: boolean }[] = generatedVariants

    if (stars <= 2) {
      try {
        const recoveryStr = buildRecoveryPrompt(reviewText, reviewerName, settings)
        let recoveryRaw: string

        try {
          const recoveryParsed = JSON.parse(recoveryStr)
          recoveryRaw = await callClaude(recoveryParsed._user, recoveryParsed._system)
        } catch {
          recoveryRaw = await callClaude(recoveryStr)
        }

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
              { label: parsed.label || 'Deeskalierend', text: cleanText(parsed.text), isRecovery: true },
            ]
          }
        }
      } catch (e) {
        console.error('Recovery generation failed:', e)
      }
    }

    return res.status(200).json({ success: true, category, answers: finalVariants })

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('generate-replies-v2 FEHLER:', errMsg)
    return res.status(500).json({ error: 'Serverfehler', details: errMsg })
  }
}
