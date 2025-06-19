#!/bin/bash

# Linux Cron-Job Setup für Temperaturbericht
# Führt das Skript täglich um 08:00 Uhr aus

echo "🔧 Erstelle Cron-Job für Temperaturbericht..."

# Aktuelles Verzeichnis ermitteln
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_SCRIPT="$SCRIPT_DIR/index.js"

# Prüfe ob Node.js verfügbar ist
if ! command -v node &> /dev/null; then
    echo "❌ Fehler: Node.js ist nicht installiert!"
    echo "Bitte installiere Node.js mit: sudo apt install nodejs npm"
    exit 1
fi

echo "✅ Node.js gefunden: $(node --version)"

# Prüfe ob das Skript existiert
if [ ! -f "$NODE_SCRIPT" ]; then
    echo "❌ Fehler: index.js nicht gefunden in $SCRIPT_DIR"
    exit 1
fi

echo "✅ Skript gefunden: $NODE_SCRIPT"

# Cron-Job Eintrag erstellen (täglich um 08:00 Uhr)
CRON_JOB="0 8 * * * cd $SCRIPT_DIR && node index.js >> $SCRIPT_DIR/temperature_report.log 2>&1"

# Prüfe ob der Cron-Job bereits existiert
if crontab -l 2>/dev/null | grep -q "temperature_report"; then
    echo "⚠️  Cron-Job existiert bereits. Lösche alten Eintrag..."
    crontab -l 2>/dev/null | grep -v "temperature_report" | crontab -
fi

# Neuen Cron-Job hinzufügen
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

if [ $? -eq 0 ]; then
    echo "✅ Cron-Job erfolgreich erstellt!"
    echo "📅 Der Temperaturbericht wird täglich um 08:00 Uhr ausgeführt."
    echo "📝 Logs werden in: $SCRIPT_DIR/temperature_report.log gespeichert"
else
    echo "❌ Fehler beim Erstellen des Cron-Jobs"
    exit 1
fi

echo ""
echo "📋 Nützliche Befehle:"
echo "Cron-Jobs anzeigen: crontab -l"
echo "Cron-Job löschen: crontab -r"
echo "Logs anzeigen: tail -f $SCRIPT_DIR/temperature_report.log"
echo "Skript manuell ausführen: cd $SCRIPT_DIR && node index.js"
echo ""
echo "🔍 Cron-Job Details:"
echo "Zeit: Täglich um 08:00 Uhr"
echo "Skript: $NODE_SCRIPT"
echo "Arbeitsverzeichnis: $SCRIPT_DIR"
echo "Log-Datei: $SCRIPT_DIR/temperature_report.log" 