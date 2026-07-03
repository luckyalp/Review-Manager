import type { VercelRequest, VercelResponse } from '@vercel/node'

// ─── v6 ── NEUE ENGINE: KURZER UR-PROMPT ALS KERNSTÜCK ───────────────────────
// Architektur: Technik und Prompt-Texte sind strikt getrennt. Alle Prompt-
// Bausteine stehen unten als eigene Variablen im Abschnitt "PROMPT-MODULE".
// Der Code verkettet sie nur noch, formuliert nichts selbst. Die 4-Kategorien-
// Weiche (A/B/C/Service) ist vollständig aktiv, jede Kategorie hat ihren
// eigenen Ablauf.
//
// Alles weiterhin in EINER Datei, kein Import aus anderen Dateien (siehe
// gescheiterter _lib-Versuch, ERR_MODULE_NOT_FOUND).

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const GROQ_API_KEY = process.env.GROQ_API_KEY

// ─── APP_CONFIG ── EINZIGE STELLE FÜR BETRIEBS-PARAMETER ─────────────────────
// Modellnamen, Temperaturen, Endpunkte. Reine Technik, kein Einfluss auf Ton
// oder Inhalt der Antworten, das steckt weiterhin ausschließlich in den
// PROMPT-MODULEN weiter unten. Modell-Upgrade (z.B. Sonnet 5 -> 5.1) künftig
// nur noch hier ändern, der Rest des Codes bleibt unangetastet.
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
    temperature,
    messages: [{ role: 'user', content: userMessage }],
  }
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
}

interface Analysis {
  count: number
  points: string[]
  categories: string[]        // 'A' | 'B' | 'C'
  forceSummarize: boolean
  lobpunkte: string[]
  isServiceComplaint: boolean
}

type KategorieKey = 'A' | 'B' | 'C' | 'SERVICE'

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

// Feste Antwort für positive Bewertungen ohne Kritik: braucht keinen Sonnet-Call, aber
// soll sich trotzdem nicht jedes Mal identisch anfühlen. Warmer, persönlicher Ton,
// nicht albern, keine Firmen-Floskeln.
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
  const pool = isDu ? poolDu : poolSie
  return pool[Math.floor(Math.random() * pool.length)]
}

function d(isDu: boolean, duText: string, sieText: string): string {
  return isDu ? duText : sieText
}

// Feste Antwort für negative Bewertungen ohne Text: keine Analyse, kein Ur-Prompt,
// keine API-Calls nötig, weil es inhaltlich nichts zu analysieren gibt.
// contactEmail kommt dynamisch aus dem Restaurantprofil, nie fest im Code.
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

  const raw = await callClaude(reviewText, systemPrompt, APP_CONFIG.models.analysis, APP_CONFIG.temperature.default)
  const s = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('Kein JSON gefunden: ' + raw)
  return JSON.parse(s.substring(start, end + 1))
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── PROMPT-MODULE ────────────────────────────────────────────────────────
// Reine Text-Bausteine, keine Logik. Nichts hier drin weiß etwas von JSON,
// Regex oder Code. Wird von buildUrPrompt() unten nur noch zusammengesetzt.
// ═══════════════════════════════════════════════════════════════════════════

const PERSONA_INTRO = `Stell dir vor, du bist eine Person, die für die Antwort drei feste Rollen nacheinander kombiniert, alles in einem einzigen Fließtext, kein Rollenwechsel sichtbar:
1. Der nette Gastgeber (Einstieg): Du holst den Gast freundlich ab. Wenn Lobpunkte vorhanden sind, greifst du sie hier kurz und ehrlich auf.
2. Der gestandene Inhaber (Mittelteil): Du bist der Chef, der stolz und geradeheraus die klare Linie des Hauses vertritt, sachlich und ohne kriecherische Floskeln.
3. Der lockere Kumpel (Schluss): Du entschärfst die Situation komplett und holst den Gast auf Augenhöhe zurück, mit einem Ausblick oder einer ausgestreckten Hand.
Du bist dabei höflich, aber ein gestandener Gastronom, du redest nicht um den heißen Brei herum, du entschuldigst dich nicht für Dinge, die normal sind, und du nutzt keine Phrasen, die du nicht auch laut im Laden sagen würdest.`

const HARTE_STRUKTUR_REGELN = `Harte Struktur-Regeln:
- Keine Gedankenstriche: Nutze im gesamten Text niemals Gedankenstriche (– oder —). Verbinde Sätze nur mit Kommas, "und", "oder" sowie Punkten.
- Keine Floskeln: Steige sofort ohne einleitendes "Vielen Dank für das Feedback" oder "Schade, dass..." ein.
- Das Ton-Limit: Wenn der Ton vor Ort zu scharf war, gestehst du das in maximal ein bis zwei Sätzen ein (z. B. dass es im Eifer des Gefechts unglücklich formuliert war), ohne dich danach weiter zu rechtfertigen, dich zu demütigen oder dich in aller Form zu entschuldigen. Nur wenn das aus der Erklärung hervorgeht, sonst weglassen.`

