import type { VercelRequest, VercelResponse } from '@vercel/node'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY

function classify(rating: number, reviewText: string) {
  const wordCount = reviewText.trim().split(/\s+/).filter(Boolean).length
  const hasText = wordCount >= 6
  if (!hasText && rating >= 4) return 'EMPTY_POSITIVE'
  if (!hasText && rating <= 2) return 'EMPTY_NEGATIVE'
  if (rating >= 4) return 'CONTENT_POSITIVE'
  if (rating === 3) return 'CONTENT_MIXED'
  return 'CONTENT_NEGATIVE'
}

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

  // V1 duzt immer, V2 siezt immer, V3 folgt den Settings
  const duSieAnrede = salutation === 'Du' ? 'Du/Dein (Duzen)' : 'Sie/Ihr (Siezen)'
  const anredeHinweis = salutation === 'Du'
    ? 'Nutze konsequent die Du-Form (du, dein, dir). Schreibe "dir" und "dein" klein.'
    : 'Nutze konsequent die Sie-Form (Sie, Ihr, Ihnen). Schreibe "Sie" und "Ihr" immer groß.'
  const signature = responseSignature || `Das Team von ${businessName}`
  const mode = classify(rating, reviewText)
  const firstName = reviewerName ? reviewerName.split(' ')[0] : ''

  const langInstruction =
    responseLanguage === 'Sprache des Bewerters'
      ? 'Antworte in der Sprache der Bewertung. Erkenne sie automatisch.'
      : responseLanguage === 'Englisch'
      ? 'Respond in English only.'
      : responseLanguage === 'Deutsch und Englisch'
      ? 'Antworte auf Deutsch und fuege direkt danach eine englische Uebersetzung in Klammern hinzu.'
      : 'Antworte auf Deutsch.'

  // Ersten Buchstaben gross, Rest klein — verhindert HEIKE-in-Caps-Bug
  const firstNameCapitalized = firstName
    ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
    : ''

  const begruessungV2 = salutation === 'Du'
    ? `Hallo ${firstNameCapitalized},`
    : `Hallo ${firstNameCapitalized},`

  const nameRule = firstNameCapitalized
    ? `PERSONALISIERUNG:
- Variante 1: kein Name — direkt ins Thema starten
- Variante 2: beginnt exakt mit "${begruessungV2}"
- Variante 3: kein Name — direkt ins Thema starten
Schreibe den Namen IMMER genau so: ${firstNameCapitalized} — nie in Grossbuchstaben.`
    : 'PERSONALISIERUNG: Kein Name bekannt — alle drei ohne persoenliche Anrede'

  const context = [
    `Restaurant: ${businessName}`,
    description          && `Beschreibung: ${description}`,
    restaurantType       && `Typ: ${restaurantType}`,
    cuisineType          && `Kueche: ${cuisineType}`,
    priceRange           && `Preisklasse: ${priceRange}`,
    restaurantAtmosphere && `Atmosphaere: ${restaurantAtmosphere}`,
    uniqueSellingPoints  && `Besonderheiten: ${uniqueSellingPoints}`,
    contactEmail         && `Kontakt-E-Mail: ${contactEmail}`,
  ].filter(Boolean).join('\n')

  const contactLine = contactEmail
    ? `Kontaktkanal fuer Variante 3: ${contactEmail}`
    : 'Kein Kontaktkanal hinterlegt — Variante 3 ohne E-Mail-Hinweis'

  // ─── EMPTY POSITIVE ────────────────────────────────────────────────────────
  if (mode === 'EMPTY_POSITIVE') {
    return `Du bist eine Hospitality Response Engine fuer "${businessName}".
${langInstruction}

KONTEXT:
${context}

${nameRule}

BEWERTUNG: ${rating} Sterne — kein Text.

AUFGABE: 3 kurze, herzliche Antworten. Max. 2 Saetze. Keine Floskeln. Keine Dankesformeln.
Schreibe wie gesprochen, nicht wie formuliert. Direkt beginnen.
Alle drei enden mit: ${signature}

BEISPIELE (genau dieser Ton):
- "Danke dir :) Schoen, dass du bei uns warst."
- "Freut uns, dass du einen guten Abend hattest. Bis bald :)"
- "5 Sterne nehmen wir natuerlich gern. Danke dir."

ABSOLUT VERBOTEN:
- "Vielen Dank fuer Ihre/deine Bewertung"
- "Wir freuen uns ueber Ihr/dein Feedback"
- "Das freut uns sehr"
- "Wir heissen Sie jederzeit wieder herzlich willkommen"
- Jede Form von standardisierter Dankesformel

AUSGABE — NUR dieses JSON:
{"variant1":{"label":"Herzlich","text":"..."},"variant2":{"label":"Persoenlich","text":"..."},"variant3":{"label":"Kurz & warm","text":"..."}}`
  }

  // ─── EMPTY NEGATIVE ────────────────────────────────────────────────────────
  if (mode === 'EMPTY_NEGATIVE') {
    return `Du bist eine Hospitality Response Engine fuer "${businessName}".
${langInstruction}

KONTEXT:
${context}

${nameRule}

BEWERTUNG: ${rating} Sterne — kein Text.

AUFGABE: 3 Antworten. Anerkennen + Einladung zur direkten Kontaktaufnahme. Kein Druck.
${contactLine}
Max. 3 Saetze. Schreibe wie gesprochen, nicht wie formuliert.
Nie mit Dankesformel beginnen. Keine leeren Entschuldigungen.
Alle drei enden mit: ${signature}

BEISPIELE (genau dieser Ton — beilaeufig, nicht komponiert):
- "Da scheint ja einiges schiefgelaufen zu sein. Ohne mehr zu wissen, koennen wir's schwer einordnen."
- "So ganz ohne Kontext ist das schwer. Wenn du magst, schreib uns kurz."
- "Schade, dass du uns so erlebt hast. Meld dich gern direkt, wenn du magst."

ABSOLUT VERBOTEN:
- "Vielen Dank fuer Ihre/deine Bewertung"
- "Das tut uns sehr leid"
- "Wir bitten um Verstaendnis"
- "Wir nehmen Ihr/dein Feedback ernst"

AUSGABE — NUR dieses JSON:
{"variant1":{"text":"..."},"variant2":{"text":"..."},"variant3":{"text":"..."}}`
  }

  // ─── CONTENT MODI (POSITIVE / MIXED / NEGATIVE) ────────────────────────────

  const slot4 = rating <= 2
    ? `Slot 4 – Brueckenbauer: Biete persoenliche Kontaktaufnahme an. ${contactLine}`
    : rating === 3
    ? 'Slot 4 – Brueckenbauer: Leichte Offenheit, Gespraechsmoeglichkeit anbieten.'
    : 'Slot 4 – Brueckenbauer: Nicht notwendig. Optional kurzer Dank.'

  const alreadyHandled = (reviewText.toLowerCase().includes('massnahmen') ||
    reviewText.toLowerCase().includes('reagiert') ||
    reviewText.toLowerCase().includes('versichert') ||
    reviewText.toLowerCase().includes('aufgenommen'))
    ? `WICHTIG: Der Gast erwaehnt, dass das Team bereits vor Ort reagiert hat.
Anerkenne diese Reaktion kurz — aber mache klar: sie hebt den Schrecken oder Vertrauensverlust nicht auf.
Nicht so tun als waere noch nichts passiert.`
    : ''

  // System-Prompt: Original Google AI Studio Instructions — kurz und sauber
  const systemPrompt = `Erstelle natuerliche, menschliche und professionelle Antworten auf Google-Bewertungen.
Die Antworten sollen nicht wie PR-Texte, Agenturtexte oder KI-Texte wirken.
Keine uebertriebene Freundlichkeit, keine Rechtfertigungen, keine Standardfloskeln.

Grundregeln:
Beschwerden nicht aufzaehlen oder wiederholen.
Kritik nicht spiegeln.
Keine Ursachen erfinden.
Keine internen Ablaeufe erklaeren.
Keine leeren Floskeln verwenden.
Kurz und natuerlich schreiben.
Eher wie ein Gastronom als wie eine Pressestelle.
Nutze fuer alle Beschreibungen (Typ, Atmosphaere, Konzept) ausschliesslich die Angaben aus dem Restaurantprofil. Leite niemals Informationen aus dem Restaurantnamen ab.
Niemals diese Phrasen verwenden: "nehmen wir sehr ernst", "intern adressiert", "intern nachgeschaerft", "Massnahmen ergriffen".
Bei positiven Bewertungen niemals: "Das freut uns sehr/riesig", "Danke fuer die tollen Worte", "zeigt uns dass wir auf dem richtigen Weg sind", "Wir hoffen dich bald wieder begruessen zu duerfen", "Vielen Dank fuer deine Bewertung/dein Feedback".
Starte bei Lob direkt mit einer echten Reaktion — nie mit einem generischen Dankeschoen.

STRENGES FORMATIERUNGS-VERBOT (MENSCHLICHER SCHREIBSTIL):
VERBOT VON GEDANKENSTRICHEN: Nutze NIEMALS Gedankenstriche (weder "—" noch "-") um Saetze zu trennen oder Zusaetze einzufuegen. Nutze stattdessen einen Punkt oder ein Komma.

DYNAMISCHE BEGRUESSUNGS-PFLICHT:
Jede Antwort MUSS mit einer passenden Begruessung starten (inkl. Name des Gastes falls vorhanden). Die Begruessung variiert je nach Tonfall:
- Bei DIREKT & EHRLICH: "Hi {{NAME}}," oder "Hey {{NAME}},"
- Bei RUHIG & PROFESSIONELL: "Hallo {{NAME}}," oder "Guten Tag {{NAME}},"
- Bei FOKUS AUF KLAERUNG: "Hi {{NAME}}," oder "Hallo {{NAME}},"
- Bei DEESKALIEREND: "Hallo {{NAME}},"
Nach der Begruessung folgt der eigentliche Einstieg (z.B. "Schade, dass..."). Die Begruessung darf NIEMALS weggelassen werden.
Wenn die KI eine logische Ursache fuer eine Situation erklaert (z.B. hohe Auslastung, volles Haus, lebhafte Atmosphaere), darf sie danach NIEMALS so klingen als haette das Restaurant ein ungeloestes Problem oder muesste Besserung geloben.
VERBOTEN: "Das ist etwas, dem wir mehr Aufmerksamkeit widmen muessen" oder "Wir haben das auf dem Schirm" (wenn es sich um eine normale Gegebenheit handelt).
ERLAUBT: Die Situation als Gegebenheit stehen lassen und loesungsorientiert nach vorne blicken (z.B. einen anderen Tisch anbieten). Die KI waehlt EINE klare Linie: Entweder wir stehen zur lebhaften Atmosphaere eines vollen Hauses, ODER wir bieten eine diskrete Loesung an. Niemals beides vermischen.
Vermeide die inflationaere Nutzung von "Es tut mir leid" oder "Wir entschuldigen uns", besonders wenn es um subjektiven Geschmack, Preise oder Hausregeln geht. Das Restaurant knickt nicht ein.
Nutze stattdessen diese souveraenen Alternativen je nach Variante:
- Bei DIREKT & EHRLICH: Nutze "Schade, dass..." oder "Es ist aergerlich, wenn..."
  Erlaubt: "Schade, dass es dir nicht geschmeckt hat — das aergert uns natuerlich auch."
  Verboten: "Es tut uns leid, dass es nicht geschmeckt hat."
- Bei RUHIG & PROFESSIONELL: Nutze "Wir bedauern, dass..." oder "Das entspricht nicht unserem Anspruch."
  Erlaubt: "Dass du unzufrieden nach Hause gegangen bist, bedauern wir."
- Bei FOKUS AUF KLAERUNG: Komplett ohne Entschuldigung einsteigen. Direkt auf die Loesung gehen.
  Erlaubt: "Das klingt nach einem Besuch, der deine Erwartungen nicht erfuellt hat — und das wollen wir verstehen."

Antwortstruktur:

Slot 1 - Emotionaler Stossdaempfer:
Erste emotionale Reaktion. Verstaendnis zeigen. Keine Erklaerung, keine Verteidigung.

Slot 2 - Abstraktion / Einordnung:
Das Problem auf hoeherer Ebene einordnen ohne die Beschwerde zu wiederholen.
Kategorien: Qualitaet / Ablauf / Umgang / Sorgfalt
Mehrere gleichwertige Probleme: Komplexfall-Satz, keine Aufzaehlung.

Slot 3 - Commitment:
Zeigen dass die Kritik intern Wirkung hat. Nur: Was machen wir mit dieser Rueckmeldung?
Fokus: Verantwortungsuebernahme, Reaktion, Verbesserungsbereitschaft.
Natuerliche Formulierungen bevorzugen: "Wir schauen, was da schiefgelaufen ist." / "Das besprechen wir direkt mit dem Team." / "Da muessen wir im Team drueber reden."
NICHT: "Wir gehen der Sache intern nach" / "Wir analysieren den Vorfall" / "intern nachgeschaerft".

Slot 4 - Brueckenbauer: wird in der Aufgabe vorgegeben.

Slot 5 - Abschluss: Kurz und professionell. Keine neue Information.

Sprachstil:
Die Antwort soll wirken als haette sie ein aufmerksamer Gastronom geschrieben.
Nicht wie Kundenservice, Konzernkommunikation, Rechtsabteilung, Marketingagentur oder KI.
Natuerliche Sprache, kurze Saetze, glaubwuerdige Formulierungen, ruhige Professionalitaet.

Oberstes Prinzip:
Der Gast soll das Gefuehl haben dass seine Kritik gelesen, verstanden und ernst genommen wurde
ohne dass die Antwort die Bewertung nacherzaehlt oder sich rechtfertigt.

Wortwahl: Locker und ehrlich, aber keine vulgaeren Formulierungen.
Natuerliche Alternativen wie "den Geist aufgegeben", "ausgefallen", "gestreikt".

Allgemeine Fallback-Regeln (gelten wenn das Restaurantprofil keine spezifischere Regel enthaelt):

BEI KRITIK AN WARTEZEITEN:
Zu Stosszzeiten ist immer viel Bewegung — Gaeste kommen, Gaeste gehen. Genau in diesen Momenten kann es kurz zu Verzoegerungen kommen. Erklaere das ruhig und ohne Entschuldigung.

BEI KRITIK AM ESSEN OHNE KONKRETEN MANGEL:
Nutze exakt eine dieser beiden Fragen: "War es einfach nicht dein persoenlicher Geschmack oder hat bei der Zubereitung etwas nicht gestimmt?" ODER "Schade, dass es dir nicht geschmeckt hat. Lag es einfach am persoenlichen Geschmack oder lief bei uns im Service oder in der Kueche etwas schief?"

WICHTIGE STRUKTUR-PFLICHT BEI ESSEN + PREIS-KRITIK:
Wenn sowohl das Essen (Geschmack) als auch der Preis kritisiert werden, MUESSEN die Varianten DIREKT & EHRLICH und RUHIG & PROFESSIONELL zwingend beide folgenden Elemente enthalten:
1. DIE GESCHMACKS-WEICHE (Pflicht): Die Frage ob es am persoenlichen Geschmack lag oder in der Kueche etwas schiefgelaufen ist.
2. DAS PREIS-ARGUMENT (Pflicht): Das flexible Qualitaets-Argument (frische Ware, hoher Anspruch), ohne sich zu entschuldigen.
Es ist VERBOTEN, eines dieser beiden Elemente wegzulassen um den Text kuerzer zu machen. Beide Punkte muessen fliessend nacheinander abgearbeitet werden.

BEI KRITIK AN PREISEN ODER PORTIONSGROESSEN:
Kern-Aussage: Unsere Preise sind bewusst so gesetzt, weil wir konsequent auf frische Ware und hohe Qualitaet setzen und hier keine Abstriche machen. Dafuer stehen wir.
STRENGE FORMULIERUNGS-REGEL: Kopiere NICHT in jeder Variante denselben Wortlaut. Der Kernsatz ist nur inhaltliche Richtlinie. Das Argument muss in jeder Variante voellig neu und passend zum Ton verpackt werden:
- Bei DIREKT & EHRLICH: Knackig und selbstbewusst. (z.B. "Hinter unseren Preisen stehen wir ganz bewusst — bei frischer Ware und Qualitaet machen wir keine Kompromisse.")
- Bei RUHIG & PROFESSIONELL: Sachlich und erklaerend. (z.B. "Unsere Preisgestaltung spiegelt unseren Anspruch an Qualitaet und frische Zutaten wider, von dem wir nicht abweichen moechten.")
- Bei FOKUS AUF KLAERUNG: Fokus auf Preis-Leistungs-Zusammenhang ohne Rechtfertigung. (z.B. "Wir kalkulieren bewusst so, um bei der Qualitaet unserer Zutaten ein hohes Niveau zu garantieren.")

BEI KRITIK AN LAUTSTAERKE ODER AMBIENTE:
Je nach Auslastung kann es in einem gut besuchten Restaurant laut und turbulent werden. Kurz anerkennen, nicht dramatisieren.`

  // User-Message: nur die Daten — Bewertung + Kontext + Aufgabe
  const userMessage = `${langInstruction}

RESTAURANT: ${businessName}
${context}

${nameRule}

BEWERTUNG (${rating} Sterne):
"${reviewText}"

${alreadyHandled}

${slot4}
Abschluss: Waehle passend zum Ton "Viele Grüße, ${signature}" oder "Herzliche Grüße, ${signature}" oder "Beste Grüße, ${signature}"

Schreibe 3 Varianten. Fuer ALLE gilt strikt: ${duSieAnrede}. ${anredeHinweis}

Variante 1 – Direkt & Ehrlich: Locker, direkt, ehrlich — geht sofort ohne Umschweife ins Thema. Kein Name.
Variante 2 – Ruhig & Professionell: Empathisch, ruhig, Mensch zuerst. Startet mit der vorgegebenen Begrüssung.
Variante 3 – Fokus auf Klaerung: Kuerzer, max. 3 Saetze, direkter Kontaktkanal im Vordergrund. Kein Name.

AUSGABE — NUR dieses JSON, kein anderer Text:
{
  "variant1": {"label": "Direkt & Ehrlich", "text": "..."},
  "variant2": {"label": "Ruhig & Professionell", "text": "..."},
  "variant3": {"label": "Fokus auf Klaerung", "text": "..."}
}`

  return JSON.stringify({ _system: systemPrompt, _user: userMessage })
}

