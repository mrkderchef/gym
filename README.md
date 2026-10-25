# Gym

Persönliche Trainings-Web-App (PWA) – Trainingsplan, Gewichte/Sätze/Wiederholungen loggen, Dashboard mit Auswertung pro Muskelgruppe.

- Kein Build-Schritt, kein Backend: reines HTML/CSS/JS.
- Daten liegen lokal im Browser (`localStorage`). Backup über *Plan → Backup exportieren*.
- Funktioniert offline (Service Worker) und lässt sich zum Home-Bildschirm hinzufügen.

## Dateien

| Datei | Inhalt |
|---|---|
| `plan.js` | Muskelgruppen und Standard-Trainingsplan |
| `app.js` | App-Logik (Dashboard, Training, Verlauf, Plan-Editor) |
| `styles.css` | Styles |
| `sw.js` | Offline-Cache – bei Änderungen `CACHE`-Version erhöhen |

## Lokal starten

```sh
python3 -m http.server 8000
```

Dann <http://localhost:8000> öffnen.
