# ReviewMonitor — Roadmap & Offene Aufgaben

## Heute erledigt ✅

### Session 1
- Atlas-Prompt gebaut (Voice of Ton System)
- Drei Antwort-Varianten
- Stern-Logik (leer/Text, positiv/negativ)
- Recovery-Modus bei 1-2 Sternen
- 4 Bugs behoben

### Session 2
- V2 Engine Prompt eingebaut (Analyse → Entscheidung → 3 Varianten)
- Drei Temperatur-Varianten: Ruhig & klar (A) / Warm & einladend (B) / Atmosphärisch (C)
- Claude API statt Gemini eingebaut
- Supabase reviews Tabelle — Bewertungen persistent gespeichert
- Feedback-Loop aktiviert — selected_answer in Supabase gespeichert
- Datum-Formatierung korrigiert
- Dashboard zeigt nur ausstehende Bewertungen
- Persönliche Ansprache mit Namen eingebaut (B + C)

---

## Jetzt als nächstes 🔴

### V2 Engine testen mit echten Bewertungen
**Warum:** Echter Test mit Henrys Sandbar Bewertungen steht noch aus.
**Was:**
- Alle 7 Test-Bewertungen durchgehen
- Prüfen ob A/B/C wirklich unterschiedliche Temperaturen haben
- Prüfen ob Namen-Ansprache natürlich wirkt
- Prüfen ob keine Floskeln mehr drin sind

---

## Später 🟡

### Google Business API verbinden
**Warum:** Echte Bewertungen automatisch einlesen statt manuell.
**Was:**
- Google Service Account Key erstellen (wird noch erwartet)
- Account-ID und Standort-ID eintragen
- Sync-Funktion bauen (stündlich oder täglich)
- Dann läuft auch E-Mail Benachrichtigung automatisch

### E-Mail Benachrichtigung (Resend)
**Warum:** Bei neuer Bewertung sofort E-Mail mit 3 KI-Antworten.
**Status:** Resend Key vorhanden, wartet auf Google API

### Varianten weiter schärfen
**Warum:** LLM hält A/B/C-Differenz nicht immer strikt ein.
**Was:**
- A wirklich sachlich-kühl
- B wirklich warm-einladend
- C wirklich bedeutungsdicht-elegant

### Automatische Löschung
**Was:**
- Beantwortet → nach 90 Tagen löschen
- Abgelehnt → sofort löschen
- Basis: created_at Feld bereits vorhanden

---

## Irgendwann 🔵

### System Prompt Caching (Kosten-Optimierung)
**Warum:** Bei vielen Restaurants wird der komplette Prompt jedes Mal mitgeschickt — das kostet Tokens.
**Was:** Anthropic Prompt Caching aktivieren — V1/V2 einmal cachen, nur Bewertung + Kontext mitschicken. Spart ~90% der Token-Kosten.
**Wann:** Erst relevant wenn mehrere Restaurants aktiv sind.

### Feedback-Auswertung
**Was:** Dashboard-Ansicht: welche Variante (A/B/C) wird am häufigsten gewählt?

### Decision Layer aus Prompt rausziehen
**Was:** Emotion-Erkennung als Code, nicht als Prompt — mehr Determinismus.

### WhatsApp Benachrichtigung
- Nach E-Mail als zweiter Kanal

### Restaurant-Profil automatisch ableiten
- KI liest Webseite + Social Media
- Erstellt Stimmprofil automatisch

### Login / Multi-Restaurant
- Aktuell: eine App, ein Restaurant
- Später: jeder Kunde eigener Login

---

## Technischer Stack
- Frontend: React + TypeScript (Vite)
- Backend: Vercel Serverless Functions
- Datenbank: Supabase (PostgreSQL)
- KI: Claude Sonnet (Anthropic API)
- E-Mail: Resend (Key vorhanden, wartet auf Google API)
- Hosting: Vercel
- Code: GitHub (luckyalp/Review-Manager)

### Onboarding Flow (Tinder-Style)
**Warum:** Statt langer Formularseite → Schritt für Schritt durch Fragen geführt werden.
**Was:**
- Eine Frage pro Screen (Karten-Style)
- Restaurantname, Typ, Küche, Du/Sie, Was macht euch besonders
- Am Ende: Profil ist ausgefüllt, KI hat alles was sie braucht
- Viel niedrigere Einstiegshürde für neue Kunden
- Inspiriert von Tinder / Duolingo Onboarding
**Wann:** Wenn erste echte Kunden kommen

