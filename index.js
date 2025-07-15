const http = require("http");

// Home Assistant Konfiguration
const HA_URL = "http://homeassistant.local:8123";
const HA_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJhZjliOTk5YTk0YjA0Mjc2ODBlM2Q4MWZmYzE2NmM0MCIsImlhdCI6MTc1MDMyNjQ2NSwiZXhwIjoyMDY1Njg2NDY1fQ.0_p75ZwA-EkGvsxK8TkCmJezH5vb6V_kUUbaiCa5Xkc";

// Drucker-IP und Port
const printerIP = "192.168.178.69";
const printerPort = 80; // Standard für ePOS-HTTP

const SENSORS = [
  {
    name: "Kühlschrank",
    entity: "sensor.lumi_lumi_weather_temperature",
    battery: "sensor.lumi_lumi_weather_battery",
    maxTemp: 13.0,
  },
  {
    name: "Kühltruhe",
    entity: "sensor.lumi_lumi_weather_temperature_2",
    battery: "sensor.lumi_lumi_weather_battery_2",
    maxTemp: 0.0,
  },
  {
    name: "Picknick-Kühlschrank",
    entity: "sensor.lumi_lumi_weather_temperature_3",
    battery: "sensor.lumi_lumi_weather_battery_3",
    maxTemp: 10.0,
  },
];

async function getMinMaxOfLast24h(entityId, token, maxTemp) {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const startTime = yesterday.toISOString();
  const endTime = now.toISOString();
  const url = `${HA_URL}/api/history/period/${startTime}?end_time=${endTime}&filter_entity_id=${entityId}&minimal_response=false`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) throw new Error("Fehler beim Abrufen der Historie");
  const data = await response.json();
  const values = data[0]
    .map((item) => ({
      value: parseFloat(item.state),
      timestamp: new Date(item.last_changed),
    }))
    .filter((item) => !isNaN(item.value));

  const min = Math.min(...values.map((v) => v.value));
  const max = Math.max(...values.map((v) => v.value));

  // Finde den ersten Zeitpunkt, an dem die Temperatur überschritten wurde
  let firstExceededTime = null;
  if (maxTemp !== undefined && max > maxTemp) {
    const exceededReadings = values.filter((v) => v.value > maxTemp);
    if (exceededReadings.length > 0) {
      // Sortiere nach Zeitstempel und nimm den ersten
      exceededReadings.sort((a, b) => a.timestamp - b.timestamp);
      firstExceededTime = exceededReadings[0].timestamp;
    }
  }

  return { min, max, firstExceededTime };
}

