🏠 **Hub de Controle IoT: Flask + ESP32 (Socket.IO)**

Este projeto implementa um sistema de controle de dispositivos IoT em tempo real, utilizando Flask como servidor web/Hub de comunicação e um ESP32 como o dispositivo de campo para acionamento de relés. A comunicação bidirecional e de baixa latência é garantida pelo Socket.IO.

🚀 **Tecnologias Utilizadas**

---
Componente

Linguagem/Plataforma

Dependências Chave

Função Principal

Hub/Backend

Python (Flask)

Flask-SocketIO, python-socketio

Servidor Web, Gerenciamento de Status (Online/Offline) e Roteamento de Comandos.

Frontend/UI

JavaScript, HTML, CSS

Socket.IO Client, Tailwind CSS

Interface de Usuário responsiva e envio/recebimento de comandos em tempo real.

Dispositivo

C++ (Arduino)

WiFiManager, SocketIOClient

Conexão Wi-Fi portátil, recebimento de comandos e controle de GPIO (Relés).
---

📐 Arquitetura do Sistema

O sistema opera em uma arquitetura centralizada onde o servidor Flask atua como um broker de mensagens em tempo real:

Conexão: O ESP32 utiliza a biblioteca WiFiManager para se conectar à rede. Em seguida, estabelece uma conexão persistente de Socket.IO com o Hub Flask.

Status: O Hub Flask monitora a conexão. Se o ESP32 estiver conectado, o status na interface web é Online.

Comando: O usuário na interface web clica em um botão (Ligar/Desligar).

Roteamento: O navegador (cliente Socket.IO) envia o comando (web_command) para o Flask.

Ação: O Flask retransmite o comando diretamente para o ESP32 conectado.

Feedback: O ESP32 aciona o relé e pode opcionalmente enviar uma confirmação de volta ao Flask, que a exibe no log da interface web.

🛠️ Configuração do Backend (Flask Hub)

Pré-requisitos

Python 3.x

PIP (Gerenciador de Pacotes Python)

Instalação

Crie um ambiente virtual e instale as dependências:

# 1. Clonar o repositório
git clone <URL_DO_SEU_REPOSITÓRIO>
cd <nome-do-diretorio>

# 2. Criar e ativar o ambiente virtual (Exemplo Linux/macOS)
python3 -m venv venv
source venv/bin/activate
# (Para Windows, use: .\venv\Scripts\activate)

# 3. Instalar dependências
pip install Flask flask-socketio


Estrutura de Arquivos

/
├── app.py              # Aplicação Flask principal e lógica Socket.IO
├── README.md           # Este arquivo
├── requirements.txt    # Lista de dependências Python
└── templates/
    └── index.html      # Frontend HTML
└── static/
    ├── app.js          # Lógica do Socket.IO e UI do cliente
    └── styles.css      # Estilos customizados


Execução

Para iniciar o servidor Flask:

python app.py


O Hub estará disponível em http://127.0.0.1:5000 (ou na porta configurada).

💻 Configuração do Firmware (ESP32)

Pré-requisitos

Arduino IDE ou VS Code com extensão PlatformIO.

Placa ESP32 configurada.

Bibliotecas Necessárias

Instale as seguintes bibliotecas através do Gerenciador de Bibliotecas da IDE:

WiFiManager (Recomendado: Versão compatível com ESP32, ex: por tzapu ou Tabalabs)

SocketIOClient (Cliente Socket.IO para ESP32)

Portabilidade Wi-Fi

O uso do WiFiManager garante a portabilidade. Na primeira execução, o ESP32 criará um Ponto de Acesso (AP) chamado ESP32_HUB_SETUP.

Conecte-se a esse AP via celular ou computador.

Um portal de configuração abrirá automaticamente.

Selecione sua rede Wi-Fi local e insira a senha.

O ESP32 salvará as credenciais e reiniciará, conectando-se automaticamente.

Lógica de Conexão

O firmware deve ser configurado para apontar para o IP do seu servidor Flask (ex: http://192.168.1.10:5000) após a conexão bem-sucedida do WiFiManager.

Eventos Chave no ESP32:

Evento

Direção

Propósito

connect

ESP32 -> Flask

Notifica o Hub que o dispositivo está online.

web_command

Flask -> ESP32

Recebe o JSON de comando ({"target": "lamp", "state": "on"}).

status_update

ESP32 -> Flask

Opcional: Envia confirmação de que o comando foi executado.

🤝 Contribuição

Sinta-se à vontade para sugerir melhorias, como:

Migração para MQTT para maior robustez em ambientes de alta latência.

Implementação de um banco de dados para persistência do estado (ex: Firestore ou SQLite).

Autenticação de usuários na interface web.