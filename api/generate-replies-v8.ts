import type { VercelRequest, VercelResponse } from '@vercel/node'

// ─── v8.7 ── MOTOR-WECHSEL: ANTHROPIC → GEMINI ──────────────────────────────
// Nur die API-Anbindung wurde getauscht (callClaude → callGemini, neue
// Modellnamen, neuer Env-Var-Name GEMINI_API_KEY). Alle Prompts, Regeln,
// Spickzettel und die komplette Ablauflogik sind 1:1 unverändert wie in v8.6.
// Analyse läuft jetzt auf gemini-2.5-flash-lite, Text-Generierung auf
// gemini-3.5-flash.
//
// ─── v8.6 ── DIE PRÄZISIONS-ENGINE: GOLD-BEISPIELE STATT VERBOTSLISTEN ──────
// Änderungen v8.6 (Architektur unangetastet):
// 1. TEMPERATUR-BUG: temperature wurde für claude-sonnet-5 nie gesendet,
//    Generierung lief real auf 1.0 statt 0.3. Jetzt wird sie immer gesendet.
// 2. GOLD_BEISPIELE_V8: 6 Ton-Vorbilder (Bewertung → Antwort) im Prompt.
//    Stil kommt jetzt aus Beispielen, nicht aus Verbotslisten.
// 3. HARTE_STRUKTUR_REGELN_V8 auf 5 Regeln gekürzt, Satzrhythmus-Variation
//    statt starrer 15-20-Wörter-Regel (monotoner Stakkato war KI-Erkennungsmerkmal).
// 4. CLEANER-BUGS: "morgen"-Ersetzung ("bis morgen" → "bis besuch") und
//    'laden'/'regel' in domainNouns ("wir laden dich ein" → "wir Laden dich ein") behoben.
//
// ─── v8.5 ── DIE PRÄZISIONS-ENGINE: SPICKZETTEL & JSON-PROFIL ────────────────
// Architektur: Technik und Prompt-Texte sind strikt getrennt. Alle Prompt-
// Bausteine stehen unten als eigene Variablen im Abschnitt "PROMPT-MODULE".
//
// Diese Version basiert 1:1 auf der bestehenden, funktionierenden v8-Architektur
// (alle Weichen, Sterne-Schutz, API-Sicherheit, answers-Array-Format bleiben
// unverändert) und ergänzt ausschließlich geprüfte Prompt-Verbesserungen:
// Anti-Double-Deviation, spezifische Validierung, Service Recovery Paradox (SRP)
// und ein deterministisches Sicherheitsnetz gegen Tageszeit-Wörter im Code.
// Alle technischen Hilfsfunktionen (Skalpell, Transkription, Weichen) sind unangetastet.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GROQ_API_KEY = process.env.GROQ_API_KEY

