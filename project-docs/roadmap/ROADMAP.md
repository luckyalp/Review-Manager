# ReviewMonitor — Roadmap & Offene Aufgaben

## Heute erledigt ✅
- Atlas-Prompt gebaut (Voice of Ton System)
- Drei Antwort-Varianten (Nah & direkt / Ruhig & professionell / Kurz & klar)
- Stern-Logik (leer/Text, positiv/negativ)
- Recovery-Modus bei 1-2 Sternen
- Doppelte "Persönliche Kontaktaufnahme" Karte entfernt
- 4 Bugs behoben (Cache-Guard, Fallback, Recovery-Karte, UI-Label)
- Master-Systemprompt V1 (Human Review Response Engine) integriert
- Chart auf Anzahl Bewertungen umgestellt (war: Durchschnitt)
- KPI-Icons auf Lucide umgestellt
- Sternverteilung-Balken: einheitliche Gelb-Farbe wiederhergestellt

---

## Jetzt als nächstes 🔴

### Supabase: reviews Tabelle anlegen
**Warum:** Status (Beantwortet/Ausstehend) geht beim Reload verloren — alles läuft nur im Browser-Speicher.

**Was zu tun ist:**
1. In Supabase Dashboard → Table Editor → New Table → Name: `reviews`
2. Felder anlegen:
   - `id` (int8, primary key, auto-increment)
   - `name` (text)
   - `initials` (text)
   - `stars` (int4)
   - `text` (text)
   - `date` (text)
   - `status` (text) — Werte: 'Ausstehend', 'Beantwortet', 'Abgelehnt'
   - `created_at` (timestamptz, default: now())
3. App.tsx anpassen:
   - Bewertungen beim Start aus Supabase laden (statt INITIAL_REVIEWS)
   - Status-Änderungen in Supabase speichern
   - Neue Bewertungen in Supabase schreiben

---

## Später 🟡

### Automatische Löschung
**Warum:** Datenbank soll schlank bleiben, alte Daten werden nicht gebraucht.
**Was:** 
- Beantwortet → nach 90 Tagen automatisch löschen
- Abgelehnt → sofort oder nach kurzer Zeit löschen
- Basis ist `created_at` Feld (bereits in der Tabelle geplant)
- Umsetzung: Supabase Edge Function oder Cron-Job

### Google Business API verbinden
**Warum:** Echte Bewertungen automatisch einlesen statt manuell eingeben.
**Was:**
- Google Service Account Key erstellen
- Account-ID und Standort-ID eintragen
- Sync-Funktion bauen (stündlich oder täglich)

### E-Mail Benachrichtigung (Resend)
**Warum:** Bei neuer Bewertung soll der Besitzer sofort eine E-Mail mit 3 KI-Antworten bekommen.
**Was:**
- Resend Account erstellen → API Key als RESEND_API_KEY in Vercel hinterlegen
- send-email.ts Funktion aktivieren
- Test-E-Mail funktioniert bereits — nur Key fehlt

---

## Irgendwann 🔵

### Code-Auslagerung / Refactoring
**Warum:** App.tsx hat über 2000 Zeilen — schwer zu warten, fehleranfällig bei größeren Änderungen.
**Wann:** Nach einem stabilen Release-Stand.
**Was:** App.tsx in einzelne Komponenten aufteilen:
- `src/components/Dashboard.tsx`
- `src/components/Analytics.tsx`
- `src/components/ReviewDetail.tsx`
- `src/components/Reviews.tsx`
- `src/components/Settings.tsx`
- `src/components/Auth.tsx`
- `src/components/Onboarding.tsx`
- `src/types.ts` — alle Types & Interfaces
- `src/lib/supabase.ts` — Supabase-Client
- `src/App.tsx` — nur noch Router-Logik (~150 Zeilen)

### Voice of Ton weiter testen
- Master-Systemprompt V1 mit echten Bewertungen testen
- Ton weiter verfeinern wenn nötig

### WhatsApp Benachrichtigung
- Nach E-Mail als zweiter Kanal
- WhatsApp Business API nötig

### Restaurant-Profil automatisch ableiten
- KI liest Webseite + Social Media
- Erstellt Stimmprofil automatisch
- Weniger Aufwand beim Onboarding neuer Kunden

### Login / Multi-Restaurant
- Aktuell: eine App, ein Restaurant
- Später: jeder Kunde hat eigenen Login und eigenes Profil

---

## Technischer Stack
- Frontend: React + TypeScript (Vite)
- Backend: Vercel Serverless Functions
- Datenbank: Supabase (PostgreSQL)
- KI: Claude API (Anthropic) — claude-sonnet-4-5
- E-Mail: Resend (noch nicht aktiv)
- Hosting: Vercel
- Code: GitHub (luckyalp/Review-Manager)
