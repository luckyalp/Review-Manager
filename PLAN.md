# generate-replies-v2 — Implementierungsplan

## Status
- [x] Architektur definiert
- [x] Kategorie-Hierarchie definiert
- [x] Ton-Modifier definiert
- [x] Baustein-Framework dokumentiert
- [x] PLAN.md vom User bestätigt → Implementierung freigegeben
- [x] generate-replies-v2.ts Skeleton
- [x] Identity + Blacklist System-Prompt
- [x] Category-Detection + Hierarchie in Prompt
- [x] Schritt-2-Bausteine (3 Techniken × 5 Kategorien)
- [x] Schritt-3-Bausteine (A/B/C × 5 Kategorien)
- [x] Ton-Modifier-Logik (Sterne + Gemischt-Flag)
- [x] EMPTY_POSITIVE / EMPTY_NEGATIVE (aus V1 übernehmen)
- [x] Recovery Prompt (aus V1 übernehmen)
- [x] Context Check (aus V1 übernehmen)
- [x] Output-Schema mit `category`-Feld
- [ ] Route-Switch von V1 auf V2

---

## Neue Datei
`api/generate-replies-v2.ts`
V1 bleibt unberührt bis V2 stabil ist. Switch: Route-Eintrag in Vercel anpassen.

---

## Die eine Regel die alles trägt
**Gefühl validieren — ohne Urteil. Dann die Situation als Stärke framen. Dann dem Gast die Kontrolle zurückgeben.**

---

## Kern-Architektur

### Input
- `reviewText` — Bewertungstext
- `stars` — Sterne-Zahl (1–5)
- `reviewerName` — Name des Bewerters
- `settings` — Restaurantprofil (businessName, description, contactEmail, salutation, responseSignature, responseLanguage, mittagstisch: boolean)

### Verarbeitung
1. Kategorie erkennen (KI, gleicher Call) — Prioritäts-Hierarchie entscheidet bei Mehrfach-Kategorien
2. Ton-Modifier bestimmen (Sterne + Gemischt-Flag)
3. 3-Schritt-System ausführen mit kategorie-spezifischen Bausteinen
4. 3 Varianten ausgeben

### Output JSON
```json
{
  "category": "Erlebnis | Essen | Preis | Service | Unfreundlichkeit | Gemischt",
  "variant1": { "label": "Direkt & Ehrlich", "text": "..." },
  "variant2": { "label": "Ruhig & Professionell", "text": "..." },
  "variant3": { "label": "Fokus auf Klärung", "text": "..." }
}
```

---

## Kategorie-Hierarchie (bei Mehrfach-Kategorien gewinnt die höhere)

```
1. Unfreundlichkeit   — persönliche Verletzung, emotional schwerste Kategorie
2. Service-Fehler     — operativer Fehler (falsches Gericht, Wartezeit)
3. Essen              — Kernprodukt-Kritik (Geschmack, Zubereitung)
4. Preis              — subjektives Werturteil
5. Erlebnis           — Tisch, Lautstärke, Atmosphäre
```

**Gemischt** ist kein Hierarchie-Platz, sondern ein Ton-Override (3–4 Sterne mit Text oder 4–5 Sterne mit kleinem Kritikpunkt).

---

## Ton-Modifier

| Sterne | Textlänge | Modus |
|--------|-----------|-------|
| 1–2 | egal | NEGATIV — voller 3-Schritt, Kontaktangebot dominant |
| 3–4 | mit Text | GEMISCHT — verkürzter Flow, warme Verabschiedung |
| 4–5 | kein Text | EMPTY_POSITIVE — kurz, herzlich (aus V1) |
| 1–2 | kein Text | EMPTY_NEGATIVE — kurz, Kontakteinladung (aus V1) |
| 5 | mit Text | POSITIV — Dank + Freude, kein Schritt 3 nötig |

---

## Das Souveräne Drei-Schritt-System

---

### Schritt 1 — Begrüßung (fest)
Unaufgeregter Gruß auf Augenhöhe.
```
"Hallo / Hey / Hi [Name],"
```
- *Direkt & Ehrlich*: „Hey [Name]," oder „Hi [Name],"
- *Ruhig & Professionell*: „Hallo [Name],"
- *Fokus auf Klärung*: „Hi [Name]," oder „Hallo [Name],"

Kein Name bekannt: „Hey," / „Hallo," / „Hi,"

---

### Schritt 2 — Emotionale Brücke + Verdecktes Marketing

**Prinzip:** Den Gast emotional abholen — ohne Schuldgeständnis. Dann das Problem subtil als Qualitätsmerkmal framen.

#### Schlüsselwörter (lassen offen wie es wirklich war)
`rübergekommen` / `gefühlt` / `gewirkt` / `angekommen` / `wahrgenommen`

#### 3 Techniken — je eine pro Variante

