import type { VercelRequest, VercelResponse } from '@vercel/node'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const GROQ_API_KEY = process.env.GROQ_API_KEY

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface Settings {
  businessName?: string
  salutation?: 'Du' | 'Sie'
  contactEmail?: string
  responseSignature?: string
  responseLanguage?: 'Deutsch' | 'Englisch' | 'Sprache des Bewerters'
  description?: string
  restaurantType?: string
  cuisineType?: string
  restaurantAtmosphere?: string
  uniqueSellingPoints?: string
  priceRange?: string
}

interface Analysis {
  count: number
  points: string[]
  nominative: string[]
  nominativeArtikel: string[]
  pluralFlags: boolean[]
  categories: string[]
  forceSummarize: boolean
  lobpunkte: string[]
  vorOrtErwaehnt: boolean
  isServiceComplaint: boolean
  ambiguousB: boolean
}

interface BlockOptionen {
  block1_einstieg: { v1: string; v2: string; v3: string }
  block2_kern: { v1: string; v2: string; v3: string }
  block3_abschluss: { v1: string; v2: string; v3: string }
}

// ─── CLASSIFY ─────────────────────────────────────────────────────────────────

function classify(rating: number, reviewText: string): string {
  const wordCount = reviewText.trim().split(/\s+/).filter(Boolean).length
  const hasText = wordCount >= 6
  if (!hasText && rating >= 4) return 'EMPTY_POSITIVE'
  if (!hasText && rating <= 2) return 'EMPTY_NEGATIVE'
  if (!hasText && rating === 3) return 'EMPTY_NEGATIVE'
  if (rating >= 4) return 'CONTENT_POSITIVE'
  if (rating === 3) return 'CONTENT_MIXED'
  return 'CONTENT_NEGATIVE'
}

// ─── SETTINGS RESOLVER ────────────────────────────────────────────────────────

function resolveSettings(settings: Settings | undefined, reviewerName: string) {
  const {
    businessName = 'das Restaurant',
    salutation = 'Sie',
    contactEmail = '',
    responseSignature = '',
    responseLanguage = 'Deutsch',
    description = '',
    restaurantType = '',
    cuisineType = '',
    restaurantAtmosphere = '',
    uniqueSellingPoints = '',
    priceRange = '',
  } = settings || {}

  const isDu = salutation === 'Du'
  const duSie = isDu
    ? 'Du/Dein (Duzen). Schreibe "du", "dir", "dein", "dich" klein.'
    : 'Sie/Ihr (Siezen)'
  const signature = responseSignature || `Das Team von ${businessName}`
  const firstName = reviewerName ? reviewerName.split(' ')[0] : ''
  const firstNameClean = firstName
    ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
    : ''
  const langInstruction =
    responseLanguage === 'Sprache des Bewerters' ? 'Antworte in der Sprache der Bewertung.' :
    responseLanguage === 'Englisch' ? 'Respond in English only.' :
    'Antworte auf Deutsch.'

  const context = [
    `Restaurant: ${businessName}`,
    description          && `Beschreibung: ${description}`,
    restaurantType       && `Typ: ${restaurantType}`,
    cuisineType          && `Kueche: ${cuisineType}`,
    priceRange           && `Preisklasse: ${priceRange}`,
    restaurantAtmosphere && `Atmosphaere: ${restaurantAtmosphere}`,
    uniqueSellingPoints  && `Besonderheiten: ${uniqueSellingPoints}`,
  ].filter(Boolean).join('\n')

  return { businessName, salutation, contactEmail, signature, duSie, isDu, firstNameClean, langInstruction, context }
}

// ─── FORMAT-REGELN ────────────────────────────────────────────────────────────

const FORMAT_RULES = `ABSOLUTES VERBOT — GEDANKENSTRICHE: Verwende niemals "–", "—" oder langen Bindestrich.
ABSOLUTES VERBOT — TAGESZEITEN: Niemals "Abend", "Morgen", "Mittag". Stattdessen "Besuch", "Aufenthalt".
ABSOLUTES VERBOT — DOPPELPUNKT-LABEL: Kein "Zum Service:" oder ähnliche Überschriften.
VERBOTENE EINSTIEGE: Niemals "Vielen Dank für Ihr Feedback", "Danke für Ihre Rückmeldung", "Wir schätzen Ihre Bewertung".
VERBOTENE FLOSKELN: "nehmen wir sehr ernst", "intern adressiert", "Unannehmlichkeiten", "bedauern", "wir werden überprüfen", "wir arbeiten daran", "wir kümmern uns darum".
UMLAUTE: Nutze ä, ö, ü, ß.
GRAMMATIK: Vollständige Sätze. Maximal zwei Kommas pro Satz.`

