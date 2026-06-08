# Smart Onboarding Feature — Spezifikation

## Was es ist
Beim ersten Login analysiert die KI automatisch alle vorhandenen Bewertungen des Restaurants und generiert einen fertigen Profil-Vorschlag. Der Gastronom klickt nur noch "Übernehmen".

## Problem das es löst
Gastronomen füllen Profil-Felder nicht freiwillig aus. Je weniger im Profil steht, desto schlechter die KI-Antworten — und desto geringer der Mehrwert des Produkts.

## Ablauf

1. Gastronom meldet sich an und verbindet Google via OAuth
2. System zieht alle vorhandenen Bewertungen via Google My Business API
3. KI analysiert die Bewertungen: Was wird oft kritisiert? Was wird gelobt?
4. Automatischer Profil-Vorschlag wird generiert — mit Regeln pro Situation
5. Gastronom sieht Vorschlag, kann anpassen oder direkt übernehmen

## Beispiel-Output der Analyse

| Muster in Bewertungen | Vorgeschlagene Regel |
|---|---|
| 8× Beschwerden über Wasserpreis | "Wir servieren stilles Mineralwasser in Glasflaschen — das ist eine bewusste Entscheidung." |
| 5× Beschwerden über Wartezeit | "Bei vollem Betrieb kann es zu längeren Wartezeiten kommen — wir bitten um Verständnis." |
| 12× Lob für hausgemachte Desserts | Besonderheit: "Hausgemachte Desserts, täglich frisch" |

## Offene Fragen

- **5.000+ Bewertungen?** → Nur die letzten 6–12 Monate analysieren. Aktueller = relevanter.
- **Wann triggern?** → Direkt nach OAuth-Verbindung, im Hintergrund.
- **Priorität** → Nach stabilem Kern, vor erstem Paid Customer.

## Regelbank — automatischer Aufbau im Betrieb

Das Regelwerk muss nicht beim Onboarding vollständig sein. Es baut sich selbst auf — durch echte Bewertungen.

### Ablauf

1. Bewertung kommt rein
2. KI versucht zu antworten
3. KI erkennt: Situation vorhanden, aber keine passende Regel im Profil
4. Statt schlechter Antwort → Stopp + konkrete Frage an den Gastronom:
   > "Gäste erwähnen oft den Wasserpreis. Wie soll ich darauf antworten?"
5. Gastronom gibt seine Regel ein
6. Regel wird im Profil gespeichert
7. Beim nächsten Mal beantwortet die KI diese Situation korrekt

### Wichtig
- Nur bei konkreten Policy-Situationen (Wasserpreis, Hund, Parkplatz...)
- Nicht bei allgemeinen Aussagen ("Service war gut")
- Der Context Check Mechanismus ist bereits eingebaut — fehlt nur noch das Speichern der Antwort

### Ergebnis
Das Regelwerk entsteht automatisch — aus echten Bewertungen, nicht aus einem Formular. Nur für Situationen die wirklich vorkommen.

## Wöchentlicher Regelwerk-Aufbau

Kein Formular. Kein Stress. Der Gastronom baut sein Regelwerk Stück für Stück auf — geführt, über mehrere Wochen.

### Phase 1 — Einmalige Analyse beim Start
- Letzte 6–12 Monate Bewertungen werden analysiert
- KI erkennt alle wiederkehrenden Problemsituationen
- Diese werden als offene Fragen gespeichert (z. B. 10–20 Stück)

### Phase 2 — Wöchentliche Aufgabe per E-Mail
- Jede Woche: 1–2 Fragen aus der Liste
- Gastronom sieht Fortschritt: "Woche 3 von 8 — noch 6 Fragen offen"
- Er beantwortet die Frage → Regel wird gespeichert → KI kann diese Situation ab sofort korrekt behandeln

### Beispiel E-Mail
> "Diese Woche: Frage 3 von 10
> Mehrere Gäste haben deinen Wasserpreis erwähnt. Wie soll die KI darauf antworten?
> [Antwort eingeben]"

### Warum das funktioniert
- Kein einmaliger Aufwand — kleiner wöchentlicher Schritt
- Gastronom sieht dass er aktiv an seinem Betrieb arbeitet
- Fortschrittsbalken erhöht die Bindung ans Produkt
- E-Mail-Kanal via Resend bereits vorhanden

## Status
Geplant — noch nicht gebaut.
