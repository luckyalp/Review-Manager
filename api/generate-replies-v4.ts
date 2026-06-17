import type { VercelRequest, VercelResponse } from '@vercel/node'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

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

  const duSieAnrede = salutation === 'Du' ? 'Du/Dein (Duzen)' : 'Sie/Ihr (Siezen)'
  const anredeHinweis = salutation === 'Du'
    ? 'Nutze konsequent die Du-Form (du, dein, dir). Schreibe "dir" und "dein" klein.'
    : 'Nutze konsequent die Sie-Form (Sie, Ihr, Ihnen). Schreibe "Sie" und "Ihr" immer groß.'
  const signature = responseSignature || `Das Team von ${businessName}`
  const mode = classify(rating, reviewText)
  const wordCount = reviewText.trim().split(/\s+/).filter(Boolean).length
  // "a" oder "s" sind technisch 1 Wort, aber inhaltlich praktisch nichts —
  // ab 3 Zeichen behandeln wir den Text als "vorhanden", darunter wie "kein Text".
  const hasMeaningfulText = reviewText.trim().length >= 3
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

  const nameRule = firstNameCapitalized
    ? `PERSONALISIERUNG UND BEGRUESSUNGS-PFLICHT:
Alle drei Varianten MUESSEN mit einer Begruessung inkl. Name starten.
- DIREKT & EHRLICH: beginnt mit "Hi ${firstNameCapitalized}," oder "Hey ${firstNameCapitalized},"
- RUHIG & PROFESSIONELL: beginnt mit "Hallo ${firstNameCapitalized},"
- FOKUS AUF KLAERUNG: beginnt mit "Hi ${firstNameCapitalized}," oder "Hallo ${firstNameCapitalized},"
Schreibe den Namen IMMER genau so: ${firstNameCapitalized} — nie in Grossbuchstaben.`
    : `PERSONALISIERUNG UND BEGRUESSUNGS-PFLICHT:
Kein Name bekannt. Alle drei Varianten starten trotzdem mit einer Begruessung:
- DIREKT & EHRLICH: "Hi," oder "Hey,"
- RUHIG & PROFESSIONELL: "Hallo,"
- FOKUS AUF KLAERUNG: "Hi," oder "Hallo,"`

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
    const reviewContextBlock = !hasMeaningfulText
      ? `BEWERTUNG: ${rating} Sterne — kein Text.`
      : `BEWERTUNG: ${rating} Sterne. Der Gast hat folgendes geschrieben: "${reviewText.trim()}"

Das ist sehr kurz (${wordCount} ${wordCount === 1 ? 'Wort' : 'Woerter'}), aber es ist Text vorhanden — behaupte NIEMALS, es waere "kein Text" oder "kein Wort" geschrieben worden.
- Wenn ein konkretes Thema erkennbar ist (z.B. Essen, Service, Atmosphaere): geh kurz darauf ein.
- Wenn KEIN konkretes Thema erkennbar ist (z.B. nur "Top" oder "Super"): erkenne die positive Stimmung kurz an.`

    return `Du bist eine Hospitality Response Engine fuer "${businessName}".
${langInstruction}

KONTEXT (Hintergrundwissen fuer dich — NIEMALS woertlich oder als ganze Saetze in die Antwort uebernehmen, sondern nur sinngemaess und falls relevant einfliessen lassen):
${context}

${nameRule}

${reviewContextBlock}

AUFGABE: 3 kurze, herzliche Antworten. Max. 2 Saetze. Keine Floskeln. Keine Dankesformeln.
Schreibe wie gesprochen, nicht wie formuliert. Direkt beginnen.
Alle drei enden mit: ${signature}

BEISPIELE (genau dieser Ton):
- "Danke dir :) Schoen, dass du bei uns warst."
- "Freut uns, dass du einen schoenen Besuch hattest. Bis bald :)"
- "5 Sterne nehmen wir natuerlich gern. Danke dir."
- "Ich bin sprachlos. Im positiven Sinne natuerlich. Bis bald :)"

ABSOLUT VERBOTEN:
- "Vielen Dank fuer Ihre/deine Bewertung"
- "Wir freuen uns ueber Ihr/dein Feedback"
- "Das freut uns sehr"
- "Wir heissen Sie jederzeit wieder herzlich willkommen"
- Jede Form von standardisierter Dankesformel
- Gedankenstriche (weder "—" noch " - ") — nutze Punkt oder Komma stattdessen.

SPRACHE: Nutze echte Umlaute: ä, ö, ü, ß — niemals ae, oe, ue als Ersatz.

AUSGABE — NUR dieses JSON:
{"variant1":{"label":"Herzlich","text":"..."},"variant2":{"label":"Persoenlich","text":"..."},"variant3":{"label":"Kurz & warm","text":"..."}}`
  }

  // ─── EMPTY NEGATIVE ────────────────────────────────────────────────────────
  if (mode === 'EMPTY_NEGATIVE') {
    const reviewContextBlock = !hasMeaningfulText
      ? `BEWERTUNG: ${rating} Sterne — kein Text.`
      : `BEWERTUNG: ${rating} Sterne. Der Gast hat folgendes geschrieben: "${reviewText.trim()}"

Das ist sehr kurz (${wordCount} ${wordCount === 1 ? 'Wort' : 'Woerter'}), aber es ist Text vorhanden — behaupte NIEMALS, es waere "kein Text" oder "kein Wort" geschrieben worden.
- Wenn ein konkretes Thema erkennbar ist (z.B. Essen, Service, Wartezeit, Preis, Atmosphaere, Sauberkeit): geh kurz darauf ein, ehrlich und ohne etwas zu erfinden — aber kompakter als bei einer ausfuehrlichen Bewertung.
- Wenn KEIN konkretes Thema erkennbar ist (z.B. nur "Schlecht" oder "Nie wieder"): erkenne die Stimmung kurz an und frage freundlich, ob der Gast mehr dazu erzaehlen moechte.`

    return `Du bist eine Hospitality Response Engine fuer "${businessName}".
${langInstruction}

KONTEXT (Hintergrundwissen fuer dich — NIEMALS woertlich oder als ganze Saetze in die Antwort uebernehmen, sondern nur sinngemaess und falls relevant einfliessen lassen):
${context}

${nameRule}

${reviewContextBlock}

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
- Gedankenstriche (weder "—" noch " - ") — nutze Punkt oder Komma stattdessen.

SPRACHE: Nutze echte Umlaute: ä, ö, ü, ß — niemals ae, oe, ue als Ersatz.

AUSGABE — NUR dieses JSON:
{"variant1":{"label":"Direkt & Ehrlich","text":"..."},"variant2":{"label":"Ruhig & Professionell","text":"..."},"variant3":{"label":"Fokus auf Klaerung","text":"..."}}`
  }

  // ─── CONTENT MODI (POSITIVE / MIXED / NEGATIVE) ────────────────────────────

  const alreadyHandled = (reviewText.toLowerCase().includes('massnahmen') ||
    reviewText.toLowerCase().includes('reagiert') ||
    reviewText.toLowerCase().includes('versichert') ||
    reviewText.toLowerCase().includes('aufgenommen'))
    ? `WICHTIG: Der Gast erwaehnt, dass das Team bereits vor Ort reagiert hat.
Anerkenne diese Reaktion kurz — aber mache klar: sie hebt den Schrecken oder Vertrauensverlust nicht auf.
Nicht so tun als waere noch nichts passiert.`
    : ''

  // ─── STUFE 1: Analyse-Erweiterung ─────────────────────────────────────────
  // Drei zusätzliche Analyse-Dimensionen die den Ton der Antwort präzisieren.
  const analyseErweiterung = `ANALYSE DER BEWERTUNG (vor dem Schreiben intern durchführen, nicht ausgeben):
1. EMPFEHLUNG TROTZ KRITIK: Empfiehlt der Gast das Restaurant trotz genannter Mängel (explizit oder implizit)? Wenn ja, MÜSSEN ALLE DREI VARIANTEN das anerkennen — jede in ihrem eigenen Ton, aber keine darf es ignorieren.
2. EMOTIONALER KERN: Was ist der emotionale Grundton? Enttäuschung (Erwartung nicht erfüllt), Ärger (etwas ist aktiv schiefgelaufen), oder neutrale Beobachtung (sachliche Feststellung ohne emotionalen Aufwand)? Der Ton der Antwort richtet sich danach.
3. ERWARTUNGSHALTUNG: Schreibt der Gast für andere Gäste (Hinweis-Charakter) oder erwartet er eine direkte Reaktion des Restaurants? Bei reinem Hinweis-Charakter: keine übertriebene Persönlichkeit, sachlicher und kürzer. Bei Erwartung einer Reaktion: direkte Ansprache, mehr Wärme.`

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
Niemals diese Phrasen verwenden: "nehmen wir sehr ernst", "intern adressiert", "intern nachgeschaerft", "Massnahmen ergriffen", "entspricht nicht unserem Anspruch", "nicht das wofuer wir stehen wollen", "nicht das was wir uns vorstellen".
Bei positiven Bewertungen niemals: "Das freut uns sehr/riesig", "Danke fuer die tollen Worte", "zeigt uns dass wir auf dem richtigen Weg sind", "Wir hoffen dich bald wieder begruessen zu duerfen", "Vielen Dank fuer deine Bewertung/dein Feedback".
Starte bei Lob direkt mit einer echten Reaktion — nie mit einem generischen Dankeschoen.

STRENGES FORMATIERUNGS-VERBOT (MENSCHLICHER SCHREIBSTIL):
KEINE GEDANKENSTRICHE — ABSOLUTES VERBOT:
Verwende NIEMALS "–", "—" oder jeden anderen langen Bindestrich zur Satzabgrenzung oder fuer Einschuebe.
Das gilt fuer ALLE drei Varianten ohne Ausnahme.
FALSCH: "Das freut uns, – und noch mehr freut uns..."
FALSCH: "Die Lautstaerke ist real – das gehoert dazu."
RICHTIG: "Das freut uns. Und noch mehr freut uns..."
RICHTIG: "Die Lautstaerke ist real. Das gehoert dazu."
Ersetze JEDEN Gedankenstrich durch einen Punkt oder ein Komma. Immer.

VERBOT VON TAGESZEIT-BEZUEGEN: STRENG VERBOTEN: Verwende NIEMALS Woerter wie "Abend", "Abendessen", "Gruppenabend", "Nacht", "Morgen", "Mittag", "Mittagessen", "Fruehstueck" oder andere Tageszeit-Bezuege, auch wenn die Bewertung selbst eine Tageszeit nennt. Nutze IMMER neutrale Begriffe wie "Besuch", "Aufenthalt", "Zeit bei uns", "Besuch bei uns", "Erlebnis" oder "Termin bei uns".
ALLE VARIANTEN MUESSEN DIESE REGEL EINHALTEN. SCHREIBE NIEMALS "ABEND", "MORGEN" ODER "MITTAG".

VERBOT VON UEBERFLUESSIGEN EINSCHRAENKUNGEN (KAPITULATIONEN):
Nach einer klaren, souveraenen Aussage (z.B. "bei vollem Haus kann das passieren", "so sind wir nun mal", "das gehoert dazu") darf KEIN einschraenkender oder entschuldigender Halbsatz folgen.
VERBOTENE NACHTRAEGE:
- "auch wenn es nicht schoen ist"
- "auch wenn das keine Entschuldigung ist"
- "auch wenn wir uns das anders wuenschen"
- "auch wenn es aergerlich ist"
- "das ist keine Entschuldigung, aber..."
REGEL: Die Antwort stoppt nach der klaren Aussage. Punkt. Kein "aber", kein "auch wenn", keine nachgeschobene Einschraenkung.


