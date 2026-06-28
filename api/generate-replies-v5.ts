import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface TopicA {
  situation: string  // Freie Beschreibung der A-Situation (1-2 Saetze von Haiku)
  barOption: boolean // true wenn Bar/Stehtisch als naechster Schritt sinnvoll ist
}

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
  topicA?: TopicA
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

// ─── SHARED: FORMAT-REGELN ────────────────────────────────────────────────────

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

// ─── KI-HILFSFUNKTIONEN ───────────────────────────────────────────────────────

async function checkContext(reviewText: string, description: string): Promise<{ ok: boolean; missing?: string }> {
  const systemPrompt = `Analysiere, ob in der Bewertung Punkte kritisiert werden, deren genauer Hintergrund unklar ist (z.B. Kritik an einer Sauce oder Beilage, ohne zu sagen ob Geschmack, Konsistenz oder Menge das Problem war).
  Gib NUR ein valides JSON-Objekt zurück:
  { "ok": true/false, "missing": "Kurze Beschreibung was fehlt oder leer" }`

  const response = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
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
  const systemPrompt = `Analysiere die Restaurant-Bewertung syntaktisch und logisch.
  Kategorien: A (Konzept/Struktur), B (Echter Fehler/Service/Einzelfall), C (Subjektiv/Geschmack/Menge).
  Gib NUR ein valides JSON zurück, das dem Interface Analysis entspricht:
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
    model: 'claude-3-5-sonnet-20240620',
    max_tokens: 600,
    system: systemPrompt,
    messages: [{ role: 'user', content: reviewText }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  return JSON.parse(text)
}

// ─── STUFE 1: BAUSTEIN-GENERATOR ENGINE ───────────────────────────────────────

async function generateAllBlocks(
  analysis: Analysis,
  settings: Settings,
  reviewerName: string,
  userKontext?: string
): Promise<BlockOptionen> {
  const { isDu, context, duSie, langInstruction } = resolveSettings(settings, reviewerName)
  
  const kritischerPunkt = analysis.nominative[0] || 'der Aufenthalt'
  const artikelPunkt = analysis.nominativeArtikel[0] || 'den Besuch'
  const hauptkat = analysis.categories[0] || 'C'

  const systemPrompt = `Du bist das Text-Herzstück eines intelligenten Gastro-Systems. Deine Aufgabe ist es, für ein Gamification-UI ein modulares Antwort-Baukasten-System zu generieren.
  
  Anforderungen an das Antwort-Format:
  Du musst für 3 logische Textblöcke jeweils genau 3 unterschiedliche, stilistisch starke Satz-Varianten (v1, v2, v3) ausgeben.

  ${FORMAT_RULES}
  Anrede-Modus: ${duSie}
  ${langInstruction}
  
  Restaurant-Profilkontext:
  ${context}

  Kritisiertes Thema: "${artikelPunkt}" (Kategorie ${hauptkat})
  Zusatz-Kontext vom Gastronomen aus dem UI (falls vorhanden): "${userKontext || 'Kein Zusatzkontext geliefert'}"

  BLOCK-STRUKTUREN DIE DU GENERIEREN MUSST:
  - BLOCK 1 (Einstieg / Die Brücke): Nenne das Bedauern über das Problem mit "${artikelPunkt}".
    v1: Ehrlich, locker, direkt auf den Punkt.
    v2: Elegant, herzlich, gastfreundlich.
    v3: Minimalistisch, fokussiert.
  - BLOCK 2 (Der Kern / Die Erklärung): Erkläre die Situation um "${kritischerPunkt}". Nutze den Zusatz-Kontext intensiv!
    v1: Erklärend, Fokus auf Qualitäts- / Konzeptgründe (z.B. hausgemacht, Portionierung für die Balance).
    v2: Kulant, einsichtig, fehlerzugebend (falls geschlampt wurde oder ein B-Fehler vorliegt).
    v3: Authentisch, Fokus auf Gastronomie-Alltag, Frische oder Handwerk.
  - BLOCK 3 (Der Abschluss / Der Ausblick): Schaffe eine positive Bindung für die Zukunft.
    v1: Lockere Einladung (z.B. auf einen Espresso/Drink beim nächsten Mal).
    v2: Serviceorientierter Hinweis, beim nächsten Besuch direkt vor Ort dem Personal Bescheid zu geben.
    v3: Herzliche Verabschiedung ohne abgedroschene Phrasen.

  Jeder Satz muss eigenständig stehen können und darf maximal 15 Wörter lang sein.
  Gib AUSSCHLIESSLICH ein sauberes, valides JSON-Objekt zurück. Kein Begleittext, keine Markdown-Wrapper außerhalb des JSON.`

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20240620',
    max_tokens: 1000,
    system: systemPrompt,
    messages: [{ role: 'user', content: `Generiere die 3x3 Matrix für: ${kritischerPunkt}` }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  return JSON.parse(text)
}

// ─── STUFE 2: DER REINE GLÄTTER-PROMPT ────────────────────────────────────────

async function finalizeAndSmoothSelection(
  settings: Settings,
  reviewerName: string,
  s1: string,
  s2: string,
  s3: string
): Promise<string> {
  const { isDu, signature, firstNameClean, duSie } = resolveSettings(settings, reviewerName)
  
  const begruessung = firstNameClean ? `Hallo ${firstNameClean},` : d(isDu, "Hallo,", "Guten Tag,")
  const grussFormel = d(isDu, "Viele Grüße", "Mit freundlichen Grüßen")
  
  const roherText = `${begruessung}\n\n${s1} ${s2} ${s3}\n\n${grussFormel},\n${signature}`

  const systemPrompt = `Du bist ein präziser Text-Editor. Du erhältst eine Restaurant-Antwort, die aus drei ausgewählten Bausteinen zusammengesetzt wurde.
  Deine Aufgabe ist es AUSSCHLIESSLICH, die Übergänge zwischen den Sätzen flüssig und harmonisch zu gestalten (z.B. durch Einfügen von Bindewörtern wie 'allerdings', 'daher' oder 'deshalb').

  ${FORMAT_RULES}
  Anrede-Modus beachten: ${duSie}

  STRIKTE BEARBEITUNGS-REGELN:
  1. Verändere NIEMALS den inhaltlichen Sinn oder die logische Aussage der Sätze.
  2. Erfinde KEINE neuen Entschuldigungen, Floskeln oder Beschreibungen hinzu.
  3. Kürze den Text nicht radikal, sondern optimiere nur den Lesefluss der 3 Kern-Sätze.
  4. Gib NUR den finalen, bereinigten und flüssigen Text aus. Keinerlei Metatext oder Kommentare.`

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20240620',
    max_tokens: 400,
    system: systemPrompt,
    messages: [{ role: 'user', content: roherText }]
  })

  return response.content[0].type === 'text' ? response.content[0].text.trim() : roherText
}

// ─── VERCEL NODE HANDLER ──────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  const { action, reviewText, stars, reviewerName, settings, userKontext, selectedS1, selectedS2, selectedS3 } = req.body

  try {
    switch (action) {
      
      case 'analyze': {
        if (!reviewText) return res.status(400).json({ success: false, error: 'Kein Bewertungstext geliefert.' })
        
        const contextCheck = await checkContext(reviewText, settings?.description || '')
        if (!contextCheck.ok) {
          return res.status(200).json({ 
            success: false, 
            missingContext: true, 
            missingInfo: contextCheck.missing 
          })
        }

        const modeRaw = classify(stars, reviewText)
        const analysis = await analyzeReview(reviewText)

        if (modeRaw === 'CONTENT_POSITIVE' && analysis.count === 0) {
          const { signature, isDu, firstNameClean } = resolveSettings(settings, reviewerName)
          const begruessung = firstNameClean ? `Hallo ${firstNameClean},` : ''
          const kernSatz = d(isDu, "Danke, das freut uns wirklich. Komm gerne wieder vorbei.", "Danke, das freut uns wirklich. Kommen Sie gerne wieder vorbei.")
          const directText = `${begruessung} ${kernSatz}\n\nViele Grüße,\n${signature}`
          return res.status(200).json({ success: true, route: 'direct', text: directText })
        }

        return res.status(200).json({ 
          success: true, 
          route: 'interactive', 
          analysis 
        })
      }

      case 'generate_blocks': {
        const { analysis } = req.body
        if (!analysis) return res.status(400).json({ success: false, error: 'Analysis-Objekt fehlt.' })

        const blockMatrix = await generateAllBlocks(analysis, settings, reviewerName, userKontext)
        
        return res.status(200).json({ success: true, blocks: blockMatrix })
      }

      case 'finalize': {
        if (!selectedS1 || !selectedS2 || !selectedS3) {
          return res.status(400).json({ success: false, error: 'Es müssen Sätze aus allen 3 Blöcken ausgewählt sein.' })
        }

        const finalReviewText = await finalizeAndSmoothSelection(settings, reviewerName, selectedS1, selectedS2, selectedS3)
        
        return res.status(200).json({ success: true, finalReviewText })
      }

      default:
        return res.status(400).json({ error: 'Aktion unbekannt oder nicht mitgegeben.' })
    }

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('generate-replies-v5 FEHLER:', errMsg)
    return res.status(500).json({ success: false, error: errMsg })
  }
}
