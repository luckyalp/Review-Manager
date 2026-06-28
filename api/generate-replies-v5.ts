import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

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

// ─── ANALYSE ──────────────────────────────────────────────────────────────────

async function checkContext(reviewText: string, description: string): Promise<{ ok: boolean; missing?: string }> {
  const systemPrompt = `Analysiere, ob in der Bewertung Punkte kritisiert werden, deren genauer Hintergrund unklar ist.
  Gib NUR ein valides JSON-Objekt zurück:
  { "ok": true/false, "missing": "Kurze Beschreibung was fehlt oder leer" }`

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    system: systemPrompt,
    messages: [{ role: 'user', content: `Profil: ${description}\n\nBewertung: ${reviewText}` }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  try {
    return JSON.parse(text)
  } catch {
    return { ok: true }
  }
}

async function analyzeReview(reviewText: string): Promise<Analysis> {
  const systemPrompt = `Analysiere die Restaurant-Bewertung.
  Kategorien: A (Konzept/Struktur), B (Echter Fehler/Service), C (Subjektiv/Geschmack/Menge).
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

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: systemPrompt,
    messages: [{ role: 'user', content: reviewText }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  return JSON.parse(text)
}

// ─── BAUSTEIN-GENERATOR ───────────────────────────────────────────────────────

async function generateAllBlocks(
  analysis: Analysis,
  settings: Settings,
  reviewerName: string
): Promise<BlockOptionen> {
  const { isDu, context, duSie, langInstruction } = resolveSettings(settings, reviewerName)

  const kritischerPunkt = analysis.nominative[0] || 'der Aufenthalt'
  const artikelPunkt = analysis.nominativeArtikel[0] || 'den Besuch'
  const hauptkat = analysis.categories[0] || 'C'

  const systemPrompt = `Du bist das Text-Herzstück eines intelligenten Gastro-Systems. Generiere für 3 logische Textblöcke jeweils genau 3 unterschiedliche Satz-Varianten (v1, v2, v3).

  ${FORMAT_RULES}
  Anrede-Modus: ${duSie}
  ${langInstruction}

  Restaurant-Profilkontext:
  ${context}

  Kritisiertes Thema: "${artikelPunkt}" (Kategorie ${hauptkat})

  BLOCK-STRUKTUREN:
  - BLOCK 1 (Einstieg): Nenne das Bedauern über das Problem mit "${artikelPunkt}".
    v1: Ehrlich, locker, direkt.
    v2: Elegant, herzlich, gastfreundlich.
    v3: Minimalistisch, fokussiert.
  - BLOCK 2 (Kern): Erkläre die Situation um "${kritischerPunkt}".
    v1: Erklärend, Fokus auf Qualitäts- oder Konzeptgründe.
    v2: Kulant, einsichtig, fehlerzugebend.
    v3: Authentisch, Fokus auf Gastronomie-Alltag oder Handwerk.
  - BLOCK 3 (Abschluss): Schaffe positive Bindung für die Zukunft.
    v1: Lockere Einladung.
    v2: Hinweis, beim nächsten Besuch direkt Bescheid zu geben.
    v3: Herzliche Verabschiedung ohne Floskeln.

  Jeder Satz maximal 15 Wörter. Gib AUSSCHLIESSLICH valides JSON zurück:
  {
    "block1_einstieg": { "v1": "...", "v2": "...", "v3": "..." },
    "block2_kern": { "v1": "...", "v2": "...", "v3": "..." },
    "block3_abschluss": { "v1": "...", "v2": "...", "v3": "..." }
  }`

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    system: systemPrompt,
    messages: [{ role: 'user', content: `Generiere die 3x3 Matrix für: ${kritischerPunkt}` }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  return JSON.parse(text)
}

// ─── GLÄTTER ──────────────────────────────────────────────────────────────────

async function finalizeAndSmooth(
  settings: Settings,
  reviewerName: string,
  s1: string,
  s2: string,
  s3: string
): Promise<string> {
  const { isDu, signature, firstNameClean, duSie } = resolveSettings(settings, reviewerName)

  const begruessung = firstNameClean ? `Hallo ${firstNameClean},` : d(isDu, 'Hallo,', 'Guten Tag,')
  const grussFormel = d(isDu, 'Viele Grüße', 'Mit freundlichen Grüßen')
  const roherText = `${begruessung}\n\n${s1} ${s2} ${s3}\n\n${grussFormel},\n${signature}`

  const systemPrompt = `Du bist ein präziser Text-Editor. Glätte nur die Übergänge zwischen den Sätzen durch Bindewörter.
  ${FORMAT_RULES}
  Anrede-Modus: ${duSie}
  REGELN: Verändere NIEMALS den Inhalt. Keine neuen Floskeln. Gib NUR den finalen Text aus, ohne Metatext.`

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system: systemPrompt,
    messages: [{ role: 'user', content: roherText }]
  })

  return response.content[0].type === 'text' ? response.content[0].text.trim() : roherText
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

    // 4. Bausteine generieren (3x3 Matrix)
    const blocks = await generateAllBlocks(analysis, settings, reviewerName)

    // 5. 3 fertige Antworten aus je einer Variante zusammenbauen und glätten
    const combos = [
      { label: 'Variante A', s1: blocks.block1_einstieg.v1, s2: blocks.block2_kern.v1, s3: blocks.block3_abschluss.v1 },
      { label: 'Variante B', s1: blocks.block1_einstieg.v2, s2: blocks.block2_kern.v2, s3: blocks.block3_abschluss.v2 },
      { label: 'Variante C', s1: blocks.block1_einstieg.v3, s2: blocks.block2_kern.v3, s3: blocks.block3_abschluss.v3 },
    ]

    const answers = await Promise.all(
      combos.map(async ({ label, s1, s2, s3 }) => {
        const text = await finalizeAndSmooth(settings, reviewerName, s1, s2, s3)
        return { label, text }
      })
    )

    return res.status(200).json({ success: true, answers })

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('generate-replies-v5 FEHLER:', errMsg)
    return res.status(500).json({ success: false, error: errMsg })
  }
}
