import type { VercelRequest, VercelResponse } from '@vercel/node'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY

// ─── CLASSIFY (Sterne + Textlänge, nur für EMPTY-Modi) ────────────────────
function classify(rating: number, reviewText: string): string {
  const wordCount = reviewText.trim().split(/\s+/).filter(Boolean).length
  const hasText = wordCount >= 6
  if (!hasText && rating >= 4) return 'EMPTY_POSITIVE'
  if (!hasText && rating <= 2) return 'EMPTY_NEGATIVE'
  return 'CONTENT'
}

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────
function buildSystemPrompt(settings: any): string {
  const contactEmail = settings?.contactEmail || ''
  const emailRef = contactEmail ? ` unter ${contactEmail}` : ''

  // Mittagstisch: aus der Restaurantbeschreibung ableiten
  const hasMittagstisch = settings?.description
    ? /mittagstisch|mittagsangebot|mittagskarte|mittags/i.test(settings.description)
    : false

  const preisBlock = hasMittagstisch
    ? `  Direkt & Ehrlich:      "Wenn du mittags vorbeischaust liegt das Preisniveau übrigens etwas anders, könnte ein fairer Test sein."
  Ruhig & Professionell: "Unser Mittagsangebot ist preislich zugänglicher, falls das eine Alternative wäre."
  Fokus auf Klärung:    "Schau gerne mal mittags vorbei, da bekommst du einen anderen Eindruck beim Preis."`
    : `  Kein Tipp. Antwort endet nach Schritt 2 mit einer souveränen Haltung. Keine Einladung zur Diskussion.
  Haltung (jede Variante anders formulieren): Wir setzen konsequent auf Qualität und frische Ware, dafür stehen wir.`

  return `Du bist ein erfahrener Gastronom, der seit Jahren selbst hinter der Theke steht.
Du schreibst Antworten auf Google-Bewertungen — kurz, direkt, menschlich.
Deine erste Aufgabe ist immer die Wahrnehmungs-Brücke: Du validierst wie sich der Gast gefühlt hat, ohne Schuld beim Restaurant zu suchen.
Du klingst nie wie eine PR-Agentur, ein Konzern oder eine KI.
Du klingst wie jemand dem das Restaurant wirklich gehört.

==================================================
DAS SOUVERAENE DREI-SCHRITT-SYSTEM
==================================================

SCHRITT 1 — BEGRUESSUNG (fest, kurz):
Unaufgeregter Gruß auf Augenhöhe. Name immer korrekt kapitalisiert — nie in Großbuchstaben.
  Direkt & Ehrlich:      beginnt mit "Hey [Name]," oder "Hi [Name],"
  Ruhig & Professionell: beginnt mit "Hallo [Name],"
  Fokus auf Klärung:    beginnt mit "Hi [Name]," oder "Hallo [Name],"
Kein Name bekannt: "Hey," / "Hallo," / "Hi,"

SCHRITT 2 — EMOTIONALE BRUECKE + VERDECKTES MARKETING:
Prinzip: Gefühl validieren ohne Urteil. Situation als Qualitätsmerkmal framen.
Schlüsselwörter (neutral, lassen offen wie es wirklich war):
"rübergekommen" / "gefühlt" / "gewirkt" / "angekommen" / "wahrgenommen"

WICHTIG: Die Anredeform (Du oder Sie) gilt für das gesamte System — auch für Schritt 2 und alle Techniken. Passe die Beispiele entsprechend an.

Jede Variante nutzt eine andere Technik:

WICHTIG für alle drei Techniken — Kernwort spiegeln:
Lies die Bewertung und nimm EIN konkretes Wort oder Thema des Gastes auf (z.B. "ruhiger", "entspannter", "gemütlicher", "in Ruhe unterhalten").
Nicht aufzählen. Nur das eine Kernthema. So fühlt sich der Gast gehört ohne dass wir seine Kritik wiederholen.

Technik 1 — Persönliche Resonanz (für Variante "Direkt & Ehrlich"):
Ich-Form, direktes Gefühl im Moment, nah dran. NICHT "frustrierend" — das ist ein Urteil, kein Gefühl.
Beispiel (ERLEBNIS): "Ich versteh total, dass das für dich so nicht gepasst hat."
Weitere gute Formulierungen: "ich kann gut verstehen, dass das für dich nicht optimal war" / "ich kann das gut nachempfinden"
WICHTIG: Kein eigener Zusatz nach dem Empathie-Satz — der Satz steht allein, die Brücke kommt danach als eigener Satz.

Technik 2 — Vorfreude-Dynamik (für Variante "Ruhig & Professionell"):
Enttaeuschte Erwartung anerkennen, ruhig, einfuehlsam. Umgangssprachlich, nicht steif.
Das Kernwort aus der Bewertung direkt einbauen.
Beispiel (ERLEBNIS): "Ich kann gut nachvollziehen, dass du dir deinen Besuch bei uns ruhiger vorgestellt hast."
NICHT: "ich verstehe vollkommen, dass das enttäuschend gewirkt hat, wenn du mit einer anderen Erwartung zu uns kommst." — zu komplex, zu gestellt.

Technik 3 — Ablauf-Perspektive (für Variante "Fokus auf Klärung"):
Sachlicher, kürzer. Kernthema der Bewertung einbauen, kein "ins Stocken geraten" bei ERLEBNIS.
Beispiel (ERLEBNIS): "Ich kann mir gut vorstellen, dass du mit ganz anderen Erwartungen zu uns reingekommen bist."

Brücke zum verdeckten Marketing (NICHT bei Kategorie UNFREUNDLICHKEIT verwenden):
Der Empathie-Satz und die Brücke sind ZWEI separate Sätze — getrennt durch einen Punkt, nicht durch ein Komma.
Formulierungsmuster: "[Empathie-Satz]. [Verbindungsstück + Erklärung]."

Das Verbindungsstück erklärt WARUM es so ist — das ist der entscheidende Unterschied zu einer bloßen Aussage.
Wähle eine dieser Brücken-Formulierungen — variiere bei jeder Antwort:
- "Das liegt einfach daran, dass wir ein gut besuchtes Lokal sind und es bei uns oft richtig lebendig zugeht."
- "Das kommt daher, dass bei uns meistens gut was los ist und es schon mal etwas turbulenter zugehen kann."
- "Das kommt einfach daher, dass wir ein gut besuchtes Lokal sind und bei uns oft richtig was los ist."

VERBOTEN in der Brücke:
- NICHT "wir sind bekannt dafür" oder "wir sind immer voll" — das klingt nach "nimm es oder lass es" und macht Schritt 3 unglaubwürdig.
- Keine Tageszeit ("abends", "mittags", "morgens") — wir wissen nicht wann der Gast da war.
- Kein "zu dem Zeitpunkt" oder "zu deinem Besuch" — wir behaupten nicht was beim konkreten Besuch so war.
- Kein "man" — immer "du" oder "Sie" je nach Anredeform.
- Kein "für manche das Richtige, für andere nicht" — klingt wie eine Absage, nicht wie ein Gastgeber.

BEISPIEL guter Fluss (Technik 2, ERLEBNIS):
"Hallo [Name], ich kann gut nachvollziehen, dass du dir deinen Besuch ruhiger vorgestellt hast. Das liegt einfach daran, dass wir ein gut besuchtes Lokal sind und es bei uns oft richtig lebendig zugeht."

TAGESZEIT-VERBOT (gilt für die gesamte Antwort, alle 3 Schritte):
Uebernehme NIEMALS Tageszeit-Begriffe aus der Bewertung ("Abend", "abends", "Mittag", "Morgen" etc.).
Auch wenn der Gast "einen ruhigen Abend" schreibt — antworte mit "Besuch" oder "Aufenthalt", nie mit "Abend".
Beispiel: "einen ruhigen Abend" in der Bewertung → "einen ruhigen Besuch" oder "einen entspannten Aufenthalt" in der Antwort.

SCHRITT 3 — GASTGEBER-AUSSTIEG (kategorie-spezifisch):
Konkreter Insider-Tipp. Kein Betteln. Keine Standard-Kontaktfloskeln. Dem Gast die Kontrolle zurückgeben.

==================================================
KATEGORIE-ERKENNUNG — PRIORITAETSHIERARCHIE
==================================================

Analysiere die Bewertung und wähle EINE Hauptkategorie:
1. UNFREUNDLICHKEIT — persönliche Verletzung durch Personal oder Umgang
2. SERVICE           — operativer Fehler (falsches Gericht, Wartezeit, Abläufe)
3. ESSEN             — Geschmack oder Zubereitung
4. PREIS             — Preis-Leistungs-Verhältnis, Portionsgröße
5. ERLEBNIS          — Tisch, Lautstärke, Atmosphäre, Ambiente

Bei mehreren Kategorien gewinnt immer die höhere in der Hierarchie.
Sonderfall GEMISCHT: Bewertung überwiegend positiv mit kleinem Kritikpunkt. Kein Schritt 3, nur warme Verabschiedung.

==================================================
SCHRITT 3 BUILDING BLOCKS JE KATEGORIE
==================================================

ERLEBNIS:
Das Angebot in Schritt 3 lässt offen WAS genau anders sein wird — kein Platz, keine Uhrzeit, kein Wochentag.
Kernbotschaft: Komm nochmal, wir finden gemeinsam was das für dich passt.
VERBOTEN: "Es gibt Zeiten wo es ruhiger ist" oder Uhrzeiten-Empfehlungen.
VERBOTEN: Tageszeiten ("abends", "mittags") — wir wissen nicht wann der Gast da war.
Nutze stattdessen neutrale Wörter: "Besuch", "Aufenthalt", "wenn du wiederkommst".

Wähle EINE Formulierung aus dem jeweiligen Pool — variiere bei jeder Antwort, nutze nicht immer dieselbe:

  Direkt & Ehrlich (Pool — eine davon wählen):
  - "Gib einfach kurz bei der nächsten Reservierung dein Anliegen mit an, wir schauen was wir möglich machen können."
  - "Sag uns bei der nächsten Reservierung kurz dein Anliegen, wir schauen was wir drehen können."
  - "Gib einfach kurz bei der nächsten Reservierung dein Anliegen mit an, wir schauen was wir möglich machen können."

  Ruhig & Professionell (Pool — eine davon wählen):
  - "Teile uns bei der nächsten Reservierung kurz dein Anliegen mit, wir gucken was wir für dich tun können."
  - "Sag uns bei der nächsten Reservierung kurz was du dir vorstellst, wir schauen was wir möglich machen können."
  - "Gib bei der nächsten Reservierung einfach kurz dein Anliegen mit an, wir kümmern uns darum."

  Fokus auf Klärung (Pool — eine davon wählen):
  - "Bei der nächsten Reservierung einfach kurz dein Anliegen mitteilen, wir schauen was geht."
  - "Sag uns bei der nächsten Reservierung kurz dein Anliegen, wir gucken was wir drehen können."
  - "Einfach kurz bei der Reservierung Bescheid geben, wir schauen was möglich ist."

ESSEN (Geschmacks-Weiche — erkenne intern: Zubereitung oder Geschmack):
  Direkt & Ehrlich:      "War es Geschmackssache oder hat in der Küche was nicht gestimmt? Das macht für uns einen Unterschied."
  Ruhig & Professionell: "Damit wir das einordnen können, lag es am persönlichen Geschmack oder lief bei der Zubereitung etwas schief?"
  Fokus auf Klärung:    "Meld dich kurz, war es Geschmack oder Küche? Das wollen wir verstehen."

SERVICE:
  Direkt & Ehrlich:      "Meld dich kurz direkt bei uns, solche Sachen wollen wir nicht einfach so stehen lassen."
  Ruhig & Professionell: "Wir würden das gerne persönlich mit dir klären.${contactEmail ? ' Schreib uns kurz unter ' + contactEmail + '.' : ''}"
  Fokus auf Klärung:    "Schreib uns kurz${emailRef}, dann klären wir das direkt."

UNFREUNDLICHKEIT (kein Framing, nur ehrliche Direktheit):
  Direkt & Ehrlich:      "Meld dich bitte kurz direkt bei uns, solche Momente wollen wir verstehen und nicht einfach ignorieren."
  Ruhig & Professionell: "Wir würden gerne persönlich mit dir sprechen um zu verstehen was passiert ist.${contactEmail ? ' Du erreichst uns unter ' + contactEmail + '.' : ''}"
  Fokus auf Klärung:    "Schreib uns direkt${emailRef}, wir möchten wissen was vorgefallen ist."

PREIS:
${preisBlock}

GEMISCHT (kein Schritt 3 — nur warme Verabschiedung am Ende):
  Direkt & Ehrlich:      "Bis beim nächsten Mal."
  Ruhig & Professionell: "Wir freuen uns auf deinen nächsten Besuch."
  Fokus auf Klärung:    "Bis bald."

==================================================
ABSOLUT VERBOTEN
==================================================

Einzelwörter: "entschuldigen", "entschuldigt", "Entschuldigung", "Dynamik", "Respektlosigkeit", "Schande", "Service-Exzellenz", "frustrierend", "Frustration"
Phrasen:
- "logistische Rahmenbedingungen"
- "intern nachgeschärft" / "intern adressiert" / "intern klar gemacht"
- "nehmen wir sehr ernst"
- "entspricht nicht unserem Anspruch" / "nicht das wofür wir stehen"
- "Maßnahmen ergriffen" / "Team sensibilisiert" / "Konsequenzen gezogen"
- "Das tut uns sehr leid"
- "Vielen Dank für Ihre/deine Bewertung"
- "Wir freuen uns über Ihr/dein Feedback"
- "Das freut uns sehr" / "Das freut uns riesig"
- "Wir hoffen dich bald wieder begrüßen zu dürfen"
- "Das hätte nicht passieren dürfen"
- "unser Team" als gesichtslose Kollektivformulierung
Formatierung:
- Keine Gedankenstriche (weder em-dash noch Bindestrich als Satzteiler)
- Keine Aufzählung von Beschwerdepunkten
- Kein wörtliches Wiederholen der Kritik
- Nichts doppelt sagen`
}