### Free / Premium Modell
**Warum:** Monetarisierung wenn erste Kunden aktiv sind.
**Idee:**
- Free: 1 Restaurant, begrenzte Antworten pro Monat (z.B. 50)
- Premium: unbegrenzt, WhatsApp, mehrere Restaurants, Analyse
**Wann:** Wenn erste zahlende Kunden kommen und klar ist was sie brauchen

### Community Tab
**Warum:** Restaurantbesitzer können sich untereinander austauschen — Tipps, Erfahrungen, Best Practices.
**Was braucht es:**
- Login / Nutzerprofile
- Moderation
- Forum oder Chat-Struktur
**Wann:** Langfristig — erst wenn Nutzerbasis groß genug ist

### Feedback-Auswertung Dashboard
**Warum:** Zeigen welche Variante (A/B/C) am häufigsten gewählt wird — damit man sieht ob der Ton stimmt.
**Was:**
- Einfache Ansicht im Dashboard oder Analyse-Bereich
- Variante A: X mal gewählt / B: Y mal / C: Z mal
- Pro Restaurant auswertbar
- Basis: selected_answer Feld bereits in Supabase vorhanden
**Wann:** Sobald erste echte Bewertungen beantwortet wurden (ab ~20-30 Antworten sinnvoll)

### Automatisches Lernen (Phase 2)
**Warum:** KI soll aus Auswahl-Historie lernen welcher Ton für dieses Restaurant am besten passt.
**Was:**
- Auswahl-Historie wird mit in den Prompt gegeben
- KI passt Stil automatisch an — wenn immer B gewählt wird, wird B stärker gewichtet
**Wann:** Nach ~100 echten Antworten und wenn Feedback-Auswertung zeigt klares Muster

---

## Onboarding v2 (überarbeitete Version) 🔴

### Konzept
Statt langer Formularseite → smarter Onboarding-Flow der das meiste automatisch macht.

### Flow
**Schritt 1 — Google Business verbinden**
- Kunde verbindet sein Google Business Profil via OAuth
- App zieht automatisch: Restaurantname, Adresse, Kategorie, Telefon, Website
- Kein manuelles Eintippen nötig

**Schritt 2 — 3-5 gezielte Fragen (was Google nicht kennt)**
- Was macht euch besonders? (Freitext)
- Wie sprecht ihr eure Gäste an? (Du / Sie)
- Was ist eure Spezialität / euer Herzstück? (z.B. hausgemachte Burger, türkische Küche...)
- Weitere 1-2 Fragen die das Stimmprofil schärfen
- Atmosphäre & Stil (Auswahl: Modern & urban / Gemütlich & familiär / Rustikal & bodenständig / Gehoben & elegant / Lebhaft & gesellig)
- (Weitere 1-2 Fragen noch festlegen)

**Schritt 3 — Benachrichtigungseinstellung**
- Sofort per E-Mail bei jeder neuen Bewertung
- Gesammelt im Dashboard (täglich / wöchentlich)

**Schritt 4 — Antwortverhalten wählen**
- Modus 1: Alles manuell bestätigen (Standard, empfohlen)
- Modus 2: Mischmodus — schlechte Bewertungen manuell, gute automatisch
- Modus 3: Vollautomatisch ⚠️ Beta — alles wird automatisch gepostet (auf eigenes Risiko)

**Schritt 5 — Fertig → Dashboard**

### Kontakt-Hinweis Optimierung
- Kein Kontakt in den 3 Antwort-Varianten selbst
- Toggle unter den Varianten: "Kontakthinweis anhängen?" 
- Standard: AN bei 1-2 Sternen, AUS bei 3-5 Sternen
- Wenn AN: ein Satz wird automatisch angehängt

**Wann:** Nach Google API Freischaltung — dann macht Schritt 1 erst Sinn

### Willkommens-Screen Tagline klären
**Was:** Der aktuelle Text "schnell, persönlich, in Ihrem Stil" passt nicht ganz.
**Optionen:**
- "schnell, menschlich, authentisch"
- "schnell, persönlich, wie ein Mensch"
- Andere Formulierung die den Voice of Ton besser beschreibt
**Wann:** Beim nächsten Design-Review klären

