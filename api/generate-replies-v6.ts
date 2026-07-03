import type { VercelRequest, VercelResponse } from '@vercel/node'
import { callClaude, handleTranscribeAction, handleSkalpellAction } from './_lib/voice-helpers'

// ─── v6 ── NEUE ENGINE: KURZER UR-PROMPT ALS KERNSTÜCK ───────────────────────
// Ersetzt die vorherige v6 (Kategorie-Router ohne Lego-Bausteine, war Vorstufe
// von v7 ohne Eigenwert). Statt fester Bausteine bekommt Claude hier den
// kurzen Persona-Prompt ("Stell dir vor, du bist der Inhaber...") + den
// harten Struktur-Käfig, 1:1 wie vorgegeben, inklusive Ton-Limit-Klausel.

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
  categories: string[]        // 'A' | 'B' | 'C'
  forceSummarize: boolean
  lobpunkte: string[]
  isServiceComplaint: boolean
}

// ─── CLASSIFY ─────────────────────────────────────────────────────────────────

function classify(rating: number, reviewText: string): string {
  const wordCount = reviewText.trim().split(/\s+/).filter(Boolean).length
  const hasText = wordCount >= 6
  if (!hasText && rating >= 4) return 'EMPTY_POSITIVE'
  if (!hasText) return 'EMPTY_NEGATIVE'
  if (rating >= 4) return 'CONTENT_POSITIVE'
  if (rating === 3) return 'CONTENT_MIXED'
  return 'CONTENT_NEGATIVE'
}

// ─── SETTINGS AUFLÖSEN ────────────────────────────────────────────────────────

function resolveSettings(settings: Settings | undefined, reviewerName: string) {
  const {
    businessName = 'das Restaurant',
    salutation = 'Sie',
    responseSignature = '',
    responseLanguage = 'Deutsch',
    description = '',
  } = settings || {}

  const isDu = salutation === 'Du'
  const signature = responseSignature || `Das Team von ${businessName}`
  const firstName = reviewerName ? reviewerName.split(' ')[0] : ''
  const firstNameClean = firstName
    ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
    : ''
  const langInstruction =
    responseLanguage === 'Sprache des Bewerters' ? 'Antworte in der Sprache der Bewertung.' :
    responseLanguage === 'Englisch' ? 'Respond in English only.' :
    'Antworte auf Deutsch.'

  return { businessName, isDu, signature, firstNameClean, langInstruction, description }
}

// ─── HAIKU: ANALYSE DER BEWERTUNG ─────────────────────────────────────────────

async function analyzeReview(reviewText: string): Promise<Analysis> {
  const systemPrompt = `Analysiere die Restaurant-Bewertung. Extrahiere Kritik- und Lobpunkte.

Kategorien:
A = betrifft eine feste betriebliche Regel/Struktur (z.B. Tischzeit, Lautstärke bei vollem Haus, Öffnungszeiten)
B = Fehler im Ablauf, Küche oder Zubereitung (etwas ging schief, das nicht hätte passieren sollen)
C = Geschmack, Menge, Preis oder Auswahl (persönliche Präferenz, kein objektiver Fehler)

Gib NUR valides JSON zurück:
{
  "count": 1,
  "points": ["Kritikpunkt in wenigen Worten"],
  "categories": ["B"],
  "forceSummarize": false,
  "lobpunkte": ["Lobpunkt falls vorhanden"],
  "isServiceComplaint": false
}
forceSummarize = true nur wenn 3 oder mehr eigenständige Kritikpunkte genannt werden.`

  const raw = await callClaude(reviewText, systemPrompt, 'claude-haiku-4-5-20251001', 0)
  const s = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('Kein JSON gefunden: ' + raw)
  return JSON.parse(s.substring(start, end + 1))
}

// ─── DER KURZE UR-PROMPT (Kernstück v8) ──────────────────────────────────────
// explanation = das, was der Inhaber dem Gast erklärt. Kommt primär aus der
// Inhaber-Stimme (ownerVoice, per Mikrofon eingesprochen). Fällt darauf
// zurück, sollte kein ownerVoice vorliegen: Restaurantprofil-Beschreibung.

