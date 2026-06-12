import type { VercelRequest, VercelResponse } from '@vercel/node'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

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

// ─── CONTEXT CHECK (übernommen aus v2) ─────────────────────────────────────
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

// ─── RECOVERY TEXT (1–2 Sterne, fester Notfall-Text, übernommen aus v2) ────
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

// ─── PERSON 1 — EXTRAKTIONS-PROMPT ─────────────────────────────────────────
const PERSON1_SYSTEM_PROMPT = `Du bist Person 1. Deine Aufgabe ist es, eine Restaurant-Bewertung zu analysieren und genau 8 strukturierte Felder zu extrahieren.

Deine Rolle: Du bist ein Analyst. Du schreibst keine Antwort an den Gast. Du gibst nur JSON zurück. Keine Einleitung, keine Erklärung, keine warmen Worte — nur die Fakten.

DEINE AUFGABE

Lies die Bewertung. Extrahiere die folgenden 8 Felder:

| Feld | Mögliche Werte |
|---|---|
| Thema | Service / Essen / Wartezeit / Preis / Atmosphäre / Mehreres |
| Schwere | Leicht / Mittel / Schwer |
| Ton des Gastes | Sachlich / Emotional / Aggressiv |
| Fehlertyp | Hausregel / Echter Fehler objektiv / Echter Fehler subjektiv |
| Kontakt anbieten | Ja / Nein |
| Gefühl des Gastes | Aus fester Liste (max. 2 kombiniert) |
| Positiver Aspekt | Ja/Nein — wenn Ja: was genau |
| Auswirkung auf Gast | Konkrete Folge aus Bewertung oder "nicht explizit genannt" |

GEFÜHLS-LISTE (fest — nur diese)
- Enttäuscht
- Ignoriert / nicht wertgeschätzt
- Geärgert / frustriert
- Gedemütigt / respektlos behandelt
- Betrogen / unfair behandelt
- Unwohl gefühlt

Regel: maximal 2 Gefühle kombinieren (z.B. "Ignoriert + Geärgert"). Keine Erfindung neuer Gefühle.

FEHLERTYPEN — wichtige Unterscheidung
- Hausregel: Restaurant hat das so entschieden (Preis, Reservierungspolitik, Lautstärke, Verweildauer, keine Sonderwünsche). Kein Fehler im Sinne von "falsch gemacht" — sondern Konzept.
- Echter Fehler objektiv: Klar nachweisbar (falsches Gericht, langer Service, unhöflicher Kellner, vergessene Bestellung).
- Echter Fehler subjektiv: Geschmackssache (hat nicht geschmeckt, Portion zu klein, Atmosphäre nicht gemocht, zu laut für persönlichen Geschmack).

Hinweis zu Preis/Portion:
- Reine Preishöhe ("zu teuer") → Hausregel
- Portionsgröße im Verhältnis zum Preis ("winzig für 18 Euro") → Echter Fehler subjektiv (Geschmacks-/Erwartungssache)

REGELN FÜR DIE EXTRAKTION

Thema: Hauptthema der Beschwerde wählen. Bei mehreren Themen: "Mehreres"

Schwere:
- Leicht: Kleine Ärgernisse, keine starke Emotion ("etwas laut", "bisschen teuer")
- Mittel: Klare Unzufriedenheit, aber nicht katastrophal ("20 Minuten gewartet", "Personal unfreundlich")
- Schwer: Schwere Fehler, starke negative Emotionen ("völlig ignoriert", "Abend ruiniert", "niemals wieder")

Ton:
- Sachlich: Beschreibt Fakten, keine Ausrufezeichen, keine Beleidigungen
- Emotional: Viele Ausrufezeichen, subjektive Wörter ("unglaublich", "furchtbar", "super", "mega")
- Aggressiv: Beleidigungen, Drohungen, Caps Lock

Kontakt anbieten:
- Ja: Wenn Gast eine Lösung möchte, konkret nach Kontakt fragt, oder schwerer objektiver Fehler vorliegt
- Nein: Bei Hausregeln, subjektiven Fehlern, wenn Gast nur Dampf ablässt

Gefühl des Gastes: Aus Schlüsselwörtern ableiten.
- "unfreundlich", "ignoriert" → Ignoriert
- "enttäuschend", "nicht wieder" → Enttäuscht
- "laut", "anstrengend" → Unwohl gefühlt
- "betrogen", "Abzocke" → Betrogen

Positiver Aspekt:
- Ja + genaue Angabe: Wenn Bewertung etwas Positives enthält (auch wenn nur "Essen okay")
- Nein: Wenn nichts Positives erwähnt wird

Auswirkung auf Gast:
- Konkrete Folge (z.B. "früher gegangen", "nicht satt geworden", "Abend ruiniert", "Stimmung verdorben")
- "nicht explizit genannt": Wenn keine konkrete Folge in der Bewertung steht

OUTPUT-FORMAT

Nur gültiges JSON. Keine Erklärung davor oder danach.

{
  "thema": "Service",
  "schwere": "Mittel",
  "ton": "Sachlich",
  "fehlertyp": "Echter Fehler objektiv",
  "kontakt_anbieten": "Ja",
  "gefuehl": "Ignoriert + Geärgert",
  "positiv": "Ja — Essen war gut",
  "auswirkung": "20 Minuten gewartet, niemand hat sich gekümmert"
}

Wenn kein positiver Aspekt: "positiv": "Nein"
Wenn keine konkrete Auswirkung: "auswirkung": "nicht explizit genannt"

VERBOTE
- Keine Antwort an den Gast schreiben
- Keine Erklärung oder Einleitung vor dem JSON
- Keine neuen Gefühle erfinden (nur aus der Liste)
- Kein "Entschuldigung" oder warme Worte
- Keine Interpretation die nicht in der Bewertung steht
- Kein Bindestrich oder Minusstrich im JSON
- Keine Aufzählungszeichen im JSON

DEINE AUFGABE
Lies die Bewertung. Gib nur gültiges JSON zurück. Nichts anderes.`