// ─── POST-PROCESSING: FLOSKEL-FILTER ──────────────────────────────────────────

const VERBOTENE_PHRASEN = [
  'vielen dank für ihr feedback',
  'vielen dank für ihre rückmeldung',
  'wir schätzen ihre bewertung',
  'nehmen wir sehr ernst',
  'intern adressiert',
  'intern nachgeschärft',
  'unannehmlichkeiten',
  'wir werden überprüfen',
  'wir arbeiten daran',
  'wir kümmern uns darum',
  'entspricht nicht unserem anspruch',
  'massnahmen ergriffen',
  'team sensibilisiert',
  'das nehmen wir mit',
  'notiert',
  'verständlicherweise',
  'wir bedauern',
]

function hatVerbotenePhrase(text: string): boolean {
  const lower = text.toLowerCase()
  return VERBOTENE_PHRASEN.some(p => lower.includes(p))
}

function d(isDu: boolean, duText: string, sieText: string): string {
  return isDu ? duText : sieText
}

// ─── CLAUDE API CALL ──────────────────────────────────────────────────────────

async function callClaude(userMessage: string, systemPrompt?: string, model = 'claude-sonnet-4-6', temperature = 0): Promise<string> {
  const body: any = {
    model,
    max_tokens: 1500,
    temperature,
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

function parseJson(raw: string): any {
  const s = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('Kein JSON gefunden: ' + raw)
  return JSON.parse(s.substring(start, end + 1))
}

// ─── ANALYSE ──────────────────────────────────────────────────────────────────

async function analyzeReview(reviewText: string): Promise<Analysis> {
  const systemPrompt = `Analysiere die Restaurant-Bewertung. Extrahiere alle Lob- und Kritikpunkte.
Gib NUR valides JSON zurück:
{
  "count": 1,
  "points": ["Kritikpunkt"],
  "nominative": ["Begriff"],
  "nominativeArtikel": ["der Begriff"],
  "pluralFlags": [false],
  "categories": ["C"],
  "forceSummarize": false,
  "lobpunkte": ["Lobpunkt"],
  "vorOrtErwaehnt": false,
  "isServiceComplaint": false,
  "ambiguousB": false
}`
  const raw = await callClaude(reviewText, systemPrompt, 'claude-haiku-4-5-20251001', 0)
  return parseJson(raw)
}

// ─── BAUSTEIN-GENERATOR (Sonnet + Persona + Few-Shot) ────────────────────────

// ─── DREI KOMPLETTE ANTWORTEN IN EINEM CALL ─────────────────────────────────

async function generateThreeAnswers(
  analysis: Analysis,
  settings: Settings,
  reviewerName: string,
  reviewText: string,
  ownerVoice: string = ''
): Promise<{ label: string; text: string }[]> {
  const { context, duSie, langInstruction, businessName, signature, firstNameClean, isDu } = resolveSettings(settings, reviewerName)
  const lobpunkte = analysis.lobpunkte?.length > 0 ? analysis.lobpunkte.join(', ') : ''
  const voiceKontext = ownerVoice ? `INHABER-KONTEXT (vertraulich): "${ownerVoice}"` : ''
  const isSummarize = analysis.forceSummarize || analysis.count >= 3
  const begruessung = firstNameClean ? `Hallo ${firstNameClean},` : (isDu ? 'Hallo,' : 'Guten Tag,')
  const grussFormel = isDu ? 'Viele Grüße' : 'Mit freundlichen Grüßen'

  const systemPrompt = `Du bist die Stimme von ${businessName} und antwortest auf Gästebewertungen. Warm, herzlich, locker — aber immer respektvoll. Keine leeren Versprechen. Keine reflexartigen Entschuldigungen. Erkläre wenn es Sinn macht.

${FORMAT_RULES}
Anrede: ${duSie}
${langInstruction}

${context}
${voiceKontext}

TONMUSTER (Stil lernen, nicht kopieren):
"Hallo [Name], ich freu mich dass dir unser Essen so geschmeckt hat. Dass die Wartezeit zu lang war, ist nicht das, was wir uns für deinen Besuch wünschen. Wenn du das nächste Mal bei uns bist, gib kurz Bescheid."
"Hallo [Name], dass die Wartezeit so lang war, ist nicht das, was wir uns wünschen. Meld dich gerne direkt bei uns."
"Hallo [Name], schön, dass dir bei uns etwas gefallen hat. Dass die Atmosphäre nicht ganz dein Ding war, ist schade. Am Ende ist Ambiente halt Geschmackssache."

AUFGABE: Schreibe 3 fertige, komplett unterschiedliche Antworten auf diese Bewertung.
Bewertung: "${reviewText}"
${lobpunkte ? `Lobpunkte: ${lobpunkte}` : ''}

REGELN:
- Jede Antwort startet mit "${begruessung}" und endet mit "${grussFormel},\n${signature}"
- Kein Dankeschön als Einstieg — direkt ins Thema
- Maximal 4 Sätze pro Antwort (ohne Begrüßung und Gruß)
- Kein Satz darf sich innerhalb derselben Antwort inhaltlich wiederholen
- Nie zweimal zum nächsten Besuch einladen in derselben Antwort
${isSummarize ? '- Viele Kritikpunkte: NICHT jeden einzeln aufzählen. Ein Satz reicht ("Da ist einiges nicht gelaufen wie es sollte."), dann Kontext wenn vorhanden, dann ein Tipp.' : ''}

Variante A: Direkt, ehrlich, klar.
Variante B: Herzlich, warm, gastfreundlich.
Variante C: Kurz, ein Satz pro Gedanke, kein Wort zu viel.

Gib NUR valides JSON zurück:
{"varA": "...", "varB": "...", "varC": "..."}`

  const raw = await callClaude(`3 Antworten für: ${reviewText}`, systemPrompt, 'claude-sonnet-4-6', 0.3)
  const parsed = parseJson(raw)
  return [
    { label: 'Variante A', text: parsed.varA },
    { label: 'Variante B', text: parsed.varB },
    { label: 'Variante C', text: parsed.varC },
  ]
}

// ─── AUDIO TRANSKRIPTION (Groq Whisper) ──────────────────────────────────────

async function transcribeAudio(audioBase64: string, mimeType: string): Promise<string> {
  const binaryStr = atob(audioBase64)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
  const blob = new Blob([bytes], { type: mimeType })

  const formData = new FormData()
  formData.append('file', blob, 'audio.webm')
  formData.append('model', 'whisper-large-v3')
  formData.append('language', 'de')
  formData.append('response_format', 'text')

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` },
    body: formData,
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Groq Whisper Fehler: ${err}`)
  }

  return (await response.text()).trim()
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  const { action, audioBase64, mimeType, review, settings, ownerVoice } = req.body

  // TRANSCRIBE
  if (action === 'transcribe') {
    if (!audioBase64) return res.status(400).json({ success: false, error: 'audioBase64 fehlt' })
    try {
      const transcript = await transcribeAudio(audioBase64, mimeType || 'audio/webm')
      return res.status(200).json({ success: true, transcript })
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      return res.status(500).json({ success: false, error: errMsg })
    }
  }

  if (!review) return res.status(400).json({ success: false, error: 'review fehlt' })

  const reviewText   = review.reviewText || ''
  const stars        = Number(review.stars) || 3
  const reviewerName = review.reviewerName || ''

  try {
    // 1. Analyse (Haiku — günstig und schnell)
    const mode = classify(stars, reviewText)
    const analysis = await analyzeReview(reviewText)

    const { signature, isDu, firstNameClean } = resolveSettings(settings, reviewerName)
    const begruessung = firstNameClean ? `Hallo ${firstNameClean},` : d(isDu, 'Hallo,', 'Guten Tag,')
    const grussFormel = d(isDu, 'Viele Grüße', 'Mit freundlichen Grüßen')

    // 2. Direkt-Route für rein positive Bewertungen
    if (mode === 'CONTENT_POSITIVE' && analysis.count === 0) {
      const kernSatz = d(isDu,
        'Ich freu mich dass dir dein Besuch bei uns so gut gefallen hat. Komm gerne wieder vorbei.',
        'Es freut uns sehr, dass Ihnen Ihr Besuch bei uns so gut gefallen hat. Kommen Sie gerne wieder.'
      )
      const text = `${begruessung}\n\n${kernSatz}\n\n${grussFormel},\n${signature}`
      return res.status(200).json({ success: true, answers: [{ label: 'Antwort', text }] })
    }

    // 3. Drei fertige Antworten in einem Call
    const rawAnswers = await generateThreeAnswers(analysis, settings, reviewerName, reviewText, ownerVoice || '')

    // 4. Post-Processing — Floskel-Check
    const answers = [
      ...rawAnswers.filter(a => !hatVerbotenePhrase(a.text)),
      ...rawAnswers.filter(a => hatVerbotenePhrase(a.text)),
    ]

    return res.status(200).json({ success: true, answers })

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('generate-replies-v5 FEHLER:', errMsg)
    return res.status(500).json({ success: false, error: errMsg })
  }
}