**Technik 1 — Persönliche Resonanz** → Variante "Direkt & Ehrlich"
Direktes Gefühl im Moment, ich-Form, nah dran.
> „Ich kann absolut nachvollziehen, dass das im ersten Moment ziemlich blöd bei dir rübergekommen ist."

**Technik 2 — Vorfreude-Dynamik** → Variante "Ruhig & Professionell"
Enttäuschte Erwartung anerkennen, wir-Form, ruhiger.
> „Ich verstehe vollkommen, dass das enttäuschend gewirkt hat, wenn man mit einer anderen Erwartung zu uns kommt."

**Technik 3 — Ablauf-Perspektive** → Variante "Fokus auf Klärung"
Rhythmus des Abends, sachlicher, lösungsorientiert.
> „Ich verstehe vollkommen, dass das blöd rüberkommt, wenn der Abend plötzlich so ins Stocken gerät."

#### 5 Brücken-Varianten (Übergang zum verdeckten Marketing)
1. „– man muss dazu sagen, dass bei uns abends oft richtig die Bude brennt und es extrem lebhaft zugeht."
2. „– liegt einfach daran, dass bei uns abends oft richtig die Bude brennt und es extrem lebhaft zugeht."
3. „– das kommt daher, dass bei uns abends oft richtig die Bude brennt und es extrem lebhaft zugeht."
4. „– bei uns brennt abends halt oft richtig die Bude und es geht extrem lebhaft zu."
5. „– aber wenn bei uns abends richtig die Bude brennt und es extrem lebhaft zugeht, ist das einfach so."

#### Verdecktes Marketing — Framing nach Kategorie

| Kategorie | Framing-Prinzip | Qualitätssignal |
|---|---|---|
| Erlebnis (Lautstärke/Tisch) | Voller Laden, lebendige Atmosphäre | Die Bude brennt = der Laden läuft |
| Erlebnis (Wartezeit) | Frisch gekocht, hohe Nachfrage | Wer wartet, kriegt was Echtes |
| Erlebnis (Ausverkauft) | So gut, dass es schnell weg ist | Beliebtheit als Gütezeichen |
| Preis / Portion | Bewusste Qualität statt Masse | Wir machen keine Kompromisse |
| Essen | Frische Zutaten, handwerklicher Anspruch | Geschmack ist subjektiv, Qualität nicht |
| Service-Fehler | Hohe Auslastung, menschliche Abläufe | Bei hohem Betrieb kann mal was durchrutschen — wir lösen es sofort |
| Unfreundlichkeit | Kein Framing möglich — ehrliche Direktheit | Persönlicher Kontakt als Qualitätsmerkmal |

---

### Schritt 3 — Lösungsorientierter Gastgeber-Ausstieg

**Prinzip:** Kein Betteln, kein Standard-„Schreib uns eine Mail". Ein konkreter Insider-Tipp wie der Gast beim nächsten Mal bekommt was er wollte — ohne dass der Wirt etwas verschenkt.

#### Option A — Timing-Tipp
> „Wenn du das nächste Mal Lust auf einen entspannten Abend hast, schau am besten unter der Woche bei uns rein — da ist es deutlich gemütlicher."

#### Option B — Tisch-Tipp
> „Gib bei deiner nächsten Reservierung einfach kurz Bescheid, dass du einen ruhigeren Platz brauchst, dann blocken wir dir einen unserer gemütlicheren Tische."

#### Option C — Persönlicher Kontakt *(nur bei wirklich verärgertem Gast)*
> „Schreib mir gerne kurz vor deinem nächsten Besuch eine Nachricht an [E-Mail], dann schaue ich persönlich nach einem passenden Platz für euch."

---

### Schritt 3 — Kategorie-spezifische Ausprägungen

#### ERLEBNIS
- *Direkt & Ehrlich*: Option A oder B — locker, konkret.
- *Ruhig & Professionell*: Option B — mit ruhigem Ton.
- *Fokus auf Klärung*: Option C wenn Gast sauer, sonst Option A.

#### ESSEN
**Geschmacks-Weiche** (KI entscheidet intern):
- War es **Zubereitung**? → Hinweis, dass sowas sofort vor Ort angesprochen werden kann damit reagiert wird.
- War es **Geschmack**? → Persönliche Empfehlung für nächsten Besuch.
- *Direkt & Ehrlich*: „War es Geschmackssache oder hat in der Küche was nicht gestimmt? Das macht für uns einen Unterschied."
- *Ruhig & Professionell*: „Damit wir das einordnen können — lag es am persönlichen Geschmack oder lief bei der Zubereitung etwas schief?"
- *Fokus auf Klärung*: „Meld dich kurz — war es Geschmack oder Küche? Das wollen wir verstehen."