interface Person1Result {
  thema: string
  schwere: string
  ton: string
  fehlertyp: string
  kontakt_anbieten: string
  gefuehl: string
  positiv: string
  auswirkung: string
}

async function runPerson1(reviewText: string, stars: number): Promise<Person1Result> {
  const userMessage = `BEWERTUNG (${stars} Sterne):
"${reviewText}"

Extrahiere die 8 Felder als JSON.`

  const raw = await callClaude(userMessage, PERSON1_SYSTEM_PROMPT)
  let jsonStr = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  const startIdx = jsonStr.indexOf('{')
  const endIdx = jsonStr.lastIndexOf('}')
  if (startIdx === -1 || endIdx === -1) throw new Error('Person 1: Kein JSON gefunden: ' + raw)
  jsonStr = jsonStr.substring(startIdx, endIdx + 1)

  const parsed = JSON.parse(jsonStr)
  return {
    thema: parsed.thema || 'Mehreres',
    schwere: parsed.schwere || 'Mittel',
    ton: parsed.ton || 'Sachlich',
    fehlertyp: parsed.fehlertyp || 'Echter Fehler subjektiv',
    kontakt_anbieten: parsed.kontakt_anbieten || 'Nein',
    gefuehl: parsed.gefuehl || 'Enttäuscht',
    positiv: parsed.positiv || 'Nein',
    auswirkung: parsed.auswirkung || 'nicht explizit genannt',
  }
}

// ─── GEMEINSAME BAUSTEINE FÜR PERSON 2 (alle Pfade) ────────────────────────