Wenn die KI eine logische Ursache fuer eine Situation erklaert (z.B. hohe Auslastung, volles Haus, lebhafte Atmosphaere), darf sie danach NIEMALS so klingen als haette das Restaurant ein ungeloestes Problem oder muesste Besserung geloben.
VERBOTEN: "Das ist etwas, dem wir mehr Aufmerksamkeit widmen muessen" oder "Wir haben das auf dem Schirm" (wenn es sich um eine normale Gegebenheit handelt).
ERLAUBT: Die Situation als Gegebenheit stehen lassen und loesungsorientiert nach vorne blicken (z.B. einen anderen Tisch anbieten). Die KI waehlt EINE klare Linie: Entweder wir stehen zur lebhaften Atmosphaere eines vollen Hauses, ODER wir bieten eine diskrete Loesung an. Niemals beides vermischen.
Vermeide die inflationaere Nutzung von "Es tut mir leid" oder "Wir entschuldigen uns", besonders wenn es um subjektiven Geschmack, Preise oder Hausregeln geht. Das Restaurant knickt nicht ein.
Die Validierung in Satz 1 (siehe Variantenbeschreibungen unten) ist jeweils GENAU EINE Formulierung — nicht mehrere davon im Text verteilen:
- Bei DIREKT & EHRLICH: Satz 1 ist "Kann ich gut nachvollziehen, wenn das bei dir nicht so gepasst hat, wie's sollte." ODER "Ich kann total nachempfinden, dass sich das im Moment nach [passendes Gefuehl] angefuehlt haben muss." (passendes Gefuehl einsetzen, nicht dem Gast eine Emotion unterstellen sondern aus eigener Perspektive Verstaendnis zeigen). Verboten: "Es tut uns leid, dass es nicht geschmeckt hat."
- Bei RUHIG & PROFESSIONELL: Satz 1 ist "Ich kann mir gut vorstellen, dass du dir den Besuch bei uns ganz anders vorgestellt hast." ODER "Letztendlich war's nicht in Ordnung." ODER "So oder so hat's nicht gepasst." — waehle EINE davon fuer Satz 1, die anderen NICHT zusaetzlich an anderer Stelle verwenden.
- Bei FOKUS AUF KLAERUNG: siehe Variantenbeschreibung unten (eigene Slot-1-Beispiele).

Antwortstruktur:

Slot 1 - Emotionaler Stossdaempfer:
Erste emotionale Reaktion. Verstaendnis zeigen. Keine Erklaerung, keine Verteidigung.

Slot 2 - Abstraktion / Einordnung:
Das Problem auf hoeherer Ebene einordnen ohne die Beschwerde zu wiederholen.
Kategorien: Qualitaet / Ablauf / Umgang / Sorgfalt
Mehrere gleichwertige Probleme: Komplexfall-Satz, keine Aufzaehlung.

Slot 3 - Je nach Art der Kritik einen von drei Typen wählen:

SLOT 3A — etwas ist schiefgelaufen (Service, Küche, Ablauf):
Ehrlich eingestehen dass wir das im Nachhinein nicht mehr nachvollziehen können. Kein leeres Commitment, keine internen Versprechen.
Formulierungen — aufgeteilt in zwei Pools, damit Variante 2 und 3 sich garantiert NICHT ueberschneiden:
  Pool A (nur fuer Variante 2): "Das können wir im Nachhinein nicht mehr nachvollziehen." / "Damit wir das einordnen können, brauchen wir mehr."
  Pool B (nur fuer Variante 3): "Was genau passiert ist, wissen wir so nicht." / "Was da konkret schiefgelaufen ist, lässt sich im Nachhinein leider nicht mehr rekonstruieren." / "Im Nachhinein lässt sich nicht mehr genau sagen, was da bei uns nicht gestimmt hat."
NICHT: "Wir gehen der Sache intern nach" / "Wir analysieren den Vorfall" / "intern nachgeschärft" / "Das entspricht nicht unserem Anspruch" / "Das ist nicht das Erlebnis das wir bieten wollen" / "ist das ein echtes Signal für uns" / "das können wir so stehen lassen" / jede sinngemäße Variante davon.

SLOT 3B — bewusste Restaurant-Entscheidung (Preis, Lautstärke, Atmosphäre, Portionsgröße):
Das Restaurant steht souverän zu seiner Entscheidung. Kein Eingestehen, kein "das nehmen wir mit", kein "das war kein befriedigender Besuch". Die Haltung wird klar gemacht und dann ist Schluss.
Beispielsätze: "Ja, so sind wir nun mal." / "Das gehört hier irgendwie dazu." / "Das macht den Laden hier auf seine eigene Art aus."
ABSOLUT VERBOTEN nach Slot 3B: kein weiterer Satz der impliziert dass das Erlebnis des Gastes insgesamt nicht gepasst hat oder dass das Restaurant das intern aufnimmt.

SLOT 3C — Konzept-Mismatch (Gast hat etwas erwartet das nicht zum Konzept gehört):
Klar und ohne Entschuldigung benennen dass das Konzept nicht zu den Erwartungen des Gastes gepasst hat. Niemand hat einen Fehler gemacht — es ist einfach kein Match.
Beispielsätze (Ton anpassen, nicht wörtlich kopieren):
- "Du hast offensichtlich was anderes erwartet. Das ist auch völlig legitim. Wir sind halt eine andere Gastronomie."
- "Klar, wenn man das nicht weiß, kann das überraschen. Wir sind eben so."
- "Offensichtlich war das nicht das, was du dir vorgestellt hast. Das passiert. Wir sind nicht für jeden das Richtige."
- "Das machen wir hier so nicht."

Abschluss (einheitlich fuer alle Sterne):
${rating <= 2 ? '- Bei 1-2 Sternen: Kein Gespraechsangebot, keine Aufforderung zur Kontaktaufnahme.\n  FALLS Slot 3A (echter Fehler — etwas ist objektiv schiefgelaufen, z.B. kaltes Essen, lange Wartezeit, unfreundliches Personal): Jede Variante bekommt GENAU EINEN der folgenden Saetze — WORTWOERTLICH, keine Umformulierung, jeder Satz nur einmal und exklusiv fuer diese Variante:\n    - Variante 1 (Direkt & Ehrlich): "Vielleicht kriegen wir irgendwann die Chance, das besser zu machen."\n    - Variante 2 (Ruhig & Professionell): "Vielleicht bekommen wir irgendwann die Gelegenheit, einen besseren Eindruck zu hinterlassen."\n    - Variante 3 (Fokus auf Klaerung): "Vielleicht ergibt sich irgendwann die Chance fuer einen besseren Eindruck."\n  ZUSAETZLICH bei Slot 3A: Falls die Bewertung mindestens ein Problem nennt, das vor Ort sofort loesbar gewesen waere (z.B. kaltes Essen, falsche Bestellung, Essen hat sehr lange gedauert, ein Getraenk fehlt — NICHT bei: Atmosphaere/Lautstaerke, Preis-Leistung, Wartezeit auf einen Tisch trotz Reservierung, allgemeine Stimmung/Gefuehl), haenge in Variante 1 (Direkt & Ehrlich) NACH dem obigen Abschlusssatz, aber VOR dem Gruss, folgenden zusaetzlichen Satz an — WORTWOERTLICH, keine Umformulierung: "Falls mal etwas nicht passt, sag uns gern direkt vor Ort Bescheid – dann koennen wir sofort reagieren." Variante 2 und 3 bekommen diesen Zusatzsatz NICHT.\n  FALLS Slot 3B oder 3C (bewusste Entscheidung des Restaurants oder Konzept-Mismatch): Jede Variante bekommt GENAU EINEN der folgenden Saetze — WORTWOERTLICH, keine Umformulierung, jeder Satz nur einmal und exklusiv fuer diese Variante:\n    - Variante 1 (Direkt & Ehrlich): "Das letzte Wort gehoert dem naechsten Besuch."\n    - Variante 2 (Ruhig & Professionell): "Lass uns beim naechsten Besuch eine andere Geschichte erzaehlen."\n    - Variante 3 (Fokus auf Klaerung): "Wir freuen uns auf die naechste Runde."'
  : rating === 3 ? '- Bei 3 Sternen: Kein Gespraechsangebot, keine Aufforderung zur Kontaktaufnahme. Formuliere einen kurzen, eigenen Abschluss-Impuls in diese Richtung (nicht wortwoertlich uebernehmen, sondern passend zum Ton der Variante variieren), z.B.: "Lass uns beim naechsten Mal den vierten Stern gemeinsam holen." / "Lass den naechsten Besuch fuer sich sprechen." / "Wir freuen uns auf die naechste Runde."'
  : '- Bei 4-5 Sternen: Nicht notwendig, optional kurzer warmer Abschluss.'}
Kein Kontaktangebot, keine E-Mail-Adresse in den drei Varianten (siehe Regel im System-Prompt).
Direkt danach folgt NUR der Gruss (z.B. "Viele Gruesse, ..."). Kein weiterer inhaltlicher Satz zwischen Abschluss und Gruss — AUSSER dem optionalen Zusatzsatz fuer Variante 1 bei vor-Ort-loesbaren Problemen (siehe oben).

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

BEI REGELN/INFOS AUS DEM RESTAURANTPROFIL (BESCHREIBUNG):
Wenn die Beschreibung im Restaurantprofil eine konkrete Regel oder Information enthaelt, die fuer die Antwort relevant ist (z.B. Reservierungsdauer, Tischzeiten, Ablaeufe, Bestellvorgaben):
Kopiere NICHT in mehreren Varianten denselben Wortlaut. Nimm die enthaltenen Fakten (Zahlen, Zeiten, Bedingungen) exakt und unveraendert, aber formuliere fuer jede Variante einen eigenen, unterschiedlich klingenden Satz, der zum Ton der jeweiligen Variante passt. Gleiche Fakten, andere Worte.

BEI KRITIK AN WARTEZEITEN:
Zu Stosszzeiten ist immer viel Bewegung — Gaeste kommen, Gaeste gehen. Genau in diesen Momenten kann es kurz zu Verzoegerungen kommen. Erklaere das ruhig und ohne Entschuldigung.

BEI KRITIK AM ESSEN OHNE KONKRETEN MANGEL:
Nutze exakt eine dieser beiden Fragen: "War es einfach nicht dein persoenlicher Geschmack oder hat bei der Zubereitung etwas nicht gestimmt?" ODER "Schade, dass es dir nicht geschmeckt hat. Lag es einfach am persoenlichen Geschmack oder lief bei uns im Service oder in der Kueche etwas schief?"

WICHTIGE STRUKTUR-PFLICHT BEI ESSEN + PREIS-KRITIK: Wenn sowohl das Essen (Geschmack/Zubereitung) als auch der Preis kritisiert werden, MUESSEN die Varianten DIREKT & EHRLICH und RUHIG & PROFESSIONELL das PREIS-ARGUMENT enthalten (flexibles Qualitaetsargument, frische Ware, hoher Anspruch, ohne sich zu entschuldigen).
Die "Geschmacks-Weiche" (Frage: "Liegt es an Ihrem persoenlichen Geschmack oder an der Kueche?") darf NUR dann zusaetzlich gestellt werden, wenn der Grund der Essenskritik aus der Bewertung NICHT klar hervorgeht.
Beispiel fuer klaren Grund (keine Weiche): "Portion war zu klein, geschmacklich war das Essen gut" -> Grund klar (Quantitaet, nicht Qualitaet). Beispiel fuer unklaren Grund (Weiche erlaubt): "Das Essen war nicht gut" (ohne weitere Angabe).

BEI KRITIK AN PREISEN ODER PORTIONSGROESSEN:
Kern-Aussage: Unsere Preise sind bewusst so gesetzt, weil wir konsequent auf frische Ware und hohe Qualitaet setzen und hier keine Abstriche machen.
KEIN KONTAKTANGEBOT: Bei reiner Preis- oder Portionskritik KEIN Kontaktangebot machen. Es gibt nichts zu klaeren. Die Antwort endet nach der Haltung, klar und ohne Einladung zur weiteren Diskussion.
STRENGE FORMULIERUNGS-REGEL: Kopiere NICHT in jeder Variante denselben Wortlaut. Der Kernsatz ist nur inhaltliche Richtlinie. Formuliere einen kurzen, eigenen Satz in diese Richtung, der zum Ton der Variante passt (nicht wortwoertlich uebernehmen, sondern variieren), z.B.:
- "Ja, so sind wir nun mal."
- "Das gehoert hier irgendwie dazu."
- "Das macht den Laden hier auf seine eigene Art aus."

BEI KRITIK AN LAUTSTAERKE ODER AMBIENTE:
Je nach Auslastung kann es in einem gut besuchten Restaurant laut und turbulent werden. Kurz anerkennen, nicht dramatisieren.
WICHTIG: Die Antwort endet nicht bei der Bestätigung. Nach der Anerkennung kommt immer ein konstruktiver Vorwärtssatz — z.B. dass der Gast beim nächsten Besuch oder bei der Reservierung kurz Bescheid geben soll, dann schaut man was sich machen lässt (ruhigerer Platz, ruhigere Zeit). Kein Aufzählen von Optionen — nur ein einziger natürlicher Satz. Die Antwort soll dem Gast das Gefühl geben, dass es beim nächsten Mal besser werden kann, nicht dass er einfach wegbleiben soll wenn ihm Lautstärke stört.`

  // User-Message: nur die Daten — Bewertung + Kontext + Aufgabe
  const userMessage = `${langInstruction}

RESTAURANT: ${businessName}

KONTEXT (Hintergrundwissen fuer dich — NIEMALS woertlich oder als ganze Saetze in die Antwort uebernehmen, sondern nur sinngemaess und falls relevant einfliessen lassen):
${context}

