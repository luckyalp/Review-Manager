import type { VercelRequest, VercelResponse } from '@vercel/node'

// ─── v8 ── DIE PRÄZISIONS-ENGINE: SPICKZETTEL & JSON-PROFIL ──────────────────
// Architektur: Technik und Prompt-Texte sind strikt getrennt. Alle Prompt-
// Bausteine stehen unten als eigene Variablen im Abschnitt "PROMPT-MODULE".
//
// Das 3-Rollen-Modell wurde durch die klare, unmissverständliche Rolle des
// stolzen Gastro-Chefs ersetzt. Der Mittelteil wird jetzt über messerscharfe
// Spickzettel gesteuert, die sich die echten Fakten direkt aus dem JSON-Profil ziehen.
// Alle technischen Hilfsfunktionen (Skalpell, Transkription, Weichen) sind geschützt.

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const GROQ_API_KEY = process.env.GROQ_API_KEY

// ─── APP_CONFIG ── BETRIEBS-PARAMETER ────────────────────────────────────────
const APP_CONFIG = {
  anthropicApiUrl: 'https://api.anthropic.com/v1/messages',
  anthropicApiVersion: '2023-06-01',
  models: {
    generation: 'claude-sonnet-5',
    analysis: 'claude-haiku-4-5-20251001',
  },
  maxTokens: 1000,
  temperature: {
    default: 0,
    skalpell: 0.2,
    generation: 0.3,
  },
  groq: {
    apiUrl: 'https://api.groq.com/openai/v1/audio/transcriptions',
    whisperModel: 'whisper-large-v3',
    language: 'de',
  },
}

// ─── CLAUDE API CALL ──────────────────────────────────────────────────────────

async function callClaude(
  userMessage: string,
  systemPrompt?: string,
  model = APP_CONFIG.models.generation,
  temperature = APP_CONFIG.temperature.default
): Promise<string> {
  const body: any = {
    model,
    max_tokens: APP_CONFIG.maxTokens,
    messages: [{ role: 'user', content: userMessage }],
  }
  if (!model.startsWith('claude-sonnet-5')) body.temperature = temperature
  if (model.startsWith('claude-sonnet-5')) body.thinking = { type: 'disabled' }
  if (systemPrompt) body.system = systemPrompt

  const response = await fetch(APP_CONFIG.anthropicApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': APP_CONFIG.anthropicApiVersion,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(`Claude API Fehler: ${JSON.stringify(err)}`)
  }

  const data = await response.json()
  const textBlock = data.content?.find((block: any) => block.type === 'text')
  return textBlock?.text || ''
}

// ─── AUDIO TRANSKRIPTION (Groq Whisper) ──────────────────────────────────────