// ─── JUDGE PROMPT ──────────────────────────────────────────────────────────
function buildJudgePrompt(
  variants: { label: string; text: string }[],
  reviewText: string,
  salutation: string,
  signature: string
): string {
  return `Du bist ein Qualitaetspruefer fuer Restaurant-Antworten. Du optimierst menschliche Tiefe und filterst KI-Floskeln heraus.

BEWERTUNG DES GASTES:
"${reviewText}"

ZUR PRUEFUNG:
Variante 1 (${variants[0]?.label}): "${variants[0]?.text}"
Variante 2 (${variants[1]?.label}): "${variants[1]?.text}"
Variante 3 (${variants[2]?.label}): "${variants[2]?.text}"

==================================================
PRUEKLISTE:
==================================================

1. SLOT-STRUKTUR:
   Folgen Variante 1 & 2 der 5-Slot-Logik?
   WICHTIG ZU VARIANTE 3: Variante 3 darf kuerzer sein (max. 3 Saetze) und muss NICHT alle 5 Slots ausformulieren.
   Sie ist gut wenn sie schnell auf Slot 1 (Stossdaempfer) und Slot 4 (Kontaktangebot) fokussiert.
   Variante 3 NIEMALS als schwach einstufen nur weil sie kurz ist!

2. NACHERZAEHLUNG:
   Wiederholt eine Variante den konkreten Fehler woertlich? (z.B. "Dass Ihnen ein falscher Cocktail serviert wurde")
   Das ist stumpfes KI-Plappern → SCHWACH. Ersetze durch abstrakte Einordnung (Sorgfalt / Ablauf / Umgang / Qualitaet).

3. VERBOTENE PHRASEN — ABSOLUT SPERREN:
   Enthaelt eine Variante: "intern nachgeschaerft" / "Team sensibilisiert" / "Konsequenzen gezogen" /
   "entspricht nicht unserem Anspruch" / "nehmen wir sehr ernst" / "intern klar gemacht" / "Massnahmen ergriffen"?
   Wenn JA → SCHWACH. Durch echtes, lebendiges Deutsch eines Gastronoms ersetzen.

4. GRAMMATIK: Fehlen Subjekte ("Verstehen Ihren Aerger" statt "Wir verstehen Ihren Aerger")? → SCHWACH

5. ABSCHLUSS: Enden alle mit: ${signature}?

==================================================
ENTSCHEIDUNG:
==================================================
- Alle 3 gut → "changed": null, alle drei WORTGENAU zurueck
- Genau eine schwach → NUR diese neu schreiben, "changed": 1, 2 oder 3
- Die anderen beiden EXAKT unveraendert kopieren

AUSGABE — NUR dieses JSON:
{
  "changed": null,
  "variant1": {"label": "Direkt & Ehrlich", "text": "..."},
  "variant2": {"label": "Ruhig & Professionell", "text": "..."},
  "variant3": {"label": "Fokus auf Klaerung", "text": "..."}
}`
}