async function getEntityState(entityId, token) {
  const url = `${HA_URL}/api/states/${entityId}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) throw new Error("Fehler beim Abrufen des Status");
  const data = await response.json();
  return data.state;
}

// Funktion zum Drucken der Temperaturdaten
async function printTemperatureReport() {
  try {
    console.log("📊 Lade Temperaturdaten von Home Assistant...");
    const now = new Date();
    const timestamp = now.toLocaleString("de-DE");
    let sensorReports = [];
    for (const sensor of SENSORS) {
      try {
        const currentTemp = await getEntityState(sensor.entity, HA_TOKEN);
        const { min, max, firstExceededTime } = await getMinMaxOfLast24h(
          sensor.entity,
          HA_TOKEN,
          sensor.maxTemp
        );
        let battery = "-";
        try {
          battery = await getEntityState(sensor.battery, HA_TOKEN);
        } catch (err) {
          console.error(
            `❌ Fehler beim Abrufen des Batteriestands für ${sensor.name}:`,
            err.message
          );
        }
        sensorReports.push({
          name: sensor.name,
          current: currentTemp,
          min,
          max,
          battery,
          maxTemp: sensor.maxTemp,
          firstExceededTime,
        });
        console.log(
          `🌡️  ${sensor.name}: ${currentTemp}C (Min: ${min}C, Max: ${max}C, Batterie: ${battery}%, MaxTemp: ${sensor.maxTemp}C)`
        );
      } catch (err) {
        sensorReports.push({
          name: sensor.name,
          current: "Fehler",
          min: "-",
          max: "-",
          battery: "-",
          firstExceededTime: null,
        });
        console.error(`❌ Fehler bei ${sensor.name}:`, err.message);
      }
    }
    // ePOS-Druckdaten erstellen
    // https://files.support.epson.com/pdf/pos/bulk/epos-print_xml_um_en_revk.pdf
    // https://download4.epson.biz/sec_pubs/pos/reference_en/epos_print/ref_epos_print_xml_en_xmlforcontrollingprinter_text.html
    let printData = `<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">`;
    printData += `<feed line="4" />`;
    printData += `<text dh="1" dw="1" font="font_e">TEMPERATURBERICHT</text>`;
    printData += `<feed line="1" />`;
    printData += `<text dh="0" dw="0" font="font_a">Zeit: ${timestamp}</text>`;
    printData += `<feed line="2" />`;
    for (const report of sensorReports) {
      printData += `<text font="font_b">${report.name}\n</text>`;
      printData += `<text font="font_a">Aktuell: ${report.current} °C, Batterie: ${report.battery}%\n</text>`;
      printData += `<text font="font_a">Min: ${report.min} °C, Max: ${report.max} °C\n</text>`;
      printData += `<feed line="1" />`;
      printData += `<text>----------------------------------\n</text>`;
      printData += `<feed line="1" />`;
    }

    // Prüfe ob eine Temperatur überschritten wurde
    const tempExceededSensors = sensorReports.filter((report) => {
      if (report.max === "Fehler" || report.maxTemp === undefined) return false;
      return parseFloat(report.max) > report.maxTemp;
    });

    // Prüfe ob eine Batterie gewechselt werden muss
    const lowBatterySensors = sensorReports.filter((report) => {
      if (report.battery === "-" || report.battery === "Fehler") return false;
      return parseFloat(report.battery) < 18;
    });

    printData += `<feed line="2" />`;
    if (tempExceededSensors.length > 0) {
      printData += `<text em="1" font="font_b" align="center">TEMPERATUR ÜBERSCHRITTEN:\n </text>`;
      for (const sensor of tempExceededSensors) {
        const exceededTime = sensor.firstExceededTime
          ? sensor.firstExceededTime.toLocaleString("de-DE")
          : "Unbekannt";
        printData += `<text em="0" font="font_a" align="center">${sensor.name} (${sensor.max}°C > ${sensor.maxTemp}°C)\n</text>`;
        printData += `<text em="0" font="font_a" align="center">Erste Überschreitung: ${exceededTime}\n</text>`;
        console.log(
          `🌡️  Temperatur überschritten für ${sensor.name} (${sensor.max}°C > ${sensor.maxTemp}°C) um ${exceededTime}`
        );
      }
    } else {
      printData += `<text font="font_a" align="center">Alles OK</text>`;
      console.log("✅ Alle Temperaturen sind im normalen Bereich.");
    }

    // Batterie-Warnungen ausgeben
    if (lowBatterySensors.length > 0) {
      printData += `<feed line="1" />`;
      printData += `<text em="1" font="font_b" align="center">BATTERIE WECHSELN: </text>`;
      for (const sensor of lowBatterySensors) {
        printData += `<text em="0" font="font_a" align="center">${sensor.name} (${sensor.battery}%)\n</text>`;
        console.log(`🔋 Batterie wechseln für ${sensor.name} (${sensor.battery}%)`);
      }
    }

    printData += `<feed line="3" />`;
    printData += `<cut type="feed" />`;
    printData += `</epos-print>`;
    console.log("🔍 Debug - Vollständiges XML:");
    console.log(printData);
    // SOAP-Envelope erstellen
    const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body>${printData}</soapenv:Body></soapenv:Envelope>`;
    // HTTP-Request-Optionen
    const options = {
      hostname: printerIP,
      port: printerPort,
      path: "/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000",
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "Content-Length": Buffer.byteLength(soapEnvelope),
        SOAPAction: '""',
        "If-Modified-Since": "Thu, 01 Jan 1970 00:00:00 GMT",
      },
      timeout: 10000,
    };
    console.log("🖨️ Sende Druckauftrag an Drucker...");
    console.log(`📡 Verbindung zu: ${printerIP}:${printerPort}`);
    console.log("📄 XML-Daten:", printData);
    // Anfrage senden
    const req = http.request(options, (res) => {
      console.log(`📥 HTTP Status: ${res.statusCode}`);
      let responseData = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        responseData += chunk;
      });
      res.on("end", () => {
        console.log("Antwort vom Drucker:\n", responseData);
        if (responseData.includes('success="true"')) {
          console.log("✅ Temperaturbericht erfolgreich gedruckt!");
        } else if (responseData.includes("SchemaError")) {
          console.log("❌ Schema-Fehler - XML-Format ist nicht korrekt");
        } else {
          console.log("❌ Druck fehlgeschlagen");
        }
      });
    });
    req.on("error", (e) => {
      console.error(`❌ Fehler beim Drucken: ${e.message}`);
    });
    req.on("timeout", () => {
      console.error("⏰ Timeout - Drucker antwortet nicht");
      req.destroy();
    });
    req.write(soapEnvelope);
    req.end();
  } catch (error) {
    console.error("❌ Fehler beim Abrufen der Temperaturdaten:", error.message);
  }
}

// Temperaturbericht drucken
printTemperatureReport();