// ─── CONTENT PROMPT BUILDER ───────────────────────────────────────────────
function buildPrompt(reviewText: string, rating: number, reviewerName: string, settings: any): string {
  const {
    businessName = 'das Restaurant',
    cuisineType = '',
    uniqueSellingPoints = '',
    responseSignature = '',
    salutation = 'Sie',
    contactEmail = '',
    description = '',
    restaurantType = '',
    priceRange = '',
    responseLanguage = 'Deutsch',
    restaurantAtmosphere = '',
  } = settings || {}

  const duSieAnrede = salutation === 'Du' ? 'Du/Dein (Duzen)' : 'Sie/Ihr (Siezen)'
  const anredeHinweis = salutation === 'Du'
    ? 'Nutze konsequent die Du-Form (du, dein, dir). Schreibe "dir" und "dein" klein.'
    : 'Nutze konsequent die Sie-Form (Sie, Ihr, Ihnen). Schreibe "Sie" und "Ihr" immer groß.'
  const signature = responseSignature || `Das Team von ${businessName}`

  const firstName = reviewerName ? reviewerName.split(' ')[0] : ''
  const firstNameCapitalized = firstName
    ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
    : ''

  const langInstruction =
    responseLanguage === 'Sprache des Bewerters'
      ? 'Antworte in der Sprache der Bewertung. Erkenne sie automatisch.'
      : responseLanguage === 'Englisch'
      ? 'Respond in English only.'
      : responseLanguage === 'Deutsch und Englisch'
      ? 'Antworte auf Deutsch und füge direkt danach eine englische Übersetzung in Klammern hinzu.'
      : 'Antworte auf Deutsch.'

  const context = [
    `Restaurant: ${businessName}`,
    description          && `Beschreibung: ${description}`,
    restaurantType       && `Typ: ${restaurantType}`,
    cuisineType          && `Küche: ${cuisineType}`,
    priceRange           && `Preisklasse: ${priceRange}`,
    restaurantAtmosphere && `Atmosphäre: ${restaurantAtmosphere}`,
    uniqueSellingPoints  && `Besonderheiten: ${uniqueSellingPoints}`,
    contactEmail         && `Kontakt-E-Mail: ${contactEmail}`,
  ].filter(Boolean).join('\n')

  const systemPrompt = buildSystemPrompt(settings)

  const userMessage = `${langInstruction}
Anredeform für ALLE Varianten: ${duSieAnrede}. ${anredeHinweis}

RESTAURANT-KONTEXT:
${context}

BEWERTUNG (${rating} Sterne):
"${reviewText}"

BEWERTER: ${firstNameCapitalized || '(kein Name bekannt)'}

AUFGABE:
1. Erkenne die Hauptkategorie nach der Prioritätshierarchie (output im "category"-Feld).
2. Prüfe ob Gemischt-Flag gilt.
3. Schreibe 3 Varianten nach dem Drei-Schritt-System mit den passenden Bausteinen.
4. Jede Variante endet mit einer Verabschiedung (wähle eine aus dem Pool, rotiere zwischen den Varianten) gefolgt von der Signatur auf einer neuen Zeile.

Verabschiedungs-Pool (je nach Anredeform anpassen):
- "Herzliche Grüße"
- "Beste Grüße"
- "Bis zu deinem nächsten Besuch" (Du-Form) / "Bis zu Ihrem nächsten Besuch" (Sie-Form)

Signatur: ${signature}

Variante 1 — Direkt & Ehrlich:
Technik 1 (Persönliche Resonanz) für Schritt 2. Locker, ich-Form.
Schritt 3: Building Block "Direkt & Ehrlich" der erkannten Kategorie.

Variante 2 — Ruhig & Professionell:
Technik 2 (Vorfreude-Dynamik) für Schritt 2. Empathisch, ruhig.
Schritt 3: Building Block "Ruhig & Professionell" der erkannten Kategorie.

Variante 3 — Fokus auf Klärung:
Technik 3 (Ablauf-Perspektive) für Schritt 2. Kürzer, max. 3 Sätze gesamt.
Schritt 3: Building Block "Fokus auf Klärung" der erkannten Kategorie.

AUSGABE — NUR dieses JSON, kein anderer Text:
{
  "category": "Erlebnis | Essen | Preis | Service | Unfreundlichkeit | Gemischt",
  "variant1": {"label": "Direkt & Ehrlich", "text": "..."},
  "variant2": {"label": "Ruhig & Professionell", "text": "..."},
  "variant3": {"label": "Fokus auf Klärung", "text": "..."}
}`

  return JSON.stringify({ _system: systemPrompt, _user: userMessage })
}

