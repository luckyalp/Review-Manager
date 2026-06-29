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
  const systemPrompt = `Analysiere die Restaurant-Bewertung. Extrahiere alle Lob- und Kritikpunkte.
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

// ─── BAUSTEIN-GENERATOR ───────────────────────────────────────────────────────

async function generateAllBlocks(
  analysis: Analysis,
  settings: Settings,
  reviewerName: string,
  reviewText: string,
  ownerVoice: string = ''
): Promise<BlockOptionen> {
  const { context, duSie, langInstruction } = resolveSettings(settings, reviewerName)
  const alleKritikpunkte = analysis.points.length > 0 ? analysis.points.join(', ') : 'die gemachten Erfahrungen'
  const voiceKontext = ownerVoice ? `\nINHABER-KONTEXT (Sprachnotiz, vertraulich): "${ownerVoice}"\nNutze diesen Kontext als Grundlage für die Antwort. Das ist die echte Sichtweise des Inhabers.` : ''

  const systemPrompt = `Du bist das Text-Herzstück eines intelligenten Gastro-Systems. Generiere für 3 logische Textblöcke jeweils genau 3 unterschiedliche, präzise Satz-Varianten (v1, v2, v3).

${FORMAT_RULES}
Anrede-Modus unbedingt beachten: ${duSie}
${langInstruction}

Restaurant-Profilkontext:
${context}
${voiceKontext}

TONMUSTER — SO KLINGT EINE GUTE ANTWORT (lerne den Stil, kopiere nicht wörtlich):

Beispiel 1 (gemischt):
"Hallo [Name], ich freu mich dass dir unser Essen so geschmeckt hat. Dass die Wartezeit zu lang war, ist nicht das, was wir uns für deinen Besuch wünschen. Wenn du das nächste Mal bei uns bist, gib kurz Bescheid. Beste Grüße."

Beispiel 2 (nur schlecht):
"Hallo [Name], dass die Wartezeit so lang war, ist nicht das, was wir uns für deinen Besuch wünschen. Meld dich gerne direkt bei uns. Beste Grüße."

Beispiel 3 (nur positiv):
"Hallo [Name], ich freu mich dass dir dein Besuch bei uns so gut gefallen hat. Wir freuen uns auf deinen nächsten Besuch. Beste Grüße."

Beispiel 4 (Ambiente, gemischt):
"Hallo [Name], schön, dass dir bei uns etwas gefallen hat. Dass die Atmosphäre nicht ganz dein Ding war, ist schade. Am Ende ist Ambiente halt Geschmackssache. Herzliche Grüße."

Beispiel 5 (Preis, positiv):
"Hallo [Name], das freut uns wirklich! Gutes Preis-Leistungs-Verhältnis bedeutet für uns echten Gegenwert fürs Geld. Genau das versuchen wir jeden Tag. Bis bald!"

Was diese Beispiele gemeinsam haben: Kein Dankeschön als Einstieg. Direkt ins Thema. Kurze Sätze. Keine internen Versprechen. Kein PR-Sprech.

WICHTIG:
Die Analyse hat diese Punkte erkannt: "${alleKritikpunkte}".
Original-Bewertung: "${reviewText}"

In BLOCK 2 musst du auf alle Kritikpunkte eingehen. Wenn der Gast etwas gelobt hat, erwähne das positiv bevor du die Kritik ansprichst.

BLOCK-STRUKTUREN:
- BLOCK 1 (Einstieg): Direkt ins Thema, kein "Vielen Dank", kein langer Anlauf.
  v1: Ehrlich, locker, direkt.
  v2: Herzlich, gastfreundlich.
  v3: Minimalistisch, ein Satz.

- BLOCK 2 (Kern): Antwort auf (${alleKritikpunkte}).
  v1: Gibt Fehler offen zu, wahrt positives Lob.
  v2: Erklärt Hintergründe ruhig und sachlich.
  v3: Authentisch, nahbar, Fokus auf Gastroalltag.

- BLOCK 3 (Abschluss): Kurz und echt, kein "Wir freuen uns auf Ihren nächsten Besuch".
  v1: Lockere Einladung für das nächste Mal.
  v2: Hinweis, beim nächsten Mal direkt Bescheid zu geben.
  v3: Herzlicher Abschied, ein Satz, keine Floskel.

Jeder Satz maximal 15 Wörter. Gib AUSSCHLIESSLICH valides JSON zurück:
{
  "block1_einstieg": { "v1": "...", "v2": "...", "v3": "..." },
  "block2_kern": { "v1": "...", "v2": "...", "v3": "..." },
  "block3_abschluss": { "v1": "...", "v2": "...", "v3": "..." }
}`

  const raw = await callClaude(`Generiere die Bausteine für: ${reviewText}`, systemPrompt, 'claude-haiku-4-5-20251001', 0)
  return parseJson(raw)
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

  const systemPrompt = `Du bist ein präziser Text-Editor. Glätte nur die Übergänge zwischen den Sätzen durch Bindewörter, damit ein perfekt fließender Text entsteht.
${FORMAT_RULES}
Anrede-Modus: ${duSie}
REGELN: Verändere niemals den Sinn. Füge keine neuen Floskeln hinzu. Gib NUR den finalen Text aus, ohne Metatext.`

  const raw = await callClaude(roherText, systemPrompt, 'claude-haiku-4-5-20251001', 0)
  return raw.trim() || roherText
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

  // ─── TRANSCRIBE ACTION ────────────────────────────────────────────────────
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
        'Danke für das tolle Feedback. Komm gerne wieder vorbei.',
        'Danke für das tolle Feedback. Kommen Sie gerne wieder vorbei.'
      )
      const gruss = d(isDu, 'Viele Grüße', 'Mit freundlichen Grüßen')
      const text = `${begruessung}${kernSatz}\n\n${gruss},\n${signature}`
      return res.status(200).json({ success: true, answers: [{ label: 'Antwort', text }] })
    }

    // 4. Bausteine generieren
    const blocks = await generateAllBlocks(analysis, settings, reviewerName, reviewText, ownerVoice || '')

    // 5. Zusammensetzen und glätten
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