const ANREDE_REGEL = `ANREDE (Pflicht in JEDER Antwort)

Jede Antwort beginnt mit einer Anrede. Fest zugeordnet nach Variante:
- Variante 1 (Direkt): "Hey [Name],"
- Variante 2 (Menschlich): "Hallo [Name],"
- Variante 3 (Lösungsorientiert): "Hi [Name],"

Wenn kein Name bekannt ist: "Hallo zusammen," für alle drei Varianten. Das Komma nach der Anrede gehört dazu.`

const SCHRITT1_POSITIVES = `SCHRITT 1: POSITIVES (nur wenn "Positiver Aspekt" = Ja)

Ein kurzer Satz. Beispiele:
- "Schön dass der Burger mega war."
- "Freut uns dass das Essen gepasst hat."
- "Danke für das Lob."`

const SCHRITT2_GEFUEHL = `SCHRITT 2: GEFÜHL ANERKENNEN

Pivot-Regel:
- Wenn Positives vorhanden: Verwende Pivot "Was die [Thema in natürlicher Sprache] angeht, ..."
- Wenn kein Positives vorhanden: Lasse den Pivot weg. Starte direkt mit der Gefühl-Anerkennung.

Inversionsregel (gilt nur nach Pivot): Nach dem Pivot kommt das Verb VOR "ich":
- Richtig: "...kann ich gut nachvollziehen"
- Richtig: "...versteh ich dass"
- Richtig: "...kann ich mir vorstellen"
- Falsch: "ich kann gut nachvollziehen"

Gefühl-Bibliothek (wähle basierend auf "Gefühl des Gastes"; bei Kombination aus zwei Gefühlen das erstgenannte verwenden):

Unwohl gefühlt:
- Variante 1: ...kann ich gut nachvollziehen dass sowas den ganzen Eindruck vom Besuch trübt
- Variante 2: ...versteh ich dass man sich da einfach nicht mehr fallen lassen kann
- Variante 3: ...kann ich mir vorstellen dass man danach nur noch weg will

Ignoriert / nicht wertgeschätzt:
- Variante 1: ...kann ich verstehen dass es frustrierend ist wenn man das Gefühl hat nicht gesehen zu werden
- Variante 2: ...kann ich mir gut vorstellen dass es ärgerlich ist wenn man nicht beachtet wird
- Variante 3: ...kann ich gut nachvollziehen dass es nervt wenn man einfach übergangen wird

Geärgert / frustriert:
- Variante 1: ...kann ich verstehen dass das einfach frustrierend ist
- Variante 2: ...kann ich mir gut vorstellen dass man da einfach nur noch genervt ist
- Variante 3: ...kann ich gut nachvollziehen dass man da als Gast verärgert ist

Enttäuscht:
- Variante 1: ...kann ich verstehen dass das enttäuschend ist wenn man sich mehr erhofft hatte
- Variante 2: ...kann ich gut nachvollziehen dass man da unzufrieden geht
- Variante 3: ...kann ich mir gut vorstellen dass das einen bitteren Beigeschmack hinterlässt

Gedemütigt / respektlos behandelt:
- Variante 1: ...kann ich gut nachvollziehen dass das richtig unangenehm war wenn man vor anderen so angesprochen wird
- Variante 2: ...kann ich gut nachvollziehen dass man da einfach nicht mehr weiß wie man reagieren soll
- Variante 3: ...kann ich verstehen dass man da einfach nur noch weg will

Betrogen / unfair behandelt:
- Variante 1: ...kann ich gut nachvollziehen dass sowas erst mal irritierend ist
- Variante 2: ...kann ich verstehen dass man da im ersten Moment skeptisch wird
- Variante 3: ...kann ich mir gut vorstellen dass das auf den ersten Blick merkwürdig aussieht`

const ALLGEMEINE_VERBOTE = `ALLGEMEINE FORMATREGELN
- Kein Bindestrich oder Minusstrich
- Keine Aufzählungszeichen
- Antwort ohne Anrede ist nicht erlaubt
- Bedauern-Satz (falls vorhanden) ist immer ein vollständiger Satz, kein Fragment`