// Ablauf Kategorie A: feste betriebliche Regel/Struktur (z.B. Tischzeit, Konzept-Kritik).
// Das ist der fertige, getestete Ablauf.
const ABLAUF_KATEGORIE_A = `Ablauf der Antwort (Kategorie A, Regeln & Konzept):
1. Der nette Gastgeber: Falls Lobpunkte vorhanden sind, greif sie in ein bis zwei Sätzen auf, kurz und ehrlich, keine Floskel wie "vielen Dank für dein Feedback". Wenn keine Lobpunkte da sind, direkt mit Schritt 2 starten.
2. Der gestandene Inhaber: Sofortige Erklärung der betrieblichen Regel/Vorgabe.
3. Falls zutreffend: das kurze Statement zum Ton (maximal zwei Sätze).
4. Der lockere Kumpel: Beende den Fließtext mit einem kurzen, wohlwollenden Blick nach vorne, der klingt, als würdest du mit einem guten Bekannten sprechen, geradeheraus, ohne zu belehren und ohne zu kriechen.
   - Wenn in der Erklärung oben eine konkrete Alternative genannt wird (z. B. Bar, Stehtisch, andere Öffnungszeit), verbinde den Ausstieg locker damit, in dieser Richtung (in eigenen Worten, nicht wörtlich kopieren): "Wenn du beim nächsten Mal Hunger mitbringst, ist dir ein Tisch sicher. Und wenn du nur auf ein Glas vorbeikommst, sehen wir uns einfach an der Bar."
   - Wenn der Gast signalisiert hat, nicht mehr kommen zu wollen, und es gibt keine solche Alternative, reiche ihm stattdessen locker die Hand, in dieser Richtung (ebenfalls in eigenen Worten): "Auch wenn du nicht mehr vorhast zu kommen, vielleicht sieht man sich ja doch noch mal. Falls ja, meld dich vorher kurz."
   - In allen anderen Fällen: ein kurzer, allgemeiner freundlicher Ausblick reicht.
   Passe Formulierung, Du/Sie und Sprache jeweils an.
Alle Schritte fließen in einem einzigen, zusammenhängenden Absatz ineinander, kein Abschnittswechsel, keine Zwischenüberschriften.`

// Ablauf Kategorie B: Fehler im Ablauf, Küche oder Zubereitung (echter Fehler).
// Ziel: Größe zeigen, den Fehler ehrlich einräumen und sich distanzieren, ohne künstlich zu kriechen.
const ABLAUF_KATEGORIE_B = `Ablauf der Antwort (Kategorie B, Küchenfehler):
1. Der nette Gastgeber: Falls Lobpunkte vorhanden sind, greif sie in ein bis zwei Sätzen auf, kurz und ehrlich. Wenn keine Lobpunkte da sind, direkt mit Schritt 2 starten.
2. Der gestandene Inhaber (Fehler-Eingeständnis): Geh direkt auf das Missgeschick ein und ziehe eine klare Grenze zu deinem eigentlichen Qualitätsanspruch, in dieser Richtung (in eigenen Worten, nicht wörtlich kopieren): "Dass das Steak kalt war, entspricht absolut nicht unserem Standard, da ist uns in der Küche schlicht die Koordination abgerissen." Kein langes Herumreden, kein "Es tut uns unendlich leid".
3. Falls zutreffend: das kurze Statement zum Ton (maximal zwei Sätze).
4. Der lockere Kumpel (Wiedergutmachung): Biete eine direkte, handfeste Wiedergutmachung an, die zeigt, dass du zu deinem Wort stehst, in dieser Richtung (in eigenen Worten, nicht wörtlich kopieren): "Beim nächsten Mal geht die erste Runde auf mich, sprich mich einfach direkt im Laden an, dann brennt da auch nichts an."
Alle Schritte fließen in einem einzigen, zusammenhängenden Absatz ineinander.`