${nameRule}

${analyseErweiterung}

BEWERTUNG (${rating} Sterne):
"${reviewText}"

${alreadyHandled}

Abschluss: Waehle passend zum Ton "Viele Grüße, ${signature}" oder "Herzliche Grüße, ${signature}" oder "Beste Grüße, ${signature}"

Schreibe 3 Varianten. Fuer ALLE gilt strikt: ${duSieAnrede}. ${anredeHinweis}
WICHTIG zur Grossschreibung: Alle Begruessungen enden mit einem Komma ("Hallo ${firstNameCapitalized},"). Das Wort direkt danach ist die Fortsetzung DESSELBEN Satzes und wird klein geschrieben (z.B. "Hallo ${firstNameCapitalized}, ich kann mir gut vorstellen..." oder "Hallo ${firstNameCapitalized}, kann mir gut vorstellen..." — NICHT "Hallo ${firstNameCapitalized}, Ich kann..." oder "Hallo ${firstNameCapitalized}, Kann...").

Variante 1 – Direkt & Ehrlich: Locker, direkt, ehrlich. Startet mit "Hi ${firstNameCapitalized}," oder "Hey ${firstNameCapitalized}," (kein Name bekannt: "Hi," oder "Hey,").
Falls die Bewertung Kritik enthaelt: Satz 1 (direkt nach der Begruessung) MUSS Slot 1 sein — eine kurze, lockere Gefuehls-Validierung, z.B. "Kann ich gut nachvollziehen, wenn das bei dir nicht so gepasst hat, wie's sollte." oder "Ich kann total nachempfinden, dass sich das im Moment nach [passendes Gefuehl, z.B. Frust/Enttaeuschung] angefuehlt haben muss." (passendes Gefuehl einsetzen, nicht woertlich "Frust/Enttaeuschung" schreiben).
Satz 2 ordnet mehrere Kritikpunkte dann als Gesamteindruck ein — NIEMALS einzeln aufzaehlen, auch nicht abstrakt, z.B. "das war ein Besuch, der auf ganzer Linie nicht funktioniert hat" — ohne die einzelnen Punkte zu wiederholen. KEINE abstrakte "Wenn X nicht stimmt/funktioniert, bleibt davon Y uebrig"-Konstruktion (z.B. nicht "Wenn beides nicht stimmt, weder Kueche noch Service, bleibt davon nichts Gutes uebrig"). Vermeide in Satz 2 "tut mir leid" / "tut uns leid" — das ist nicht der Ton von Variante 1. Nutze stattdessen "schade" oder "aergerlich", z.B. "...und das ist einfach nicht in Ordnung" oder "...das ist aergerlich."
Variante 2 – Ruhig & Professionell: Empathisch, ruhig, Mensch zuerst. Startet mit "Hallo ${firstNameCapitalized}," (kein Name bekannt: "Hallo,")
Falls die Bewertung Kritik enthaelt: Satz 1 (direkt nach der Begruessung) ist Slot 1 — GENAU EINE der folgenden Validierungen, nicht mehrere: "Ich kann mir gut vorstellen, dass du dir den Besuch bei uns ganz anders vorgestellt hast." ODER "Letztendlich war's nicht in Ordnung." ODER "So oder so hat's nicht gepasst."
Satz 2 ordnet den Gesamteindruck konkret und persoenlich ein — KEINE abstrakte "Wenn X nicht funktioniert, bleibt davon Y uebrig"-Konstruktion. Stattdessen z.B. "So ein Gesamteindruck bleibt haengen." oder aehnlich konkret formuliert.
Satz 3 ist die ehrliche Slot-3A-Einordnung — waehle EINE Formulierung aus Pool A (siehe "SLOT 3A" oben), mit natuerlichem Uebergang (z.B. "Ehrlich gesagt,"), als eigener klarer Satz. Baue daraus KEINEN Bandwurmsatz mit der Validierung aus Satz 1 — also NICHT "Letztendlich war's nicht in Ordnung, und das koennen wir nicht nachvollziehen, ohne mehr zu wissen" o.ae.
Variante 3 – Fokus auf Klaerung: Kuerzer als V1/V2 — aber zusammenhaengend formuliert, KEINE Aneinanderreihung kurzer, abgehackter Saetze ("Punkt. Punkt. Punkt."). Faustregel: 2-3 Saetze (bzw. Teilsaetze, durch "und"/Komma verbunden), die sich wie ein einzelner zusammenhaengender Gedanke lesen, nicht wie eine Checkliste. Startet mit "Hi ${firstNameCapitalized}," oder "Hallo ${firstNameCapitalized}," (kein Name bekannt: "Hi," oder "Hallo,"). KEIN E-Mail-Satz und KEIN Kontaktangebot (Kontaktaufnahme ist ausschliesslich Teil der separaten Recovery-Antwort bei 1-2 Sternen, nicht Teil dieser drei Varianten). Die Antwort endet stattdessen mit dem Abschluss gemaess der "Abschluss (einheitlich fuer alle Sterne)"-Regel, gefolgt vom Abschlussgruss.
Falls die Bewertung Kritik enthaelt: Der erste Satz (direkt nach der Begruessung) MUSS Slot 1 sein — eine kurze, natuerliche Gefuehls-Validierung aus Gast-Perspektive, z.B. "Klingt, als haette dich der Besuch ziemlich geaergert." oder "Kann mir gut vorstellen, dass sich das nicht gut angefuehlt hat." Der zweite Satz ist die ehrliche Einordnung — waehle EINE Formulierung aus Pool B (siehe "SLOT 3A" oben) — beginne ihn mit einem natuerlichen Uebergang wie "Ehrlich gesagt," oder "Was da genau passiert ist,". Baue daraus KEINEN grammatisch verschachtelten Bandwurmsatz mit dem ersten Satz — zwei kurze, klare Saetze mit natuerlichem Anschluss sind besser als ein verschachtelter. Keine Formulierungen aus Restaurant-Perspektive wie "den wir uns wuenschen", "der Eindruck, den wir hinterlassen wollen" o.ae. — diese sind verboten.
WICHTIG: Beziehe dich bei Hausregeln NICHT auf den spezifischen Tag aus der Bewertung (z.B. "Samstag") sondern auf die generelle Regel wie sie im Profil steht.

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
  signature: string
): string {
  return `Du bist ein strenger Qualitaetspruefer fuer Restaurant-Antworten auf Google-Bewertungen.
Deine einzige Aufgabe: Pruefen und urteilen. Du schreibst NICHTS neu.

BEWERTUNG DES GASTES:
"${reviewText}"

ZUR PRUEFUNG:
Variante 1 (${variants[0]?.label}): "${variants[0]?.text}"
Variante 2 (${variants[1]?.label}): "${variants[1]?.text}"
Variante 3 (${variants[2]?.label}): "${variants[2]?.text}"

PRUEFE JEDE VARIANTE AUF DIESE 6 PUNKTE:

1. NACHERZAEHLUNG
Wiederholt die Antwort den Fehler oder die Kritik woertlich?
Beispiel schlecht: "Dass Sie 45 Minuten warten mussten und die Toiletten zu klein waren..."
Beispiel gut: Einordnung als Gesamteindruck ohne Details zu nennen.
→ SCHWACH wenn ja.

2. VERBOTENE PHRASEN (corporate-speak)
Enthaelt die Antwort: "intern nachgeschaerft" / "nehmen wir sehr ernst" / "entspricht nicht unserem Anspruch" /
"Massnahmen ergriffen" / "Team sensibilisiert" / "Konsequenzen gezogen" / "Das ist nicht das Erlebnis das wir bieten wollen"?
→ SCHWACH wenn ja.

3. VERBOTENE OPENER (Dankesfloskeln)
Beginnt die Antwort (nach der Begruessung) mit einer dieser Formeln:
"Vielen Dank fuer Ihre/deine Bewertung", "Vielen Dank fuer Ihr/dein Feedback",
"Danke fuer die Einschaetzung", "Danke fuer Ihr/dein Feedback",
"Es freut uns sehr", "Das freut uns sehr", "Wir freuen uns ueber Ihr/dein Feedback",
"Vielen Dank fuer Ihre/deine ausfuehrliche Einschaetzung"?
→ SOFORT SCHWACH. Keine Ausnahme. Das ist das haeufigste und storendste Problem.

4. EMPFEHLUNG IGNORIERT
Hat der Gast trotz Kritik das Restaurant empfohlen oder positiv geendet, und die Antwort ignoriert das komplett?
→ SCHWACH wenn ja.

5. GEDANKENSTRICHE, MENSCHLICHKEIT UND KAPITULATIONEN
Enthaelt die Antwort einen Gedankenstrich ("–" oder "—")? → SOFORT SCHWACH. Keine Ausnahme.
Fehlende Subjekte ("Verstehen Ihren Aerger" statt "Wir verstehen") → SCHWACH.
Klingt es wie Kundenservice-Text statt wie ein echter Gastronom? → SCHWACH.
Variante 3 darf kurz sein (max. 3 Saetze). Kurz ist kein Fehler.
Enthaelt die Antwort eine ueberfluessige Einschraenkung nach einer klaren Aussage?
SOFORT SCHWACH — keine Ausnahme — wenn einer dieser Saetze oder eine sinngemaeße Variante davon vorkommt:
"auch wenn es nicht schoen ist" / "auch wenn das keine Entschuldigung ist" / "auch wenn es aergerlich ist" / "das ist keine Entschuldigung, aber..." / "Das ist keine Entschuldigung, aber..."
→ SOFORT SCHWACH. Keine Ausnahme. Keine zweite Chance. Eine souveraene Aussage braucht keinen einschraenkenden Nachsatz.

6. SINGULAR/PLURAL-KONSISTENZ
Spricht die Antwort mal als "ich" und mal als "wir", obwohl die Signatur ein Team ist?
Beispiel schlecht: "da gebe ich Ihnen recht" wenn die Signatur "Das Team von ..." ist.
→ SCHWACH wenn ja.

7. FALSCHER SLOT-3-TYP
Prüfe: Welche Art von Kritik liegt vor?
- Etwas ist schiefgelaufen (Service, Küche, Ablauf) → Slot 3A erwartet: ehrliches "wir wissen es nicht"
- Bewusste Entscheidung des Restaurants (Preis, Lautstärke, Atmosphäre) → Slot 3B erwartet: souveräne Haltung, kein Eingestehen
- Konzept-Mismatch (Gast erwartete etwas anderes) → Slot 3C erwartet: klare Benennung ohne Entschuldigung

Typische Fehler:
- Bei Preis/Lautstärke-Kritik endet die Antwort mit "das ist ein Signal für uns" oder "das war kein befriedigender Besuch" → SCHWACH (Slot 3B verletzt)
- Bei echtem Service-Fehler endet die Antwort mit "Ja, so sind wir nun mal" → SCHWACH (falscher Slot)
- Bei Konzept-Mismatch entschuldigt sich die Antwort oder verspricht Besserung → SCHWACH (Slot 3C verletzt)
→ SCHWACH wenn falscher Typ verwendet.

AUSGABE — NUR dieses JSON, kein anderer Text:
{
  "variant1": { "ok": true, "reason": "" },
  "variant2": { "ok": true, "reason": "" },
  "variant3": { "ok": true, "reason": "" }
}

Wenn eine Variante schwach ist: "ok": false und "reason" erklaert in einem Satz was genau falsch ist.
Wenn eine Variante gut ist: "ok": true und "reason": ""`
}

