import type { VercelRequest, VercelResponse } from '@vercel/node'

// ─── v7 ── RADIKALER RESET: EINFACHER UR-PROMPT OHNE KATEGORIEN ──────────────
// Die komplizierte Kategorien-Weiche (A/B/C/Service) und die Haiku-Analyse 
// wurden im gesamten Code restlos entfernt. Die Engine nutzt nun einen fokussierten 
// Master-Prompt, der das 3-Rollen-Prinzip (Gastgeber -> Inhaber -> Kumpel) linear erzwingt.
// Alle nützlichen UI-Features (Skalpell, Audio, Leere-Sterne-Logik) bleiben aktiv.

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

// ─── DER NEUE KOMPAKTE UR-PROMPT (Kernstück v7) ──────────────────────────────

function buildUrPrompt(
  businessName: string,
  explanation: string,
  isDu: boolean,
  langInstruction: string,
  contactEmail: string
): string {
  const anrede = isDu
    ? 'Du duzt den Gast. Schreibe "du", "dir", "dein", "dich" klein.'
    : 'Du siezt den Gast.'

  const kontaktHinweis = contactEmail
    ? `Falls du am Ende auf eine direkte Klärung verweist, nutze diese E-Mail-Adresse: ${contactEmail}`
    : `Es ist aktuell KEINE Kontakt-E-Mail hinterlegt. Verweise niemals auf eine E-Mail-Adresse, sondern formuliere allgemein, wie z.B. „sprich mich beim nächsten Besuch direkt im Laden an“.`

  return `Stell dir vor, du bist der Inhaber von „${businessName}“. Ein Gast hat eine Bewertung hinterlassen und du antwortest ihm direkt. 
Schreibe einen einzigen zusammenhängenden Absatz (Fließtext), der ohne sichtbare Brüche drei Rollen nacheinander kombiniert:

1. Der nette Gastgeber (Einstieg): Du holst den Gast freundlich ab. Wenn Lobpunkte in der Bewertung mitschwingen, greifst du sie hier kurz und ehrlich auf.
2. Der gestandene Inhaber (Mittelteil): Du bist der Chef, der stolz und geradeheraus die klare Linie des Hauses vertritt. Erkläre die Situation sachlich anhand der betrieblichen Vorgabe, ohne Ausflüchte und ohne kriecherische Floskeln.
3. Der lockere Kumpel (Schluss): Du nimmst den Druck komplett vom Kessel und reichst dem Gast auf Augenhöhe die Hand für die Zukunft oder eine private Klärung.

Harte Struktur-Regeln:
- Länge der Antwort: Der gesamte Antworttext ist strikt auf insgesamt maximal 3 bis 5 Sätze begrenzt. Fasse dich kurz und präzise.
- Keine Gedankenstriche: Nutze im gesamten Text niemals Gedankenstriche (– oder —). Verbinde Sätze nur mit Kommas, Punkten oder normalen Bindewörtern.
- Keine Floskeln: Steige sofort ohne einleitendes "Vielen Dank für das Feedback" oder "Schade, dass..." ein.
- Charakter: Du bist höflich, aber ein gestandener Gastronom. Du redest nicht um den heißen Brei herum und entschuldigst dich nicht für Dinge, die betrieblich völlig normal sind.

Hier ist die Hausregel/betriebliche Vorgabe für den Mittelteil, die du dem Gast erklärst: "${explanation}"

${kontaktHinweis}

${anrede}
${langInstruction}

Anrede und Grußformel werden separat vom System ergänzt, gib nur diesen mittleren Teil inklusive Ausstieg aus.

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

// ─── HANDLER ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert' })

  const { action, audioBase64, mimeType, markierterSatzOriginal, gesprocheneAnweisung, review, settings, ownerVoice } = req.body

  // Mikrofon-Transkription (Aufnahme starten)
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
    const { businessName, signature, isDu, firstNameClean, langInstruction, description, contactEmail } = resolveSettings(settings, reviewerName)
    
    const pickGreeting = (isDu: boolean, name: string): string => {
      if (isDu) {
        const pool = name ? [`Hallo ${name},`, `Hey ${name},`] : ['Hallo,', 'Hey,']
        return pool[Math.floor(Math.random() * pool.length)]
      }
      return name ? `Hallo ${name},` : 'Guten Tag,'
    }
    const begruessung = pickGreeting(isDu, firstNameClean)
    const grussFormel = d(isDu, 'Viele Grüße', 'Mit freundlichen Grüßen')

    // 1. WEICHE: Negative Bewertung ohne Text -> Sofortiges Boilerplate, bricht ab ohne KI-Kosten
    if (mode === 'EMPTY_NEGATIVE') {
      const text = `${begruessung}\n\n${getBoilerplateResponse(isDu, contactEmail)}\n\n${grussFormel},\n${signature}`
      return res.status(200).json({ success: true, answers: [{ label: 'Frei (Test)', text }] })
    }

    // 2. WEICHE: Rein positive Bewertung ohne Kritik -> Schneller Zufallstext, kein Claude-Call nötig
    if (mode === 'CONTENT_POSITIVE' || mode === 'EMPTY_POSITIVE') {
      const kernSatz = d(isDu,
        'Ich freu mich, dass dir dein Besuch bei uns so gut gefallen hat. Komm gerne wieder vorbei.',
        'Es freut uns sehr, dass Ihnen Ihr Besuch bei uns so gut gefallen hat. Kommen Sie gerne wieder.'
      )
      const text = `${begruessung}\n\n${kernSatz}\n\n${grussFormel},\n${signature}`
      return res.status(200).json({ success: true, answers: [{ label: 'Frei (Test)', text }] })
    }

    // 3. WEICHE: Alles mit echter Kritik -> Direkt über den neuen Master-Ur-Prompt ohne Kategorien-Weiche
    const explanation = (ownerVoice && ownerVoice.trim())
      ? ownerVoice.trim()
      : (description || 'Erkläre kurz und sachlich, warum wir so handeln, ohne dich zu rechtfertigen.')

    const urPrompt = buildUrPrompt(businessName, explanation, isDu, langInstruction, contactEmail)
    const raw = await callClaude(
      `Bewertung des Gasts:\n"${reviewText}"\nSternebewertung: ${stars} von 5`,
      urPrompt,
      'claude-sonnet-4-6',
      0.3
    )
    const kernText = parseUrPromptResponse(raw)

    const text = `${begruessung}\n\n${kernText}\n\n${grussFormel},\n${signature}`
    return res.status(200).json({ success: true, answers: [{ label: 'Frei (Test)', text }] })

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('generate-replies FEHLER:', errMsg)
    return res.status(500).json({ success: false, error: errMsg })
  }
}