// ─── EMPTY POSITIVE ───────────────────────────────────────────────────────
function buildEmptyPositivePrompt(rating: number, reviewerName: string, settings: any): string {
  const {
    businessName = 'das Restaurant',
    responseSignature = '',
    salutation = 'Sie',
    responseLanguage = 'Deutsch',
  } = settings || {}

  const signature = responseSignature || `Das Team von ${businessName}`
  const firstName = reviewerName ? reviewerName.split(' ')[0] : ''
  const firstNameCapitalized = firstName
    ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
    : ''

  const langInstruction = responseLanguage === 'Sprache des Bewerters'
    ? 'Antworte in der Sprache der Bewertung.'
    : responseLanguage === 'Englisch' ? 'Respond in English only.'
    : 'Antworte auf Deutsch.'

  const greeting = firstNameCapitalized ? `mit dem Namen "${firstNameCapitalized}"` : 'ohne Namen'

  return `Du bist eine Hospitality Response Engine für "${businessName}".
${langInstruction}

BEWERTUNG: ${rating} Sterne — kein Text.

AUFGABE: 3 kurze, herzliche Antworten. Max. 2 Sätze. Keine Floskeln. Keine Dankesformeln.
Schreibe wie gesprochen, nicht wie formuliert. Jede Antwort beginnt ${greeting}.
Alle drei enden mit: ${signature}

BEISPIELE (genau dieser Ton):
- "Danke dir :) Schön, dass du bei uns warst."
- "Freut uns, dass du einen guten Abend hattest. Bis bald :)"
- "5 Sterne nehmen wir natürlich gern. Danke dir."

ABSOLUT VERBOTEN:
- "Vielen Dank für Ihre/deine Bewertung"
- "Wir freuen uns über Ihr/dein Feedback"
- "Das freut uns sehr"
- "Wir heissen Sie jederzeit wieder herzlich willkommen"
- Gedankenstriche

AUSGABE — NUR dieses JSON:
{"variant1":{"label":"Herzlich","text":"..."},"variant2":{"label":"Persönlich","text":"..."},"variant3":{"label":"Kurz & warm","text":"..."}}`
}

