
---

## 🏠 Hub de Controle IoT: Flask + ESP32 (Socket.IO)

Este projeto implementa um sistema de controle de dispositivos IoT em tempo real, utilizando **Flask** como servidor web/Hub de comunicação e um **ESP32** como o dispositivo de campo para acionamento de relés. A comunicação bidirecional e de baixa latência é garantida pelo **Socket.IO**.

## 🚀 Tecnologias Utilizadas

| Componente      | Linguagem/Plataforma | Dependências Chave             | Função Principal |
|------------------|----------------------|---------------------------------|------------------|
| **Hub/Backend**  | Python (Flask)       | ``Flask-SocketIO``, ``python-socketio`` | Servidor Web, gerenciamento de status (Online/Offline) e roteamento de comandos. |
| **Frontend/UI**  | JavaScript, HTML, CSS | ``Socket.IO Client``, Tailwind CSS  | Interface de usuário responsiva e envio/recebimento de comandos em tempo real. |
| **Dispositivo**  | C++ (Arduino)        | ``WiFiManager``, ``SocketIOClient``     | Conexão Wi-Fi portátil, recebimento de comandos e controle de GPIO (Relés). |
---


📐 Arquitetura do Sistema
---
O sistema opera em uma arquitetura centralizada onde o servidor Flask atua como um broker de mensagens em tempo real:

1. **Conexão:** O ESP32 utiliza a biblioteca `WiFiManager` para se conectar à rede. Em seguida, estabelece uma conexão persistente de **Socket.IO** com o Hub Flask.

2. **Status:** O Hub Flask monitora a conexão. Se o ESP32 estiver conectado, o status na interface web é `Online`.

3. **Comando:** O usuário na interface web clica em um botão (`Ligar`/`Desligar`).

4. **Roteamento:** O navegador (cliente Socket.IO) envia o comando (`web_command`) para o Flask.

5. **Ação:** O Flask retransmite o comando diretamente para o ESP32 conectado.

6. **Feedback:** O ESP32 aciona o relé e pode opcionalmente enviar uma confirmação de volta ao Flask, que a exibe no log da interface web.

## Fluxograma

![Logo do Projeto](./static/img/fluxograma.svg)

## 🛠️ Configuração do Backend (Flask Hub)

### Pré-requisitos

+ Python 3.x
+ PIP (Gerenciador de Pacotes Python)

### Instalação
Crie um ambiente virtual e instale as dependências:

```
# 1. Clonar o repositório:
git clone <URL_DO_SEU_REPOSITÓRIO>
cd <nome-do-diretorio>

# 2. Criar e ativar o ambiente virtual (Exemplo Linux/macOS):
python -m venv venv

# 2.1. Se for Linux/macOS, use:
source venv/bin/activate

# 2.1. Se for Windows, use:
.\venv\Scripts\activate

# 3. Instalar dependências:
pip install -r requirements.txt
```
💡 Dica: O arquivo requirements.txt contém todas as bibliotecas necessárias (como Flask, Flask-SocketIO, python-socketio, etc.), permitindo configurar o ambiente completo em um só comando.

## Estrutura de Arquivos
```
├── app.py              # Aplicação Flask principal e lógica Socket.IO
├── README.md           # Este arquivo
├── requirements.txt    # Lista de dependências Python
└── templates/
    └── index.html      # Frontend HTML
    └── login.html      # Tela de Login    
└── static/
    ├── app.js          # Lógica do Socket.IO e UI do cliente
    └── styles.css      # Estilos customizados
```

## Execução

Para iniciar o servidor Flask:

```
python app.py
```

O Hub estará disponível em http://127.0.0.1:5000 (ou na porta configurada).

## 💻 Configuração do Firmware (ESP32)

### Pré-requisitos
- Arduino IDE ou VS Code com extensão PlatformIO.
- Placa ESP32 configurada.

### Bibliotecas Necessárias

Instale as seguintes bibliotecas através do Gerenciador de Bibliotecas da IDE:

1. **WiFiManager** (Recomendado: Versão compatível com ESP32, ex: por tzapu ou Tabalabs)

2. **SocketIOClient** (Cliente Socket.IO para ESP32)

### Portabilidade Wi-Fi
---
O uso do ``WiFiManager`` garante a portabilidade. Na primeira execução, o ESP32 criará um Ponto de Acesso (AP) chamado ``ESP32_HUB_SETUP``.

1. Conecte-se a esse AP via celular ou computador.

2. Um portal de configuração abrirá automaticamente.

3. Selecione sua rede Wi-Fi local e insira a senha.

4. O ESP32 salvará as credenciais e reiniciará, conectando-se automaticamente.

### Lógica de Conexão
O firmware deve ser configurado para apontar para o IP do seu servidor Flask (ex: ``http://192.168.1.10:5000``) após a conexão bem-sucedida do ``WiFiManager``.

Eventos Chave no ESP32:

| **Evento** | **Direção** | **Propósito** |
|----|----|----|
| ``connect`` | ESP32 -> Flask | Notifica o Hub que o dispositivo está online. |
| ``web_command`` | Flask -> ESP32 | Recebe o JSON de comando (``{"target": "lamp", "state": "on"}``). |
| ``status_update`` | ESP32 -> Flask | Opcional: Envia confirmação de que o comando foi executado. |
