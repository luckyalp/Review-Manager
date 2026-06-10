# Handoff-Prompt — ReviewManager / generate-replies-v2

## Projektkontext
Wir bauen ein Restaurant-Bewertungs-Antwortsystem für Google Reviews. Die App läuft auf Vercel (Next.js/TypeScript). Der relevante Ordner ist `C:\Users\Alp\Downloads\ReviewManager\ReviewApp`.

## Architektur-Überblick

### Was existiert
- `api/generate-replies.ts` — V1, bleibt unberührt
- `api/generate-replies-v2.ts` — V2, aktiver Entwicklungsstand (wird unten erklärt)
- `src/App.tsx` — Frontend, ruft derzeit noch `/api/generate-replies` auf (V1)

### V2-Kernlogik: Das Souveräne Drei-Schritt-System
Jede Google-Review bekommt 3 Varianten: **Direkt & Ehrlich** / **Ruhig & Professionell** / **Fokus auf Klärung**.

**Schritt 1** — Begrüßung (Hey/Hi/Hallo + Name)  
**Schritt 2** — Emotionale Brücke (Empathie-Satz mit Komma verbunden zur Brücke) + Verdecktes Marketing  
**Schritt 3** — Kategorie-spezifischer Gastgeber-Ausstieg  

### Kategorie-Hierarchie (KI erkennt selbst, kein extra API-Call)
1. UNFREUNDLICHKEIT — persönliche Verletzung
2. SERVICE — operativer Fehler
3. ESSEN — Geschmack/Zubereitung
4. PREIS — Preis-Leistung
5. ERLEBNIS — Lautstärke, Tisch, Atmosphäre
GEMISCHT = Ton-Override (3–4 Sterne mit Text), kein Schritt 3

### Modi
- `EMPTY_POSITIVE` — 4–5 Sterne, kein Text → kurz herzlich, kein AI-3-Schritt
- `EMPTY_NEGATIVE` — 1–2 Sterne, kein Text → Einladung zur direkten Kontaktaufnahme
- `CONTENT` — alles andere → volles 3-Schritt-System
- `Recovery` — bei 1–2 Sternen zusätzlich als 4. Variante, FESTES TEMPLATE (kein AI-Call):
  `"Hallo [Name], was du da erlebt hast, macht uns wirklich betroffen. Bitte melde dich direkt bei uns, damit wir das persönlich mit dir klären können. [Email] [Signatur]"`

### Output-JSON
```json
{
  "category": "Erlebnis | Essen | Preis | Service | Unfreundlichkeit | Gemischt",
  "variant1": {"label": "Direkt & Ehrlich", "text": "..."},
  "variant2": {"label": "Ruhig & Professionell", "text": "..."},
  "variant3": {"label": "Fokus auf Klärung", "text": "..."}
}
```
Bei 1–2 Sternen kommt zusätzlich Recovery als 4. Element in `answers`.

---

## Aktueller Stand von generate-replies-v2.ts

### Funktionen
1. `classify(rating, reviewText)` → EMPTY_POSITIVE / EMPTY_NEGATIVE / CONTENT
2. `buildSystemPrompt(settings)` → Kernprompt mit 3-Schritt-System, Kategoriehierarchie, Building Blocks, Blacklist
3. `buildPrompt(reviewText, rating, reviewerName, settings)` → User-Message + System-Prompt als JSON
4. `buildRecoveryText(reviewerName, settings)` → festes Template, kein AI
5. `parseResponse(raw)` → extrahiert category + variants aus Claude-Response
6. `checkContext(reviewText, description)` → prüft ob Profil reicht (separater Claude-Call)
7. `callClaude(userMessage, systemPrompt?)` → Anthropic API (claude-sonnet-4-6)
8. Handler: checkContext → classify → EMPTY oder CONTENT → ggf. Recovery anhängen

### System-Prompt-Regeln (aktueller Stand, alle Korrekturen bereits eingebaut)

**Techniken für Schritt 2:**
- Technik 1 (Direkt & Ehrlich): Ich-Form, direkt. Beispiel: "Ich kann absolut nachvollziehen, dass das im ersten Moment ziemlich blöd bei dir rübergekommen ist."
- Technik 2 (Ruhig & Professionell): Umgangssprachlich, nicht steif. Beispiel: "Ich kann gut nachvollziehen, dass du dir deinen Besuch bei uns ruhiger vorgestellt hast." — NICHT die alte steife Version "ich verstehe vollkommen, dass das enttäuschend gewirkt hat, wenn du mit einer anderen Erwartung..."
- Technik 3 (Fokus auf Klärung): Sachlicher, kürzer. Beispiel: "Ich verstehe vollkommen, dass das blöd rüberkommt, wenn der Besuch plötzlich so ins Stocken gerät."

