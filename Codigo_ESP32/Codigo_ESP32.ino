/*
 * CÓDIGO CLIENTE FINAL PARA ESP32 (C++)
 * VERSÃO 7.8: Remoção do Teste TCP Auxiliar.
 *
 * Objetivo: Forçar o uso direto do WebSocketsClient.begin() para evitar
 * falhas de buffer/alocação no WiFiClient auxiliar.
 *
 * Se a conexão falhar agora, é definitivamente um problema de protocolo/handshake
 * que o Flask já deveria ter reportado com sucesso.
 */

// --- Bibliotecas ---
#include <WiFi.h>
#include <WebSocketsClient.h> // A única biblioteca de WebSocket necessária (Links2004)
#include <ArduinoJson.h>
#include <WiFiClient.h> 

// ======================================================================
// --- CONFIGURAÇÕES ---
// ======================================================================
const char* ssid = "Omega_New-Fibra_2.4G";
const char* password = "demi1234";
const char* socket_host = "192.168.1.201"; // IP do Hub (Confirmado pelo celular)
const uint16_t socket_port = 5000;
const char* deviceName = "ESP-Quarto";      
// ======================================================================

#define RELAY_LAMP_PIN 23
#define RELAY_COOLER_PIN 22

// Instância APENAS da biblioteca WebSockets
WebSocketsClient webSocket;

// Variável de estado para controlar o handshake
bool socketIOSessionStarted = false;

// --- Função de tratamento de eventos da biblioteca WebSockets ---
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {

    String msg = (payload != NULL) ? String((char*)payload) : "";

    switch (type) {
        case WStype_DISCONNECTED:
            Serial.println("[WebSocket] DESCONECTADO!");
            socketIOSessionStarted = false;
            break;
        
        case WStype_CONNECTED:
            Serial.printf("\n[WebSocket] CONECTADO ao URL: %s\n", payload);
            Serial.println("[Handshake] Aguardando pacote '0' (Open) do Servidor...");
            // ESPERAMOS o pacote '0' para iniciar o handshake do Socket.IO
            break;
        
        case WStype_TEXT:
            Serial.printf("[Msg Recebida] Payload Bruto: %s\n", msg.c_str());
            
            // =======================================================
            // --- LÓGICA DE HANDSHAKE SOCKET.IO (EIO=4) ---
            // =======================================================

            // 1. Servidor envia "0" (Pacote OPEN)
            if (msg.startsWith("0")) {
                Serial.println("[Handshake] Pacote '0' (Open) recebido.");
                Serial.println("[Handshake] Enviando pacote '40' (Namespace Connect)...");
                // Responda com "40" (Solicitação de Namespace Padrão)
                webSocket.sendTXT("40");
            }
            
            // 2. Servidor responde com "40" (Namespace Conectado)
            else if (msg.startsWith("40")) {
                Serial.println("[Handshake] Pacote '40' (Namespace OK) recebido.");
                Serial.println("[Handshake] SESSÃO SOCKET.IO ESTABELECIDA!");
                socketIOSessionStarted = true;
                
                // AGORA sim, podemos nos registrar (Pacote 42)
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
                // Payload recebido: 42["event_name", {DATA_OBJECT}]
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
                        // Active LOW (Relé desliga com HIGH, liga com LOW)
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
                        // Recebe o status de volta do Flask (exemplo de confirmação)
                        const char* message = data["message"] | "Mensagem vazia";
                        Serial.printf("[Status Hub] %s\n", message);
                    }
                }
            }
            
            // 4. Servidor envia PING (Pacote "2")
            else if (msg == "2") {
                Serial.println("[Ping] Ping (2) recebido. Enviando Pong (3)...");
                // Responda com PONG (Pacote "3")
                webSocket.sendTXT("3");
            }
            
            break; // Fim do WStype_TEXT

        case WStype_ERROR:
            Serial.printf("[WebSocket] Erro: %s\n", payload);
            break;
        case WStype_PING: 
            Serial.println("[WebSocket] PING Recebido (Camada WS).");
            break;
        case WStype_PONG:
            Serial.println("[WebSocket] PONG Recebido (Camada WS).");
            break;
        default:
            break;
    } 
}


void setup() {
    Serial.begin(115200);
    Serial.println("\nInicializando ESP32 (WebSocket Puro - V7.8 - Conexão Limpa)...");

    pinMode(RELAY_LAMP_PIN, OUTPUT);
    pinMode(RELAY_COOLER_PIN, OUTPUT);
    digitalWrite(RELAY_LAMP_PIN, HIGH); // Relés iniciam DESLIGADOS (Active LOW)
    digitalWrite(RELAY_COOLER_PIN, HIGH);

    Serial.printf("Conectando em %s ", ssid);
    WiFi.begin(ssid, password); 
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\n[WiFi] Conectado!");
    Serial.print("[WiFi] Endereço IP do ESP32: ");
    Serial.println(WiFi.localIP());

    // =================================================================
    // --- CONEXÃO DIRETA WEB SOCKET ---
    // =================================================================
    Serial.printf("[Conexão] Tentando iniciar WebSocket em ws://%s:%d/socket.io/?EIO=4...\n", socket_host, socket_port);
    
    // Adiciona o cabeçalho User-Agent 
    webSocket.setExtraHeaders("User-Agent: ESP32-Client\r\n");
    
    // A própria função begin() fará o handshake TCP e a requisição WebSocket
    webSocket.begin(socket_host, socket_port, "/socket.io/?EIO=4&transport=websocket"); 

    webSocket.onEvent(webSocketEvent);
    webSocket.setReconnectInterval(5000); 
}

void loop() {
    webSocket.loop(); 
}