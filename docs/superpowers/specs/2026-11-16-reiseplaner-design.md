# Reiseplaner: Entwurf

Stand: 16.11.2026. Arbeitsname „Reiseplaner“.

## Absicht

Gregor plant mit Freunden eine Reise nach Skandinavien (Norwegen, Schweden). Die Gruppe braucht einen gemeinsamen Ort, an dem alle sehen, was wo und wann stattfindet, und an dem alle selbst Orte und Ideen eintragen. Die App ist nicht auf diese eine Reise zugeschnitten, sondern für beliebige Reisen nutzbar.

## Ziele

- Eine Reise anlegen und per Link teilen, ohne Registrierung.
- Zwei Links pro Reise: ein Admin-Link (lesen und alles bearbeiten) und ein Viewer-Link (nur lesen).
- Alle mit Admin-Link tragen Einträge ein: Orte, Aktivitäten, Unterkünfte, Fahrten, Ideen.
- Karte zeigt alle Einträge und die Route zwischen den geplanten Stationen.
- Tagesplan zeigt, was an welchem Tag und zu welcher Uhrzeit geplant ist.
- Läuft im Browser am PC und lässt sich am Handy zum Startbildschirm hinzufügen.
- Claude kann eine Reise per MCP lesen und bearbeiten.

## Nicht-Ziele

- Konten, Login, Rechte pro Person.
- App im App Store oder Play Store.
- Abstimmen über Ideen, Kosten teilen, Buchungen, Foto- oder Datei-Uploads.
- Bearbeiten ohne Internetverbindung.
- Automatische Vorschläge für Sehenswürdigkeiten in der App selbst. „Möglichkeiten“ entstehen, indem Personen oder Claude (per MCP) Ideen eintragen.
- Mehrsprachigkeit. Die Oberfläche ist deutsch.

## Anti-Ziele

- Ein Freund muss sich registrieren oder etwas installieren, bevor er eine Idee eintragen kann.
- Mit dem Viewer-Link lässt sich etwas ändern.
- Laufende Kosten für Hosting, Karten oder Routen.

## Rahmenbedingungen

- Eigener Ordner und eigenes Git-Repo: `~/Developer/reiseplaner`. Nicht im FH-Repo.
- Hosting bei Cloudflare im kostenlosen Rahmen.
- Kartenmaterial von OpenStreetMap.

## Wege, die zur Wahl standen

- **A: Geheimer Link pro Reise.** Wer den Link hat, ist drin. Kein Login. Wenig Aufwand. Einzelne Personen lassen sich nicht aussperren, nur der Link erneuern.
- **B: Konten mit Login.** Rechte pro Person, sauberer für fremde Nutzer. Deutlich mehr Aufwand und eine Hürde für Freunde.

Gregor hat **A** gewählt, mit der Ergänzung: zwei Links, Admin und Viewer.

## Was Gregor entschieden hat

- Alle Freunde tragen selbst ein.
- Weg A mit Admin-Link und Viewer-Link.
- Web-App für PC und Handy, Zugriff per MCP.

## Was ich festgelegt habe (meine Entscheidungen, korrigierbar)

### Rollen

- Admin-Link: Einträge anlegen, ändern, löschen; Reise umbenennen; beide Links erneuern; Reise löschen. Die mitplanenden Freunde bekommen diesen Link.
- Viewer-Link: nur lesen, zum Beispiel für Familie.
- Beim ersten Öffnen mit Admin-Link fragt die App einmal nach einem Namen und merkt ihn sich im Browser. Der Name steht am Eintrag („von Anna“). Er ist keine Sicherheit, nur eine Beschriftung.

### Eine Reise

- Name, optional Start- und Enddatum.
- Einträge mit: Titel, Art (Unterkunft, Aktivität, Fahrt, Sonstiges), Ort (Koordinaten und Ortsname), optional Datum, optional Uhrzeit, Notiz, Web-Link, Name des Erstellers.
- Pflicht sind nur Titel und Art. Der Ort ist freiwillig: Einträge ohne Ort erscheinen nur in den Listen, nicht auf der Karte und nicht in der Route.
- Ein Eintrag hat genau einen Ort. Eine Fahrt (Fähre, Flug) wird am Abfahrtsort eingetragen, das Ziel steht im Titel oder in der Notiz.
- Optionales Enddatum für mehrtägige Einträge (zum Beispiel drei Nächte in einer Unterkunft). Der Eintrag erscheint dann an jedem dieser Tage im Tagesplan, in der Route zählt er einmal.
- Ein Eintrag ohne Datum ist eine Idee. Ein Eintrag mit Datum steht im Tagesplan.
- Reihenfolge im Tagesplan: nach Datum, dann Uhrzeit; Einträge ohne Uhrzeit am Ende des Tages.

### Ansichten

- Startseite: Reise anlegen (Name eingeben, danach beide Links anzeigen und kopierbar machen).
- Reiseseite am PC: Karte links, rechts Tagesplan und darunter die Ideenliste.
- Reiseseite am Handy: Karte und Plan als zwei umschaltbare Ansichten.
- Karte: ein Marker pro Eintrag, farblich nach Art; Ideen sichtbar anders als geplante Einträge. Eine Linie verbindet die geplanten Einträge in zeitlicher Reihenfolge.
- Klick auf Marker oder Listeneintrag öffnet den Eintrag; mit Admin-Link bearbeitbar.
- Ort festlegen: Ortssuche per Texteingabe oder Tippen auf die Karte.

### Route

