// --- Bibliotecas ---
#include <WiFi.h>
#include <WebSocketsClient.h> 
#include <ArduinoJson.h>
#include <WiFiClient.h> 
#include <WiFiManager.h> // Para gerenciamento dinâmico do Wi-Fi

// ======================================================================
// --- CONFIGURAÇÕES DE APLICAÇÃO E PINAGEM ---
// ======================================================================
const char* socket_host = "192.168.1.201"; // colocar IP de conexão ao servidor WebHub
const uint16_t socket_port = 5000; // Porta host entre o Servidor Local e o ESP
const char* deviceName = "Quarto"; // Nome do ESP no WebHub

// --- Pinos de I/O ---
#define RELAY_LAMP_PIN 23
#define RELAY_COOLER_PIN 22

// Pinos dos LEDs de Status (Seus Pinos Personalizados)
const int LED_RED_PIN = 19;   // Vermelho: Wi-Fi Desconectado / Modo Config
const int LED_YELLOW_PIN = 18;  // Amarelo: Wi-Fi OK, Hub Desconectado
const int LED_GREEN_PIN = 17;   // Verde: Conexão Completa

// NOVO: Pino para o Botão de Reset
// O GPIO 0 é ideal, pois força o chip a entrar no modo flash (BOOT) se estiver LOW na inicialização.
// Mas aqui, vamos usá-lo apenas para resetar após a inicialização normal.
#define RESET_BUTTON_PIN 0 
const unsigned long RESET_HOLD_TIME_MS = 3000; // Segurar por 3 segundos
// ======================================================================

// --- Variáveis de Estado Globais ---
WebSocketsClient webSocket;
bool socketIOSessionStarted = false;
unsigned long resetStartTime = 0; // Contador de tempo para o reset

// Instância Global do WiFiManager (Necessária para chamar resetSettings() no loop)
WiFiManager wm;

// NOVO: Enum para o estado dos LEDs
enum ConnectionState {
    STATE_WIFI_DISCONNECTED = 0, // Vermelho
    STATE_HUB_DISCONNECTED = 1,  // Amarelo
    STATE_HUB_CONNECTED = 2      // Verde
};

// NOVO: Função para controlar os LEDs de Status (Atualizada para Piscar no Reset)
void setStatusLed(ConnectionState state) {
    // Apaga todos os LEDs
    digitalWrite(LED_RED_PIN, LOW);
    digitalWrite(LED_YELLOW_PIN, LOW);
    digitalWrite(LED_GREEN_PIN, LOW);

    switch (state) {
        case STATE_WIFI_DISCONNECTED:
             // Se o botão estiver pressionado (resetStartTime > 0), faz o LED piscar
            if (resetStartTime > 0 && (millis() / 250) % 2 == 0) { 
                // Permite piscar (LOW se for par, HIGH se for ímpar)
                digitalWrite(LED_RED_PIN, LOW);
            } else {
                digitalWrite(LED_RED_PIN, HIGH);
            }
            Serial.println("STATUS LED: [VERMELHO] - Wi-Fi Desconectado / Modo de Configuração.");
            break;
        case STATE_HUB_DISCONNECTED:
            digitalWrite(LED_YELLOW_PIN, HIGH);
            Serial.println("STATUS LED: [AMARELO] - Wi-Fi Conectado. Buscando Hub...");
            break;
        case STATE_HUB_CONNECTED:
            digitalWrite(LED_GREEN_PIN, HIGH);
            Serial.println("STATUS LED: [VERDE] - Conexão Completa: Wi-Fi + Hub.");
            break;
    }
}