// ─── EMPTY NEGATIVE ───────────────────────────────────────────────────────
function buildEmptyNegativePrompt(rating: number, reviewerName: string, settings: any): string {
  const {
    businessName = 'das Restaurant',
    responseSignature = '',
    salutation = 'Sie',
    contactEmail = '',
    responseLanguage = 'Deutsch',
  } = settings || {}

  const signature = responseSignature || `Das Team von ${businessName}`
  const firstName = reviewerName ? reviewerName.split(' ')[0] : ''
  const firstNameCapitalized = firstName
    ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
    : ''

  const langInstruction = responseLanguage === 'Sprache des Bewerters'
    ? 'Antworte in der Sprache der Bewertung.'
    : responseLanguage === 'Englisch' ? 'Respond in English only.'
    : 'Antworte auf Deutsch.'

  const contactLine = contactEmail
    ? `Kontaktkanal: ${contactEmail}`
    : 'Kein Kontaktkanal hinterlegt — ohne E-Mail-Hinweis'

  const greeting = firstNameCapitalized ? `mit dem Namen "${firstNameCapitalized}"` : 'ohne Namen'

  return `Du bist eine Hospitality Response Engine für "${businessName}".
${langInstruction}

BEWERTUNG: ${rating} Sterne — kein Text.

AUFGABE: 3 Antworten. Anerkennen + Einladung zur direkten Kontaktaufnahme. Kein Druck.
${contactLine}
Max. 3 Sätze. Schreibe wie gesprochen. Nie mit Dankesformel beginnen. Keine leeren Entschuldigungen.
Jede Antwort beginnt ${greeting}.
Alle drei enden mit: ${signature}

BEISPIELE (genau dieser Ton):
- "Da scheint ja einiges schiefgelaufen zu sein. Ohne mehr zu wissen, können wir's schwer einordnen."
- "So ganz ohne Kontext ist das schwer. Wenn du magst, schreib uns kurz."
- "Schade, dass du uns so erlebt hast. Meld dich gern direkt, wenn du magst."

ABSOLUT VERBOTEN:
- "Vielen Dank für Ihre/deine Bewertung"
- "Das tut uns sehr leid"
- "Wir bitten um Verstaendnis"
- Gedankenstriche

AUSGABE — NUR dieses JSON:
{"variant1":{"label":"Direkt & Ehrlich","text":"..."},"variant2":{"label":"Ruhig & Professionell","text":"..."},"variant3":{"label":"Fokus auf Klärung","text":"..."}}`
}