// ─── FREIE VARIANTE (Test) ──────────────────────────────────────────────────
// Wie die Recovery-Variante strukturell (freier Prompt, keine Slot-Struktur),
// aber ohne die "Notfall/Deeskalation"-Einschraenkung. Laeuft fuer JEDE Bewertung.
function buildFreePrompt(reviewText: string, stars: number, reviewerName: string, settings: any, analysis?: {count: number, points: string[], categories: string[], forceSummarize: boolean}): string {
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

  const duSie = salutation === 'Du' ? 'Du/Dein (Duzen). Schreibe "du", "dir", "dein", "dich" klein.' : 'Sie/Ihr (Siezen)'
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

  const freeContext = [
    `Restaurant: ${businessName}`,
    description          && `Beschreibung: ${description}`,
    restaurantType       && `Typ: ${restaurantType}`,
    cuisineType          && `Kueche: ${cuisineType}`,
    priceRange           && `Preisklasse: ${priceRange}`,
    restaurantAtmosphere && `Atmosphaere: ${restaurantAtmosphere}`,
    uniqueSellingPoints  && `Besonderheiten: ${uniqueSellingPoints}`,
  ].filter(Boolean).join('\n')

  const systemPrompt = `Erstelle EINE ehrliche, persoenliche Antwort auf eine Google-Bewertung fuer ein Restaurant.
Schreibe wie ein aufmerksamer Gastronom, der die Bewertung selbst gelesen hat. Nicht wie Kundenservice, PR-Agentur oder KI.

Grundregeln:
Keine feste Struktur, kein Pflichtaufbau. Schreib frei, so wie es zu DIESER Bewertung passt.
Beschwerden oder Lob nicht einfach nacherzaehlen oder wortwoertlich wiederholen.
Keine Ursachen erfinden, die nicht in der Bewertung oder im Profil stehen.
Keine leeren Floskeln.
Natuerliche Sprache, kurze bis mittlere Saetze. Maximal zwei Kommas pro Satz. Wenn mehr noetig waeren, den Satz aufteilen.
Nutze echte Umlaute: ä, ö, ü, ß — niemals ae, oe, ue als Ersatz.
Nutze fuer alle Beschreibungen (Typ, Atmosphaere, Konzept) ausschliesslich die Angaben aus dem Restaurantprofil.

KEINE GEDANKENSTRICHE — ABSOLUTES VERBOT:
Verwende NIEMALS "–", "—" oder jeden anderen langen Bindestrich zur Satzabgrenzung oder fuer Einschuebe.
Ersetze jeden Gedankenstrich durch einen Punkt oder ein Komma.

KEINE DOPPELPUNKT-UEBERSCHRIFTEN: Nutze niemals einen Doppelpunkt, um einen neuen Gedanken wie eine Ueberschrift oder ein Label einzuleiten (z.B. "Zur Tischzeit:", "Was ich mir zu Herzen nehme:", "Zu dem Hinweis:"). Schreib in durchgehenden Saetzen.

SPRECHSTIL STATT SCHREIBSTIL: Vermeide literarische Verstaerker-Konstruktionen wie "kein einziges X", "nicht ein X", "schlichtweg", "voellig". Pruefe bei jedem Satz: Wuerde ein Gastronom das im persoenlichen Gespraech GENAUSO SAGEN, oder klingt das nach geschriebenem Text?

AMBIGES "AUCH" VERMEIDEN: Wenn du eine Regel oder einen Grund erklaerst, vermeide ein "auch", das sich auf nichts Konkretes bezieht (z.B. "wenn du auch essen moechtest" — auch im Vergleich zu was?). Schreibe stattdessen direkt, was gilt, z.B. "wenn du bei uns essen moechtest" oder "wenn du etwas essen moechtest".

WORTWAHL BEI PERSONAL VOR ORT: Wenn es um Service/Personal im Restaurant geht (nicht Telefon/E-Mail/online), vermeide Fernkommunikations-Woerter wie "sich melden", "Rueckmeldung", "kontaktieren". Nutze stattdessen Woerter fuer persoenliche Anwesenheit — z.B. vorbeikommen, an den Tisch kommen, nach dem Rechten schauen, da sein, sich kuemmern — und baue sie in deinen eigenen Satz ein. Diese Begriffe decken oft schon mehrere Aspekte gleichzeitig ab (Anwesenheit + Aufmerksamkeit) — du musst nicht zusaetzlich noch eine zweite Handlung ergaenzen.

UEBERGAENGE ZWISCHEN GEDANKEN: Wenn die Antwort mehrere unterschiedliche Gedanken enthaelt (z.B. Lob, Sachinfo zu einer Regel, Reaktion auf die Art der Kommunikation), verbinde diese mit natuerlichen Uebergangsworten oder -saetzen (z.B. "Dazu", "Was [Thema] angeht", "Davon unabhaengig", "Gleichzeitig", "Ansonsten"). Reihe sie nicht unverbunden aneinander.

FALLS NICHTS POSITIVES ERWAEHNT WIRD: Erfinde KEIN Lob, das nicht in der Bewertung steht. Beginne in diesem Fall direkt mit einer ehrlichen Reaktion auf das eigentliche Anliegen, ohne erzwungenen positiven Einstieg.

VERBOT VON TAGESZEIT-BEZUEGEN: Verwende NIEMALS Woerter wie "Abend", "Abendessen", "Gruppenabend", "Nacht", "Morgen", "Mittag", "Mittagessen", "Fruehstueck" oder andere Tageszeit-Bezuege, auch wenn die Bewertung selbst eine Tageszeit nennt. Nutze stattdessen "Besuch", "Aufenthalt", "Zeit bei uns" oder "Erlebnis".

VERBOTENE PHRASEN: Niemals "vielen dank fuer ihr/dein feedback", "wir nehmen das sehr ernst", "ich nehme das ernst", "das nehme ich ernst", "intern adressiert", "intern nachgeschaerft", "massnahmen ergriffen", "team sensibilisiert", "entspricht nicht unserem anspruch", "es tut uns/mir leid" als Standard-Einstieg, "frustrierend", "das nehme ich mit", "das nehmen wir mit", "gib uns eine chance", "gib uns noch eine chance", "eine zweite chance", "nicht auf die leichte schulter nehmen" oder sinngemaesse Varianten davon.

Bei Hausregeln/Policy-Themen: Position freundlich und offen erklaeren, ohne sich dafuer zu entschuldigen. Kein Rechtfertigungston, kein Tuersteherton.
Bei echten Fehlern: Verantwortung uebernehmen in ruhigem Ton. Nicht einzelne Mitarbeitende beschuldigen. Distanzierung vom Fehlverhalten klingt wie "so soll das bei uns nicht laufen" oder "da scheint bei uns wohl etwas schiefgelaufen zu sein" (bei konkreten, glaubwuerdigen Vorwuerfen) oder "das klingt so, als waere da bei uns etwas nicht rundgelaufen" (bei vageren Eindruecken). Nicht wie ein Urteil ("das kann ich nicht gutheissen", "das ist nicht akzeptabel") und nicht wie Abstreiten ("das gehoert nicht zu uns", "so etwas machen wir nicht").
Bei Lob: Ehrlich und konkret freuen, nicht uebertrieben.

KEIN OEFFENTLICHES STRUKTURVERSPRECHEN (gilt fuer ALLE Kategorien und immer): Versprich NIEMALS, etwas Strukturelles/Operatives allgemein zu aendern oder zu verbessern (z.B. "wir sorgen fuer bessere Luftzirkulation", "wir aktualisieren die Fotos", "wir achten ab jetzt bei jedem Tisch darauf"). Solche Saetze sind oeffentlich nicht ruecknehmbar und wirken unglaubwuerdig, wenn der naechste Gast das Gegenteil erlebt. Erlaubt sind nur: (1) eine im Profil bereits bestehende Loesung, oder (2) eine persoenliche Geste fuer den naechsten Besuch DIESES Gastes. Wenn keines von beiden passt, ist eine ruhige Einordnung ohne zusaetzlichen Versprechen-Satz besser als ein erzwungenes Strukturversprechen.

FOKUS AUF DAS ERLEBNIS (gilt fuer die GESAMTE Antwort, jeden Satz): Beziehe dich durchgehend auf das tatsaechliche Erlebnis/Gefuehl (z.B. Gedraenge, Enge, Laerm), NICHT auf das funktionale Ziel, das dadurch erschwert wurde (z.B. "an ein Getraenk kommen", "einen Platz finden"). Das Ziel ist meist nur der Kontext aus der Bewertung — die eigentliche Beschwerde ist das Erlebnis selbst. Gilt fuer Validierung UND Abschluss gleichermassen.

GEFUEHL VALIDIEREN VOR DER EINORDNUNG: Bevor du eine Regel erklaerst, Verantwortung uebernimmst oder auf Geschmack eingehst, formuliere einen einzigen, freien Satz der zeigt dass der Gast gehoert wurde. Keine festen Vorlagen — jedes Mal neu und passend zur konkreten Bewertung formulieren.

Drei Regeln fuer diesen Satz:
1. Validiere das GEFUEHL IM MOMENT, nicht die Schlussfolgerung des Gastes. Wenn der Gast sagt "ich fuehlte mich nicht willkommen" — validiere NICHT diese Schlussfolgerung (das wuerde sie bestaetigen). Validiere das engere Gefuehl darunter: die Verwirrung, die Ueberraschung, den unangenehmen Moment der Abweisung.
2. Beschreibe wie etwas BEIM GAST hinterlassen oder erlebt wurde — nie dass etwas objektiv falsch war. Wahrnehmungs-Verben: hinterlassen, wahrgenommen, erlebt, so empfunden, in Erinnerung geblieben. Diese Verben beschreiben IMMER die Perspektive des Gastes (wie etwas bei IHM gelandet ist), NIE die Perspektive des Restaurants.
  FALSCH: "...ist bei uns angekommen" / "...ist bei mir angekommen" (klingt wie Beschwerdestelle: "Ihr Feedback ist eingegangen")
  RICHTIG — folge dieser Struktur, variiere jedes Mal, NICHT woertlich uebernehmen:
  "Dass + [Gefuehl/Eindruck/Wahrnehmung] + [Wahrnehmungs-Verb], finden wir schade / bedauern wir."
  Beispiele zur Inspiration:
  - "Dass bei dir dieser Eindruck entstanden ist, finden wir schade."
  - "Dass du deinen Besuch so erlebt hast, bedauern wir."
  - "Schade, dass dein Besuch dieses Gefuehl hinterlassen hat."
  Variiere bei jeder Antwort: anderes Wahrnehmungs-Verb, andere Satzstellung, anderer Abschluss (schade/bedauern). Nie zweimal denselben Satz.
3. VERBOTEN: "verstehen", "nachvollziehen", "nachempfinden", "verstaendlich" — diese Verben implizieren Zustimmung oder Schuld.

NICHT UEBERPRUEFBARE BEHAUPTUNGEN: Wenn die Bewertung eine spezifische, nicht ueberpruefbare Behauptung enthaelt (z.B. "wurde nicht gefragt", "keine Erklaerung bekommen"), diese niemals oeffentlich bestaetigen oder bestreiten. Nutze bedingte Sprache ("falls das so war", "sollte das im Gespraech nicht klar genug erklaert worden sein") und lenke den Fokus auf die Loesung statt auf den strittigen Einzelfakt.

ANALYSE VOR DEM SCHREIBEN (intern durchfuehren, NICHT in der Antwort ausgeben):
1. Welche Kritikpunkte enthaelt die Bewertung? Identifiziere jeden einzelnen.
2. In welche Kategorie faellt jeder Punkt?
   - Kat A (Konzept/strukturell): Hausregeln, Lautstaerke bei vollem Haus, Tischvergabe, Oeffnungszeiten
   - Kat B (echter Fehler): Wartezeiten, falscher Tisch, unfreundlicher Service, vergessene Bestellungen
   - Kat C (Geschmack/Wahrnehmung): zu scharf, zu wenig Portion, "nicht gemuetlich"
3. Wenn ALLE Punkte in EINE Kategorie fallen: behandle die Bewertung nach dieser Kategorie.
4. Wenn die Punkte in MEHRERE Kategorien fallen:
   - Fasse Kat-B-Fehler in EINEM Satz zusammen ("da scheint bei uns einiges nicht rundgelaufen zu sein"), NICHT einzeln aufzaehlen. Die Zusammenfassung ist der KOMPLETTE Satz — kein Doppelpunkt danach, keine Liste danach.
   - Erklaere Kat-A-Sachen ehrlich als eigenen Gedanken ("wenn bei uns viel los ist, kann es schon mal lauter werden")
   - Kat-C-Punkte koennen mit einem kurzen Satz anerkannt werden, ohne sich zu entschuldigen
   - Maximal 2-3 Gedanken fuer den gesamten Mittelteil, nicht jeden Punkt einzeln ansprechen
   - Wenn Kat-A-Erklaerung und Kat-B-Zusammenfassung aufeinander folgen: verbinde sie mit "und", nicht mit "aber". Beides sind Punkte, die den Gast gestoert haben. "Aber" erzeugt einen falschen Gegensatz.
   VORRANG-REGEL: Die Einzelfall-Regeln aus Kat B und C ("konkretes Merkmal benennen", "das Merkmal aufgreifen") gelten NUR bei Bewertungen mit EINEM oder ZWEI Kritikpunkten. Bei drei oder mehr Kritikpunkten hat ZUSAMMENFASSEN immer Vorrang vor konkretem Benennen.

KATEGORIE A - KONZEPT ODER STRUKTURELL FIX: Wenn die Kritik etwas betrifft, das durch die Art des Ladens oder eine feste Regel bedingt ist und sich grundsaetzlich nicht aendert (z.B. Tischzeit-Limit, Lage eines bestimmten Tisches, Oeffnungszeiten, Lautstaerke oder Temperatur bei vollem Haus):
- Nenne einen sachlichen, neutralen Grund, WARUM es so ist. NIEMALS "andere Gaeste moegen das" (wirkt wie eine Abwertung der Kritik). NICHT entschuldigen fuer etwas, das richtig war.
- Die Hausregel-Erklaerung steht im Mittelteil als eigener, kurzer Satz. Die konkreten Alternativen (z.B. Bar, Stehtische, Reservierungstipp) gehoeren in den ABSCHLUSS, nicht in denselben Satz wie die Regel. Formuliere Alternativen als Moeglichkeit ("koennen", "kannst du"), nicht als Vorschrift ("werden").
- Pruefe zuerst: Tritt das Problem NUR bei hoher Auslastung auf (z.B. Laustaerke, Temperatur steigen mit mehr Gaesten), oder ist es eine FESTE Eigenschaft des Raums/Konzepts, die UNABHAENGIG von der Auslastung besteht (z.B. Tischabstand/Enge, Lage eines Tisches)?
  - Bei AUSLASTUNGSABHAENGIGEN Gruenden (laut, warm etc.): bleibe bei dem einfachen Adjektiv aus der Bewertung — keine Nominalisierung ("Laermpegel") oder Passiv-Konstruktion ("hat den Besuch getruebt/beeintraechtigt"). Formuliere als nicht-absoluten GRUND-SATZ, z.B. "Kann sein, dass das fuer den einen oder anderen [laut/warm] wirkt, wenn viel los ist." WICHTIG: Dieser Grund-Satz ERSETZT NICHT die separate Gefuehl-Validierung aus Schritt 1 — beide Saetze werden benoetigt, in dieser Reihenfolge: erst Gefuehl validieren (z.B. "kann verstehen, dass sich das fuer den einen oder anderen [warm/stickig] anfuehlt"), dann dieser Grund-Satz.
  - WENN die Bewertung die Auslastung/Enge bereits SELBST beschreibt (z.B. "voll", "Gedraenge", "Schlange"): "wenn viel los ist" NICHT zusaetzlich als Grund anhaengen — das waere redundant ("es ist voll, weil viel los ist"). Formuliere stattdessen eine direkte, ehrliche Bestaetigung als GRUND-SATZ, die den in der Bewertung genannten Ort/Bereich verwendet (z.B. "Kann an der Bar/Garderobe/am Eingang schon mal eng werden, wenn's richtig voll ist." — den jeweils passenden Ort aus der Bewertung einsetzen, NICHT immer "Bar"). WICHTIG: Dieser Grund-Satz ERSETZT NICHT die separate Gefuehl-Validierung aus Schritt 1 — beide Saetze werden benoetigt, in dieser Reihenfolge: erst Gefuehl validieren, dann dieser Grund-Satz.
  - Bei FESTEN Eigenschaften (z.B. Tischabstand): KEIN Bezug auf "viel los ist". Stattdessen als bewusste Konzept-Entscheidung benennen.
    TONFALL FUER DIESEN SATZ: Das Wort "Konzept" (oder "Philosophie") ist erlaubt und erwuenscht — es signalisiert dem Gast, dass es sich um eine grundsaetzliche, faire Regel handelt und nicht um eine Schikane gegen ihn persoenlich. VERBOTEN ist aber ein knapper, abgehakter Tonfall, der wie eine Rechtfertigung oder ein Tuer-zu-Moment wirkt (z.B. "Das ist halt so bei uns." / "So sind wir nun mal." / "Das ist unser Konzept." als kompletter, abschliessender Satz). Stattdessen soll der Satz wie ein offenes Teilen einer Eigenheit klingen, das Verstaendnis erzeugt statt sich zu verteidigen — die Konzept-Nennung und der konkrete Grund/Nutzen gehoeren in EINEN gemeinsamen Atemzug, nicht als zwei getrennte Saetze (Behauptung + Begruendung), sondern als ein einziger, warmer Gedanke.
    BEISPIELE (Ton uebernehmen, nicht woertlich kopieren):
    - "Die Tische stehen bei uns bewusst eng beieinander, das ist Teil unseres Konzepts fuer eine lebendige, gesellige Atmosphaere."
    - "Das gehoert zu unserer Philosophie hier: lieber eng und lebendig als steril und leer."
    FALSCH (zu knapp, wirkt wie Rechtfertigung): "Das ist halt unser Konzept." / "So sind wir nun mal, das ist unser Konzept."
- ABSCHLUSS fuer Kategorie A:
  Der Abschluss-Satz wiederholt NICHT die Erklaerung aus dem Mittelteil. Er leitet daraus die KONKRETEN ALTERNATIVEN ab, die der Gast fuer seinen naechsten Besuch hat.
  PFLICHT: Pruefe im Restaurantprofil, welche Optionen dem Gast offenstehen (z.B. verschiedene Bereiche wie Bar/Stehtische/normale Tische, Reservierung vs. spontan vorbeikommen, unterschiedliche Angebote je nach Bereich, akzeptierte Zahlungsmethoden, ruhigere Zeiten). Nenne diese Alternativen konkret und in eigenen Worten.
  KEIN ZWANG: Formuliere Empfehlungen, keine Pflichten. "Lohnt sich kurz vorher anrufen" statt "du musst reservieren".
  NORMALFALL (Gast kommt wieder oder sagt nichts dazu): Nenne den konkreten Tipp direkt, z.B. "Fuer ein Getraenk kannst du auch spontan vorbeikommen, und wenn du richtig essen moechtest, lohnt sich kurz vorher anrufen, damit ein Tisch frei ist."
  SONDERFALL (Gast sagt explizit, er kommt nicht wieder): Genau derselbe konkrete Tipp, nur mit "Falls es dich doch nochmal zu uns zieht:" davor. Tuer offen lassen, nicht betteln.
  FALSCH: "Wir wuerden uns trotzdem freuen, dir eine zweite Chance zu zeigen." (betteln)
  FALSCH: "Komm gerne nochmal vorbei, dann zeigen wir dir, wer wir wirklich sind." (generische Floskel ohne Bezug)
  FALSCH: "Komm gerne nochmal vorbei." (leer, keine konkrete Handlungsoption)
  WENN das Profil KEINE konkreten Alternativen hergibt: pruefe ob das Problem auslastungsabhaengig ist. Wenn ja: unverbindlicher Tipp zu ruhigeren Zeiten, z.B. "Zu ruhigeren Zeiten ist's da meist entspannter." Wenn auch das nicht passt (dauerhafte/bauliche Sache, z.B. fehlende Barrierefreiheit): KEINEN Abschluss-Satz erzwingen — Validierung + Grund ist eine vollstaendige Antwort.
  WENN die Bewertung ZUSAETZLICH echte Service-Fehler enthaelt (Kat B), die NICHT zur Hausregel gehoeren (z.B. Umgangston, widerspruechliches Verhalten): Diese werden im Mittelteil separat angesprochen. Der Abschluss nennt die konkreten Alternativen aus dem Profil.
  DIREKTE ANREDE: Sprich den Gast in der GESAMTEN Antwort IMMER direkt an (du/Sie), NIEMALS generisch in der dritten Person ("wer", "man"). Gilt fuer Mittelteil UND Abschluss.
  FALSCH: "...und wer essen moechte, lohnt sich kurz vorher anzurufen." (dritte Person, unpersoenlich)
  RICHTIG: "...und wenn du bei uns essen moechtest, lohnt sich kurz vorher anrufen." (direkte Anrede)
  In ALLEN Faellen: KEINE generischen Einladungen ohne konkreten Bezug zum Profil.

KATEGORIE B - ECHTER FEHLER, EINZELFALL: Wenn die Kritik einen objektiven Fehler beschreibt, der beim naechsten Besuch anders laufen koennte (z.B. falsches Gericht, lange Wartezeit ohne Grund, unfreundliches Personal) und NICHT durch Konzept/Policy bedingt ist:
- Verantwortung uebernehmen, OHNE zu rechtfertigen. Suche KEINE Auslastungs-Begruendung (z.B. "bei vollem Haus dauert's mal laenger"), wenn die Bewertung das Gegenteil beschreibt (z.B. "Laden war leer", "kaum was los").
- Pruefe: Hat der Gast das Problem bereits VOR ORT angesprochen und wurde es geloest (z.B. "Hab's der Kellnerin gesagt, dann kam er richtig")? Dann KEINE Geste/Aufforderung anbieten ("sag uns Bescheid" o.ae.) — das waere zirkulaer, der Gast hat das schon getan. Stattdessen reicht Validierung + Verantwortung, optional eine kurze Anerkennung, dass die Korrektur vor Ort gepasst hat (diese Anerkennung uebernimmt die ABSCHLUSS-Funktion fuer diese Antwort, auch wenn sie gleichzeitig auf Positives aus der Bewertung eingeht). Haenge danach KEINEN weiteren Ausblick-Satz an (z.B. "Beim naechsten Mal laeuft das reibungsloser") — die ABSCHLUSS-Funktion ist mit der Anerkennung bereits erfuellt. AUSNAHME: Falls die Bewertung trotz des Fehlers insgesamt positiv/ausgewogen bleibt (z.B. "war trotzdem ein schoener Abend"), kann die Antwort statt- oder zusaetzlich mit einem ehrlichen Dank fuer diese faire Einordnung schliessen, z.B. "Danke, dass du das so fair einordnest." — das ist eine konkrete Reaktion auf DIESE Bewertung, kein generisches Versprechen oder Abschiedsfloskel.
- Falls der Gast NICHTS vor Ort gesagt hat: pruefe, WANN der Gast das Problem realistischerweise haette merken/melden koennen:
  - Wenn das Problem WAEHREND des Besuchs hätte auffallen können (z.B. falsches Gericht, lange Wartezeit) UND der Gast aktiv etwas tun koennte, das dem Restaurant hilft (kurz Bescheid geben, waehrend man noch da ist): biete eine entsprechende Geste an, z.B. "Sprich uns einfach kurz an, dann schauen wir sofort, wo's hakt" oder "Wink uns kurz, dann kuemmern wir uns gleich". Vermeide unnatuerliche Konstruktionen wie "auf uns zuschauen". Diese Geste uebernimmt die ABSCHLUSS-Funktion.
  - Falls das NICHT passt — z.B. weil das Problem laut Bewertung ERST SPAETER/NACH DEM BESUCH aufgefallen ist (z.B. "erst zu Hause aufgefallen"), oder weil der Gast bei diesem Fehler ohnehin nichts haette pruefen/tun koennen (z.B. einfacher Bestell-/Service-Fehler): biete KEINE Geste an, die voraussetzt, dass der Gast noch vor Ort ist oder beim naechsten Mal selbst aufpassen muss (das wuerde Verantwortung auf den Gast verschieben). Schliesse stattdessen mit einer kurzen, ehrlichen Einladung fuer den naechsten Besuch ab, die Verantwortung anerkennt, ohne ein konkretes Strukturversprechen zu machen, z.B. "Komm gerne nochmal vorbei, das geht besser, das wissen wir." (Anrede/Du-Form entsprechend anpassen). Diese Einladung uebernimmt die ABSCHLUSS-Funktion.

KATEGORIE C - SUBJEKTIV/GESCHMACK/WAHRNEHMUNG: Wenn die Kritik eine persoenliche Geschmacks- oder Wahrnehmungssache beschreibt (z.B. "fuer meinen Geschmack zu scharf", "fuer mein Hunger etwas knapp", "war nicht so meins"), bei der NICHTS objektiv falsch gelaufen ist:
- Validiere die Wahrnehmung, OHNE den Gast zu isolieren. NIEMALS "Geschmaecker sind halt verschieden" oder aehnliche Saetze, die implizieren "dein Empfinden ist eine Ausnahme/anders als bei anderen".
- KEINE Schuld eingestehen — es war kein Fehler, nur nicht die Praeferenz dieses Gastes. Keine Erklaerung der Kuechenphilosophie/Konzept (das waere Kategorie A).
- WENN DIE BEWERTUNG GEMISCHT IST (ein Gericht/Aspekt wird gelobt, ein anderer kritisiert): Greife das ECHTE Lob aus der Bewertung zuerst auf (z.B. "Schoen, dass der Burger so gut ankam"), DANN validiere den Kritikpunkt. Das Lob darf NICHT wegfallen, auch wenn danach noch Validierung + Geste folgen.
- Abschluss: eine persoenliche Geste/Beratung fuer den naechsten Besuch (z.B. "Sag uns naechstes Mal kurz Bescheid, dann passen wir [X] fuer dich an"). KEIN Versprechen, das Gericht/Konzept allgemein zu aendern.
- UNTERFALL PORTION/MENGE SUBJEKTIV (z.B. "fuer meinen Hunger etwas knapp"): Vermeide vage "schauen, was wir tun koennen"-Gesten — wirkt wie ein Versprechen auf kostenlosen Nachschlag. Nutze stattdessen "empfehlen": z.B. "Sag uns beim naechsten Besuch einfach kurz Bescheid, dann koennen wir dir was passend zu deinem Hunger empfehlen."
- FUER ALLE ANDEREN GESCHMACKS-/WAHRNEHMUNGSTHEMEN: Validierung hier IMMER mit "Schade, dass..." (NICHT "kann nachvollziehen, dass..." — das ist fuer Geschmackssachen falsch, siehe Schritt 1), und sie benennt das KONKRETE Merkmal aus der Bewertung, z.B. "Schade, dass die Wuerze bei den Pommes nicht ganz gepasst hat." Fuer den Abschluss zwei Faelle unterscheiden:
  - HAUPTFALL — der Gast nennt ein konkretes, ANPASSBARES Merkmal desselben Gerichts/Getraenks (z.B. Wuerze, Schaerfe, Alkoholgehalt, Temperatur, Suesse, "fad", "zu mild"): Biete an, genau DAS beim naechsten Mal anzupassen, z.B. "Sag uns beim naechsten Besuch kurz Bescheid, dann machen wir's kraeftiger fuer dich" / "...dann wuerzen wir's fuer dich nach" / "...dann machen wir ihn etwas staerker". Konkret das Merkmal aufgreifen, nicht generisch.
  - NEBENFALL — reine Geschmacksrichtung/Stilsache OHNE anpassbares Merkmal (z.B. "mag keine asiatische Kueche", "war einfach nicht mein Stil"): Hier passt "anpassen" nicht. Stattdessen offen "Sag uns, was dir eher zusagt, dann empfehlen wir dir naechstes Mal etwas Passendes."
- KEINE UNGEFRAGTE VERTEIDIGUNG: Wenn der Gast die Zubereitung/Qualitaet nicht in Frage gestellt hat, erwaehne sie auch nicht zusaetzlich (z.B. KEIN "...obwohl die Zubereitung gepasst hat" anhaengen). Validierung + Geste reichen.
- UNTERFALL SERVICE-WAHRNEHMUNG SUBJEKTIV (kein konkreter Vorwurf, nur Eindruck, z.B. "kam mir unfreundlich/gehetzt vor"): "empfehlen" passt hier NICHT. ECHTE Validierung (nicht nur Feststellung): "Dass der Besuch diesen Eindruck hinterlassen hat, bedauern wir." — benennt das Gefuehl ohne Schuldzuweisung und ohne verbotene Zustimmungsverben. WICHTIG: Wenn die Bewertung von EINER Person spricht (z.B. "die Bedienung kam mir vor"), NICHT auf "das Team" verallgemeinern (z.B. NICHT "dass du das Team so wahrgenommen hast") — bei der Person/Situation bleiben, nicht beim ganzen Team. Bei kurzer Bewertung reicht die Validierung ohne weiteren Satz. Bei ausfuehrlicherer Bewertung kann ein Kanal-Hinweis ergaenzt werden, der sich auf eine ANDERE Gelegenheit/Person bezieht (deshalb ist "jemanden vom Team ansprechen" hier okay, anders als die Validierung selbst): "Was genau in dem Moment passiert ist, koennen wir im Nachhinein nicht mehr nachvollziehen. Beim naechsten Mal sprich einfach kurz jemanden vom Team an, dann koennen wir direkt reagieren." Kein Schuldeingestaendnis, kein Versprechen.
- ABGRENZUNG: Service mit konkretem Vorwurf (z.B. "hat unsere Bestellung vergessen") ist Kategorie B, nicht C. Atmosphaere/Lautstaerke subjektiv faellt unter Kategorie A (wenn Auslastung erwaehnt wird) oder unter den Geschmack-Unterfall oben — kein eigener Baustein noetig.

ZUSAETZLICHER BAUSTEIN (testweise): Pruefe, ob die Bewertung beschreibt, WIE etwas kommuniziert oder vermittelt wurde (Tonfall, Zeitpunkt, Art der Ansprache).
- WENN das bereits der Hauptpunkt der Bewertung ist (z.B. "niemand hat sich gemeldet" IST die Beschwerde): nicht zusaetzlich erwaehnen, das wurde schon behandelt.
- WENN es ein Nebenaspekt zu einem anderen Hauptthema ist (z.B. Beschwerde ist eigentlich ueber eine Regel, aber die Art der Ansprache war zusaetzlich unpassend): ein kurzer, eigener Satz dazu, in eigenen Worten.
- WENN nichts dazu in der Bewertung steht: keine Erwaehnung.

ABSCHLUSS (immer, als letzter Satz vor der Signatur): ein nach vorne gerichteter Satz, formuliert als Standard oder Erwartung des RESTAURANTS, nicht als persoenliches Versprechen einer einzelnen Person. Was zeigt sich beim naechsten Besuch grundsaetzlich anders? NIEMALS eine reine Gefuehlsaussage ("das nehme ich mir zu Herzen") als letzter Satz ohne Folge.
Pruefe: Klingt der Satz wie eine generische Bettel-Floskel ohne Bezug zu DIESER Bewertung? Falls ja: formuliere stattdessen etwas, das konkret zu DIESER Bewertung passt — was wird der Gast beim naechsten Mal anders erleben?

KONSISTENTE ZEITFORM: Wenn du auf Ereignisse aus der Bewertung zurueckblickst, bleibe innerhalb eines Satzes/Gedankens bei derselben Zeitform (Praeteritum), z.B. "die Vorspeise auftauchte ... musstest" statt "die Vorspeise auftaucht ... musstest".

Korrekte Zeichensetzung — jeder Hauptsatz beginnt nach einem Punkt. Jeder Satz muss grammatisch vollstaendig sein (Subjekt, Praedikat, ggf. Objekt). Wenn du Profil-Informationen paraphrasierst, ergaenze fehlende Satzteile, z.B. NICHT "Desserts sind bei uns an der Bar" (unvollstaendig), SONDERN "Desserts kannst du bei uns an der Bar bestellen" (vollstaendig).`

  const userMessage = `${langInstruction} Anredeform: ${duSie}

KONTEXT (Hintergrundwissen fuer dich — NIEMALS woertlich oder als ganze Saetze in die Antwort uebernehmen, sondern nur sinngemaess und falls relevant einfliessen lassen):
${freeContext}
${contactEmail ? `Kontakt-E-Mail (nur erwaehnen, wenn ein Kontaktangebot fuer DIESE Bewertung wirklich sinnvoll ist): ${contactEmail}` : ''}

Bewertung von ${firstNameClean || 'einem Gast'} (${stars} Sterne):
"${reviewText}"

${analysis && analysis.forceSummarize ? `ANALYSE-ERGEBNIS (Fakt aus Vorstufe, NICHT aenderbar):
Diese Bewertung enthaelt ${analysis.count} Kritikpunkte (${analysis.points.join(', ')}).
ZUSAMMENFASSUNGS-PFLICHT: Bei ${analysis.count} Kritikpunkten MUSST du alle Punkte in EINEM zusammenfassenden Satz behandeln, z.B. "da scheint bei uns einiges nicht rundgelaufen zu sein."
VERBOTEN: Mehr als EINEN konkreten Punkt namentlich in der Antwort nennen. Keine Aufzaehlungen, keine Listen, keine Doppelpunkte gefolgt von mehreren Punkten. Auch eine zweite, abgeschwaechte Aufzaehlung ist verboten. FALSCH: "der Rest, von der Wartezeit ueber den Tisch bis zum Service". Nach der einen Zusammenfassung kommt KEINE weitere Nennung einzelner Punkte.
${analysis.categories.includes('A') ? `Kat-A-Punkte erkannt: Erklaere auslastungsabhaengige Aspekte (z.B. Lautstaerke) als eigenen, ehrlichen Gedanken.` : ''}` : ''}

Schreibe EINE freie, persoenliche Antwort. Laenge passend zum Anlass (1 bis 4 Saetze). Bei vielen Kritikpunkten NICHT alles in einen langen Satz mit Aufzaehlung packen. Fasse stattdessen zusammen ("da scheint bei uns einiges nicht rundgelaufen zu sein"). Eine Aufzaehlung mehrerer Beschwerden (auch mit Komma oder Gedankenstrich verbunden) ist immer falsch.
Erster Satz: Validierung des Gefuehls (wie im System-Prompt beschrieben — Gefuehl, nicht Ereignis, keine Schuld, keine Zustimmungsverben). Danach: sachliche Einordnung. Kein "Es tut uns leid zu hoeren, dass...". Menschlich und direkt, nicht wie PR.
${firstNameClean ? `Beginne mit "Hallo ${firstNameClean},"` : 'Kein Name bekannt — ohne persoenliche Anrede beginnen.'}
Abschluss: Waehle passend zum Ton "Viele Gruesse, ${signature}" oder "Herzliche Gruesse, ${signature}" oder "Beste Gruesse, ${signature}"

AUSGABE — NUR dieses JSON:
{"label":"Frei (Test)","text":"..."}`

  return JSON.stringify({ _system: systemPrompt, _user: userMessage })
}