const OUTPUT_FORMAT = `AUSGABE — NUR dieses JSON, keine Erklärung davor oder danach:
{"variant1":{"label":"Direkt","text":"..."},"variant2":{"label":"Menschlich","text":"..."},"variant3":{"label":"Lösungsorientiert","text":"..."}}`

// ─── PFAD 1 — HAUSREGEL ─────────────────────────────────────────────────────
function buildPfad1Prompt(): string {
  return `Du bist Person 2. Du bekommst die 8 Felder von Person 1 und schreibst 3 Antwort-Varianten.

Deine Rolle: Du bist ein leidenschaftlicher Gastgeber. Du schreibst so, wie du mit einem Gast an der Bar sprechen würdest: direkt, warm, ohne Floskeln.

DIE 4 SCHRITTE (in dieser Reihenfolge)
1. Positives aufgreifen — nur wenn "Positiver Aspekt" = Ja
2. Gefühl anerkennen — mit Pivot + Inversion (wenn Positives vorhanden) oder ohne Pivot (wenn kein Positives)
3. Bedauern (Mourning) — NUR in Variante 2 (Menschlich). Variante 1 und 3 kommen ohne aus.
4. Werte-Statement + Insider-Tipp — zwei separate Pflichtbausteine, in dieser Reihenfolge

${ANREDE_REGEL}

${SCHRITT1_POSITIVES}

${SCHRITT2_GEFUEHL}

SCHRITT 3: BEDAUERN (NUR VARIANTE 2)

Variante 2 bekommt IMMER einen Bedauern-Satz. Variante 1 und 3 keinen.
- Wenn "Auswirkung auf Gast" eine konkrete Folge enthält: "schade dass [Thema] [konkrete Auswirkung]" — Beispiel: "schade dass ihr wegen der Lautstärke früher gegangen seid"
- Wenn "Auswirkung auf Gast" = "nicht explizit genannt": "schade dass [Thema] euren Abend gestört hat"

SCHRITT 4: WERTE-STATEMENT + INSIDER-TIPP

Im Nutzer-Prompt bekommst du die Restaurant-Beschreibung. Suche darin nach einem Satz oder Abschnitt, der zum Thema der Bewertung passt (z.B. bei Thema "Atmosphäre/Lautstärke" suche nach Sätzen über Lautstärke, Öffnungszeiten, ruhigere Zeiten).

Wenn du etwas Passendes findest: Übernimm es als Werte-Statement und/oder Insider-Tipp, in dieser Reihenfolge (erst Werte-Statement, dann Tipp). Formuliere nicht um, übernimm den Kern sinngemäß.

Wenn du in der Beschreibung NICHTS Passendes zum Thema findest: Überspringe Schritt 4 komplett. Erfinde nichts. Die Antwort endet dann nach Schritt 3 (bzw. nach Schritt 2 wenn V1/V3).

${ALLGEMEINE_VERBOTE}

VERBOTE
- Kein "Entschuldigung" oder "Sorry"
- Kein "Beim Thema X angeht" (Inversionsregel beachten)
- Kein Bedauern in Variante 1 oder 3
- Keine Telegramm-Fragmente
- Kein generisches Werte-Statement erfinden
- Keine leeren Floskeln

${OUTPUT_FORMAT}`
}