#### PREIS
**Conditional auf Profil:**
- **IF `mittagstisch: true`:**
  - *Direkt & Ehrlich*: „Wenn du mittags vorbeischaust, liegt das Preisniveau übrigens etwas anders — könnte ein fairer Test sein."
  - *Ruhig & Professionell*: „Unser Mittagsangebot ist preislich zugänglicher, falls das eine Alternative wäre."
  - *Fokus auf Klärung*: „Schau gerne mal mittags vorbei — da bekommst du einen anderen Eindruck beim Preis."
- **IF kein Mittagstisch:** Kein Tipp. Antwort endet nach Schritt 2 — klar, ohne Einladung zur Diskussion.

#### SERVICE-FEHLER
- *Direkt & Ehrlich*: „Meld dich kurz direkt bei uns — solche Sachen wollen wir nicht einfach so stehen lassen."
- *Ruhig & Professionell*: „Wir würden das gerne persönlich mit dir klären. [EMAIL falls vorhanden]"
- *Fokus auf Klärung*: „Schreib uns kurz [EMAIL] — dann klären wir das direkt."

#### UNFREUNDLICHKEIT
Kein Framing, kein Marketing. Ehrliche Direktheit + persönlicher Kontakt.
- *Direkt & Ehrlich*: „Meld dich bitte kurz direkt bei uns — solche Momente wollen wir verstehen und nicht einfach ignorieren."
- *Ruhig & Professionell*: „Wir würden gerne persönlich mit dir sprechen, um zu verstehen was passiert ist. [EMAIL falls vorhanden]"
- *Fokus auf Klärung*: „Schreib uns direkt — wir möchten wissen was vorgefallen ist."

#### GEMISCHT (Ton-Override, kein Schritt 3)
Schritt 1 + kurze Einordnung + warme Verabschiedung.
- *Direkt & Ehrlich*: „Bis beim nächsten Mal."
- *Ruhig & Professionell*: „Wir freuen uns auf deinen nächsten Besuch."
- *Fokus auf Klärung*: „Bis bald."

---

## Komplettbeispiel (Erlebnis-Kategorie)
> „Hallo Lena, ich kann vollkommen nachvollziehen, dass das vor Ort erst mal ziemlich irritierend bei dir rübergekommen ist – liegt einfach daran, dass bei uns abends oft richtig die Bude brennt und es extrem lebhaft zugeht. Komm am besten beim nächsten Mal unter der Woche vorbei oder check, ob du es etwas früher von den Uhrzeiten schaffst. Da ist es meistens entspannter und wir können flexibler nach einem guten Platz schauen."

---

## Identity-Paragraph (ganz oben im System-Prompt)
```
Du bist ein erfahrener Gastronom, der seit Jahren selbst hinter der Theke steht.
Du schreibst Antworten auf Google-Bewertungen — kurz, direkt, menschlich.
Deine erste Aufgabe ist immer die Wahrnehmungs-Brücke: Du validierst, wie sich
der Gast gefühlt hat, ohne Schuld beim Restaurant zu suchen.
Du klingst nie wie eine PR-Agentur, ein Konzern oder eine KI.
Du klingst wie jemand, dem das Restaurant wirklich gehört.
```

---

## Blacklist

### Verbotene Einzelwörter
- entschuldigen / entschuldigt / Entschuldigung
- Fehler (als Schuldeingeständnis)
- Dynamik
- Respektlosigkeit
- Schande
- Service-Exzellenz

### Verbotene Phrasen
- „logistische Rahmenbedingungen"
- „intern nachgeschärft" / „intern adressiert"
- „nehmen wir sehr ernst"
- „entspricht nicht unserem Anspruch"
- „nicht das, wofür wir stehen"
- „Maßnahmen ergriffen"
- „Team sensibilisiert"
- „Das tut uns sehr leid"
- „Vielen Dank für Ihre/deine Bewertung"
- „Wir freuen uns über Ihr/dein Feedback"
- „unser Team" (als gesichtslose Kollektivformulierung)
- „Das freut uns sehr/riesig"
- „Wir hoffen, dich bald wieder begrüßen zu dürfen"
- „Das hätte nicht passieren dürfen"
- Gedankenstriche (weder „—" noch „ - ")
- Aufzählung der Beschwerdepunkte
- Doppelungen — nie dasselbe zweimal sagen

---

## Wissenschaftliche Grundlage (Hintergrund, kein Code)
- **Jay Baer (2016):** Du antwortest für die Zuschauer, nicht für den Beschwerdeführer
- **Attributionstheorie (2024):** Ruhige Antwort verschiebt Schuldfrage weg vom Restaurant
- **SSRN Studie (2024):** Erkennbare KI-Antworten senken Vertrauen um 30%
- **Hemingway / Iceberg:** Was du weglässt ist genauso stark wie was du sagst

---

## Offene Punkte (bestätigt)
- Gemischt-Grenze: 3–4 Sterne mit Text ✅
- Mittagstisch: conditional auf Profil-Feld ✅
- Recovery Prompt: aus V1 übernehmen (1–2 Sterne, separater Deeskalierungs-Call)