// ─── RECOVERY PROMPT ───────────────────────────────────────────────────────
function buildRecoveryPrompt(reviewText: string, reviewerName: string, settings: any): string {
  const {
    businessName = 'das Restaurant',
    salutation = 'Sie',
    contactEmail = '',
    responseSignature = '',
    responseLanguage = 'Deutsch',
    // ── STUFE 3: voller Kontext für Recovery ──
    description = '',
    restaurantType = '',
    cuisineType = '',
    restaurantAtmosphere = '',
    uniqueSellingPoints = '',
    priceRange = '',
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

  // Kontext-Block — identisch zum Hauptprompt
  const recoveryContext = [
    `Restaurant: ${businessName}`,
    description          && `Beschreibung: ${description}`,
    restaurantType       && `Typ: ${restaurantType}`,
    cuisineType          && `Küche: ${cuisineType}`,
    priceRange           && `Preisklasse: ${priceRange}`,
    restaurantAtmosphere && `Atmosphäre: ${restaurantAtmosphere}`,
    uniqueSellingPoints  && `Besonderheiten: ${uniqueSellingPoints}`,
  ].filter(Boolean).join('\n')

  const systemPrompt = `Erstelle eine deeskalierende, menschliche und verantwortungsvolle Antwort auf eine sehr negative Google-Bewertung.
Schreibe wie ein aufmerksamer Gastronom — nicht wie Kundenservice, PR-Agentur oder KI.

Grundregeln:
Beschwerden nicht nacherzählen oder wörtlich wiederholen.
Kritik nicht spiegeln.
Keine Ursachen erfinden.
Keine leeren Floskeln.
Natürliche Sprache, kurze Sätze.
Nutze echte Umlaute: ä, ö, ü, ß — niemals ae, oe, ue als Ersatz.
Nutze für alle Beschreibungen (Typ, Atmosphäre, Konzept) ausschließlich die Angaben aus dem Restaurantprofil.

KEINE GEDANKENSTRICHE — ABSOLUTES VERBOT:
Verwende NIEMALS "–", "—" oder jeden anderen langen Bindestrich zur Satzabgrenzung oder für Einschübe.
Ersetze jeden Gedankenstrich durch einen Punkt oder ein Komma.

VERBOT VON TAGESZEIT-BEZUEGEN: Verwende NIEMALS Woerter wie "Abend", "Abendessen", "Gruppenabend", "Nacht", "Morgen", "Mittag", "Mittagessen", "Fruehstueck" oder andere Tageszeit-Bezuege, auch wenn die Bewertung selbst eine Tageszeit nennt. Nutze stattdessen "Besuch", "Aufenthalt", "Zeit bei uns" oder "Erlebnis".

VERBOTENE PHRASEN: Niemals "nehmen wir sehr ernst", "intern adressiert", "intern nachgeschaerft", "Massnahmen ergriffen", "Team sensibilisiert", "entspricht nicht unserem Anspruch", "nicht das wofuer wir stehen", "nicht das Erlebnis das wir bieten wollen", "kein Erlebnis das so bleiben soll" oder sinngemaesse Varianten davon verwenden. Auch das Wort "frustrierend" vermeiden — nutze stattdessen z.B. "aergerlich" oder "schade".

Ziel: Vertrauen zurückgewinnen und persönliche Klärung anbieten.
Länge: 3 bis 4 vollständige, fließende Sätze.
Korrekte Zeichensetzung — jeder Hauptsatz beginnt nach einem Punkt.`

  const userMessage = `${langInstruction} Anredeform: ${duSie}

RESTAURANTPROFIL (Hintergrundwissen — NIEMALS woertlich oder als ganze Saetze uebernehmen, nur sinngemaess einfliessen lassen):
${recoveryContext}
${contactEmail ? `Kontakt-E-Mail: ${contactEmail}` : ''}

Bewertung von ${firstNameClean || 'einem Gast'} (1-2 Sterne):
"${reviewText}"

Schreibe EINE deeskalierende Antwort.
${firstNameClean ? `Beginne mit "Hallo ${firstNameClean},"` : 'Kein Name bekannt — ohne persoenliche Anrede beginnen.'}
Satz 1 (direkt nach der Begruessung) sollte eine kurze, ehrliche Gefuehls-Validierung sein, z.B. "Ich kann total nachempfinden, dass sich das im Moment nach [passendes Gefuehl, z.B. Frust/Enttaeuschung] angefuehlt haben muss." (passendes Gefuehl einsetzen, nicht woertlich "Frust/Enttaeuschung" schreiben).
${contactEmail ? `Kontaktangebot: Bitte melde dich kurz unter ${contactEmail}, damit wir das persönlich klären können.` : ''}
Endet mit: ${signature}

AUSGABE — NUR dieses JSON:
{"label":"Deeskalierend","text":"..."}`

  return JSON.stringify({ _system: systemPrompt, _user: userMessage })
}

// ─── HELPER: CLAUDE API CALL ───────────────────────────────────────────────
async function callClaude(userMessage: string, systemPrompt?: string, model = 'claude-sonnet-4-6', temperature = 0.4): Promise<string> {
  const body: any = {
    model,
    max_tokens: 4000,
    temperature,
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

// ─── STUFE 2a: POST-PROCESSING — deterministischer Regex-Check ─────────────
// Läuft nach parseVariants. Kein KI-Aufruf, kein API-Call.
// Verbotene Muster die die KI trotz Prompt-Verbot regelmäßig produziert.
const FORBIDDEN_OPENERS = [
  /vielen?\s+dank\s+f[üu]r\s+(ihre?|deine?|ihr)\s+(ausf[üu]hrliche?\s+)?(bewertung|feedback|einsch[äa]tzung|rezension)/i,
  /danke\s+f[üu]r\s+(ihre?|deine?|ihr)\s+(ausf[üu]hrliche?\s+)?(bewertung|feedback|einsch[äa]tzung|rezension)/i,
  /danke\s+f[üu]r\s+die\s+(ausf[üu]hrliche?\s+)?(bewertung|einsch[äa]tzung|r[üu]ckmeldung)/i,
  /(es|das)\s+freut\s+uns\s+sehr/i,
  /wir\s+freuen\s+uns\s+[üu]ber\s+(ihre?|deine?|ihr)\s+(bewertung|feedback)/i,
]

// Prüft ob eine Variante einen verbotenen Opener enthält.
// Sucht im Text nach dem ersten Satz NACH der Begrüßung (Hallo X, / Hi X, / Hey X,).
function hasForbiddenOpener(text: string): boolean {
  // Begrüßung abschneiden: alles nach dem ersten Komma
  const afterGreeting = text.replace(/^(hallo|hi|hey)\s+\w*,?\s*/i, '').trim()
  return FORBIDDEN_OPENERS.some(pattern => pattern.test(afterGreeting))
}

// Singular/Plural-Inkonsistenz: "ich" + Team-Signatur
function hasPronounMismatch(text: string, signature: string): boolean {
  const isTeamSignature = /team|wir|restaurant/i.test(signature)
  if (!isTeamSignature) return false
  // "da gebe ich", "finde ich", "sehe ich" etc. — Einzelperson spricht für Team
  return /\b(da\s+)?(gebe|finde|sehe|sage|denke|meine)\s+ich\b/i.test(text)
}

// "auch wenn ..." als einschraenkender Nachsatz nach einer klaren Aussage — verboten
const CAPITULATION_PATTERN = /\bauch\s+wenn\b/i
function hasCapitulation(text: string): boolean {
  return CAPITULATION_PATTERN.test(text)
}

// Einzelne verbotene Woerter
const FORBIDDEN_WORD_PATTERNS = [
  /\bfrustrierend/i,
]
function hasForbiddenWord(text: string): boolean {
  return FORBIDDEN_WORD_PATTERNS.some(pattern => pattern.test(text))
}

// "intern" / "interne" / "internen" etc. — verweist auf interne Ablaeufe, laut Prompt verboten
const INTERNAL_REFERENCE_PATTERN = /\bintern(e|er|es|en)?\b/i
function hasInternalReference(text: string): boolean {
  return INTERNAL_REFERENCE_PATTERN.test(text)
}

// Tageszeit-Bezuege — laut Prompt strikt verboten, wird hier zusaetzlich erzwungen
const TIME_REFERENCE_PATTERN = /\b(abend(s|essen)?|gruppenabend|morgens?|mittags?|mittagessen|fr[üu]hst[üu]ck|nachts?)\b/i
function hasTimeReference(text: string): boolean {
  return TIME_REFERENCE_PATTERN.test(text)
}

// Sinngemaesse Konzern-Floskeln, die der Wortlaut-Filter (FORBIDDEN_OPENERS) nicht erfasst
const CORPORATE_PHRASE_PATTERNS = [
  /nicht\s+das,?\s+(was|wie)\s+wir/i,
  /kein(e)?\s+erlebnis(,)?\s+das/i,
  /nicht\s+das\s+erlebnis/i,
  /nicht\s+das,?\s+wof[üu]r\s+wir\s+stehen/i,
  /entspricht\s+nicht\s+(unserem|dem|ihrem)/i,
  // "nicht den/das ... den/das/die wir (uns) wuenschen/vorstellen/bieten" — z.B.
  // "nicht den Eindruck hinterlassen, den wir uns wuenschen"
  /nicht\s+(den|das)\b[^.!?]{0,40}\b(den|das|die)\s+wir\s+(uns\s+)?(w[üu]nschen|vorstellen|bieten)/i,
]
function hasCorporatePhrase(text: string): boolean {
  return CORPORATE_PHRASE_PATTERNS.some(pattern => pattern.test(text))
}

// "tut mir/uns leid" — fuer Variante 1 (Direkt & Ehrlich) nicht der richtige Ton,
// dort gilt "schade"/"aergerlich" statt einer Entschuldigung.
const APOLOGY_PATTERN = /tut\s+(mir|uns)\s+(wirklich\s+|aufrichtig\s+)?leid/i
function hasApology(text: string): boolean {
  return APOLOGY_PATTERN.test(text)
}

function sanitizeVariants(
  variants: { label: string; text: string }[],
  signature: string
): { variants: { label: string; text: string }[]; flagged: string[]; issuesByVariant: string[][] } {
  const flagged: string[] = []
  const issuesByVariant: string[][] = []

  const checked = variants.map((v, i) => {
    const issues: string[] = []
    if (hasForbiddenOpener(v.text)) issues.push('forbidden_opener')
    if (hasPronounMismatch(v.text, signature)) issues.push('pronoun_mismatch')
    if (hasCapitulation(v.text)) issues.push('capitulation')
    if (hasForbiddenWord(v.text)) issues.push('forbidden_word')
    if (hasInternalReference(v.text)) issues.push('internal_reference')
    if (hasTimeReference(v.text)) issues.push('time_reference')
    if (hasCorporatePhrase(v.text)) issues.push('corporate_phrase')
    if (i === 0 && hasApology(v.text)) issues.push('apology_in_v1')
    if (issues.length > 0) {
      flagged.push(`${v.label}: ${issues.join(', ')}`)
    }
    issuesByVariant.push(issues)
    return { label: v.label, text: v.text }
  })

  return { variants: checked, flagged, issuesByVariant }
}

// ─── STUFE 2b: KOMBINIERTES FEEDBACK FUER REGENERIERUNG ────────────────────
// Fasst Sanitize-Treffer und (falls vorhanden) Judge-Ergebnis pro Variante zusammen.
const SANITIZE_ISSUE_TEXT: Record<string, (signature: string) => string> = {
  forbidden_opener: () =>
    'Beginnt (nach der Begruessung) mit einer verbotenen Dankesfloskel (z.B. "Vielen Dank fuer Ihre Bewertung"). Starte direkt mit einer echten Reaktion, ohne Dankesformel.',
  pronoun_mismatch: (signature: string) =>
    `Wechselt zwischen "ich" und "wir", obwohl die Signatur ein Team ist ("${signature}"). Bleibe konsequent bei "wir".`,
  capitulation: () =>
    'Enthaelt "auch wenn" als einschraenkenden Nachsatz nach einer klaren Aussage (z.B. "Das ist eine bewusste Entscheidung, auch wenn..."). Das ist verboten — die Aussage muss nach dem Punkt enden, ohne "auch wenn"-Einschraenkung.',
  forbidden_word: () =>
    'Enthaelt das Wort "frustrierend". Das ist verboten — nutze stattdessen z.B. "aergerlich" oder "schade".',
  internal_reference: () =>
    'Verweist mit dem Wort "intern" (oder einer Form davon) auf interne Ablaeufe (z.B. "intern nicht gestimmt"). Das ist verboten — erklaere keine internen Ablaeufe, bleibe bei der ehrlichen "im Nachhinein koennen wir das nicht mehr nachvollziehen"-Haltung.',
  apology_in_v1: () =>
    'Enthaelt "tut mir/uns leid" — das ist nicht der Ton von Variante 1 (Direkt & Ehrlich). Nutze stattdessen "schade" oder "aergerlich", z.B. "...und das ist einfach nicht in Ordnung" oder "...das ist aergerlich."',
  time_reference: () =>
    'Enthaelt einen Tageszeit-Bezug (z.B. "Abend", "Morgen", "Mittag", "Nacht"). Das ist verboten — nutze stattdessen "Besuch", "Aufenthalt" oder "Zeit bei uns".',
  corporate_phrase: () =>
    'Enthaelt eine sinngemaesse Konzern-Floskel (z.B. "kein Erlebnis das...", "nicht das was wir...", "entspricht nicht..."). Formuliere stattdessen ehrlich und persoenlich, ohne solche Floskeln.',
}

function buildRegenFeedback(
  variants: { label: string; text: string }[],
  issuesByVariant: string[][],
  judgeResult: any | null,
  signature: string
): string[] {
  return variants
    .map((v, i) => {
      const parts: string[] = []
      for (const code of issuesByVariant[i] || []) {
        const describe = SANITIZE_ISSUE_TEXT[code]
        if (describe) parts.push(describe(signature))
      }
      const judgeKey = `variant${i + 1}`
      if (judgeResult && judgeResult[judgeKey]?.ok === false && judgeResult[judgeKey]?.reason) {
        parts.push(judgeResult[judgeKey].reason)
      }
      return parts.length > 0 ? `${v.label}: ${parts.join(' ')}` : ''
    })
    .filter(Boolean)
}

// ─── STUFE 2c: QUALITAETSCHECK + GGF. REGENERIERUNG (max. 2 Versuche) ──────
// Kombiniert Sanitize-Treffer (alle Modi) und Judge-Ergebnis (nur CONTENT, < 5 Sterne).
// Regeneriert hoechstens 2x — der zweite Versuch nur, falls nach dem ersten
// Versuch immer noch ein Problem gefunden wird. Im Normalfall (0 oder 1
// Versuch reicht) entstehen keine zusaetzlichen Kosten. Der Judge laeuft nur
// einmal (vor dem ersten Versuch) — danach zaehlt nur noch die Stichwort-Kontrolle.
async function qualityCheckAndFix(
  variants: { label: string; text: string }[],
  issuesByVariant: string[][],
  mode: string,
  stars: number,
  reviewText: string,
  signature: string,
  generatorRawStr: string
): Promise<{ label: string; text: string }[]> {
  const runJudge = mode !== 'EMPTY_POSITIVE' && mode !== 'EMPTY_NEGATIVE' && stars < 5
  let judgeResult: any | null = null

  if (runJudge) {
    try {
      const judgePrompt = buildJudgePrompt(variants, reviewText, signature)
      const judgeRaw = await callClaude(judgePrompt)
      let judgeJson = judgeRaw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      const js = judgeJson.indexOf('{')
      const je = judgeJson.lastIndexOf('}')
      if (js !== -1 && je !== -1) {
        judgeJson = judgeJson.substring(js, je + 1)
        judgeResult = JSON.parse(judgeJson)
      }
    } catch (e) {
      console.error('Judge fehlgeschlagen, ueberspringe:', e)
    }
  }

  let currentVariants = variants
  let currentIssues = issuesByVariant
  let currentJudge = judgeResult
  const MAX_REGEN_ATTEMPTS = 2

  for (let attempt = 1; attempt <= MAX_REGEN_ATTEMPTS; attempt++) {
    const feedbackLines = buildRegenFeedback(currentVariants, currentIssues, currentJudge, signature)

    if (feedbackLines.length === 0) {
      return currentVariants
    }

    console.warn(`Qualitaetscheck: Probleme gefunden (Versuch ${attempt}/${MAX_REGEN_ATTEMPTS}), regeneriere...`, feedbackLines)

    let regenParsed: { _system?: string; _user?: string } | null = null
    try {
      const p = JSON.parse(generatorRawStr)
      if (p._system && p._user) regenParsed = p
    } catch {
      regenParsed = null
    }

    const feedbackBlock = `\n\nHINWEIS: Ein vorheriger Entwurf hatte folgende Probleme — bitte vermeide sie:\n${feedbackLines.join('\n')}`

    try {
      const regenRaw = regenParsed
        ? await callClaude(regenParsed._user! + feedbackBlock, regenParsed._system)
        : await callClaude(generatorRawStr + feedbackBlock)

      const regenVariants = parseVariants(regenRaw)
      const { variants: regenSanitized, flagged: regenFlagged, issuesByVariant: regenIssues } = sanitizeVariants(regenVariants, signature)

      currentVariants = regenSanitized
      currentIssues = regenIssues
      currentJudge = null // Judge laeuft nur vor dem ersten Versuch (Kosten)

      if (regenFlagged.length === 0) {
        return currentVariants
      }
      if (attempt === MAX_REGEN_ATTEMPTS) {
        console.warn(`Qualitaetscheck: nach ${MAX_REGEN_ATTEMPTS} Versuchen weiterhin Probleme:`, regenFlagged)
      }
    } catch (e) {
      console.error('Regenerierung fehlgeschlagen, nutze vorherigen Entwurf:', e)
      return currentVariants
    }
  }

  return currentVariants
}

// ─── RECOVERY-VARIANTE (eigenstaendig, kann parallel zum Qualitaetscheck laufen) ──
async function buildRecoveryVariant(
  reviewText: string,
  reviewerName: string,
  settings: any
): Promise<{ label: string; text: string; isRecovery: true } | null> {
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
        return { label: parsed.label || 'Deeskalierend', text: cleanText(parsed.text), isRecovery: true }
      }
    }
    return null
  } catch (e) {
    console.error('Recovery generation failed:', e)
    return null
  }
}

