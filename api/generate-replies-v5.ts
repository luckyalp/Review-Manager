import type { VercelRequest, VercelResponse } from '@vercel/node'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

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

const FORMAT_RULES = `ABSOLUTES VERBOT — GEDANKENSTRICHE: Verwende niemals "–", "—" oder langen Bindestrich. Ersetze durch Punkt oder Komma.
ABSOLUTES VERBOT — TAGESZEITEN: Niemals "Abend", "Morgen", "Mittag", "Nacht", "Fruehstueck". Stattdessen "Besuch", "Aufenthalt", "Zeit bei uns".
ABSOLUTES VERBOT — DOPPELPUNKT-LABEL: Kein "Zur Tischzeit:" oder aehnliche Ueberschriften. Durchgehende Saetze.
VERBOTENE WOERTER: "frustrierend", "intern adressiert", "intern nachgeschaerft", "massnahmen ergriffen", "entspricht nicht unserem anspruch", "nehmen wir sehr ernst", "gib uns eine chance", "unannehmlichkeiten", "bedauern", "verständnis".
UMLAUTE: Nutze ä, ö, ü, ß — niemals ae, oe, ue.
RESTAURANTPROFIL: Nutze Angaben aus dem Restaurantprofil nur sinngemaess — niemals woertlich zitieren oder als Adjektiv-Kette einfuegen. Leite nichts aus dem Restaurantnamen ab.
GRAMMATIK: Jeder Satz muss vollstaendig sein (Subjekt, Praedikat). Maximal zwei Kommas pro Satz — sonst aufteilen.`

function d(isDu: boolean, duText: string, sieText: string): string {
  return isDu ? duText : sieText
}

// ─── CLAUDE API CALL ──────────────────────────────────────────────────────────

async function callClaude(userMessage: string, systemPrompt?: string, model = 'claude-haiku-4-5-20251001', temperature = 0): Promise<string> {
  const body: any = {
    model,
    max_tokens: 1200,
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

async function checkContext(reviewText: string, description: string): Promise<{ ok: boolean; missing?: string }> {
  const systemPrompt = `Analysiere, ob in der Bewertung Punkte kritisiert werden, deren genauer Hintergrund unklar ist.
Gib NUR ein valides JSON-Objekt zurück: { "ok": true, "missing": "" }`

  const raw = await callClaude(`Profil: ${description}\n\nBewertung: ${reviewText}`, systemPrompt)
  try { return parseJson(raw) } catch { return { ok: true } }
}

async function analyzeReview(reviewText: string): Promise<Analysis> {
  const systemPrompt = `Analysiere die Restaurant-Bewertung. Kategorien: A (Konzept/Struktur), B (Echter Fehler/Service), C (Subjektiv/Geschmack/Menge).
Gib NUR valides JSON zurück:
{
  "count": 1,
  "points": ["Kritikpunkt"],
  "nominative": ["Trüffelmayonnaise"],
  "nominativeArtikel": ["die Trüffelmayonnaise"],
  "pluralFlags": [false],
  "categories": ["C"],
  "forceSummarize": false,
  "lobpunkte": [],
  "vorOrtErwaehnt": false,
  "isServiceComplaint": false,
  "ambiguousB": false
}`

  const raw = await callClaude(reviewText, systemPrompt)
  return parseJson(raw)
}

// ─── 3 VOLLSTÄNDIGE ANTWORTEN GENERIEREN ─────────────────────────────────────

async function generateThreeCompleteAnswers(
  reviewText: string,
  analysis: Analysis,
  settings: Settings,
  reviewerName: string
): Promise<{ label: string; text: string }[]> {
  const { context, duSie, langInstruction, signature, firstNameClean, isDu } = resolveSettings(settings, reviewerName)

  const begruessung = firstNameClean ? `Hallo ${firstNameClean},` : d(isDu, 'Hallo,', 'Guten Tag,')
  const grussFormel = d(isDu, 'Viele Grüße', 'Mit freundlichen Grüßen')

  const systemPrompt = `Du bist ein erfahrener Gastronom, der persönlich auf Gästebewertungen antwortet. Schreibe exakt 3 unterschiedliche, vollständige Antwort-Varianten.

${FORMAT_RULES}
Anrede-Modus unbedingt einhalten: ${duSie}
${langInstruction}

Restaurant-Profilkontext:
${context}

STRUKTUR JEDER VARIANTE:
- Startet zwingend mit: "${begruessung}"
- Geht auf ALLE Kritikpunkte aus der Bewertung ein — keinen auslassen
- Endet zwingend mit: "${grussFormel},\n${signature}"

STILISTISCHE AUSRICHTUNG:
- Variante A (Ehrlich & Direkt): Gibt Fehler offen zu, kein Drumherumreden, klare Aussagen.
- Variante B (Erklärend & Sachlich): Erklärt Hintergründe ruhig und gastfreundlich, ohne defensiv zu wirken.
- Variante C (Charmant & Zukunftsorientiert): Herzlicher Ton, rückt das Positive in den Vordergrund, lädt zur Wiederkehr ein.

Gib AUSSCHLIESSLICH valides JSON zurück:
{
  "answers": [
    { "label": "Variante A", "text": "..." },
    { "label": "Variante B", "text": "..." },
    { "label": "Variante C", "text": "..." }
  ]
}`

  const userMessage = `Erkannte Kritikpunkte: ${analysis.points.join(', ')}\n\nOriginal-Bewertung:\n${reviewText}`
  const raw = await callClaude(userMessage, systemPrompt, 'claude-haiku-4-5-20251001', 0.2)

  const parsed = parseJson(raw)
  return parsed.answers
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  const { review, settings } = req.body
  if (!review) return res.status(400).json({ success: false, error: 'review fehlt' })

  const reviewText   = review.reviewText || ''
  const stars        = Number(review.stars) || 3
  const reviewerName = review.reviewerName || ''

  try {
    // 1. Context-Check
    const contextCheck = await checkContext(reviewText, settings?.description || '')
    if (!contextCheck.ok) {
      return res.status(200).json({ success: false, missingContext: true, missingInfo: contextCheck.missing })
    }

    // 2. Analyse
    const mode = classify(stars, reviewText)
    const analysis = await analyzeReview(reviewText)

    // 3. Direkt-Route für rein positive Bewertungen
    if (mode === 'CONTENT_POSITIVE' && analysis.count === 0) {
      const { signature, isDu, firstNameClean } = resolveSettings(settings, reviewerName)
      const begruessung = firstNameClean ? `Hallo ${firstNameClean},\n\n` : ''
      const kernSatz = d(isDu,
        'Danke, das freut uns wirklich. Komm gerne wieder vorbei.',
        'Danke, das freut uns wirklich. Kommen Sie gerne wieder vorbei.'
      )
      const gruss = d(isDu, 'Viele Grüße', 'Mit freundlichen Grüßen')
      const text = `${begruessung}${kernSatz}\n\n${gruss},\n${signature}`
      return res.status(200).json({ success: true, answers: [{ label: 'Antwort', text }] })
    }

    // 4. 3 vollständige Antworten generieren
    const answers = await generateThreeCompleteAnswers(reviewText, analysis, settings, reviewerName)

    return res.status(200).json({ success: true, answers })

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('generate-replies-v5 FEHLER:', errMsg)
    return res.status(500).json({ success: false, error: errMsg })
  }
}