// ─── RECOVERY PROMPT ───────────────────────────────────────────────────────
function buildRecoveryPrompt(reviewText: string, reviewerName: string, settings: any): string {
  const {
    businessName = 'das Restaurant',
    salutation = 'Sie',
    contactEmail = '',
    responseSignature = '',
    responseLanguage = 'Deutsch',
  } = settings || {}

  const duSie = salutation === 'Du' ? 'Du/Dein (Duzen)' : 'Sie/Ihr (Siezen)'
  const signature = responseSignature || `Das Team von ${businessName}`
  const firstName = reviewerName ? reviewerName.split(' ')[0] : ''
  const firstNameClean = firstName
    ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
    : ''

  const langInstruction = responseLanguage === 'Sprache des Bewerters'
    ? 'Antworte in der Sprache der Bewertung.'
    : responseLanguage === 'Englisch'
    ? 'Respond in English only.'
    : 'Antworte auf Deutsch.'

  const systemPrompt = `Erstelle eine deeskalierende, menschliche und verantwortungsvolle Antwort auf eine sehr negative Google-Bewertung.
Schreibe wie ein aufmerksamer Gastronom — nicht wie Kundenservice, PR-Agentur oder KI.

Grundregeln:
Beschwerden nicht nacherzählen oder wörtlich wiederholen.
Kritik nicht spiegeln.
Keine Ursachen erfinden.
Keine leeren Floskeln.
Natürliche Sprache, kurze Sätze.
Nutze echte Umlaute: ä, ö, ü, ß — niemals ae, oe, ue als Ersatz.

Ziel: Vertrauen zurückgewinnen und persönliche Klärung anbieten.
Länge: 3 bis 4 vollständige, fließende Sätze.
Korrekte Zeichensetzung — jeder Hauptsatz beginnt nach einem Punkt.`

  const userMessage = `${langInstruction} Anredeform: ${duSie}

Restaurant: ${businessName}
${contactEmail ? `Kontakt-E-Mail: ${contactEmail}` : ''}

Bewertung von ${firstNameClean || 'einem Gast'} (1-2 Sterne):
"${reviewText}"

Schreibe EINE deeskalierende Antwort.
${firstNameClean ? `Beginne mit "Hallo ${firstNameClean},"` : 'Kein Name bekannt — ohne persoenliche Anrede beginnen.'}
${contactEmail ? `Kontaktangebot: Bitte melde dich kurz unter ${contactEmail}, damit wir das persönlich klären können.` : ''}
Endet mit: ${signature}

AUSGABE — NUR dieses JSON:
{"label":"Deeskalierend","text":"..."}`

  return JSON.stringify({ _system: systemPrompt, _user: userMessage })
}