// ─── APP_CONFIG ── BETRIEBS-PARAMETER ────────────────────────────────────────
const APP_CONFIG = {
  geminiApiUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
  models: {
    generation: 'gemini-3.5-flash',
    analysis: 'gemini-2.5-flash-lite',
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

// ─── GEMINI API CALL ──────────────────────────────────────────────────────────
// Ersetzt callClaude(). Gleiche Aufgabe, andere Verpackung:
// - System-Prompt geht separat als "systemInstruction" mit, nicht im Fließtext
// - Antwort kommt unter candidates[0].content.parts[...].text zurück
// - jsonMode erzwingt bei Google direkt valides JSON (nützlich für die Analyse)

async function callGemini(
  userMessage: string,
  systemPrompt?: string,
  model = APP_CONFIG.models.generation,
  temperature = APP_CONFIG.temperature.default,
  jsonMode = false
): Promise<string> {
  const generationConfig: any = {
    temperature,
    maxOutputTokens: APP_CONFIG.maxTokens,
  }
  // Entspricht der alten "thinking: disabled"-Zeile für Sonnet: verhindert,
  // dass das Modell unnötig "nachdenkt" und dabei Kosten/Zeit verbraucht bzw.
  // die feste Temperature aushebelt. Gemini 3.x nutzt thinkingLevel (String),
  // Gemini 2.5 nutzt thinkingBudget (Zahl, 0 = aus).
  generationConfig.thinkingConfig = model.startsWith('gemini-3')
    ? { thinkingLevel: 'low' }
    : { thinkingBudget: 0 }
  if (jsonMode) generationConfig.responseMimeType = 'application/json'

  const body: any = {
    contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    generationConfig,
  }
  if (systemPrompt) body.systemInstruction = { parts: [{ text: systemPrompt }] }

  const response = await fetch(`${APP_CONFIG.geminiApiUrl}/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY!,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(`Gemini API Fehler: ${JSON.stringify(err)}`)
  }

  const data = await response.json()
  const parts = data.candidates?.[0]?.content?.parts || []
  return parts.map((p: any) => p.text || '').join('')
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
  const raw = await callGemini(userMessage, systemPrompt, APP_CONFIG.models.generation, APP_CONFIG.temperature.skalpell)
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
- "hausregeln_konzept" (Kritik an einer bewussten Betriebsregel, z.B. Tischvergabe nur mit Bestellung eines Hauptgerichts, Reservierungspflicht, Mindestbestellwert, Sitzzeit-Begrenzung. Der Gast empfindet die Regel selbst als unfreundlich oder unnötig kompliziert, nicht einen Fehler.)

Gib AUSSCHLIESSLICH valides JSON zurück:
{
  "count": 1,
  "points": ["Kritikpunkt in wenigen Worten"],
  "forceSummarize": false,
  "lobpunkte": ["Lobpunkt falls vorhanden"],
  "categories": ["kategorie_string"]
}
forceSummarize = true nur wenn 3 oder mehr eigenständige Kritikpunkte genannt werden.`

  const raw = await callGemini(reviewText, systemPrompt, APP_CONFIG.models.analysis, APP_CONFIG.temperature.default, true)
  const s = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('Kein JSON gefunden: ' + raw)
  return JSON.parse(s.substring(start, end + 1))
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── PROMPT-MODULE & SPICKZETTEL (V8.5 PRÄZISIONSMATERIAL) ──────────────────
// ═══════════════════════════════════════════════════════════════════════════

const PERSONA_INTRO_V8 = `Du bist ein erfahrener, direkt sprechender Gastronom (Chef). Antworte auf die Bewertung am Ende dieses Textes in einem einzigen, kurzen Fließtext ohne Absätze. Schreib konsequent in kurzen, klaren Hauptsätzen. Vermeide jegliche Schachtelsätze. Der Ton ist stolz, souverän, geradeheraus und nahbar. Du vertrittst die klare Linie des Hauses selbstbewusst nach außen und entschuldigst dich niemals für Dinge, die im Betrieb normal sind.`

// v8.6: Verbotsliste radikal gekürzt. Stil wird nicht mehr über Verbote
// erzwungen (Floskel-Whack-a-Mole), sondern über die GOLD_BEISPIELE_V8 unten.
// Hier stehen nur noch die 5 harten Regeln, die inhaltlich kritisch sind.
const HARTE_STRUKTUR_REGELN_V8 = `Fünf harte Regeln:
1. KEINE DOUBLE DEVIATION: Greife jeden Kritikpunkt kurz auf, ignoriere keinen. Baue mindestens ein konkretes Detail aus der Bewertung ein (Gericht, Situation). Bei 3 oder mehr Kritikpunkten (forceSummarize) fasse in 2 kurzen Sätzen zusammen statt aufzuzählen.
2. SATZRHYTHMUS: Kurze, klare Hauptsätze, aber variiere die Länge, mal 5 Wörter, mal 20. Kein monotoner Stakkato-Rhythmus. Keine Gedankenstriche (– oder —), keine Themen-Label mit Doppelpunkt (NICHT: "Zur Tischregel:").
3. Nie "Geschmäcker sind verschieden" oder Ähnliches. Keine Empathie-Floskeln wie "Ich kann das verstehen/nachvollziehen". Keine Tageszeit-Wörter (Abend, Morgen, Mittag), schreib stattdessen "Besuch".
4. Nie einen Vorwurf gegen dein Personal direkt bestätigen, nur den Eindruck des Gasts spiegeln.
5. Nie eine konkrete Wiedergutmachung (Rabatt, Freirunde) versprechen. Prinzip "Live vor Ort lösen": Lade den Gast ein, sich beim nächsten Mal direkt bemerkbar zu machen. Erfinde dabei keinen konkreten Ort und keine Person, außer der Kontakt-Hinweis gibt etwas vor.`

// v8.6 NEU: Gold-Beispiele. Stil transferiert über Vorbilder, nicht über
// Adjektive und Verbotslisten. Diese Beispiele definieren den Zielton.
const GOLD_BEISPIELE_V8 = `### GOLD-BEISPIELE (Zielton)
So klingen perfekte Antworten (nur der Mittelteil, ohne Anrede und Gruß). Die Beispiele duzen, übernimm aber die Anrede aus der Regel oben. WICHTIG: Das sind Ton-Vorbilder. Übernimm Haltung und Rhythmus, aber NIE ganze Formulierungen wörtlich, sonst wiederholen sich deine Antworten über mehrere Bewertungen hinweg.

Bewertung (3 Sterne): "Essen war lecker, aber es war so laut, dass wir uns kaum unterhalten konnten."
Antwort: "Schön, dass dir das Essen geschmeckt hat. Ja, bei uns ist ordentlich was los, ein voller Laden bringt nun mal Geräuschkulisse mit. Wenn ihr es ruhiger mögt, kommt am besten früh unter der Woche vorbei, da könnt ihr euch beim Essen deutlich besser unterhalten."

Bewertung (2 Sterne): "Suppe war kalt, danach 25 Minuten auf das Hauptgericht gewartet. Kellner hat sich nicht mehr blicken lassen."
Antwort: "Kalte Suppe und dann 25 Minuten aufs Hauptgericht warten, das ärgert mich selbst. Da ist bei eurem Besuch einiges schiefgelaufen. Sag beim nächsten Mal bitte sofort Bescheid, dann regeln wir das direkt am Tisch und du musst den Ärger nicht mit nach Hause nehmen."

Bewertung (3 Sterne): "Alles frisch, aber das Curry war mir viel zu scharf gewürzt."
Antwort: "Freut mich, dass die Frische gepasst hat. Unser Curry ist tatsächlich kräftig gewürzt, das ist Absicht, aber nicht jedermanns Sache. Sag bei der Bestellung einfach kurz, dass du es milder magst, die Küche passt das gerne an."

Bewertung (3 Sterne): "Schöne Location, aber für die Portionsgröße echt zu teuer."
Antwort: "Danke für das Lob zur Location. Bei den Preisen bleib ich ehrlich: Wir kaufen ordentliche Ware ein und zahlen unser Team fair, das hat seinen Preis. Wenn du richtig Hunger mitbringst, sag beim Bestellen Bescheid, dann findet unser Team was Passendes für dich."

Bewertung (2 Sterne): "Toilette war leider ziemlich dreckig, Tisch klebrig beim Hinsetzen."
Antwort: "Dreckige Toilette und klebriger Tisch, das geht nicht, da gibt es nichts zu diskutieren. Danke für den klaren Hinweis. Das habe ich direkt mit dem Team für die tägliche Runde nachgeschärft."

Bewertung (1 Stern): "Laut, Essen kalt, Kellner unfreundlich, und dann noch overpriced. Nie wieder."
Antwort: "Lautstärke, kaltes Essen, der Eindruck vom Service und dann noch der Preis, da ist bei eurem Besuch einiges zusammengekommen. Das ärgert mich, keine Frage. Gib uns sowas beim nächsten Mal direkt vor Ort mit, dann kümmern wir uns sofort drum."`

const AUSGABE_REGELN_V8 = `Anrede und Grußformel werden separat vom System ergänzt, gib nur diesen mittleren Teil inklusive Lob-Einstieg (falls vorhanden) und Ausstieg aus.
Wenn du im Text selbst etwas wörtlich zitieren willst, nutze deutsche Anführungszeichen „..." oder einfache Anführungszeichen '...', niemals gerade doppelte Anführungszeichen ".
Gib NUR den fertigen Fließtext zurück, ohne Anrede-Zeile, ohne Grußformel, ohne Anführungszeichen drumherum. Beginne den Text immer mit einem Großbuchstaben.`

// DIE SPICKZETTEL-DATENBANK
const SPICKZETTEL_BAUKASTEN: Record<string, string> = {
  akustik_konzept: 'Erkläre pragmatisch, dass ein gutgehendes, volles Haus eben lebendig ist und eine dementsprechende Geräuschkulisse einfach dazu gehört. Entschuldige dich nicht dafür. Schau im RESTAURANT_PROFIL unter "fakten.ruhige_tage" oder "fakten.ruhige_uhrzeiten" nach und gib diese als unverbindlichen Tipp für den nächsten Besuch mit. Falls diese Daten fehlen oder der Gast genau an diesen Tagen da war, empfiehl allgemein Zeiten außerhalb der Hauptstoßzeiten. Biete niemals eine Tisch- oder Ecken-Garantie an.',
  fehler_kueche_service: 'Stell klar, dass bei eurem Besuch bei uns ordentlich was schiefgelaufen ist. Bleib absolut gelassen und ohne kriecherisches Drama. Betone, dass wir Fehler am liebsten sofort live vor Ort im Laden lösen (Service Recovery Prinzip). Gib den Appell mit, uns beim nächsten Mal direkt vor Ort Bescheid zu geben, damit unser Team sofort reagieren, nachbessern und den Gast persönlich positiv überraschen kann. Schau im RESTAURANT_PROFIL unter "fakten.spezifische_regel_fehler" für optionale Details.',
  essen_geschmack: 'Nimm das Feedback zum Essen sachlich entgegen. Mach kein Drama daraus, dass es dem Gast nicht perfekt geschmeckt hat oder zu intensiv gewürzt war. Erkläre kurz, wie das Gericht bei euch normalerweise zubereitet wird, falls im RESTAURANT_PROFIL nützliche Details stehen. Lade ihn ein, beim nächsten Mal vor der Bestellung kurz Bescheid zu geben, damit die Küche die Würzung flexibel anpassen kann.',
  preis_leistung: 'Tritt selbstbewusst für eure Preise ein. Verweise auf die Qualität der Zutaten, den Wareneinsatz oder faire Löhne, falls im RESTAURANT_PROFIL hinterlegt (z.B. Beschreibung). Bleib gastfreundlich, aber knicke nicht ein. Falls du eine Einladung für den nächsten Besuch aussprichst, formuliere sie NICHT so, dass sie nach einer stillschweigenden Zusage auf mehr Essen oder eine größere Portion klingt (NICHT: "Melde dich, wenn dir eine Portion zu klein vorkommt."). Nutze stattdessen sowas wie: "Sag beim Bestellen einfach kurz Bescheid, wenn du besonders hungrig bist, dann findet unser Team etwas Passendes für dich."',
  reinheit_ambiente: 'Nimm den Hinweis dankend und ohne Umschweife auf. Erkläre kurz und trocken, dass Sauberkeit oberste Priorität hat und du das direkt mit dem Team für die tägliche Routine nachjustierst.',
  hausregeln_konzept: 'Erkläre die Hausregel (z.B. Tischvergabe nur mit Bestellung eines Hauptgerichts) als bewusste, funktionale Entscheidung, keine Schikane. Sprich in einem einzigen natürlichen Satz weiter, ohne die Regel als eigenes Thema mit Doppelpunkt einzuleiten (NICHT: "Zur Tischregel:"). Nenne den Grund einfach, neutral und im gesprochenen Ton, ohne andere Gäste dabei negativ darzustellen. So klingt der richtige Ton (nur als Stil-Vorbild, nicht wörtlich übernehmen): "Bei uns bleiben Tische fürs Essen frei, damit zur Stoßzeit auch hungrige Gäste sicher einen Platz kriegen, wer nur was trinken will, ist an der Bar bestens aufgehoben." Entschuldige dich nicht für die Regel selbst, allenfalls für ein Missverständnis in der Kommunikation davon vor Ort. Falls du auf eine Kontaktmöglichkeit verweist, mach unmissverständlich klar, dass es dabei nur um ein mögliches Missverständnis vor Ort geht (z.B. "Falls das vor Ort nicht klar genug rüberkam"), niemals um eine Diskussion oder Änderung der Regel selbst.'
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
    ? `Falls du im Text auf eine Kontaktmöglichkeit verweist, nutze diese Adresse: ${contactEmail}. Halte das kurz und direkt, zum Beispiel in der Art von "Meld dich gerne nochmal bei uns, dann klären wir das persönlich." Keine Floskeln wie "Im Detail schildern" oder "Das Erlebnis nochmal schildern".`
    : `Es ist aktuell KEINE Kontakt-E-Mail hinterlegt. Verweise NIEMALS auf eine E-Mail-Adresse. Formuliere stattdessen allgemein, z.B. "Melde dich direkt bei uns." oder "Sprecht uns beim nächsten Besuch einfach an."`

  return [
    PERSONA_INTRO_V8,
    `${anrede}\n${langInstruction}`,
    HARTE_STRUKTUR_REGELN_V8,
    GOLD_BEISPIELE_V8,
    `### RESTAURANT_PROFIL\n${restaurantProfileJson}`,
    `### ARBEITSANWEISUNG FÜR DIE ARGUMENTATION\n1. Falls Lobpunkte vorhanden sind, greife sie ganz kurz und locker auf.\n2. Behandle die aufgetretene Kritik strikt nach diesen spezifischen Spickzettel-Vorgaben:\n${aktivierteSpickzettel}`,
    kontaktHinweis,
    AUSGABE_REGELN_V8
  ].join('\n\n')
}

// ─── CLEANER MIT DETERMINISTISCHEM ZEITANGABEN-SICHERHEITSNETZ ──────────────
// Prompt-Regeln sind bei Temperature 0.3 nicht 100% zuverlässig. Als
// zusätzliches Sicherheitsnetz werden Tageszeit-Wörter hart im Code ersetzt,
// falls die KI die Prompt-Regel trotzdem verletzt.

function cleanResponseText(raw: string): string {
  let cleaned = raw
    .replace(/```[a-z]*\s*/gi, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim()

  const timeWordReplacements: [RegExp, string][] = [
    [/\bAbends\b/g, 'Beim Besuch'],
    [/\babends\b/g, 'beim Besuch'],
    [/\bMorgens\b/g, 'Beim Besuch'],
    [/\bmorgens\b/g, 'beim Besuch'],
    [/\bVormittags\b/g, 'Beim Besuch'],
    [/\bvormittags\b/g, 'beim Besuch'],
    [/\bNachmittags\b/g, 'Beim Besuch'],
    [/\bnachmittags\b/g, 'beim Besuch'],
    [/\bMittags\b/g, 'Beim Besuch'],
    [/\bmittags\b/g, 'beim Besuch'],
    [/\bAbend\b/g, 'Besuch'],
    [/\babend\b/g, 'besuch'],
    // v8.6 FIX: "morgen" nicht mehr pauschal ersetzen. "morgen" heißt meist
    // "tomorrow" ("bis morgen" wurde zu "bis besuch"). Nur eindeutige
    // Tageszeit-Wendungen werden ersetzt:
    [/\bam Morgen\b/g, 'beim Besuch'],
    [/\bheute Morgen\b/g, 'beim Besuch'],
    [/\bjeden Morgen\b/g, 'bei jedem Besuch'],
    [/\bVormittag\b/g, 'Besuch'],
    [/\bvormittag\b/g, 'besuch'],
    [/\bNachmittag\b/g, 'Besuch'],
    [/\bnachmittag\b/g, 'besuch'],
    [/\bMittag\b/g, 'Besuch'],
    [/\bmittag\b/g, 'besuch'],
  ]
  timeWordReplacements.forEach(([regex, replacement]) => {
    cleaned = cleaned.replace(regex, replacement)
  })

  // Deterministisches Sicherheitsnetz: jeden Satzanfang (Textbeginn oder nach . ! ?)
  // hart großschreiben, falls das Modell durchgehend kleinschreibt.
  cleaned = cleaned.replace(/(^|[.!?]\s+)([a-zäöüß])/g, (_match, prefix, letter) => prefix + letter.toUpperCase())

  // Zusätzliches Sicherheitsnetz für die häufigsten wiederkehrenden Nomen dieser
  // Domäne, falls sie mitten im Satz kleingeschrieben durchrutschen. Deckt nicht
  // jedes mögliche Nomen ab, der eigentliche Fix ist die Regel in AUSGABE_REGELN_V8.
  // v8.6 FIX: 'laden' und 'regel' entfernt. Beide sind auch Verbformen
  // ("wir laden dich ein" wurde zu "wir Laden dich ein", "ich regel das"
  // würde zu "ich Regel das"). Der Schaden durch falsche Großschreibung
  // mitten im Satz ist größer als der Nutzen des Sicherheitsnetzes.
  const domainNouns = ['besuch', 'suppe', 'wartezeit', 'hauptgericht', 'service', 'team', 'gast', 'gäste', 'küche', 'personal', 'restaurant', 'bewertung', 'tisch', 'tische', 'qualität', 'atmosphäre', 'lautstärke', 'betrieb', 'minute', 'minuten', 'location']
  domainNouns.forEach(noun => {
    const regex = new RegExp(`\\b${noun}\\b`, 'g')
    cleaned = cleaned.replace(regex, noun.charAt(0).toUpperCase() + noun.slice(1))
  })

  // Wörter mit doppelter Rolle (z.B. "mal" als Partikel vs. "Mal" als Nomen,
  // "frage" als Verbform vs. "Frage" als Nomen) nur in eindeutigen Wendungen fixen,
  // damit korrekte Kleinschreibung (z.B. "sag mal", "ich frage mich") nicht kaputtgeht.
  const ambiguousPhrases: [RegExp, string][] = [
    [/\bvor ort\b/gi, 'vor Ort'],
    [/\bkeine frage\b/gi, 'keine Frage'],
    [/\bnächsten mal\b/gi, 'nächsten Mal'],
    [/\bnächstes mal\b/gi, 'nächstes Mal'],
    [/\bletzten mal\b/gi, 'letzten Mal'],
  ]
  ambiguousPhrases.forEach(([regex, replacement]) => {
    cleaned = cleaned.replace(regex, replacement)
  })

  return cleaned
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY nicht konfiguriert' })

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

    // 1. Haiku analysiert und weist Fokus-Kategorien zu
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

    // 5. Claude Sonnet generiert den perfekten Mittelteil basierend auf dem Spickzettel
    //    Kritik-, Lob- und Zusammenfassungshinweis werden explizit mitgegeben,
    //    damit die Anti-Double-Deviation-Regel greifen kann.
    const raw = await callGemini(
      `Bewertung des Gasts: "${reviewText}"\nSternebewertung: ${stars} von 5\nKritikpunkte: ${analysis.points.join(', ') || 'allgemeiner Unmut'}\nLobpunkte: ${analysis.lobpunkte.join(', ') || 'keine'}\nZusammenfassen statt einzeln auflisten (3+ Kritikpunkte): ${analysis.forceSummarize ? 'ja' : 'nein'}`,
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
// v8.6 Ende