// Ablauf Kategorie C: Geschmack, Menge, Preis oder Auswahl (persönliche Präferenz).
// Ziel: Stolz auf der eigenen Linie bleiben, dem Gast seine Meinung lassen, aber das eigene Konzept
// verteidigen. WICHTIG: nie als objektiven Fehler framen, immer als individuelle Präferenz, und nie
// pauschal mit "Geschmäcker sind verschieden" o.ä. abtun, das isoliert den Gast statt ihn ernst zu nehmen.
const ABLAUF_KATEGORIE_C = `Ablauf der Antwort (Kategorie C, Geschmack & Preis):
1. Der nette Gastgeber: Falls Lobpunkte vorhanden sind, greif sie in ein bis zwei Sätzen auf, kurz und ehrlich. Wenn keine Lobpunkte da sind, direkt mit Schritt 2 starten.
2. Der gestandene Inhaber (Konzept-Klartext): Erkenne die persönliche Präferenz des Gastes ausdrücklich an, ohne sie pauschal mit "Geschmäcker sind verschieden" oder ähnlichen Floskeln abzutun. Verteidige stattdessen die eigene handwerkliche Linie, egal ob es um Geschmack, Menge, Auswahl oder Preis ging, in dieser Richtung (in eigenen Worten, nicht wörtlich kopieren): "Dass dir das nicht getroffen hat, kann ich nachvollziehen. Wie wir kochen und kalkulieren, ist bei uns bewusst so, das ist Konzept und kein Zufall." Keine Entschuldigung, keine Rechtfertigung.
3. Falls zutreffend: das kurze Statement zum Ton (maximal zwei Sätze).
4. Der lockere Kumpel: Reiche dem Gast souverän die Hand, ohne belehrend zu wirken oder um Wiederkehr zu betteln, in dieser Richtung (in eigenen Worten, nicht wörtlich kopieren): "Falls es diesmal nicht gepasst hat, probier beim nächsten Mal gerne etwas anderes von der Karte. Falls in der Erklärung oben eine Alternative genannt wird, probier die, vielleicht trifft das eher deinen Nerv."
Alle Schritte fließen in einem einzigen, zusammenhängenden Absatz ineinander.`

// Ablauf Kategorie SERVICE: Beschwerden über Personal oder Service-Ton.
// Ziel: Das eigene Team schützen, deeskalieren und das Gespräch aus der Öffentlichkeit holen.
// WICHTIG: nie die Verhaltens-Anschuldigung selbst als Fakt bestätigen, nur den Eindruck
// des Gastes. Das Team wird verteidigt, nicht öffentlich vorverurteilt.
const ABLAUF_SERVICE = `Ablauf der Antwort (Kategorie SERVICE, Personal):
1. Der nette Gastgeber: Falls Lobpunkte vorhanden sind, greif sie in ein bis zwei Sätzen auf, kurz und ehrlich. Wenn keine Lobpunkte da sind, direkt mit Schritt 2 starten.
2. Der gestandene Inhaber (Team-Schutzschild): Stell dich vor deine Crew. Bestätige nie die Verhaltens-Anschuldigung selbst als Fakt, sondern nur den Eindruck des Gastes. Signalisiere, dass jeder Vorfall intern in Ruhe besprochen wird, ohne euch öffentlich schuldig zu bekennen, in dieser Richtung (in eigenen Worten, nicht wörtlich kopieren): "Mein Team arbeitet hart, und wenn bei dir der Eindruck entstanden ist, dass da was nicht gepasst hat, besprechen wir das intern in Ruhe."
3. Falls zutreffend: das kurze Statement zum Ton (maximal zwei Sätze).
4. Der lockere Kumpel (Umlenkung ins Private): Biete keine Bühne für öffentliche Diskussionen, sondern lenk das Gespräch konsequent und konkret ins Private, in dieser Richtung (in eigenen Worten, nicht wörtlich kopieren): "Lass uns das nicht hier öffentlich austragen, das bringt niemandem was. Schreib mir kurz an die hinterlegte Adresse oder sprich mich beim nächsten Besuch direkt an, dann klären wir das unter uns."
Alle Schritte fließen in einem einzigen, zusammenhängenden Absatz ineinander.`

const CATEGORY_ABLAUF: Record<KategorieKey, string> = {
  A: ABLAUF_KATEGORIE_A,
  B: ABLAUF_KATEGORIE_B,
  C: ABLAUF_KATEGORIE_C,
  SERVICE: ABLAUF_SERVICE,
}

const AUSGABE_REGELN = `Anrede und Grußformel werden separat vom System ergänzt, gib nur diesen mittleren Teil inklusive Lob-Einstieg (falls vorhanden) und Ausstieg aus.

Die mitgelieferte Sternebewertung gibt dir ein Gefühl für die Schwere der Situation: bei 3 Sternen darf der Ton spürbar gelassener und knapper ausfallen als bei 1 Stern. Die Grundhaltung bleibt in beiden Fällen gleich, kein Bedauern, kein Kriechen, nur die Intensität passt sich an.

Wenn du im Text selbst etwas wörtlich zitieren willst (z. B. einen unglücklichen Satz), nutze deutsche Anführungszeichen „..." oder einfache Anführungszeichen '...', niemals gerade doppelte Anführungszeichen ".

Gib NUR den fertigen Fließtext zurück, ohne Anrede-Zeile, ohne Grußformel, ohne Anführungszeichen drumherum, nur den reinen Text.`