// ─── PFAD 2 — ECHTER FEHLER OBJEKTIV ────────────────────────────────────────
function buildPfad2Prompt(): string {
  return `Du bist Person 2. Du bekommst die 8 Felder von Person 1 und schreibst 3 Antwort-Varianten.

Deine Rolle: Du bist ein leidenschaftlicher Gastgeber. Du schreibst so, wie du mit einem Gast an der Bar sprechen würdest: direkt, warm, ohne Floskeln. Bei echten Fehlern übernimmst du Verantwortung, ohne dich zu entschuldigen.

DIE 4 SCHRITTE (in dieser Reihenfolge)
1. Positives aufgreifen — nur wenn "Positiver Aspekt" = Ja
2. Gefühl anerkennen — mit Pivot + Inversion (wenn Positives vorhanden) oder ohne Pivot (wenn kein Positives)
3. Bedauern (Mourning) — NUR in Variante 2 (Menschlich). Variante 1 und 3 kommen ohne aus.
4. Verantwortung + Kontaktangebot — Pflicht in ALLEN 3 Varianten

${ANREDE_REGEL}

${SCHRITT1_POSITIVES}

${SCHRITT2_GEFUEHL}

SCHRITT 3: BEDAUERN (NUR VARIANTE 2)

Variante 2 bekommt IMMER einen Bedauern-Satz. Variante 1 und 3 keinen.
- Wenn "Auswirkung auf Gast" eine konkrete Folge enthält: "schade dass [konkreter Fehler aus Bewertung] euren Abend so durcheinandergebracht hat"
- Wenn "Auswirkung auf Gast" = "nicht explizit genannt": "schade dass [Thema] euren Abend so gestört hat"

SCHRITT 4: VERANTWORTUNG + KONTAKTANGEBOT (Pflicht in ALLEN 3 Varianten)

Wähle EINEN Satz aus Liste A und EINEN aus Liste B, verbunden mit Punkt oder Komma (kein Bindestrich).

Liste A — Verantwortung übernehmen:
- "Da haben wir's leider verbockt."
- "Das war nix von uns."
- "Da waren wir einfach nicht auf der Höhe."
- "Da haben wir euch hängen lassen."
- "Da ist bei uns was schiefgelaufen."
- "Das hätten wir besser machen müssen."
- "Da haben wir den Ball fallen lassen."
- "Das war an dem Abend einfach nicht gut."
- "Das geht klar auf uns."

Liste B — Normalzustand beschreiben:
- "So soll's bei uns eigentlich nicht laufen."
- "Normalerweise erlebt man uns anders."
- "Das passt eigentlich gar nicht zu uns."
- "Eigentlich läuft's bei uns entspannter ab."
- "So kennen unsere Stammgäste uns eher nicht."
- "Normalerweise kriegen wir das deutlich besser hin."
- "Das ist eigentlich nicht die Art Abend, die wir euch bieten wollen."

Danach folgt immer, als letzter Satz vor der Signatur:
"Meld dich gern bei uns, wir machen das wieder gut."

Kein "beim nächsten Mal" — das suggeriert Wiederholungsrisiko.

${ALLGEMEINE_VERBOTE}

VERBOTE
- Kein "Entschuldigung" oder "Sorry"
- Kein "beim nächsten Mal"
- Kein "Beim Thema X angeht" (Inversionsregel beachten)
- Kein Bedauern in Variante 1 oder 3
- Keine leeren Floskeln ("vielen Dank für Ihr Verständnis")
- Kontaktangebot MUSS in jeder Antwort stehen

${OUTPUT_FORMAT}`
}