// ─── RECOVERY TEXT (1–2 Sterne, fester Notfall-Text) ─────────────────────
// Kein AI-Call — festes Template für ernste Vorfaelle (Vergiftung, Unfall etc.)
function buildRecoveryText(reviewerName: string, settings: any): string {
  const {
    businessName = 'das Restaurant',
    salutation = 'Sie',
    contactEmail = '',
    responseSignature = '',
  } = settings || {}

  const signature = responseSignature || `Das Team von ${businessName}`
  const firstName = reviewerName ? reviewerName.split(' ')[0] : ''
  const name = firstName
    ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
    : ''

  const isDu = salutation === 'Du'

  const greeting = name ? `Hallo ${name},` : 'Hallo,'

  const body = isDu
    ? `was du da erlebt hast, macht uns wirklich betroffen. Bitte melde dich direkt bei uns, damit wir das persönlich mit dir klären können.`
    : `was Sie da erlebt haben, macht uns wirklich betroffen. Bitte melden Sie sich direkt bei uns, damit wir das persönlich mit Ihnen klären können.`

  const contactLine = contactEmail
    ? (isDu ? `Du erreichst uns unter ${contactEmail}.` : `Sie erreichen uns unter ${contactEmail}.`)
    : ''

  const text = [greeting, body, contactLine, signature]
    .filter(Boolean)
    .join(' ')

  return text
}

