# Antwort-Qualitäts-Baseline

## Kontext

Die Engines zur Generierung von Antworten auf Google-Bewertungen (aktuell v1–v7,
siehe `api/generate-replies-v*.ts`) wurden mehrfach überarbeitet, weil generierte
Antworten "unwirklich" wirken: Floskeln, Grammatikfehler, unsinnige oder
zusammengeklebt wirkende Sätze. Jede bisherige Korrektur hat einen konkreten
Einzelfall behoben, ohne dass sich die Verbesserung auf die Breite der Fälle
übertragen ließ — weil bisher nie systematisch, sondern nur per Bauchgefühl an
Einzelbeispielen geprüft wurde, ob eine Änderung tatsächlich hilft.

**Kernproblem, das dieses Projekt löst:** Es gibt aktuell keine Möglichkeit,
objektiv zu messen, wie gut (oder schlecht) eine Engine über eine breite Menge
an Bewertungen hinweg tatsächlich abschneidet. Jede Änderung ist ein Blindflug.

**Nicht Ziel dieses Projekts:** Die Generierungs-Engine selbst umzubauen oder zu
verbessern. Dieses Projekt liefert ausschließlich das Messwerkzeug, mit dem
sich künftige Engine-Änderungen objektiv bewerten lassen.

## Ziel

Eine reproduzierbare Baseline-Zahl für die aktuell aktive Engine (v7):
"X von Y Testfällen bestehen alle drei Qualitätschecks (keine Floskel, keine
Grammatik-/Unsinn-Fehler, wirkt nicht zusammengeklebt)."

Jede künftige Engine-Änderung wird gegen denselben Testfall-Satz erneut
gemessen, damit Verbesserung oder Verschlechterung sichtbar wird, statt geraten.

## Bausteine

### 1. Testfälle sammeln — `scripts/collect-baseline-cases.ts`

- Zieht 10–15 echte Bewertungen aus der Supabase-Tabelle `reviews` (Spalten:
  `review_text`, `stars`, `reviewer_name`, ggf. `selected_answer`), gemischt
  über 1–5 Sterne und mit/ohne Text. Zugriff über `SUPABASE_URL` +
  `SUPABASE_SERVICE_ROLE_KEY` aus `.env.local` (wie bereits in
  `scripts/test-pipeline.ts` per `process.loadEnvFile`).
- Kombiniert diese mit den 7 vorhandenen synthetischen Grenzfällen aus
  `scripts/test-pipeline.ts` (Wortstellungs-Falle, Prompt-Injection,
  Inhaber-Voice-Floskel-Schmuggel, forceSummarize-Härtefall, etc.).
- Schreibt das Ergebnis als feste JSON-Datei (z. B.
  `scripts/baseline-cases.json`) weg, damit jeder Lauf exakt dieselben Fälle
  verwendet (Reproduzierbarkeit). Reale Reviewer-Namen bleiben nur lokal
  (Datei wird nicht committet, siehe `.gitignore`-Ergänzung).

### 2. Baseline-Lauf — `scripts/run-baseline.ts`

- Importiert den Handler aus `api/generate-replies-v7.ts` direkt (kein HTTP,
  analog zum bestehenden Muster in `test-pipeline.ts`) und ruft ihn für jeden
  Fall aus `baseline-cases.json` auf.
- Schreibt alle generierten Antworten in eine lesbare Markdown-Datei
  (z. B. `scripts/baseline-results/<timestamp>.md`): pro Testfall der
  Bewertungstext direkt neben jeder generierten Antwort-Variante, darunter
  drei leere Checkbox-Zeilen:
  - `[ ] Floskel enthalten`
  - `[ ] Grammatikfehler / ergibt keinen Sinn`
  - `[ ] wirkt zusammengeklebt / abgehackt`

### 3. Auswertung (manuell)

- Der Nutzer geht die Markdown-Datei durch und hakt pro Antwort ab. Bewusst
  menschliche Bewertung (kein LLM-Judge) in dieser ersten Version, weil genau
  das eigene Urteil des Nutzers der Maßstab ist, den die Engine treffen soll.
- Eine kurze Zusammenfassung (z. B. manuell gezähltes Ergebnis am Ende des
  Dokuments oder separat berichtet) ergibt die Baseline-Zahl.

## Out of Scope

- Kein automatischer LLM-Judge (kann später ergänzt werden, wenn der
  Testfall-Satz zu groß für manuelles Scoring wird).
- Keine Änderung an einer der bestehenden Engines (v1–v7).
- Kein Aufräumen/Löschen alter Engine-Dateien (spätere, separate Entscheidung).

## Offene Punkte

Keine — Scope ist bewusst klein gehalten, um schnell eine belastbare Zahl zu
bekommen, bevor über Architektur-Änderungen entschieden wird.