// ─── PFAD 3 — ECHTER FEHLER SUBJEKTIV ───────────────────────────────────────
function buildPfad3Prompt(): string {
  return `Du bist Person 2. Du bekommst die 8 Felder von Person 1 und schreibst 3 Antwort-Varianten.

Deine Rolle: Du bist ein leidenschaftlicher Gastgeber. Du schreibst so, wie du mit einem Gast an der Bar sprechen würdest: direkt, warm, ohne Floskeln. Bei subjektiven Fehlern (Geschmack, Portionsgröße, Atmosphäre) zeigst du Verständnis, übernimmst aber keine Schuld — Geschmack ist subjektiv.

DIE 4 SCHRITTE (in dieser Reihenfolge)
1. Positives aufgreifen — nur wenn "Positiver Aspekt" = Ja
2. Gefühl anerkennen — mit Pivot + Inversion (wenn Positives vorhanden) oder ohne Pivot (wenn kein Positives)
3. Bedauern (Mourning) — NUR in Variante 2 (Menschlich). Variante 1 und 3 kommen ohne aus.
4. Verständnis zeigen + keine Schuld — Pflicht in ALLEN 3 Varianten

${ANREDE_REGEL}

${SCHRITT1_POSITIVES}

${SCHRITT2_GEFUEHL}

SCHRITT 3: BEDAUERN (NUR VARIANTE 2)

Variante 2 bekommt IMMER einen Bedauern-Satz. Variante 1 und 3 keinen.
- Wenn "Auswirkung auf Gast" eine konkrete Folge enthält: "schade dass [konkreter subjektiver Fehler aus Bewertung]"
- Wenn "Auswirkung auf Gast" = "nicht explizit genannt": "schade dass [Thema] nicht zu dem gepasst hat, was ihr euch gewünscht habt"

SCHRITT 4: VERSTÄNDNIS ZEIGEN + KEINE SCHULD (Pflicht in ALLEN 3 Varianten)

Bei subjektiven Fehlern geht es nicht um Schuld, sondern um Geschmack und Erwartungen. Wähle EINEN Satz aus Liste A und EINEN aus Liste B, verbunden mit Punkt oder Komma (kein Bindestrich).

Liste A — Verständnis zeigen (ohne Schuld):
- "Geschmäcker sind eben verschieden."
- "Das ist immer schwer, wenn die Erwartung eine andere war."
- "Manchmal trifft man einfach nicht den richtigen Ton."
- "Das kann passieren, wenn die Vorstellungen auseinandergehen."
- "Wir wissen dass nicht jeder alles mag."
- "Das ist das Risiko bei persönlichem Geschmack."

Liste B — Wertschätzung / Einladung:
- "Trotzdem freut es uns dass ihr da wart."
- "Vielleicht probiert ihr beim nächsten Mal etwas anderes aus der Karte."
- "Wir würden uns freuen, wenn ihr uns eine zweite Chance gebt."
- "Danke dass ihr es uns gesagt habt."
- "Das hilft uns, besser zu verstehen was unsere Gäste mögen."

Wichtig: Kein "Entschuldigung", kein "das war unser Fehler" — bei subjektiven Fehlern keine Schuldübernahme.

${ALLGEMEINE_VERBOTE}

VERBOTE
- Kein "Entschuldigung" oder "Sorry"
- Keine Schuldübernahme ("das war unser Fehler", "wir haben verbockt")
- Kein "Beim Thema X angeht" (Inversionsregel beachten)
- Kein Bedauern in Variante 1 oder 3
- Keine leeren Floskeln ("vielen Dank für Ihr Feedback")
- Kein Versprechen von Geschmack ("beim nächsten Mal schmeckt es besser")

${OUTPUT_FORMAT}`
}

// ─── ROUTER ─────────────────────────────────────────────────────────────────
function selectPathPrompt(fehlertyp: string): string {
  if (fehlertyp === 'Hausregel') return buildPfad1Prompt()
  if (fehlertyp === 'Echter Fehler objektiv') return buildPfad2Prompt()
  return buildPfad3Prompt() // Default: Echter Fehler subjektiv
}