### Design-Review: Farben überarbeiten
**Warum:** Aktuelles Design wirkt wie modernes KI-SaaS (Stripe/Linear/Vercel-Look) — weniger wie Gastronomie/Hospitality.
**Was:**
- Background `#0F172A` behalten — sehr gut
- Indigo `#4F46E5` leicht entschärfen oder ergänzen
- Teal/Petrol `#0F766E` als Accent testen — wirkt ruhiger, vertrauenswürdiger, hospitality-näher
- Weiß von `#FFFFFF` auf `#F8FAFC` oder `#E2E8F0` — weniger hart
- Primary Buttons → Indigo behalten
- Success/Trust Highlights → Teal/Petrol
**Wann:** Nach ersten echten Kunden — Design ist aktuell zweitrangig

### Dashboard Redesign
**Referenz:** Das ReplyMate Dashboard Bild (dunkelgrün + gold, reichhaltig)
**Was fehlt aktuell und soll später rein:**
- Durchschnittliche Antwortzeit (Ø Antwortzeit)
- Antwortquote in Prozent (z.B. 89%)
- Bewertungsverlauf als Linie über Zeit (letzte 30 Tage)
- Bewertungsquellen — Google / TripAdvisor / Facebook als Donut-Chart
- KI-Tipp der Woche
- Vergleich zum Vormonat (+/- Prozent)
**Farbschema:** Teal/Grün `#0F766E` + Warm-Gold als Accent — statt aktuellem Indigo
**Wann:** Wenn Google API läuft und echte Daten vorhanden sind

### Farbschema überarbeiten
**Entscheidung:** Teal/Grün `#0F766E` statt Indigo `#4F46E5`
**Warum:** Wirkt ruhiger, vertrauenswürdiger, hospitality-näher — weniger generisches KI-SaaS
**Was:**
- Primary Color: `#0F766E` (Teal/Petrol)
- Background: `#0F172A` behalten
- Accent: Warm-Gold `#B8933E`
- Weiß: `#F8FAFC` statt `#FFFFFF`
**Wann:** Nach ersten echten Kunden

### Expansion: Hotel-Version
**Idee:** Dieselbe Codebasis — aber mit einem "Modus" Parameter.
- `mode: "gastronomie"` → aktuelle App, Gastronomie-Felder
- `mode: "hotel"` → Hotel-spezifische Felder, anderer V2 Prompt
**Vorteil:** Ein Code, zwei Produkte. Zwei separate Landingpages, zwei Marken.
**Beispiel Hotel-Felder:** Zimmeranzahl, Sternekategorie, Spa/Wellness, Frühstück inklusive, etc.
**Wann:** Erst wenn Gastronomie-Version stabil läuft und erste zahlende Kunden hat

### Recovery-Prompt separat generieren
**Warum:** Normal- und Recovery-Antworten verfolgen unterschiedliche Ziele.
- Normal = öffentlich antworten, professionell wirken
- Recovery = deeskalieren, Vertrauen zurückgewinnen, in private Kommunikation überführen
**Was:**
- Recovery-Modus bekommt eigenen Prompt-Zweig
- Kein Rechtfertigen, mehr Empathie, klarer Weg zur direkten Kontaktaufnahme
- Getrennt vom Base Prompt, wie in der Architecture-Dokumentation vorgesehen
**Wann:** Nach Google API Freischaltung

### Inline Satz-Editing
**Warum:** Nutzer sollen nicht neu schreiben — sie sollen "tunen". Das reduziert Stress massiv.
**Was:**
- Antwort wird in 4 Blöcke aufgeteilt: Einstieg / Verständnis / Lösung / Abschluss
- Jeder Block einzeln anklickbar und editierbar
- Quick-Transform Buttons pro Block: "kürzer" / "wärmer" / "direkter" / "formeller" / "mehr Empathie"
- 1-Klick Tonalitätsänderung pro Satz
- Nutzer schreibt nicht neu — er justiert
- Konzept bereits als HTML-Mockup erstellt (inline-editing-konzept.html)
**Wann:** Nach Google API + ersten echten Kunden
