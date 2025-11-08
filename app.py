import os
from flask import Flask, render_template, request, redirect, url_for, session
from flask_socketio import SocketIO, emit

# --- Configuração ---
app = Flask(__name__)
app.config['SECRET_KEY'] = 'uma_chave_secreta_forte' 

# Credenciais de demonstração
USERS = {
    "admin": "123456", # Usuário
    "user": "password" # Senha
}

socketio = SocketIO(app, 
                    cors_allowed_origins='*', 
                    logger=True, 
                    engineio_logger=True,
                    async_mode='threading')

# ==============================================================================
# MUDANÇA ARQUITETURAL: O Hub agora é dinâmico
# Não pré-definimos "ESP-Sala". O Hub aprende quais dispositivos existem.
# A chave será o 'deviceName' (ex: "ESP-2C-0D-A7-58-FE-85")
# ==============================================================================
connected_devices = {}

# --- Rotas HTTP (Autenticação - Sem Mudanças) ---
@app.route('/')
def index():
    if 'logged_in' not in session:
        return redirect(url_for('login')) 
    # O HTML agora é dinâmico, não precisa passar o status inicial
    return render_template('index.html', username=session.get('username', 'Usuário'))

@app.route('/login', methods=['GET', 'POST'])
def login():
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
    
    return render_template('login.html', error=error)

@app.route('/logout')
def logout():
    session.pop('logged_in', None)
    session.pop('username', None)
    return redirect(url_for('login'))

# --- Eventos Socket.IO (Lógica do Hub Atualizada) ---

def get_clean_device_list():
    """Helper para enviar apenas dados seguros para o frontend."""
    frontend_data = {}
    for name, data in connected_devices.items():
        frontend_data[name] = {
            # 'sid' NÃO é enviado ao frontend por segurança
            "name": data["name"],
            "lamp": data.get("lamp", "off"), # Padrão 'off'
            "cooler": data.get("cooler", "off"), # Padrão 'off'
            "connected": data["connected"]
        }
    return frontend_data

@socketio.on('connect')
def handle_connect(auth=None):
    """Lida com novas conexões (navegadores e ESP32)."""
    sid = request.sid
    print(f"\n[SERVER] Cliente conectado: {sid}")
    
    # ATUALIZAÇÃO: Envia a lista completa de dispositivos para o NOVO cliente
    emit('full_device_update', get_clean_device_list(), to=sid)

@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid
    device_name = None
    
    # Encontra qual ESP32 (se houver) está desconectando
    for name, data in connected_devices.items():
        if data['sid'] == sid:
            device_name = name
            break
            
    if device_name:
        print(f"[SERVER] Dispositivo ESP32 DESCONECTADO ({device_name}): {sid}")
        connected_devices[device_name]['connected'] = False
        connected_devices[device_name]['sid'] = None
        # Transmite a atualização para TODOS os navegadores
        emit('full_device_update', get_clean_device_list(), broadcast=True)
    else:
        print(f"[SERVER] Cliente web desconectado: {sid}")

@socketio.on('register_esp')
def handle_esp_registration(data):
    """
    Recebe o pacote de registro do ESP32.
    data = {"name": "ESP-2C-0D-A7-58-FE-85"}
    """
    sid = request.sid
    device_name = data.get('name')
    
    if not device_name:
        print("[SERVER] Erro: Registro de ESP32 falhou, 'name' está faltando.")
        return

    print(f"\n[SERVER] ESP32 REGISTRADO: {device_name} (SID: {sid})")
    
    # Adiciona ou atualiza o dispositivo no dicionário
    connected_devices[device_name] = {
        'sid': sid,
        'name': device_name,
        'lamp': 'off', # Estado inicial padrão
        'cooler': 'off', # Estado inicial padrão
        'connected': True
    }
    
    # Envia uma confirmação de volta APENAS para o ESP32
    emit('status', {'message': f"Registro de {device_name} recebido com sucesso"}, to=sid)
    
    # Transmite a lista ATUALIZADA para TODOS os navegadores
    emit('full_device_update', get_clean_device_list(), broadcast=True)


@socketio.on('web_command')
def handle_web_command(data):
    """
    Recebe um comando da interface web e o retransmite para o ESP32.
    data = {"device_name": "ESP-Sala", "target": "lamp", "state": "on"}
    """
    device_name = data.get('device_name')
    target = data.get('target')
    new_state = data.get('state')

    if not device_name or device_name not in connected_devices:
        print(f"[SERVER] Erro: Comando para dispositivo desconhecido '{device_name}'.")
        return
        
    if not connected_devices[device_name]['connected']:
        print(f"[SERVER] Erro: Comando para dispositivo offline '{device_name}'.")
        return

    # Atualiza o estado no Hub
    connected_devices[device_name][target] = new_state
    
    # Encontra o SID do destinatário
    esp_sid = connected_devices[device_name]['sid']
    
    # Envia o comando APENAS para o ESP32 específico
    command_data = {'target': target, 'state': new_state}
    emit('command_to_esp', command_data, to=esp_sid) 
    
    print(f"[SERVER] Comando retransmitido para {device_name} ({esp_sid}): {data}")
    
    # Transmite a mudança de estado para TODOS os navegadores
    emit('full_device_update', get_clean_device_list(), broadcast=True)


# --- Execução do Servidor ---
if __name__ == '__main__':
    print("\n[INÍCIO] Servidor Flask-SocketIO (Dinâmico) rodando...")
    print(f"Acesse o Hub em http://SEU_IP_FIXO:5000")
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)