async function transcribeAudio(audioBase64: string, mimeType: string): Promise<string> {
  const binaryStr = atob(audioBase64)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
  const blob = new Blob([bytes], { type: mimeType })

  const formData = new FormData()
  formData.append('file', blob, 'audio.webm')
  formData.append('model', APP_CONFIG.groq.whisperModel)
  formData.append('language', APP_CONFIG.groq.language)
  formData.append('response_format', 'text')

  const response = await fetch(APP_CONFIG.groq.apiUrl, {
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

// ─── SKALPELL: EINZELNEN SATZ PER SPRACHBEFEHL KORRIGIEREN ──────────────────

async function korrigiereSatz(markierterSatzOriginal: string, gesprocheneAnweisung: string, isDu: boolean): Promise<string> {
  const anrede = isDu
    ? 'Der Text duzt den Gast durchgehend. Schreibe "du", "dir", "dein", "dich" klein und bleib beim Duzen.'
    : 'Der Text siezt den Gast durchgehend. Bleib beim Siezen.'

  const systemPrompt = `Du bist ein präzises Text-Skalpell für eine Gastronomie-Software. Deine einzige Aufgabe ist es, einen einzelnen Satz stilistisch zu korrigieren, den ein Gastronom per Sprachbefehl anpassen möchte.

${anrede}

Deine harten Arbeitsregeln:
1. Formuliere NUR diesen einen Satz exakt nach den Wünschen des Nutzers um.
2. Behalte den Charakter des Inhabers bei: Er ist ein gestandener Gastronom, er redet nicht um den heißen Brei herum, aber er setzt die gewünschte Anpassung präzise um.
3. Nutze NIEMALS Gedankenstriche (— oder –) in deiner Antwort.
4. Keine Entschuldigung, kein Bedauern, keine Floskeln.
5. WICHTIG: Gib als Output AUSSCHLIESSLICH den neu formulierten Satz zurück. Keine Einleitung, keine Anführungszeichen.`

  const userMessage = `Aktueller Satz:\n"${markierterSatzOriginal}"\n\nGesprochene Anweisung:\n"${gesprocheneAnweisung}"`
  const raw = await callClaude(userMessage, systemPrompt, APP_CONFIG.models.generation, APP_CONFIG.temperature.skalpell)
  return raw.trim().replace(/^["']|["']$/g, '')
}

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
  // Für das V8 Fakten-JSON-Profil:
  ruhigeTage?: string[]
  ruhigeUhrzeiten?: string
  spezifischeRegelAkustik?: string
  spezifischeRegelFehler?: string
}

interface Analysis {
  count: number
  points: string[]
  forceSummarize: boolean
  lobpunkte: string[]
  categories: string[] // V8 Kategorie-Zuweisung
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
    contactEmail = '',
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

  return { businessName, isDu, signature, firstNameClean, langInstruction, description, contactEmail }
}

function pickGreeting(isDu: boolean, name: string): string {
  if (isDu) {
    const pool = name ? [`Hallo ${name},`, `Hey ${name},`] : ['Hallo,', 'Hey,']
    return pool[Math.floor(Math.random() * pool.length)]
  }
  return name ? `Hallo ${name},` : 'Guten Tag,'
}

function pickPositivKernsatz(isDu: boolean): string {
  const poolDu = [
    'Ich freu mich, dass dir dein Besuch bei uns so gut gefallen hat. Komm gerne wieder vorbei.',
    'Das freut mich richtig. Schön, dass es bei uns so gut angekommen ist, bis zum nächsten Mal.',
    'Sowas les ich immer gern. Danke dir, und komm bald wieder vorbei.',
    'Freut mich sehr, dass dir dein Besuch so gut gefallen hat. Wir freuen uns schon aufs nächste Mal.',
  ]
  const poolSie = [
    'Es freut uns sehr, dass Ihnen Ihr Besuch bei uns so gut gefallen hat. Kommen Sie gerne wieder.',
    'Das freut uns wirklich. Schön, dass es bei Ihnen so gut angekommen ist, wir freuen uns auf Ihren nächsten Besuch.',
    'Solche Zeilen lesen wir immer gern. Vielen Dank dafür, und bis bald bei uns.',
    'Es freut uns außerordentlich, dass Ihnen der Besuch so gut gefallen hat. Wir freuen uns schon auf Ihr nächstes Mal.',
  ]
  return isDu ? poolDu[Math.floor(Math.random() * poolDu.length)] : poolSie[Math.floor(Math.random() * poolSie.length)]
}

function d(isDu: boolean, duText: string, sieText: string): string {
  return isDu ? duText : sieText
}

function getBoilerplateResponse(isDu: boolean, contactEmail: string): string {
  const kontaktDu = contactEmail
    ? `Meld dich doch gerne unter ${contactEmail}, dann schauen wir uns das gemeinsam an.`
    : 'Meld dich doch gerne direkt bei uns, dann schauen wir uns das gemeinsam an.'
  const kontaktSie = contactEmail
    ? `Melden Sie sich doch gerne unter ${contactEmail}, dann schauen wir uns das gemeinsam an.`
    : 'Melden Sie sich doch gerne direkt bei uns, dann schauen wir uns das gemeinsam an.'

  return d(isDu,
    `Schade, dass es nicht gepasst hat. Du hast leider keinen Text zu deiner Bewertung hinterlassen, dadurch wissen wir nicht, was genau los war. ${kontaktDu}`,
    `Schade, dass es nicht gepasst hat. Sie haben leider keinen Text zu Ihrer Bewertung hinterlassen, dadurch wissen wir nicht, was genau los war. ${kontaktSie}`
  )
}

// ─── HAIKU: ANALYSE & KATEGORISIERUNG DER BEWERTUNG (V8 UPGRADE) ──────────────

async function analyzeReview(reviewText: string): Promise<Analysis> {
  const systemPrompt = `Analysiere die Restaurant-Bewertung. Extrahiere Kritikpunkte, Lobpunkte und ordne die Bewertung einer oder mehreren der folgenden Fokus-Kategorien zu.

KATEGORIEN:
- "akustik_konzept" (Kritik an Lautstärke, vollem Laden, Geräuschkulisse, Musik, Trubel)
- "fehler_kueche_service" (Lange Wartezeit, falsches Essen, kalte Speisen, unaufmerksamer/überforderter Service)
- "essen_geschmack" (Geschmackssache, zu salzig, schmeckt nicht, langweilig gewürzt)
- "preis_leistung" (Zu teuer, Portionen zu klein für das Geld)
- "reinheit_ambiente" (Dreckig, klebrig, ungemütliches Licht, kaputtes Inventar)

Gib AUSSCHLIESSLICH valides JSON zurück:
{
  "count": 1,
  "points": ["Kritikpunkt in wenigen Worten"],
  "forceSummarize": false,
  "lobpunkte": ["Lobpunkt falls vorhanden"],
  "categories": ["kategorie_string"]
}
forceSummarize = true nur wenn 3 oder mehr eigenständige Kritikpunkte genannt werden.`

  const raw = await callClaude(reviewText, systemPrompt, APP_CONFIG.models.analysis, APP_CONFIG.temperature.default)
  const s = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('Kein JSON gefunden: ' + raw)
  return JSON.parse(s.substring(start, end + 1))
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── PROMPT-MODULE & SPICKZETTEL (V8 PRÄZISIONSMATERIAL) ──────────────────
// ═══════════════════════════════════════════════════════════════════════════

const PERSONA_INTRO_V8 = `Du bist ein erfahrener, direkt sprechender Gastronom (Chef). Antworte auf die Bewertung am Ende dieses Textes in einem einzigen, kurzen Fließtext ohne Absätze. Schreib konsequent in kurzen, klaren Hauptsätzen. Vermeide jegliche Schachtelsätze. Der Ton ist stolz, souverän, geradeheraus und nahbar. Du vertrittst die klare Linie des Hauses selbstbewusst nach außen und entschuldigst dich niemals für Dinge, die im Betrieb normal sind.`

const HARTE_STRUKTUR_REGELN_V8 = `Harte Struktur-Regeln:
- Keine Gedankenstriche: Nutze im gesamten Text niemals Gedankenstriche (– oder —). Trenne eigenständige Hauptsätze mit Punkten. Kommas nur innerhalb eines Satzes, nie um mehrere komplette Sätze aneinanderzureihen.
- Keine Floskeln: Steige sofort ein. Nutze niemals Phrasen wie "Das ist nicht unser Standard", "zeitnah", "austauschen", "die Sache in Ordnung bringen".
- VERBOTENE VERBEN: Nutze unter keinen Umständen die Wörter "verstehen", "nachvollziehen", "nachempfinden" oder Abwandlungen davon (z. B. NICHT: "Ich kann deinen Ärger verstehen").
- Keine Tageszeit-Wörter (Abend, Morgen, Mittag, Nachmittag, Vormittag): Nutze immer "Besuch" stattdessen.
- Drei feste Kurzregeln, immer:
  1. Nie "Geschmäcker sind verschieden" oder Ähnliches sagen.
  2. Nie einen Vorwurf gegen dein Personal direkt bestätigen, nur den Eindruck des Gasts spiegeln.
  3. Nie eine konkrete Wiedergutmachung (Rabatt, Freirunde) versprechen, das bleibt eine persönliche Entscheidung live vor Ort.`

const AUSGABE_REGELN_V8 = `Anrede und Grußformel werden separat vom System ergänzt, gib nur diesen mittleren Teil inklusive Lob-Einstieg (falls vorhanden) und Ausstieg aus.
Wenn du im Text selbst etwas wörtlich zitieren willst, nutze deutsche Anführungszeichen „..." oder einfache Anführungszeichen '...', niemals gerade doppelte Anführungszeichen ".
Gib NUR den fertigen Fließtext zurück, ohne Anrede-Zeile, ohne Grußformel, ohne Anführungszeichen drumherum. Beginne den Text immer mit einem Großbuchstaben.`

// DIE SPICKZETTEL-DATENBANK
const SPICKZETTEL_BAUKASTEN: Record<string, string> = {
  akustik_konzept: 'Erkläre pragmatisch, dass ein gutgehendes, volles Haus eben lebendig ist und eine dementsprechende Geräuschkulisse einfach dazu gehört. Entschuldige dich nicht dafür. Schau im RESTAURANT_PROFIL unter "fakten.ruhige_tage" oder "fakten.ruhige_uhrzeiten" nach und gib diese als unverbindlichen Tipp für den nächsten Besuch mit. Falls diese Daten fehlen oder der Gast genau an diesen Tagen da war, empfiehl allgemein Zeiten außerhalb der Hauptstoßzeiten. Biete niemals eine Tisch- oder Ecken-Garantie an.',
  fehler_kueche_service: 'Stell klar, dass das bei eurem Besuch handwerklich nicht optimal gelaufen ist. Bleib absolut gelassen und ohne kriecherisches Drama. Betone, dass wir Fehler am liebsten sofort live vor Ort im Laden lösen. Gib den Appell mit, uns beim nächsten Mal direkt vor Ort Bescheid zu geben, damit unser Team sofort reagieren und nachbessern kann. Schau im RESTAURANT_PROFIL unter "fakten.spezifische_regel_fehler" für optionale Details.',
  essen_geschmack: 'Nimm das Feedback zum Essen sachlich entgegen. Mach kein Drama daraus, dass es dem Gast nicht perfekt geschmeckt hat oder zu intensiv gewürzt war. Erkläre kurz, wie das Gericht bei euch normalerweise zubereitet wird, falls im RESTAURANT_PROFIL nützliche Details stehen. Lade ihn ein, beim nächsten Mal vor der Bestellung kurz Bescheid zu geben, damit die Küche die Würzung flexibel anpassen kann.',
  preis_leistung: 'Tritt selbstbewusst für eure Preise ein. Verweise auf die Qualität der Zutaten, den Wareneinsatz oder faire Löhne, falls im RESTAURANT_PROFIL hinterlegt (z.B. Beschreibung). Bleib gastfreundlich, aber knicke nicht ein.',
  reinheit_ambiente: 'Nimm den Hinweis dankend und ohne Umschweife auf. Erkläre kurz und trocken, dass Sauberkeit oberste Priorität hat und du das direkt mit dem Team für die tägliche Routine nachjustierst.'
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── VERKETTUNG & PROMPT-BAU (V8 JSON-INJEKTION) ──────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function buildV8Prompt(
  restaurantProfileJson: string,
  aktivierteSpickzettel: string,
  isDu: boolean,
  langInstruction: string,
  contactEmail: string
): string {
  const anrede = isDu
    ? 'Du duzt den Gast. Schreibe "du", "dir", "dein", "dich" klein.'
    : 'Du siezt den Gast.'

  const kontaktHinweis = contactEmail
    ? `Falls du im Text auf eine Kontaktmöglichkeit verweist, nutze diese Adresse: ${contactEmail}. Halte das kurz und direkt, zum Beispiel in der Art von "Meld dich gerne nochmal bei uns, dann klären wir das persönlich." Keine Floskeln wie "im Detail schildern" oder "das Erlebnis nochmal schildern".`
    : `Es ist aktuell KEINE Kontakt-E-Mail hinterlegt. Verweise NIEMALS auf eine E-Mail-Adresse. Formuliere stattdessen allgemein, z.B. "melde dich direkt bei uns" oder "sprich mich beim nächsten Besuch an".`

  return [
    PERSONA_INTRO_V8,
    `${anrede}\n${langInstruction}`,
    HARTE_STRUKTUR_REGELN_V8,
    `### RESTAURANT_PROFIL\n${restaurantProfileJson}`,
    `### ARBEITSANWEISUNG FÜR DIE ARGUMENTATION\n1. Falls Lobpunkte vorhanden sind, greife sie ganz kurz und locker auf.\n2. Behandle die aufgetretene Kritik strikt nach diesen spezifischen Spickzettel-Vorgaben:\n${aktivierteSpickzettel}`,
    kontaktHinweis,
    AUSGABE_REGELN_V8
  ].join('\n\n')
}

function cleanResponseText(raw: string): string {
  const cleaned = raw
    .replace(/```[a-z]*\s*/gi, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim()
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert' })

  const { action, audioBase64, mimeType, markierterSatzOriginal, gesprocheneAnweisung, review, settings, ownerVoice } = req.body

  // 1. Mikrofon-Transkription (Unverändert)
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

  // 2. Skalpell: einzelnen Satz korrigieren (Unverändert)
  if (action === 'skalpell') {
    if (!markierterSatzOriginal || !gesprocheneAnweisung) {
      return res.status(400).json({ success: false, error: 'markierterSatzOriginal oder gesprocheneAnweisung fehlt' })
    }
    try {
      const { isDu } = resolveSettings(settings, '')
      const korrigiert = await korrigiereSatz(markierterSatzOriginal, gesprocheneAnweisung, isDu)
      return res.status(200).json({ success: true, korrigierterSatz: korrigiert })
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      console.error('Skalpell FEHLER:', errMsg)
      return res.status(500).json({ success: false, error: errMsg })
    }
  }

  if (!review) return res.status(400).json({ success: false, error: 'review fehlt' })

  const reviewText   = review.reviewText || ''
  const stars        = Number(review.stars) || 3
  const reviewerName = review.reviewerName || ''

  try {
    const mode = classify(stars, reviewText)
    const { signature, isDu, firstNameClean, langInstruction, description, contactEmail } = resolveSettings(settings, reviewerName)
    const begruessung = pickGreeting(isDu, firstNameClean)
    const grussFormel = d(isDu, 'Viele Grüße', 'Mit freundlichen Grüßen')

    // Weiche: Negative Bewertung ohne Text (Unverändert)
    if (mode === 'EMPTY_NEGATIVE') {
      const text = `${begruessung}\n\n${getBoilerplateResponse(isDu, contactEmail)}\n\n${grussFormel},\n${signature}`
      return res.status(200).json({ success: true, answers: [{ label: 'Frei (Test)', text }] })
    }

    // Weiche: Rein positive Bewertung ohne Kritik (Unverändert)
    if (mode === 'CONTENT_POSITIVE' || mode === 'EMPTY_POSITIVE') {
      const analysis = mode === 'CONTENT_POSITIVE' ? await analyzeReview(reviewText) : null
      if (!analysis || analysis.count === 0) {
        const kernSatz = pickPositivKernsatz(isDu)
        const text = `${begruessung}\n\n${kernSatz}\n\n${grussFormel},\n${signature}`
        return res.status(200).json({ success: true, answers: [{ label: 'Frei (Test)', text }] })
      }
    }

    // ─── AB HIER SCHLÄGT DIE V8-ENGINE ZU (Kritik-Zweig) ─────────────────────

    // 1. Haiku analysiert und weißt Fokus-Kategorien zu
    const analysis = await analyzeReview(reviewText)

    // 2. Passende Spickzettel dynamisch aus dem Baukasten laden
    const aktivierteSpickzettel = (analysis.categories && analysis.categories.length > 0)
      ? analysis.categories.map(cat => SPICKZETTEL_BAUKASTEN[cat]).filter(Boolean).join('\n')
      : 'Erkläre den Vorfall pragmatisch, kurz und sachlich, ohne dich zu rechtfertigen.'

    // 3. Das strukturierte RESTAURANT_PROFIL als JSON-Block für Claude aufbereiten
    const restaurantProfileJson = JSON.stringify({
      restaurant_name: settings?.businessName || 'unser Laden',
      beschreibung: description || 'Keine detaillierte Beschreibung hinterlegt.',
      fakten: {
        ruhige_tage: settings?.ruhigeTage || [],
        ruhige_uhrzeiten: settings?.ruhigeUhrzeiten || '',
        spezifische_regel_akustik: settings?.spezifischeRegelAkustik || '',
        spezifische_regel_fehler: settings?.spezifischeRegelFehler || '',
        owner_voice_anweisung: ownerVoice || ''
      }
    }, null, 2)

    // Sterneabhängiger Mailkontakt-Schutz (Unverändert)
    const contactEmailFuerPrompt = stars <= 2 ? contactEmail : ''

    // 4. Den fokussierten V8 Prompt verketten
    const v8Prompt = buildV8Prompt(restaurantProfileJson, aktivierteSpickzettel, isDu, langInstruction, contactEmailFuerPrompt)

    // 5. Claude Sonnet 5 generiert den perfekten Mittelteil basierend auf dem Spickzettel
    const raw = await callClaude(
      `Bewertung des Gasts: "${reviewText}"\nSternebewertung: ${stars} von 5\nKritikpunkte: ${analysis.points.join(', ') || 'allgemeiner Unmut'}\nLobpunkte: ${analysis.lobpunkte.join(', ') || 'keine'}`,
      v8Prompt,
      APP_CONFIG.models.generation,
      APP_CONFIG.temperature.generation
    )
    const kernText = cleanResponseText(raw)

    // 6. Output zusammensetzen (Unverändert)
    const text = `${begruessung}\n\n${kernText}\n\n${grussFormel},\n${signature}`
    return res.status(200).json({ success: true, answers: [{ label: 'Frei (Test)', text }] })

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('generate-replies-v8 FEHLER:', errMsg)
    return res.status(500).json({ success: false, error: errMsg })
  }
}
