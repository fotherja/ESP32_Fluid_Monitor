#include <WiFi.h>
#include <WebServer.h>
#include <LittleFS.h>

#ifndef LED_BUILTIN
#define LED_BUILTIN 2
#endif

// a sample 24‐point data array (you can fill/update this at runtime)
float data24[2016] = {
  1.2,  3.4,  2.1,  4.5,  3.2,  5.1,
  0.9,  2.3,  3.7,  1.4,  4.0,  2.8,
  3.3,  4.7,  1.5,  2.2,  3.9,  4.1,
  2.6,  1.8,  0.7,  3.0,  2.4,  5.0
};

const char* ssid     = "yourAP";
const char* password = "yourPassword";

WebServer server(80);

void listFiles(const char* dirname = "/", uint8_t levels = 0) {
  Serial.printf("Listing %s:\n", dirname);
  File root = LittleFS.open(dirname);
  if(!root){
    Serial.println("  ▶ failed to open dir");
    return;
  }
  File file = root.openNextFile();
  while(file){
    Serial.print("  ▶ "); Serial.print(file.name());
    Serial.print("  \t"); Serial.println(file.size());
    file = root.openNextFile();
  }
}

void handleRoot() {
  Serial.println(">>> HTTP GET /");
  File file = LittleFS.open("/index.html", "r");
  if (!file) {
    Serial.println("  ✖ index.html not found");
    server.send(500, "text/plain", "index.html missing");
    return;
  }
  server.streamFile(file, "text/html");
  file.close();
}

void handleScript() {
  Serial.println(">>> HTTP GET /script.js");
  File file = LittleFS.open("/script.js", "r");
  if (!file) {
    Serial.println("  ✖ script.js not found");
    server.send(500, "text/plain", "script.js missing");
    return;
  }
  server.streamFile(file, "application/javascript");
  file.close();
}

void handleOn() {
  Serial.println(">>> HTTP GET /H");
  digitalWrite(LED_BUILTIN, HIGH);
  server.send(200, "text/plain", "LED ON");
  data24[0] += 0.2;
}

void handleOff() {
  Serial.println(">>> HTTP GET /L");
  digitalWrite(LED_BUILTIN, LOW);
  server.send(200, "text/plain", "LED OFF");
  data24[0] -= 0.2;  
}

void handleNotFound(){
  Serial.printf(">>> 404 for %s\n", server.uri().c_str());
  server.send(404, "text/plain", "Not found");
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);

  // Mount LittleFS
  if (!LittleFS.begin()) {
    Serial.println("✖ LittleFS mount failed!");
    while (true) delay(1000);
  }
  Serial.println("✔ LittleFS mounted");
  listFiles();

  // Start WiFi AP
  WiFi.softAP(ssid, password);
  Serial.print("AP up! Connect to http://");
  Serial.println(WiFi.softAPIP());

  // serve Chart.js from LittleFS
  server.serveStatic("/chart.umd.min.js", LittleFS, "/chart.umd.min.js");

  // HTTP routes
  server.on("/",         HTTP_GET, handleRoot);
  server.on("/script.js", HTTP_GET, handleScript);
  server.on("/H",        HTTP_GET, handleOn);
  server.on("/L",        HTTP_GET, handleOff);
  server.onNotFound(     handleNotFound);

  server.on("/data", HTTP_GET, [](){
    String json = "[";
    for(int i = 0; i < 24; i++){
      json += String(data24[i], 2);
      if(i < 23) json += ",";
    }
    json += "]";

    // **DEBUG** print it so we can see it in Serial Monitor
    Serial.print(">>> /data JSON: ");
    Serial.println(json);

    server.send(200, "application/json", json);
  });  

  server.begin();
  Serial.println("HTTP server started");
}

void loop() {
  server.handleClient();
}