// --- Função de tratamento de eventos da biblioteca WebSockets (INALTERADA) ---
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {

    String msg = (payload != NULL) ? String((char*)payload) : "";

    switch (type) {
        case WStype_DISCONNECTED:
            Serial.println("[WebSocket] DESCONECTADO!");
            socketIOSessionStarted = false;
            if (WiFi.status() == WL_CONNECTED) {
                setStatusLed(STATE_HUB_DISCONNECTED); 
            }
            break;
        
        case WStype_CONNECTED:
            Serial.printf("\n[WebSocket] CONECTADO ao URL: %s\n", payload);
            Serial.println("[Handshake] Aguardando pacote '0' (Open) do Servidor...");
            break;
        
        case WStype_TEXT:
            Serial.printf("[Msg Recebida] Payload Bruto: %s\n", msg.c_str());
            
            // --- LÓGICA DE HANDSHAKE SOCKET.IO (EIO=4) ---
            if (msg.startsWith("0")) {
                Serial.println("[Handshake] Pacote '0' (Open) recebido.");
                Serial.println("[Handshake] Enviando pacote '40' (Namespace Connect)...");
                webSocket.sendTXT("40");
            }
            else if (msg.startsWith("40")) {
                Serial.println("[Handshake] Pacote '40' (Namespace OK) recebido.");
                Serial.println("[Handshake] SESSÃO SOCKET.IO ESTABELECIDA!");
                socketIOSessionStarted = true;
                
                setStatusLed(STATE_HUB_CONNECTED); 
                
                StaticJsonDocument<64> dataDoc;
                dataDoc["name"] = deviceName;
                String dataJson;
                serializeJson(dataDoc, dataJson);
                String packet = "42[\"register_esp\", " + dataJson + "]";

                Serial.printf("[Registro] Enviando pacote Socket.IO: %s\n", packet.c_str());
                webSocket.sendTXT(packet);
            }
            // 3. Servidor envia um evento (Pacote "42")
            else if (msg.startsWith("42")) {
                String jsonContent = msg.substring(2); 

                DynamicJsonDocument doc(256);
                DeserializationError error = deserializeJson(doc, jsonContent);

                if (error) {
                    Serial.printf("[JSON] Falha no parse do comando: %s\n", error.f_str());
                    return;
                }
                
                if (doc.size() >= 2 && doc[0].is<const char*>() && doc[1].is<JsonObject>()) {
                    const char* eventName = doc[0];
                    JsonObject data = doc[1];

                    if (strcmp(eventName, "command_to_esp") == 0) {
                        const char* target = data["target"] | ""; 
                        const char* state = data["state"] | "";
                        int newState = (strcmp(state, "on") == 0) ? LOW : HIGH; 

                        if (strcmp(target, "lamp") == 0) {
                            Serial.printf("[Controle] Lâmpada (Pino %d) -> %s\n", RELAY_LAMP_PIN, state);
                            digitalWrite(RELAY_LAMP_PIN, newState);
                        } 
                        else if (strcmp(target, "cooler") == 0) {
                            Serial.printf("[Controle] Cooler (Pino %d) -> %s\n", RELAY_COOLER_PIN, state);
                            digitalWrite(RELAY_COOLER_PIN, newState);
                        }
                    } else if (strcmp(eventName, "status") == 0) {
                        const char* message = data["message"] | "Mensagem vazia";
                        Serial.printf("[Status Hub] %s\n", message);
                    }
                }
            }
            
            // 4. Servidor envia PING (Pacote "2")
            else if (msg == "2") {
                Serial.println("[Ping] Ping (2) recebido. Enviando Pong (3)...");
                webSocket.sendTXT("3");
            }
            
            break; 

        case WStype_ERROR:
            Serial.printf("[WebSocket] Erro: %s\n", payload);
            if (WiFi.status() == WL_CONNECTED) {
                 setStatusLed(STATE_HUB_DISCONNECTED); 
            }
            break;
        case WStype_PING: 
        case WStype_PONG:
            break;
        default:
            break;
    } 
}


