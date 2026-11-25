# Reiseblog

Ein Reisetagebuch für Camper-Reisen – als Web-App, die sich auf dem iPhone wie eine App installieren lässt.

- **Reisen auf der Karte** mit echten Straßenrouten
- **Übernachtungen, Fahrten, Ausflüge** in einer Zeitleiste nach Tagen
- **Stellplätze** mit Ausstattung, Bewertung und allen Besuchen
- **Fotos** mit Ort und Datum aus dem Foto, auch als eigene Foto-Karte
- **Suche** nach Ort, Notiz, Jahr und Zeitraum
- **„Hier eintragen“** mit dem aktuellen Standort, „Weiterfahren“ zählt die Nächte selbst
- **Ziele merken und planen**, unterwegs mit Hinweis auf gemerkte Ziele in der Nähe
- **Kosten** je Reise (Übernachtung, Tanken, Maut, Fähre …), auch in fremder Währung
- **Wetter** zu jedem Reisetag, automatisch nachgetragen
- **Statistik** mit Weltkarte der besuchten Länder
- Funktioniert offline, hell und dunkel, am iPhone und am PC

Die App: https://si2po.github.io/reiseblog/

## Entwickeln

```bash
npm install
npm run dev        # http://localhost:5173
npm run check      # Typprüfung
npm test           # Tests
```

Gebaut mit SvelteKit, MapLibre GL und OpenFreeMap. Kartendaten © OpenStreetMap-Mitwirkende. Ortssuche: Photon (komoot), Routen: OSRM, Wetter: Open-Meteo, Wechselkurse: Frankfurter (EZB), Ländergrenzen: Natural Earth.
