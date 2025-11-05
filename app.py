# app.py
import os
from flask import Flask, render_template, request, redirect, url_for, session
from flask_socketio import SocketIO, emit, join_room, leave_room

# --- Configuração ---
app = Flask(__name__)
# A chave secreta é essencial para proteger as sessões do usuário
app.config['SECRET_KEY'] = 'uma_chave_secreta_forte' 

# Credenciais de demonstração (Em um projeto real, isso viria de um DB)
USERS = {
    "admin": "123456",
    "user": "password"
}

# Configuração do SocketIO
socketio = SocketIO(app, 
                    cors_allowed_origins='*', 
                    logger=True, 
                    engineio_logger=True, 
                    async_mode='threading')

# Dicionário global para rastrear dispositivos conectados (apenas o ESP32)
connected_devices = {}
ESP_ROOM_NAME = 'esp32_sala'

# --- Rotas HTTP ---

@app.route('/')
def index():
    """Renderiza o template index.html, exigindo login."""
    # Se o usuário não estiver logado, redireciona para a página de login
    if 'logged_in' not in session:
        return redirect(url_for('login')) 

    initial_status = "Offline"
    if connected_devices:
        initial_status = "Online"
    
    # Passa o nome de usuário logado para o template, se necessário
    return render_template('index.html', 
                           initial_status=initial_status,
                           username=session.get('username', 'Usuário'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    """Lida com a lógica de login."""
    # Se já estiver logado, redireciona para o Hub
    if session.get('logged_in'):
        return redirect(url_for('index'))
        
    error = None
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        if username in USERS and USERS[username] == password:
            session['logged_in'] = True
            session['username'] = username
            print(f"[AUTH] Usuário '{username}' logado com sucesso.")
            return redirect(url_for('index'))
        else:
            error = 'Nome de usuário ou senha inválidos.'
            print(f"[AUTH] Tentativa de login falhou para usuário: {username}")
    
    return render_template('login.html', error=error)

@app.route('/logout')
def logout():
    """Encerra a sessão do usuário."""
    username = session.get('username', 'Desconhecido')
    session.pop('logged_in', None)
    session.pop('username', None)
    print(f"[AUTH] Usuário '{username}' fez logout.")
    return redirect(url_for('login'))


# --- Eventos Socket.IO ---
# Nota: O Socket.IO não precisa de checagem de sessão aqui, pois o cliente (navegador)
# só conseguirá carregar a página index.html (e iniciar o socket) se já estiver autenticado via HTTP.

@socketio.on('connect')
def handle_connect(auth=None):
    """Lida com novas conexões (navegadores e ESP32)."""
    # ... Lógica de conexão existente (não alterada)
    print(f"\n[SERVER] Cliente conectado: {request.sid}")


@socketio.on('disconnect')
def handle_disconnect():
    """Lida com a desconexão de clientes, notificando os demais."""
    sid = request.sid
    # ... Lógica de desconexão existente (não alterada)
    if sid in [dev['sid'] for dev in connected_devices.values()]:
        disconnected_name = next((name for name, dev in connected_devices.items() if dev['sid'] == sid), "ESP-Desconhecido")
        
        if disconnected_name in connected_devices:
            del connected_devices[disconnected_name]
            
        print(f"[SERVER] Dispositivo ESP32 DESCONECTADO ({disconnected_name}): {sid}")
        emit('esp_status_update', {'name': disconnected_name, 'status': 'Offline'}, broadcast=True)
    else:
        print(f"[SERVER] Cliente web desconectado: {sid}")

@socketio.on('register_esp')
def handle_esp_registration(data):
    """
    Recebe o pacote de registro do ESP32.
    """
    sid = request.sid
    device_name = data.get('name', 'Unknown')
    device_key = ESP_ROOM_NAME
    
    connected_devices[device_key] = {
        'sid': sid,
        'name': device_name
    }

    join_room(ESP_ROOM_NAME)

    print(f"\n[SERVER] ESP32 REGISTRADO: {device_name} (SID: {sid})")
    
    emit('status', {'message': f"Registro de {device_name} recebido com sucesso"}, to=sid)
    
    emit('esp_status_update', {'name': device_name, 'status': 'Online', 'sid': sid}, broadcast=True)


@socketio.on('web_command')
def handle_web_command(data):
    """
    Recebe um comando da interface web e o retransmite para o ESP32.
    """
    
    if ESP_ROOM_NAME not in connected_devices:
        emit('status_update', {'message': "Erro: ESP32 não está conectado."}, room=request.sid)
        print("[SERVER] Erro: Comando Web recebido, mas ESP32 não está conectado.")
        return

    esp_sid = connected_devices[ESP_ROOM_NAME]['sid']
    
    emit('command_to_esp', data, to=esp_sid) 
    
    print(f"[SERVER] Comando retransmitido para {connected_devices[ESP_ROOM_NAME]['name']} ({esp_sid}): {data}")
    
    emit('status_update', {'message': f"Comando '{data['target']}:{data['state']}' enviado."}, room=request.sid)


if __name__ == '__main__':
    print("\n[INÍCIO] Servidor Flask-SocketIO rodando na porta 5000...")
    print("Acesse no navegador: http://192.168.1.108:5000")
    print("Usuário/Senha de Teste: admin / 123456")
    socketio.run(app, host='0.0.0.0', port=5000)