// ─── FREIE VARIANTE (Test, eigenstaendig, kann parallel laufen) ────────────
async function buildFreeVariant(
  reviewText: string,
  stars: number,
  reviewerName: string,
  settings: any,
  analysis?: {count: number, points: string[], categories: string[], forceSummarize: boolean}
): Promise<{ label: string; text: string; isFreeTest: true } | null> {
  const signature = settings?.responseSignature || `Das Team von ${settings?.businessName || 'das Restaurant'}`
  const MAX_FREE_ATTEMPTS = 2

  try {
    const freePrompt_str = buildFreePrompt(reviewText, stars, reviewerName, settings, analysis)
    let freeParsed: { _system?: string; _user?: string } | null = null
    try {
      const p = JSON.parse(freePrompt_str)
      if (p._system && p._user) freeParsed = p
    } catch {
      freeParsed = null
    }

    let userMessage = freeParsed?._user || freePrompt_str
    let result: { label: string; text: string } | null = null

    for (let attempt = 1; attempt <= MAX_FREE_ATTEMPTS; attempt++) {
      const freeRaw = freeParsed
        ? await callClaude(userMessage, freeParsed._system)
        : await callClaude(userMessage)

      let freeJson = freeRaw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      const fs = freeJson.indexOf('{')
      const fe = freeJson.lastIndexOf('}')
      if (fs === -1 || fe === -1) break

      freeJson = freeJson.substring(fs, fe + 1)
      const parsed = JSON.parse(freeJson)
      if (!parsed.text) break

      const cleanText = (t: string) => t.replace(/\n\n/g, ' ').replace(/\n/g, ' ').trim()
      const candidate = { label: parsed.label || 'Frei (Test)', text: cleanText(parsed.text) }

      const { issuesByVariant, flagged } = sanitizeVariants([candidate], signature)
      result = candidate // letzten Versuch als Fallback behalten

      if (flagged.length === 0) {
        break
      }

      console.warn(`Frei (Test): Probleme gefunden (Versuch ${attempt}/${MAX_FREE_ATTEMPTS}):`, flagged)

      if (attempt < MAX_FREE_ATTEMPTS) {
        const feedbackLines = buildRegenFeedback([candidate], issuesByVariant, null, signature)
        const feedbackBlock = `\n\nHINWEIS: Ein vorheriger Entwurf hatte folgende Probleme — bitte vermeide sie:\n${feedbackLines.join('\n')}`
        userMessage = (freeParsed?._user || freePrompt_str) + feedbackBlock
      }
    }

    return result ? { ...result, isFreeTest: true } : null
  } catch (e) {
    console.error('Free-variant generation failed:', e)
    return null
  }
}