- Die Route verbindet alle Einträge mit Datum und Ort in zeitlicher Reihenfolge, über Tagesgrenzen hinweg. Ideen gehören nicht dazu.
- Zwischen je zwei aufeinanderfolgenden Einträgen wird eine Straßenroute (immer Auto, Autofähren eingeschlossen) berechnet und mit Dauer und Distanz angezeigt. Flüge erscheinen dadurch als gerade Linie oder als unsinnige Autoroute; das ist in dieser Version hingenommen.
- Schlägt die Berechnung fehl oder ist das Tageslimit erreicht, zeigt die Karte eine gerade Linie.
- Berechnete Routen werden pro Koordinatenpaar zwischengespeichert.

### Zusammenarbeit

- Die Reiseseite lädt alle paar Sekunden neu, was sich geändert hat.
- Speichern zwei denselben Eintrag gleichzeitig, gewinnt die letzte Speicherung.
- Löschen ist endgültig, nach einer Rückfrage.

### Ohne Empfang

- Die App selbst und der zuletzt geladene Stand der Reise bleiben lesbar.
- Kartenkacheln werden nicht gezielt für offline gespeichert.
- Bearbeiten ist offline gesperrt, mit Hinweis.

### MCP

- Ein MCP-Server unter derselben Adresse wie die App, als Connector in Claude eintragbar, ohne Login.
- Werkzeuge: Reise anlegen (gibt beide Links zurück), Reise lesen, Eintrag anlegen, Eintrag ändern, Eintrag löschen, Ort suchen.
- Zu Beginn der Planung prüfen: ob Claude einen MCP-Connector ohne Login akzeptiert.
- Jedes Werkzeug bekommt den Schlüssel der Reise als Parameter. Mit Viewer-Schlüssel sind nur Lesezugriffe erlaubt. So dient ein Connector für alle Reisen.

### Technik

- Cloudflare Pages für die Oberfläche, Pages Functions für die Schnittstelle, D1 als Datenbank.
- Karte mit Leaflet und OpenStreetMap-Kacheln.
- Ortssuche und Routenberechnung laufen über die eigene Schnittstelle, damit Schlüssel der Dienste nicht im Browser liegen und Antworten zwischengespeichert werden können. Vorgesehen: Nominatim oder Photon für die Suche, OpenRouteService für Routen.
- So wenige Abhängigkeiten wie möglich.
- Adresse: die kostenlose `*.pages.dev`-Adresse, keine eigene Domain.
- Veröffentlichen läuft über Gregors Cloudflare-Konto; er meldet sich dafür selbst an. Den kostenlosen OpenRouteService-Schlüssel legt Gregor selbst an und hinterlegt ihn als Geheimnis. Ohne Schlüssel läuft die App mit geraden Linien. (Offen: siehe Frage an Gregor.)
- Zu Beginn der Planung prüfen: aktuelle Limits und Nutzungsbedingungen von OpenRouteService, Nominatim und Photon.
- Schlüssel der Links: zufällig, mindestens 128 Bit. Die Rolle wird ausschließlich auf dem Server aus dem Schlüssel bestimmt.
- Eingaben werden auf dem Server geprüft (Pflichtfelder, Längen, Koordinatenbereich).

### Prüfung

- Automatische Tests für die Schnittstelle: Viewer-Schlüssel kann nichts ändern, unbekannter Schlüssel bekommt nichts, Admin-Schlüssel kann anlegen, ändern, löschen, Links erneuern.

## Nachtrag vom 16.11.2026 (von Gregor gewünscht)

- **Aufenthalte und Tagesausflüge:** Ein Eintrag der Art „Aufenthalt“ (Hütte, Fahrziel) hat Von- und Bis-Datum. Andere Einträge können als Tagesausflug an einen Aufenthalt gehängt werden. Die Hauptroute verbindet nur Einträge ohne Aufenthalt; Tagesausflüge bekommen eine eigene Linie von ihrem Aufenthalt. Im Plan steht der Aufenthalt am Anreisetag, jeder seiner Tage hat eine eigene Überschrift. Wird ein Aufenthalt gelöscht, bleiben seine Tagesausflüge als normale Einträge erhalten.
- **Bilder:** Pro Eintrag bis zu sechs Bild-Links. Das erste Bild ist der Marker auf der Karte; ein Klick öffnet eine Karte mit Bildern, Text und Knopf zum Eintrag. Hochladen von Dateien bleibt ein Nicht-Ziel (meine Entscheidung).
- **Gestaltung:** nach Apples Human Interface Guidelines, mit dem Skill `dickwu/apple-design-skill`: Glas nur auf der schwebenden Bedienebene, hell und dunkel nach Systemeinstellung, Sheets für Formulare, am Handy eine Leiste unten für Karte und Plan.

## Dem Erbauer überlassen

- Aufbau des Codes, Wahl eines Build-Werkzeugs oder Frameworks für die Oberfläche.
- Genaues Abfrageintervall und ob nur Änderungen oder der ganze Stand geladen werden.
- Farben, Symbole und Feinheiten der Oberfläche.
- Wahl zwischen Nominatim und Photon nach deren Nutzungsbedingungen.
- Umsetzung des MCP-Servers (offizielles SDK oder direkt).

## Bekannte Grenzen

- Jeder kann auf der Startseite Reisen anlegen. Kein Schutz gegen Missbrauch außer dem, was Cloudflare mitbringt.
- Wer den Admin-Link kennt, kann alles löschen. Abhilfe: Links erneuern. Eine Wiederherstellung gibt es nicht.
- Kostenlose Routen- und Suchdienste haben Tageslimits.