**Brücke zum verdeckten Marketing:**
- Brücke wird als Komma-Fortsetzung des Empathie-Satzes eingebaut, NICHT als neuer Satz.
- Muster: "[Empathie-Satz], [Brücke]."
- Erlaubte Brücken: "bei uns kann es schon ordentlich lebhaft zugehen." / "bei uns geht es oft richtig lebendig zu, das ist einfach wie unser Laden tickt."
- VERBOTEN: "wir sind bekannt dafür" (impliziert immer laut → macht Schritt-3-Angebot unglaubwürdig)
- VERBOTEN: "für manche das Richtige, für andere nicht" (klingt wie Absage)
- VERBOTEN: Tageszeiten überall in der Antwort ("abends", "mittags" etc.)
- VERBOTEN: "man" — immer "du" oder "Sie"

**Beispiel guter Fluss (Technik 2, ERLEBNIS):**
"Hallo Alp, ich kann gut nachvollziehen, dass du dir deinen Besuch ruhiger vorgestellt hast, bei uns kann es schon ordentlich lebhaft zugehen."

**ERLEBNIS Schritt 3 — wichtige Logik:**
- Das Angebot bezieht sich auf einen ruhigeren TISCH (nicht ruhigere Uhrzeit!)
- Logisch konsistent: auch in einem lebhaften Restaurant gibt es unterschiedlich ruhige Plätze
- Building Blocks:
  - Direkt & Ehrlich: "Frag beim nächsten Besuch einfach kurz nach, ob wir dir einen ruhigeren Platz freihalten können, wir schauen was möglich ist."
  - Ruhig & Professionell: "Beim nächsten Besuch einfach kurz Bescheid geben, wir schauen dann was wir für dich tun können."
  - Fokus auf Klärung: "Sag beim nächsten Mal kurz Bescheid was du brauchst, wir finden einen Weg."

**Mittagstisch:** Wird aus der Restaurantbeschreibung via Regex erkannt (kein extra Profilfeld). Bei PREIS-Kategorie: conditional Tipp wenn Mittagstisch vorhanden, sonst souveräne Haltung ohne Einladung zur Diskussion.

**Blacklist (absolut verboten):**
Einzelwörter: entschuldigen, Entschuldigung, Dynamik, Respektlosigkeit, Schande, Service-Exzellenz  
Phrasen: "logistische Rahmenbedingungen", "intern nachgeschärft", "nehmen wir sehr ernst", "entspricht nicht unserem Anspruch", "Das tut uns sehr leid", "Vielen Dank für deine Bewertung", "Das freut uns sehr", "Wir hoffen dich bald wieder begrüßen zu dürfen", "Das hätte nicht passieren dürfen", "unser Team" (gesichtslos), Gedankenstriche (weder — noch -)

---

## Offene Aufgaben

### 1. ROUTE-SWITCH (noch nicht gemacht — V2 ist noch nicht aktiv!)
In `src/App.tsx` müssen Zeile 508 und Zeile 1104 von `/api/generate-replies` auf `/api/generate-replies-v2` umgestellt werden. Das ist der einzige Schritt der fehlt um V2 live zu nehmen.

### 2. Test nach den letzten Fixes
Die letzte Session hat 3 Änderungen am System-Prompt gemacht:
- Technik 2 Beispiel vereinfacht (weniger steif)
- Bridge-Phrasen von "wir sind bekannt dafür" auf "kann es lebhaft zugehen" geändert
- ERLEBNIS Schritt 3 explizit als Tisch-Angebot (nicht Uhrzeit) markiert

Diese Änderungen wurden noch nicht getestet. Nächster Schritt: Route-Switch + einen neuen Test mit einer ERLEBNIS-Bewertung (z.B. "Es war zu laut, konnte mich kaum unterhalten").

### 3. Bekannte Sprachmuster die zu beachten sind
Historisch aufgetretene Fehler die der Prompt jetzt verhindert:
- "abends" / "Abend" aus der Bewertung übernommen → TAGESZEIT-VERBOT im Prompt
- "man muss dazu sagen" → "man" ist verboten
- "für manche das Richtige, für andere nicht" → jetzt verboten
- "es gibt Zeiten wo es ruhiger ist" → Uhrzeiten-Empfehlungen verboten
- "wir sind bekannt dafür" → jetzt verboten

---

## Dateistruktur (relevante Dateien)
```
ReviewApp/
├── api/
│   ├── generate-replies.ts        ← V1, nicht anfassen
│   └── generate-replies-v2.ts     ← V2, aktiver Stand
├── src/
│   └── App.tsx                    ← Zeile 508 + 1104: Route noch auf V1
└── PLAN.md                        ← Architektur-Doku
```

---

## Wie weiter
1. Route-Switch in App.tsx (Zeile 508 + 1104): `/api/generate-replies` → `/api/generate-replies-v2`
2. Test mit ERLEBNIS-Bewertung
3. Falls Output gut → V2 ist fertig
4. Optional danach: ESSEN-Kategorie testen (Geschmacks-Weiche), SERVICE testen