// ─── REVIEW-ANALYSE (Haiku, deterministisch) ─────────────────────────────
async function analyzeReview(reviewText: string): Promise<{count: number, points: string[], categories: string[], forceSummarize: boolean}> {
  const systemPrompt = `Du analysierst Restaurant-Bewertungen. Identifiziere jeden einzelnen Kritikpunkt.
Antworte NUR mit diesem JSON-Format, nichts anderes:
{"points":["Punkt1","Punkt2"],"categories":["B","A"]}

Kategorien:
A = Konzept/strukturell (Hausregeln, Lautstaerke bei vollem Haus, Tischvergabe, Oeffnungszeiten)
B = Echter Fehler (Wartezeiten, falscher Tisch, unfreundlicher Service, vergessene Bestellungen)
C = Geschmack/Wahrnehmung (zu scharf, zu wenig Portion, nicht gemuetlich)

Maximal 3 Woerter pro Punkt. Nur Kritikpunkte, kein Lob. Reihenfolge wie in der Bewertung.`

  const userMessage = `Bewertung:\n"${reviewText}"`

  try {
    const result = await callClaude(userMessage, systemPrompt, 'claude-haiku-4-5-20251001', 0)
    const cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const parsed = JSON.parse(cleaned)
    const points = parsed.points || []
    const categories = parsed.categories || []
    return {
      count: points.length,
      points,
      categories,
      forceSummarize: points.length >= 3
    }
  } catch (e) {
    console.error('analyzeReview failed:', e)
    return { count: 0, points: [], categories: [], forceSummarize: false }
  }
}