function buildUrPrompt(
  explanation: string,
  isDu: boolean,
  langInstruction: string
): string {
  const anrede = isDu
    ? 'Du duzt den Gast. Schreibe "du", "dir", "dein", "dich" klein.'
    : 'Du siezt den Gast.'

  return `Stell dir vor, du bist der Inhaber. Ein Gast steht vor dir und beschwert sich. Du bist höflich, aber du bist ein gestandener Gastronom, du redest nicht um den heißen Brei herum, du entschuldigst dich nicht für Dinge, die normal sind, und du nutzt keine Phrasen, die du nicht auch laut im Laden sagen würdest.

Hier ist die Hausregel/betriebliche Vorgabe für diesen Fall, die du dem Gast erklärst: "${explanation}"

${anrede}
${langInstruction}

Harte Struktur-Regeln:
- Keine Gedankenstriche: Nutze im gesamten Text niemals Gedankenstriche (– oder —). Verbinde Sätze nur mit Kommas, "und", "oder" sowie Punkten.
- Keine Floskeln: Steige sofort ohne einleitendes "Vielen Dank für das Feedback" oder "Schade, dass..." ein.
- Das Ton-Limit: Wenn der Ton vor Ort zu scharf war, gestehst du das in maximal ein bis zwei Sätzen ein (z. B. dass es im Eifer des Gefechts unglücklich formuliert war), ohne dich danach weiter zu rechtfertigen, dich zu demütigen oder dich in aller Form zu entschuldigen. Nur wenn das aus der Erklärung oben hervorgeht, sonst weglassen.

Ablauf der Antwort:
1. Sofortige Erklärung der betrieblichen Regel/Vorgabe.
2. Falls zutreffend: das kurze Statement zum Ton (maximal zwei Sätze).

Anrede und Grußformel werden separat vom System ergänzt, gib nur diesen mittleren Teil aus.

Gib NUR valides JSON zurück: {"text": "der Fließtext gemäß Ablauf oben, ohne Anrede-Zeile und ohne Grußformel"}`
}

function parseUrPromptResponse(raw: string): string {
  const s = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start === -1 || end === -1) return s
  try {
    const parsed = JSON.parse(s.substring(start, end + 1))
    return parsed.text || s
  } catch {
    return s
  }
}

function d(isDu: boolean, duText: string, sieText: string): string {
  return isDu ? duText : sieText
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert' })

  const { action, audioBase64, mimeType, markierterSatzOriginal, gesprocheneAnweisung, review, settings, ownerVoice } = req.body

  // Mikrofon-Transkription
  if (action === 'transcribe') {
    const result = await handleTranscribeAction(audioBase64, mimeType)
    return res.status(result.status).json(result.body)
  }

  // Skalpell: einzelnen Satz per Sprachbefehl korrigieren
  if (action === 'skalpell') {
    const result = await handleSkalpellAction(markierterSatzOriginal, gesprocheneAnweisung)
    return res.status(result.status).json(result.body)
  }

  if (!review) return res.status(400).json({ success: false, error: 'review fehlt' })

  const reviewText   = review.reviewText || ''
  const stars        = Number(review.stars) || 3
  const reviewerName = review.reviewerName || ''

  try {
    const mode = classify(stars, reviewText)
    const { signature, isDu, firstNameClean, langInstruction, description } = resolveSettings(settings, reviewerName)
    const begruessung = firstNameClean ? `Hallo ${firstNameClean},` : d(isDu, 'Hallo,', 'Guten Tag,')
    const grussFormel = d(isDu, 'Viele Grüße', 'Mit freundlichen Grüßen')

    // Rein positive Bewertung ohne Kritik: kurzer direkter Weg, kein Ur-Prompt nötig
    if (mode === 'CONTENT_POSITIVE' || mode === 'EMPTY_POSITIVE') {
      const analysis = mode === 'CONTENT_POSITIVE' ? await analyzeReview(reviewText) : null
      if (!analysis || analysis.count === 0) {
        const kernSatz = d(isDu,
          'Ich freu mich, dass dir dein Besuch bei uns so gut gefallen hat. Komm gerne wieder vorbei.',
          'Es freut uns sehr, dass Ihnen Ihr Besuch bei uns so gut gefallen hat. Kommen Sie gerne wieder.'
        )
        const text = `${begruessung}\n\n${kernSatz}\n\n${grussFormel},\n${signature}`
        return res.status(200).json({ success: true, answers: [{ label: 'Frei (Test)', text }] })
      }
    }

    // Alles mit Kritik (negativ, gemischt, leer-negativ): über den Ur-Prompt
    const analysis = await analyzeReview(reviewText)

    // Die "Erklärung" für den Ur-Prompt: primär die Inhaber-Stimme, sonst Profil-Beschreibung
    const explanation = (ownerVoice && ownerVoice.trim())
      ? ownerVoice.trim()
      : (description || 'Erkläre kurz und sachlich, ohne dich zu rechtfertigen.')

    const urPrompt = buildUrPrompt(explanation, isDu, langInstruction)
    const raw = await callClaude(
      `Bewertung des Gasts: "${reviewText}"\nKritikpunkte: ${analysis.points.join(', ') || 'keine konkreten, allgemeiner Unmut'}`,
      urPrompt,
      'claude-sonnet-4-6',
      0.3
    )
    const kernText = parseUrPromptResponse(raw)

    const text = `${begruessung}\n\n${kernText}\n\n${grussFormel},\n${signature}`
    return res.status(200).json({ success: true, answers: [{ label: 'Frei (Test)', text }] })

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('generate-replies-v6 FEHLER:', errMsg)
    return res.status(500).json({ success: false, error: errMsg })
  }
}
