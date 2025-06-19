# Temperaturbericht System

Dieses System druckt täglich einen Temperaturbericht aller Kühlschränke auf einem Epson TM-m30II-NT POS-Thermodrucker.

## Features

- 📊 Temperaturdaten von Home Assistant abrufen
- 🔋 Batteriestand der Sensoren überwachen
- ⚠️ Warnungen bei Temperaturüberschreitung
- 🔋 Warnungen bei niedrigem Batteriestand
- 🖨️ Automatischer Druck auf Epson-Drucker
- 📅 Tägliche Ausführung um 08:00 Uhr

## Installation

### Voraussetzungen

1. **Node.js** installieren:

   ```bash
   sudo apt update
   sudo apt install nodejs npm
   ```

2. **Abhängigkeiten** installieren:
   ```bash
   npm install
   ```

### Konfiguration

1. **Home Assistant URL** in `index.js` anpassen:

   ```javascript
   const HA_URL = "http://your-homeassistant-ip:8123";
   ```

2. **Home Assistant Token** in `index.js` anpassen:

   ```javascript
   const HA_TOKEN = "your-long-lived-access-token";
   ```

3. **Drucker-IP** in `index.js` anpassen:

   ```javascript
   const printerIP = "192.168.1.100";
   ```

4. **Sensoren** in `index.js` konfigurieren:
   ```javascript
   const SENSORS = [
     {
       name: "Kühlschrank",
       entity: "sensor.temperature_1",
       battery: "sensor.battery_1",
       maxTemp: 8.0,
     },
   ];
   ```

## Cron-Job Setup

### Automatische Einrichtung

```bash
chmod +x setup_cron.sh
./setup_cron.sh
```

### Manuelle Einrichtung

1. Cron-Job bearbeiten:

   ```bash
   crontab -e
   ```

2. Folgende Zeile hinzufügen:
   ```
   0 8 * * * cd /path/to/epos-print && node index.js >> temperature_report.log 2>&1
   ```

## Verwendung

### Manuelle Ausführung

```bash
node index.js
```

### Logs anzeigen

```bash
tail -f temperature_report.log
```

### Cron-Jobs verwalten

```bash
# Alle Cron-Jobs anzeigen
crontab -l

# Cron-Jobs löschen
crontab -r

# Cron-Job manuell ausführen
cd /path/to/epos-print && node index.js
```

## Beispiel-Ausgabe

```
TEMPERATURBERICHT
Zeit: 15.12.2024, 08:00:00

Kühlschrank
Aktuell: 7.8 °C, Batterie: 89%
Min: 5.3 °C, Max: 12.7 °C
----------------------------------

Kühltruhe
Aktuell: -17.6 °C, Batterie: 92%
Min: -19.1 °C, Max: 29.3 °C
----------------------------------

Picknick-Kühlschrank
Aktuell: 8.3 °C, Batterie: 85%
Min: 6.8 °C, Max: 17.8 °C
----------------------------------

Alles OK
```

## Troubleshooting

### Node.js nicht gefunden

```bash
sudo apt install nodejs npm
```

### Permission denied

```bash
chmod +x setup_cron.sh
```

### Cron-Job funktioniert nicht

1. Logs prüfen: `tail -f temperature_report.log`
2. Cron-Service prüfen: `sudo systemctl status cron`
3. Manuelle Ausführung testen: `node index.js`

### Drucker nicht erreichbar

1. IP-Adresse prüfen
2. Netzwerkverbindung testen: `ping 192.168.1.100`
3. Drucker-Webinterface aufrufen

## Dateien

- `index.js` - Hauptskript
- `setup_cron.sh` - Cron-Job Setup
- `temperature_report.log` - Log-Datei (wird automatisch erstellt)
- `README.md` - Diese Dokumentation
