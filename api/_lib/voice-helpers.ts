// ─── voice-helpers.ts ──────────────────────────────────────────────────────
// Gemeinsames Modul für alle Engines (v7, v8, zukünftige Versionen).
// Enthält: Audio-Transkription (Groq Whisper) + Skalpell (Satz per Sprachbefehl korrigieren).
// Wird zentral gepflegt, damit sich Mikrofon-Feature und Engine-Version nicht auseinanderentwickeln.

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const GROQ_API_KEY = process.env.GROQ_API_KEY

// ─── CLAUDE API CALL (geteilt) ────────────────────────────────────────────────

export async function callClaude(
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

export async function transcribeAudio(audioBase64: string, mimeType: string): Promise<string> {
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
// Bearbeitet ausschliesslich den markierten Satz, schuetzt den Rest des Textes.

export async function korrigiereSatz(
  markierterSatzOriginal: string,
  gesprocheneAnweisung: string
): Promise<string> {
  const systemPrompt = `Du bist ein präzises Text-Skalpell für eine Gastronomie-Software. Deine einzige Aufgabe ist es, einen einzelnen Satz stilistisch zu korrigieren, den ein Gastronom per Sprachbefehl anpassen möchte.

Deine harten Arbeitsregeln:
1. Formuliere NUR diesen einen Satz exakt nach den Wünschen des Nutzers um.
2. Behalte den Charakter des Inhabers bei: Er ist ein gestandener Gastronom, er redet nicht um den heißen Brei herum, aber er setzt die gewünschte Anpassung (z.B. abmildern, kürzen, verschärfen) präzise um.
3. Nutze NIEMALS Gedankenstriche (— oder –) in deiner Antwort.
4. Keine Entschuldigung, kein Bedauern, keine Floskeln.
5. WICHTIG: Gib als Output AUSSCHLIESSLICH den neu formulierten Satz zurück. Keine Einleitung, keine Anmerkungen, keine Anführungszeichen.`

  const userMessage = `Aktueller Satz:
"${markierterSatzOriginal}"

Gesprochene Anweisung des Nutzers:
"${gesprocheneAnweisung}"`

  const raw = await callClaude(userMessage, systemPrompt, 'claude-sonnet-4-6', 0.2)
  return raw.trim().replace(/^["']|["']$/g, '')
}

// ─── HANDLER-BAUSTEINE ────────────────────────────────────────────────────────
// Diese Funktionen geben fertige { success, ... } Objekte zurück, damit der
// Engine-Handler sie 1:1 durchreichen kann, ohne die Logik zu duplizieren.

export async function handleTranscribeAction(audioBase64: string, mimeType: string) {
  if (!audioBase64) return { status: 400, body: { success: false, error: 'audioBase64 fehlt' } }
  try {
    const transcript = await transcribeAudio(audioBase64, mimeType || 'audio/webm')
    return { status: 200, body: { success: true, transcript } }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    return { status: 500, body: { success: false, error: errMsg } }
  }
}

export async function handleSkalpellAction(markierterSatzOriginal: string, gesprocheneAnweisung: string) {
  if (!markierterSatzOriginal || !gesprocheneAnweisung) {
    return { status: 400, body: { success: false, error: 'markierterSatzOriginal oder gesprocheneAnweisung fehlt' } }
  }
  try {
    const korrigiert = await korrigiereSatz(markierterSatzOriginal, gesprocheneAnweisung)
    return { status: 200, body: { success: true, korrigierterSatz: korrigiert } }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    return { status: 500, body: { success: false, error: errMsg } }
  }
}