// ─── HELPER: CLAUDE API CALL ───────────────────────────────────────────────
async function callClaude(userMessage: string, systemPrompt?: string): Promise<string> {
  const body: any = {
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
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

// ─── HELPER: GEMINI API CALL (optional, für zukuenftige Nutzung) ──────────
async function callGemini(userMessage: string, systemPrompt?: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`
  const body: any = {
    contents: [{ parts: [{ text: userMessage }] }],
    generationConfig: { maxOutputTokens: 4000, temperature: 0.7 },
  }
  if (systemPrompt) body.systemInstruction = { parts: [{ text: systemPrompt }] }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(`Gemini API Fehler: ${JSON.stringify(err)}`)
  }

  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

// ─── HELPER: JSON PARSE ────────────────────────────────────────────────────
function parseResponse(raw: string): {
  category: string
  variants: { label: string; text: string; isRecovery?: boolean }[]
} {
  let jsonStr = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  const startIdx = jsonStr.indexOf('{')
  const endIdx = jsonStr.lastIndexOf('}')
  if (startIdx === -1 || endIdx === -1) throw new Error('Kein JSON gefunden: ' + raw)
  jsonStr = jsonStr.substring(startIdx, endIdx + 1)

  const parsed = JSON.parse(jsonStr)
  const cleanText = (t: string) => t.replace(/\n\n/g, ' ').replace(/\n/g, ' ').trim()

  return {
    category: parsed.category || 'Unbekannt',
    variants: [
      { label: parsed.variant1?.label || 'Variante 1', text: cleanText(parsed.variant1?.text || '') },
      { label: parsed.variant2?.label || 'Variante 2', text: cleanText(parsed.variant2?.text || '') },
      { label: parsed.variant3?.label || 'Variante 3', text: cleanText(parsed.variant3?.text || '') },
    ],
  }
}

// ─── HELPER: SIMPLE VARIANTS PARSE (für EMPTY-Modi) ──────────────────────
function parseVariants(raw: string): { label: string; text: string }[] {
  let jsonStr = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  const startIdx = jsonStr.indexOf('{')
  const endIdx = jsonStr.lastIndexOf('}')
  if (startIdx === -1 || endIdx === -1) throw new Error('Kein JSON gefunden: ' + raw)
  jsonStr = jsonStr.substring(startIdx, endIdx + 1)

  const parsed = JSON.parse(jsonStr)
  const cleanText = (t: string) => t.replace(/\n\n/g, ' ').replace(/\n/g, ' ').trim()

  return [
    { label: parsed.variant1?.label || 'Variante 1', text: cleanText(parsed.variant1?.text || '') },
    { label: parsed.variant2?.label || 'Variante 2', text: cleanText(parsed.variant2?.text || '') },
    { label: parsed.variant3?.label || 'Variante 3', text: cleanText(parsed.variant3?.text || '') },
  ]
}

// ─── CONTEXT CHECK ─────────────────────────────────────────────────────────
async function checkContext(reviewText: string, description: string): Promise<{ ok: boolean; missing?: string }> {
  const wordCount = reviewText.trim().split(/\s+/).filter(Boolean).length
  if (wordCount < 6) return { ok: true }

  const systemPrompt = `Du bist ein strikter Qualitätspruefer für Restaurant-Antworten.
Deine einzige Aufgabe: Entscheide ob das Restaurantprofil genueg Informationen enthaelt um auf diese Bewertung sicher zu antworten — ohne etwas erfinden zu muessen.

Antworte NUR mit einem dieser zwei Formate:
OK
MISSING: [kurze Beschreibung was fehlt, max. 1 Satz auf Deutsch]

Wann ist MISSING korrekt?
- Die Bewertung enthaelt einen konkreten Vorwurf ueber eine spezifische Situation oder Entscheidung des Restaurants (z.B. Platzvergabe, Reservierungspolitik, Hausregeln, spezifische Abläufe)
- UND das Profil enthaelt dazu keine Erklärung oder Regel

Wann ist OK korrekt?
- Allgemeine Kritik (Essen, Service, Wartezeit, Atmosphäre)
- Das Profil enthaelt eine passende Erklärung
- Die Bewertung ist positiv oder neutral

Sei NICHT ueberstreng. Im Zweifel: OK.`

  const userMessage = `RESTAURANTPROFIL:
${description || '(keine Beschreibung eingetragen)'}

BEWERTUNG:
"${reviewText}"

Ist das Profil ausreichend um sicher zu antworten?`

  try {
    const result = await callClaude(userMessage, systemPrompt)
    const trimmed = result.trim()
    if (trimmed.startsWith('MISSING:')) {
      return { ok: false, missing: trimmed.replace('MISSING:', '').trim() }
    }
    return { ok: true }
  } catch (e) {
    console.error('Context check failed, proceeding anyway:', e)
    return { ok: true }
  }
}

// ─── HANDLER ───────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { review, settings } = req.body

  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert' })
  }

  const reviewText   = review.reviewText   || ''
  const stars        = review.stars        || 3
  const reviewerName = review.reviewerName || ''

  const businessName = settings?.businessName || 'das Restaurant'
  const signature    = settings?.responseSignature || `Das Team von ${businessName}`

  try {
    // ── SCHRITT 0: Context Check ──────────────────────────────────────────
    const description  = settings?.description || ''
    const contextCheck = await checkContext(reviewText, description)
    if (!contextCheck.ok) {
      return res.status(200).json({
        success: false,
        missingContext: true,
        missingInfo: contextCheck.missing || 'Fehlende Informationen im Restaurantprofil',
      })
    }

    const mode = classify(stars, reviewText)

    // ── SCHRITT 1: EMPTY-Modi ─────────────────────────────────────────────
    if (mode === 'EMPTY_POSITIVE') {
      const prompt = buildEmptyPositivePrompt(stars, reviewerName, settings)
      const raw    = await callClaude(prompt)
      const variants = parseVariants(raw)
      return res.status(200).json({ success: true, answers: variants })
    }

    if (mode === 'EMPTY_NEGATIVE') {
      const prompt = buildEmptyNegativePrompt(stars, reviewerName, settings)
      const raw    = await callClaude(prompt)
      const variants = parseVariants(raw)
      return res.status(200).json({ success: true, answers: variants })
    }

    // ── SCHRITT 2: Content-Generierung (3-Schritt-System) ─────────────────
    const promptStr = buildPrompt(reviewText, stars, reviewerName, settings)
    let generatorRaw: string

    try {
      const parsed = JSON.parse(promptStr)
      generatorRaw = await callClaude(parsed._user, parsed._system)
    } catch {
      generatorRaw = await callClaude(promptStr)
    }

    const { category, variants: generatedVariants } = parseResponse(generatorRaw)

    // ── SCHRITT 3: Recovery (nur bei 1–2 Sternen als 4. Variante) ─────────
    // Fester Notfall-Text — kein AI-Call, kein Spielraum für Variationen
    let finalVariants: { label: string; text: string; isRecovery?: boolean }[] = generatedVariants

    if (stars <= 2) {
      try {
        const recoveryText = buildRecoveryText(reviewerName, settings)
        if (recoveryText) {
          finalVariants = [
            ...finalVariants,
            { label: 'Nur wenn wirklich etwas schiefgelaufen ist', text: recoveryText, isRecovery: true },
          ]

        }
      } catch (e) {
        console.error('Recovery generation failed:', e)
      }
    }

    return res.status(200).json({ success: true, category, answers: finalVariants })

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('generate-replies-v2 FEHLER:', errMsg)
    return res.status(500).json({ error: 'Serverfehler', details: errMsg })
  }
}
