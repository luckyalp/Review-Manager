# Referenz-Test-Set für Rezpond Engine

Zweck: Bei jeder Prompt-Änderung alle 10 Fälle einmal durchlaufen lassen (manuell "Antwort generieren" oder später automatisiert), statt nur die eine Bewertung zu prüfen, die gerade aufgefallen ist. So sieht man sofort, ob ein Fix für Fall A einen Rückschritt bei Fall B verursacht.

Für jeden Fall: erwarteter `classify()`-Modus, erwartete Kategorie(n), worauf beim Ergebnis zu achten ist.

---

### 1. Akustik/Konzept
**Sterne:** 3
**Text:** "Essen war lecker, aber es war so laut, dass wir uns kaum unterhalten konnten. Für ein romantisches Abendessen nicht geeignet."
**Erwartet:** CONTENT_MIXED (aktuell wird das wie CONTENT_NEGATIVE behandelt, da `classify()` nur `>=4`/`===3`/Rest unterscheidet) → volle Engine, Kategorie `akustik_konzept`.
**Achten auf:** Kein Entschuldigen für Lautstärke, Tipp für ruhigere Zeit falls im Profil hinterlegt, kein Tageszeit-Wort im Text ("Abendessen" darf im Zitat des Gasts stehen, aber nicht in Claudes eigener Antwort).

### 2. Fehler Küche/Service
**Sterne:** 2
**Text:** "Suppe war kalt, danach 25 Minuten auf das Hauptgericht gewartet. Kellner hat sich nicht mehr blicken lassen."
**Erwartet:** CONTENT_NEGATIVE, Kategorie `fehler_kueche_service`.
**Achten auf:** Beide Kritikpunkte einzeln gespiegelt (Double Deviation), SRP-Einladung ("beim nächsten Mal direkt Bescheid geben"), Kontakt-E-Mail erscheint (Sterne ≤ 2).

### 3. Essen/Geschmack
**Sterne:** 3
**Text:** "Alles frisch, aber das Curry war mir viel zu scharf gewürzt, kam so nicht erwartet."
**Erwartet:** CONTENT_MIXED, Kategorie `essen_geschmack`.
**Achten auf:** Sachlich, keine Rechtfertigung, Einladung vorab Wünsche zu äußern.

### 4. Preis/Leistung
**Sterne:** 3
**Text:** "Schöne Location, aber für die Portionsgröße echt zu teuer. Für den Preis erwarte ich mehr."
**Erwartet:** CONTENT_MIXED, Kategorie `preis_leistung`.
**Achten auf:** Selbstbewusst, keine Rabatt-Zusage, sachliche Begründung über Qualität/Herkunft.

### 5. Reinheit/Ambiente
**Sterne:** 2
**Text:** "Toilette war leider ziemlich dreckig, Tisch klebrig beim Hinsetzen."
**Erwartet:** CONTENT_NEGATIVE, Kategorie `reinheit_ambiente`.
**Achten auf:** Kurz, trocken, keine Ausreden, Kontakt-E-Mail erscheint.

### 6. Hausregeln/Konzept (der neue Fall)
**Sterne:** 1
**Text:** "Tische nur zum Essen zu vergeben ist unnötig kompliziert. Wollten nur was trinken, fühlten uns unerwünscht."
**Erwartet:** CONTENT_NEGATIVE, Kategorie `hausregeln_konzept`.
**Achten auf:** Kein Themen-Label ("Zur Tischregel:"), kein Amtsdeutsch ("aufgebaut", "durchgeführt"), Regel wird als Grund erklärt statt entschuldigt, andere Gäste werden nicht negativ dargestellt ("blockieren").

### 7. Drei oder mehr Kritikpunkte (forceSummarize)
**Sterne:** 1
**Text:** "Laut, Essen kalt, Kellner unfreundlich, und dann noch overpriced für das Gebotene. Nie wieder."
**Erwartet:** CONTENT_NEGATIVE, `forceSummarize: true` (4 Kritikpunkte), Kategorien `akustik_konzept` + `fehler_kueche_service` + `preis_leistung`.
**Achten auf:** Zusammenfassende statt einzeln aufzählende Antwort (Double-Deviation-Regel hat Ausnahme bei forceSummarize korrekt gegriffen), trotzdem nicht oberflächlich.

### 8. Rein positiv, keine Kritik (Kurzantwort-Weiche)
**Sterne:** 5
**Text:** "Fantastischer Abend, tolles Essen, super Service. Kommen definitiv wieder!"
**Erwartet:** CONTENT_POSITIVE, `analysis.count === 0` → Kurzantwort aus `pickPositivKernsatz`, KEINE volle Engine, KEIN Haiku-Call für Spickzettel nötig.
**Achten auf:** Variiert der Kernsatz bei mehrfachem Testen (4 Varianten im Pool)? Kein Tageszeit-Wort ("Abend" aus dem Gast-Zitat darf nicht in Claudes Antwort auftauchen, falls Kernsatz das Wort enthält − aktuell nicht der Fall, aber im Auge behalten).

### 9. Positiv mit versteckter Kritik (Grenzfall)
**Sterne:** 5
**Text:** "Super Abend, nur war es schon extrem laut. Trotzdem gerne wieder!"
**Erwartet:** CONTENT_POSITIVE, aber `analysis.count > 0` (Kritikpunkt: Lautstärke) → NICHT die Kurzantwort, sondern volle Engine mit Kategorie `akustik_konzept`.
**Achten auf:** Das ist der Fall, der in v8.2/v8.3 kaputt war (Kritik in positiven Bewertungen wurde ignoriert) − hier prüfen, ob die Weiche korrekt in die volle Engine wechselt statt den Kernsatz zu nutzen.

### 10. Leere Bewertung ohne Text
**Sterne:** 1
**Text:** "" (nur Sternebewertung, kein Text)
**Erwartet:** EMPTY_NEGATIVE → `getBoilerplateResponse`, KEIN Haiku-Call, KEIN Sonnet-Call.
**Achten auf:** Boilerplate-Text korrekt, Kontakt-E-Mail erscheint falls hinterlegt, sonst allgemeiner Fallback-Satz ohne Platzhalter-Lücke.

---

## Wie benutzen

Bei jeder Prompt-Änderung: Fälle 1, 2, 6, 7 und 9 sind die kritischsten (decken Double-Deviation, SRP, die neue Hausregel-Kategorie und die Kritik-in-Positiv-Weiche ab). Wenn Zeit fehlt, mindestens diese fünf laufen lassen, bevor eine Änderung live geht.