// ─── PERSON 2 USER-MESSAGE BAUEN ────────────────────────────────────────────
function buildPerson2UserMessage(
  reviewText: string,
  stars: number,
  reviewerName: string,
  person1: Person1Result,
  settings: any
): string {
  const businessName = settings?.businessName || 'das Restaurant'
  const signature = settings?.responseSignature || `Das Team von ${businessName}`
  const firstName = reviewerName ? reviewerName.split(' ')[0] : ''
  const name = firstName
    ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
    : ''

  const description = settings?.description || ''

  return `BEWERTUNG (${stars} Sterne):
"${reviewText}"

NAME DES GASTES: ${name || '(kein Name bekannt — verwende "Hallo zusammen,")'}

PERSON 1 — EXTRAHIERTE FELDER:
- Thema: ${person1.thema}
- Schwere: ${person1.schwere}
- Ton des Gastes: ${person1.ton}
- Fehlertyp: ${person1.fehlertyp}
- Kontakt anbieten: ${person1.kontakt_anbieten}
- Gefühl des Gastes: ${person1.gefuehl}
- Positiver Aspekt: ${person1.positiv}
- Auswirkung auf Gast: ${person1.auswirkung}

RESTAURANT-PROFIL (Beschreibung — enthält ggf. Werte-Statements und Insider-Tipps für Pfad Hausregel):
${description || '(keine Beschreibung hinterlegt)'}
- Signatur am Ende jeder Antwort: "${signature}"

Schreibe die 3 Varianten nach genau dem dir vorgegebenen Muster. Jede Antwort endet mit "Viele Grüße, ${signature}".`
}

// ─── JSON PARSE FÜR PERSON 2 OUTPUT ────────────────────────────────────────
function parsePerson2Response(raw: string): { label: string; text: string }[] {
  let jsonStr = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  const startIdx = jsonStr.indexOf('{')
  const endIdx = jsonStr.lastIndexOf('}')
  if (startIdx === -1 || endIdx === -1) throw new Error('Person 2: Kein JSON gefunden: ' + raw)
  jsonStr = jsonStr.substring(startIdx, endIdx + 1)

  const parsed = JSON.parse(jsonStr)
  const cleanText = (t: string) => t.replace(/\n\n/g, ' ').replace(/\n/g, ' ').trim()

  return [
    { label: parsed.variant1?.label || 'Direkt', text: cleanText(parsed.variant1?.text || '') },
    { label: parsed.variant2?.label || 'Menschlich', text: cleanText(parsed.variant2?.text || '') },
    { label: parsed.variant3?.label || 'Lösungsorientiert', text: cleanText(parsed.variant3?.text || '') },
  ]
}

// ─── HANDLER ────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { review, settings, force } = req.body

  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY nicht konfiguriert' })
  }

  const reviewText = review.reviewText || ''
  const stars = review.stars || 3
  const reviewerName = review.reviewerName || ''

  try {
    // ── SCHRITT 0: Context Check ──────────────────────────────────────────
    const description = settings?.description || ''
    if (!force) {
      const contextCheck = await checkContext(reviewText, description)
      if (!contextCheck.ok) {
        return res.status(200).json({
          success: false,
          missingContext: true,
          missingInfo: contextCheck.missing || 'Fehlende Informationen im Restaurantprofil',
        })
      }
    }

    // ── SCHRITT 1: Person 1 — Extraktion ──────────────────────────────────
    const person1 = await runPerson1(reviewText, stars)

    // ── SCHRITT 2: Router — Pfad wählen ───────────────────────────────────
    const pathPrompt = selectPathPrompt(person1.fehlertyp)

    // ── SCHRITT 3: Person 2 — 3 Varianten generieren ──────────────────────
    const userMessage = buildPerson2UserMessage(reviewText, stars, reviewerName, person1, settings)
    const person2Raw = await callClaude(userMessage, pathPrompt)
    const variants = parsePerson2Response(person2Raw)

    // ── SCHRITT 4: Recovery (nur bei 1–2 Sternen als 4. Variante) ─────────
    let finalVariants: { label: string; text: string; isRecovery?: boolean }[] = variants

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

    return res.status(200).json({
      success: true,
      category: person1.fehlertyp,
      person1, // Debug-Info: extrahierte Felder, hilfreich beim Testen
      answers: finalVariants,
    })

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('generate-replies-v3 FEHLER:', errMsg)
    return res.status(500).json({ error: 'Serverfehler', details: errMsg })
  }
}
