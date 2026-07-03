import type { VercelRequest, VercelResponse } from '@vercel/node'

// ─── v6 ── NEUE ENGINE: KURZER UR-PROMPT ALS KERNSTÜCK ───────────────────────
// Ersetzt die vorherige v6 (Kategorie-Router ohne Lego-Bausteine, war Vorstufe
// von v7 ohne Eigenwert). Statt fester Bausteine bekommt Claude hier den
// kurzen Persona-Prompt ("Stell dir vor, du bist der Inhaber...") + den
// harten Struktur-Käfig, 1:1 wie vorgegeben, inklusive Ton-Limit-Klausel.
//
// Alles in EINER Datei, kein Import aus anderen Dateien. Der vorherige Versuch
// mit ausgelagertem voice-helpers.ts in api/_lib ist am Vercel-Deployment
// gescheitert (ERR_MODULE_NOT_FOUND). Deshalb zurück zum bewährten Muster:
// jede Engine-Datei ist komplett eigenständig, genau wie v5 und v7.

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const GROQ_API_KEY = process.env.GROQ_API_KEY

// ─── CLAUDE API CALL ──────────────────────────────────────────────────────────

async function callClaude(
  userMessage: string,
  systemPrompt?: string,
  model = 'claude-sonnet-4-6',
  temperature = 0
): Promise<string> {
  const body: any = {
    model,
    max_tokens: 1000,
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
  const raw = await callClaude(userMessage, systemPrompt, 'claude-sonnet-4-6', 0.2)
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
1. Falls Lobpunkte vorhanden sind: greif sie in ein bis zwei Sätzen auf, kurz und ehrlich, keine Floskel wie "vielen Dank für dein Feedback". Wenn keine Lobpunkte da sind, direkt mit Schritt 2 starten.
2. Sofortige Erklärung der betrieblichen Regel/Vorgabe.
3. Falls zutreffend: das kurze Statement zum Ton (maximal zwei Sätze).
4. Der lockere, souveräne Ausstieg: Beende den Fließtext mit einem kurzen, wohlwollenden Blick nach vorne, der klingt, als würdest du mit einem guten Bekannten sprechen, geradeheraus, ohne zu belehren und ohne zu kriechen.
   - Wenn in der Erklärung oben eine konkrete Alternative genannt wird (z. B. Bar, Stehtisch, andere Öffnungszeit), verbinde den Ausstieg locker damit, in dieser Richtung (in eigenen Worten, nicht wörtlich kopieren): "Wenn du beim nächsten Mal Hunger mitbringst, ist dir ein Tisch sicher. Und wenn du nur auf ein Glas vorbeikommst, sehen wir uns einfach an der Bar."
   - Wenn der Gast signalisiert hat, nicht mehr kommen zu wollen, und es gibt keine solche Alternative, reiche ihm stattdessen locker die Hand, in dieser Richtung (ebenfalls in eigenen Worten): "Auch wenn du nicht mehr vorhast zu kommen, vielleicht sieht man sich ja doch noch mal. Falls ja, meld dich vorher kurz."
   - In allen anderen Fällen: ein kurzer, allgemeiner freundlicher Ausblick reicht.
   Passe Formulierung, Du/Sie und Sprache jeweils an.
Alle Schritte fließen in einem einzigen, zusammenhängenden Absatz ineinander, kein Abschnittswechsel, keine Zwischenüberschriften.

Anrede und Grußformel werden separat vom System ergänzt, gib nur diesen mittleren Teil inklusive Lob-Einstieg (falls vorhanden) und Ausstieg aus.

Wenn du im Text selbst etwas wörtlich zitieren willst (z. B. einen unglücklichen Satz), nutze deutsche Anführungszeichen „..." oder einfache Anführungszeichen '...', niemals gerade doppelte Anführungszeichen ".

Gib NUR den fertigen Fließtext zurück, ohne Anrede-Zeile, ohne Grußformel, ohne Anführungszeichen drumherum, ohne JSON, ohne Code-Block, nur den reinen Text.`
}

function parseUrPromptResponse(raw: string): string {
  let s = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  // Sicherheitsnetz: falls die KI trotz Anweisung doch JSON zurückgibt, versuchen zu extrahieren.
  // Schlägt die Extraktion fehl (z.B. wegen Anführungszeichen im Text), wird die rohe Antwort
  // von den äußeren {"text": "..."} Resten befreit statt sie ungefiltert anzuzeigen.
  if (s.startsWith('{') && s.includes('"text"')) {
    const start = s.indexOf('{')
    const end = s.lastIndexOf('}')
    try {
      const parsed = JSON.parse(s.substring(start, end + 1))
      if (parsed.text) return parsed.text
    } catch {
      s = s.replace(/^\{\s*"text"\s*:\s*"/, '').replace(/"\s*\}\s*$/, '')
    }
  }
  return s.replace(/^["']|["']$/g, '').trim()
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
    if (!audioBase64) return res.status(400).json({ success: false, error: 'audioBase64 fehlt' })
    try {
      const transcript = await transcribeAudio(audioBase64, mimeType || 'audio/webm')
      return res.status(200).json({ success: true, transcript })
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      return res.status(500).json({ success: false, error: errMsg })
    }
  }

  // Skalpell: einzelnen Satz per Sprachbefehl korrigieren
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
    const { signature, isDu, firstNameClean, langInstruction, description } = resolveSettings(settings, reviewerName)
    const pickGreeting = (isDu: boolean, name: string): string => {
      if (isDu) {
        const pool = name ? [`Hallo ${name},`, `Hey ${name},`] : ['Hallo,', 'Hey,']
        return pool[Math.floor(Math.random() * pool.length)]
      }
      return name ? `Hallo ${name},` : 'Guten Tag,'
    }
    const begruessung = pickGreeting(isDu, firstNameClean)
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
      `Bewertung des Gasts: "${reviewText}"\nKritikpunkte: ${analysis.points.join(', ') || 'keine konkreten, allgemeiner Unmut'}\nLobpunkte: ${analysis.lobpunkte.join(', ') || 'keine'}`,
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