// ─── CONTEXT CHECK ─────────────────────────────────────────────────────────
async function checkContext(reviewText: string, description: string): Promise<{ ok: boolean; missing?: string }> {
  const wordCount = reviewText.trim().split(/\s+/).filter(Boolean).length
  if (wordCount < 6) return { ok: true }

  const systemPrompt = `Du bist ein Qualitätsprüfer für Restaurant-Antworten.
Deine einzige Aufgabe: Entscheide ob das Restaurantprofil genug Informationen enthält um auf diese Bewertung sicher zu antworten — ohne etwas erfinden zu müssen.

Antworte NUR mit einem dieser zwei Formate:
OK
MISSING: [kurze Beschreibung was fehlt, max. 1 Satz auf Deutsch]

Wann ist MISSING korrekt?
- Die Bewertung kritisiert eine KONKRETE HAUSREGEL oder POLICY (z.B. Tischvergabe, Reservierungspolitik, Oeffnungszeiten, Zahlungsmethoden, spezielle Ablaeufe)
- UND das Profil enthaelt dazu KEINE Erklaerung oder Regel
- NUR dann ist MISSING korrekt

Wann ist OK korrekt? (im Zweifel IMMER OK)
- Kritik an Service, Umgangston, Hoeflichkeit, Kommunikation, Verhalten von Personal — das ist IMMER OK, dafuer braucht das Profil KEINE Informationen
- Kritik an Essen, Wartezeit, Atmosphaere, Sauberkeit — IMMER OK
- Widersprüchliches Verhalten des Personals (z.B. erst abgelehnt, dann doch erlaubt) — IMMER OK, die KI kann das als Fehler behandeln ohne Profil-Info
- Das Profil enthaelt eine passende Erklaerung zur Hausregel/Policy
- Die Bewertung ist positiv oder neutral
- Die Bewertung enthaelt MEHRERE Themen und das Profil deckt die Hausregel ab, auch wenn andere Aspekte (Service, Ton) nicht im Profil stehen

WICHTIG: Wenn das Profil die HAUSREGEL erklaert, ist das ausreichend. Die KI braucht KEINE Profil-Informationen ueber Servicestandards, Kommunikationsrichtlinien oder Personalverhalten. Das sind keine Hausregeln.

Antworte OK, es sei denn es fehlt eine echte Hausregel oder Policy.`

  const userMessage = `RESTAURANTPROFIL:
${description || '(keine Beschreibung eingetragen)'}

BEWERTUNG:
"${reviewText}"

Ist das Profil ausreichend um sicher zu antworten?`

  try {
    const result = await callClaude(userMessage, systemPrompt, 'claude-haiku-4-5-20251001', 0)
    const trimmed = result.trim()
    if (trimmed.startsWith('MISSING:')) {
      const missing = trimmed.replace('MISSING:', '').trim()
      return { ok: false, missing }
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

  if (!review || typeof review !== 'object') {
    return res.status(400).json({ error: 'review fehlt oder ist ungueltig' })
  }

  const reviewText = review.reviewText || ''
  const stars = Number(review.stars) || 3
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

    // ── SCHRITT 0b: Review-Analyse (Haiku, deterministisch) ─────────────────
    const analysis = await analyzeReview(reviewText)

    // ════════════════════════════════════════════════════════════════════
    // TEMPORAER: Nur "Frei (Test)" generieren, um API-Kosten zu sparen
    // waehrend Kategorie C getestet wird. Die drei Hauptvarianten + Judge
    // + Recovery sind unten auskommentiert — bei Bedarf wieder aktivieren.
    // ════════════════════════════════════════════════════════════════════
    const freeVariant = await buildFreeVariant(reviewText, stars, reviewerName, settings, analysis)
    const finalVariants: any[] = freeVariant ? [freeVariant] : []
    return res.status(200).json({ success: true, answers: finalVariants })

    /*
    // ── SCHRITT 1: Generator (Claude) ─────────────────────────────────────
    const generatorRaw_str = buildPrompt(reviewText, stars, reviewerName, settings)
    let generatorRaw: string

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

    let generatedVariants: { label: string; text: string }[]
    try {
      generatedVariants = parseVariants(generatorRaw)
    } catch (e) {
      console.error('Generator-Parse fehlgeschlagen, retry...', e)
      let retryRaw: string
      try {
        const parsed = JSON.parse(generatorRaw_str)
        retryRaw = parsed._system && parsed._user
          ? await callClaude(parsed._user, parsed._system)
          : await callClaude(generatorRaw_str)
      } catch {
        retryRaw = await callClaude(generatorRaw_str)
      }
      generatedVariants = parseVariants(retryRaw)
    }

    // ── SCHRITT 1b: Post-Processing (Regex, deterministisch) ──────────────
    const { variants: sanitized, flagged, issuesByVariant } = sanitizeVariants(generatedVariants, signature)
    if (flagged.length > 0) {
      console.warn('sanitize: verbotene Muster gefunden:', flagged)
    }
    generatedVariants = sanitized

    // ── SCHRITT 2 + 3: Qualitaetscheck (Judge + ggf. einmalige Regenerierung)
    // und Recovery (nur bei 1–2 Sternen) ───────────────────────────────────
    // Laufen parallel, da sie unabhaengig voneinander sind: Recovery braucht
    // weder die 3 Varianten noch das Judge-Ergebnis.
    const mode = classify(stars, reviewText)

    const [checkedVariants, recoveryVariant, freeVariant2] = await Promise.all([
      qualityCheckAndFix(generatedVariants, issuesByVariant, mode, stars, reviewText, signature, generatorRaw_str),
      stars <= 2 ? buildRecoveryVariant(reviewText, reviewerName, settings) : Promise.resolve(null),
      buildFreeVariant(reviewText, stars, reviewerName, settings),
    ])

    let finalVariants2: any[] = checkedVariants
    if (recoveryVariant) {
      finalVariants2 = [...finalVariants2, recoveryVariant]
    }
    if (freeVariant2) {
      finalVariants2 = [...finalVariants2, freeVariant2]
    }

    return res.status(200).json({ success: true, answers: finalVariants2 })
    */

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('generate-replies FEHLER:', errMsg)
    return res.status(500).json({ error: 'Serverfehler', details: errMsg })
  }
}