void setup() {
    Serial.begin(115200);
    Serial.println("\nInicializando ESP32 (WebSocket Puro - V8.1 - Reset Manual)...");

    // 1. Inicializa pinos I/O
    pinMode(RELAY_LAMP_PIN, OUTPUT);
    pinMode(RELAY_COOLER_PIN, OUTPUT);
    digitalWrite(RELAY_LAMP_PIN, HIGH); // Relés OFF (Active LOW)
    digitalWrite(RELAY_COOLER_PIN, HIGH);

    pinMode(LED_RED_PIN, OUTPUT);
    pinMode(LED_YELLOW_PIN, OUTPUT);
    pinMode(LED_GREEN_PIN, OUTPUT);
    setStatusLed(STATE_WIFI_DISCONNECTED); // Inicia VERMELHO

    // NOVO: Inicializa o pino do botão de reset com PULL-UP interno
    // O pino será HIGH por padrão, e LOW quando pressionado/conectado ao GND.
    pinMode(RESET_BUTTON_PIN, INPUT_PULLUP);
    
    // 2. Conexão Wi-Fi usando WiFiManager
    String ap_name = "Config-Hub_" + String(deviceName);
    Serial.printf("[WiFiManager] Iniciando Configuração Wi-Fi: AP = %s\n", ap_name.c_str());

    // Se autoConnect falhar, ele cria o AP. Se for bem-sucedido, conecta e continua.
    if (wm.autoConnect(ap_name.c_str())) {
        Serial.println("[WiFiManager] Conexão Wi-Fi OK!");
        Serial.print("[WiFiManager] Endereço IP do ESP32: ");
        Serial.println(WiFi.localIP());
        setStatusLed(STATE_HUB_DISCONNECTED); // Amarelo
    } else {
        Serial.println("[WiFiManager] Falha ao conectar/configurar. Reiniciando em 5s...");
        // Mantém Vermelho
        delay(5000);
        ESP.restart(); 
    }


    // 3. CONEXÃO WEB SOCKET
    Serial.printf("[Conexão] Tentando iniciar WebSocket em ws://%s:%d/socket.io/?EIO=4...\n", socket_host, socket_port);
    
    webSocket.setExtraHeaders("User-Agent: ESP32-Client\r\n");
    webSocket.begin(socket_host, socket_port, "/socket.io/?EIO=4&transport=websocket"); 

    webSocket.onEvent(webSocketEvent);
    webSocket.setReconnectInterval(5000); 
}

void loop() {
    // --- LÓGICA DE RESET MANUAL ---
    // Checa se o botão está pressionado (LOW, pois usamos PULLUP)
    if (digitalRead(RESET_BUTTON_PIN) == LOW) { 
        if (resetStartTime == 0) {
            resetStartTime = millis();
            Serial.println("[Reset] Botão pressionado. Segure por 3 segundos para resetar...");
        }
        
        // Se o tempo de espera foi atingido
        if (millis() - resetStartTime > RESET_HOLD_TIME_MS) {
            Serial.println("\n[RESET FORÇADO] Credenciais do Wi-Fi apagadas! Reiniciando...");
            // Apaga o SSID e senha salvos no NVS.
            wm.resetSettings(); 
            // Reinicia o ESP32 para entrar no modo AP na próxima inicialização.
            ESP.restart(); 
        }
         // Chama setStatusLed para piscar o Vermelho enquanto segura o botão
         setStatusLed(STATE_WIFI_DISCONNECTED); 

    } else {
        // Se o botão for solto, zera o contador
        resetStartTime = 0; 
    }
    
    // --- LÓGICA DE CONEXÃO E PING ---
    webSocket.loop(); 

    // NOVO: Lógica de reconexão Wi-Fi
    if (WiFi.status() != WL_CONNECTED) {
        // Usa uma variável estática para evitar flood na serial
        static bool wasConnected = true; 
        if (wasConnected) {
            Serial.println("[WiFi] Conexão Wi-Fi Perdida. Tentando reconectar...");
            setStatusLed(STATE_WIFI_DISCONNECTED); // Vermelho
            wasConnected = false;
        }

        // Tenta reconectar com as credenciais salvas.
        WiFi.begin(); 
        delay(100); 

        if (WiFi.status() == WL_CONNECTED) {
            Serial.println("[WiFi] Reconectado.");
            setStatusLed(STATE_HUB_DISCONNECTED); // Amarelo
            wasConnected = true;
        }
    }
}