// ─── HELPER: GEMINI API CALL (Generator) ──────────────────────────────────
async function callGemini(userMessage: string, systemPrompt?: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`

  const body: any = {
    contents: [{ parts: [{ text: userMessage }] }],
    generationConfig: { maxOutputTokens: 4000, temperature: 0.7 },
  }
  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] }
  }

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

// ─── HELPER: CLAUDE API CALL (Judge & Recovery) ────────────────────────────
async function callClaude(userMessage: string, systemPrompt?: string): Promise<string> {
  const body: any = {
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: userMessage }],
  }
  if (systemPrompt) {
    body.system = systemPrompt
  }

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

// ─── HELPER: JSON PARSE ────────────────────────────────────────────────────
function parseVariants(raw: string): { label: string; text: string; isRecovery?: boolean }[] {
  let jsonStr = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  const startIdx = jsonStr.indexOf('{')
  const endIdx = jsonStr.lastIndexOf('}')

  if (startIdx === -1 || endIdx === -1) {
    throw new Error('Kein JSON gefunden: ' + raw)
  }

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
// Prüft ob die Description genug Kontext liefert um die Bewertung sicher zu beantworten.
// Läuft VOR der eigentlichen Generierung. Ändert nichts am bestehenden Code darunter.
async function checkContext(reviewText: string, description: string): Promise<{ ok: boolean; missing?: string }> {
  // Wenn kein Text in der Bewertung — kein Kontext nötig, immer OK
  const wordCount = reviewText.trim().split(/\s+/).filter(Boolean).length
  if (wordCount < 6) return { ok: true }

  const systemPrompt = `Du bist ein strikter Qualitätsprüfer für Restaurant-Antworten.
Deine einzige Aufgabe: Entscheide ob das Restaurantprofil genug Informationen enthält um auf diese Bewertung sicher zu antworten — ohne etwas erfinden zu müssen.

Antworte NUR mit einem dieser zwei Formate:
OK
MISSING: [kurze Beschreibung was fehlt, max. 1 Satz auf Deutsch]

Wann ist MISSING korrekt?
- Die Bewertung enthält einen konkreten Vorwurf über eine spezifische Situation oder Entscheidung des Restaurants (z.B. Platzvergabe, Reservierungspolitik, Hausregeln, spezifische Abläufe)
- UND das Profil enthält dazu keine Erklärung oder Regel

Wann ist OK korrekt?
- Allgemeine Kritik (Essen, Service, Wartezeit, Atmosphäre) — hier braucht die KI keine Hausregeln
- Das Profil enthält eine passende Erklärung zur Situation
- Die Bewertung ist positiv oder neutral

Sei NICHT überstreng. Im Zweifel: OK.`

  const userMessage = `RESTAURANTPROFIL:
${description || '(keine Beschreibung eingetragen)'}

BEWERTUNG:
"${reviewText}"

Ist das Profil ausreichend um sicher zu antworten?`

  try {
    const result = await callClaude(userMessage, systemPrompt)
    const trimmed = result.trim()
    if (trimmed.startsWith('MISSING:')) {
      const missing = trimmed.replace('MISSING:', '').trim()
      return { ok: false, missing }
    }
    return { ok: true }
  } catch (e) {
    // Im Fehlerfall: immer OK — lieber generieren als blockieren
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

  const reviewText = review.reviewText || ''
  const stars = review.stars || 3
  const reviewerName = review.reviewerName || ''

  const salutation = settings?.salutation || 'Sie'
  const businessName = settings?.businessName || 'das Restaurant'
  const signature = settings?.responseSignature || `Das Team von ${businessName}`

  try {
    // ── SCHRITT 0: Context Check ──────────────────────────────────────────
    const description = settings?.description || ''
    const contextCheck = await checkContext(reviewText, description)
    if (!contextCheck.ok) {
      return res.status(200).json({
        success: false,
        missingContext: true,
        missingInfo: contextCheck.missing || 'Fehlende Informationen im Restaurantprofil',
      })
    }

    // ── SCHRITT 1: Generator (Gemini) ─────────────────────────────────────
    const generatorRaw_str = buildPrompt(reviewText, stars, reviewerName, settings)
    let generatorRaw: string

    // CONTENT-Modi liefern JSON mit _system/_user — geht an Gemini
    // EMPTY-Modi liefern direkt den Prompt-String
    try {
      const parsed = JSON.parse(generatorRaw_str)
      if (parsed._system && parsed._user) {
        generatorRaw = await callClaude(parsed._user, parsed._system)
      } else {
        generatorRaw = await callClaude(generatorRaw_str)
      }
    } catch {
      generatorRaw = await callClaude(generatorRaw_str)
    }

    const generatedVariants = parseVariants(generatorRaw)

    // ── SCHRITT 2: Judge deaktiviert — Gemini Output direkt verwenden ───────
    const mode = classify(stars, reviewText)
    let finalVariants = generatedVariants

    // ── SCHRITT 3: Recovery (nur bei 1–2 Sternen) ─────────────────────────
    if (stars <= 2) {
      try {
        const recoveryPrompt_str = buildRecoveryPrompt(reviewText, reviewerName, settings)
        let recoveryRaw: string
        try {
          const recoveryParsed = JSON.parse(recoveryPrompt_str)
          if (recoveryParsed._system && recoveryParsed._user) {
            recoveryRaw = await callClaude(recoveryParsed._user, recoveryParsed._system)
          } else {
            recoveryRaw = await callClaude(recoveryPrompt_str)
          }
        } catch {
          recoveryRaw = await callClaude(recoveryPrompt_str)
        }
        let recoveryJson = recoveryRaw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
        const rs = recoveryJson.indexOf('{')
        const re = recoveryJson.lastIndexOf('}')
        if (rs !== -1 && re !== -1) {
          recoveryJson = recoveryJson.substring(rs, re + 1)
          const parsed = JSON.parse(recoveryJson)
          if (parsed.text) {
            const cleanText = (t: string) => t.replace(/\n\n/g, ' ').replace(/\n/g, ' ').trim()
            finalVariants = [
              ...finalVariants,
              { label: parsed.label || 'Deeskalierend', text: cleanText(parsed.text), isRecovery: true }
            ]
          }
        }
      } catch (e) {
        console.error('Recovery generation failed:', e)
      }
    }

    return res.status(200).json({ success: true, answers: finalVariants })

  } catch (error) {
    return res.status(500).json({ error: 'Serverfehler', details: String(error) })
  }
}