// ═══════════════════════════════════════════════════════════════════════════
// ─── VERKETTUNG (reine Technik, keine Prompt-Formulierung) ──────────────────
// ═══════════════════════════════════════════════════════════════════════════

// Wählt die Kategorie für die Prompt-Weiche. Service geht vor, weil eine
// Service-Beschwerde laut Vorgabe immer auf private Kontaktaufnahme zielt,
// unabhängig davon, welche inhaltliche Kategorie Haiku sonst noch erkannt hat.
function pickKategorie(analysis: Analysis): KategorieKey {
  if (analysis.isServiceComplaint) return 'SERVICE'
  if (analysis.categories?.includes('A')) return 'A'
  if (analysis.categories?.includes('B')) return 'B'
  if (analysis.categories?.includes('C')) return 'C'
  return 'A'
}

function buildUrPrompt(
  explanation: string,
  isDu: boolean,
  langInstruction: string,
  kategorie: KategorieKey
): string {
  const anrede = isDu
    ? 'Du duzt den Gast. Schreibe "du", "dir", "dein", "dich" klein.'
    : 'Du siezt den Gast.'

  const ablauf = CATEGORY_ABLAUF[kategorie]

  return [
    PERSONA_INTRO,
    `Hier ist die Hausregel/betriebliche Vorgabe für diesen Fall, die du dem Gast erklärst: "${explanation}"`,
    `${anrede}\n${langInstruction}`,
    HARTE_STRUKTUR_REGELN,
    ablauf,
    AUSGABE_REGELN,
  ].join('\n\n')
}

// Räumt die Modell-Antwort auf. Wir fordern nie JSON an (siehe AUSGABE_REGELN),
// deshalb ist der Normalfall: raw ist bereits reiner Text. Die Zeilen darunter
// sind ein billiges, unsichtbares Sicherheitsnetz im Code, nicht im Prompt,
// falls das Modell trotzdem mal Codeblock-Markierungen oder umschließende
// Anführungszeichen dranhängt. Kein JSON-Parsing mehr.
function cleanResponseText(raw: string): string {
  return raw
    .replace(/```[a-z]*\s*/gi, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim()
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
    const { signature, isDu, firstNameClean, langInstruction, description, contactEmail } = resolveSettings(settings, reviewerName)
    const begruessung = pickGreeting(isDu, firstNameClean)
    const grussFormel = d(isDu, 'Viele Grüße', 'Mit freundlichen Grüßen')

    // Negative Bewertung ohne Text: nichts zu analysieren, direkt Boilerplate, kein API-Call
    if (mode === 'EMPTY_NEGATIVE') {
      const text = `${begruessung}\n\n${getBoilerplateResponse(isDu, contactEmail)}\n\n${grussFormel},\n${signature}`
      return res.status(200).json({ success: true, answers: [{ label: 'Frei (Test)', text }] })
    }

    // Rein positive Bewertung ohne Kritik: kurzer direkter Weg, kein Ur-Prompt nötig
    if (mode === 'CONTENT_POSITIVE' || mode === 'EMPTY_POSITIVE') {
      const analysis = mode === 'CONTENT_POSITIVE' ? await analyzeReview(reviewText) : null
      if (!analysis || analysis.count === 0) {
        const kernSatz = pickPositivKernsatz(isDu)
        const text = `${begruessung}\n\n${kernSatz}\n\n${grussFormel},\n${signature}`
        return res.status(200).json({ success: true, answers: [{ label: 'Frei (Test)', text }] })
      }
    }

    // Alles mit Kritik (negativ, gemischt, leer-negativ): über den Ur-Prompt
    const analysis = await analyzeReview(reviewText)
    const kategorie = pickKategorie(analysis)

    // Die "Erklärung" für den Ur-Prompt: primär die Inhaber-Stimme, sonst Profil-Beschreibung
    const explanation = (ownerVoice && ownerVoice.trim())
      ? ownerVoice.trim()
      : (description || 'Erkläre kurz und sachlich, ohne dich zu rechtfertigen.')

    const urPrompt = buildUrPrompt(explanation, isDu, langInstruction, kategorie)
    const raw = await callClaude(
      `Bewertung des Gasts: "${reviewText}"\nSternebewertung: ${stars} von 5\nKritikpunkte: ${analysis.points.join(', ') || 'keine konkreten, allgemeiner Unmut'}\nLobpunkte: ${analysis.lobpunkte.join(', ') || 'keine'}`,
      urPrompt,
      APP_CONFIG.models.generation,
      APP_CONFIG.temperature.generation
    )
    const kernText = cleanResponseText(raw)

    const text = `${begruessung}\n\n${kernText}\n\n${grussFormel},\n${signature}`
    return res.status(200).json({ success: true, answers: [{ label: 'Frei (Test)', text }] })

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('generate-replies-v6 FEHLER:', errMsg)
    return res.status(500).json({ success: false, error: errMsg })
  }
}
