// app.js
// Contém toda a lógica de manipulação da interface do usuário e comunicação via Socket.IO.

// Inicializa a conexão Socket.IO.
// Assumimos que o servidor (Flask) está na mesma origem.
const socket = io(); 

// Referências aos elementos do DOM
const statusElement = document.getElementById('esp-status');
const statusCard = document.getElementById('status-card');
const logContainer = document.getElementById('log-container');

// O estado atual dos dispositivos (inicia desligado)
let deviceStates = {
    lamp: 'off',
    cooler: 'off'
};

// Variável global que armazena o status inicial injetado pelo Flask (via template engine)
// NOTA: '{{ initial_status }}' será substituído pelo Flask/Jinja2 no HTML.
let currentStatus = "{{ initial_status }}"; 

// --- Funções de UI ---

/**
 * Adiciona uma mensagem ao log na interface.
 * Mantém o log limitado a 20 entradas.
 * @param {string} message - A mensagem a ser logada.
 */
function logMessage(message) {
    const p = document.createElement('p');
    p.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logContainer.prepend(p); // Adiciona a mensagem no topo

    // Limita o número de mensagens no log
    while (logContainer.children.length > 20) {
        logContainer.removeChild(logContainer.lastChild);
    }
}

/**
 * Atualiza o indicador de status do ESP32 (Online/Offline/Aguardando).
 * @param {string} status - O novo status ('Online', 'Offline', 'Aguardando').
 */
function updateStatusDisplay(status) {
    statusElement.textContent = status;
    
    // Expressão regular para limpar classes de cor anteriores
    const colorRegex = /bg-(green|red|yellow)-\d{2,3}/g; 

    // Limpa classes de cor no statusElement e statusCard
    statusElement.className = statusElement.className.replace(colorRegex, ''); 
    statusCard.className = statusCard.className.replace(colorRegex, '');
    
    if (status === 'Online') {
        statusElement.classList.add('bg-green-600');
        statusCard.classList.add('bg-green-50');
    } else if (status === 'Offline') {
        statusElement.classList.add('bg-red-600');
        statusCard.classList.add('bg-red-50');
    } else {
        // Assume 'Aguardando' ou outro estado transitório
        statusElement.classList.add('bg-yellow-600'); 
        statusCard.classList.add('bg-yellow-50');
    }
}

/**
 * Atualiza o botão e o ícone de um dispositivo específico.
 * @param {string} target - 'lamp' ou 'cooler'.
 * @param {string} state - 'on' ou 'off'.
 */
function updateDeviceButton(target, state) {
    const btn = document.getElementById(`btn-${target}`);
    const label = document.getElementById(`label-${target}`);
    const icon = document.getElementById(`icon-${target}`);

    if (!btn || !icon) return;

    // Remove classes de cor anteriores
    btn.classList.remove('bg-green-600', 'bg-red-600');
    icon.classList.remove('text-yellow-600', 'text-gray-400');
    
    if (state === 'on') {
        btn.textContent = 'Desligar';
        btn.classList.add('bg-green-600');
        label.textContent = `Relé ${target === 'lamp' ? 1 : 2}: Ligado`;
        icon.classList.add('text-yellow-600'); // Icone mais vibrante quando ligado
    } else {
        btn.textContent = 'Ligar';
        btn.classList.add('bg-red-600');
        label.textContent = `Relé ${target === 'lamp' ? 1 : 2}: Desligado`;
        icon.classList.add('text-gray-400'); // Icone mais discreto quando desligado
    }
    
    // Atualiza o estado interno
    deviceStates[target] = state;
}

// Inicializa o estado visual de todos os dispositivos como 'off' ao carregar
updateDeviceButton('lamp', 'off');
updateDeviceButton('cooler', 'off');


// --- Funções de Comunicação (Globais) ---
// A função precisa ser global para ser chamada pelo 'onclick' no HTML.

/**
 * Alterna o estado de um relé e envia o comando ao servidor Flask.
 * @param {string} target - 'lamp' ou 'cooler'.
 */
function toggleDevice(target) {
    if (currentStatus !== 'Online') {
        logMessage('❌ Erro: ESP32 está Offline. Não é possível enviar comandos.');
        return;
    }

    // Determina o próximo estado
    const currentState = deviceStates[target];
    const nextState = currentState === 'on' ? 'off' : 'on';

    // Atualiza a UI imediatamente para feedback rápido (UX)
    updateDeviceButton(target, nextState); 

    // Envia o evento 'web_command' ao Flask com o alvo e o novo estado
    socket.emit('web_command', { target: target, state: nextState });
    logMessage(`Comando enviado: ${target.toUpperCase()} -> ${nextState.toUpperCase()}`);
}

// Expõe a função para o escopo global para que o HTML possa chamá-la (necessário para onclick)
window.toggleDevice = toggleDevice;

// --- Setup e Event Listeners do Socket.IO ---

// Inicia a exibição do status com o valor inicial injetado pelo Flask
updateStatusDisplay(currentStatus);


// Evento: O status do ESP32 mudou (recebido do Flask/Hub)
socket.on('esp_status_update', (data) => {
    currentStatus = data.status;
    updateStatusDisplay(data.status);
    logMessage(`✅ Status atualizado: ESP32 agora está ${data.status}.`);
    
    // Se o ESP32 estiver offline, podemos resetar a UI para o estado inicial 'off'
    if (data.status === 'Offline') {
        updateDeviceButton('lamp', 'off');
        updateDeviceButton('cooler', 'off');
    }
});

// Evento: Recebe mensagens de status ou confirmação do Hub (Flask)
socket.on('status_update', (data) => {
    logMessage(`⚙️ HUB: ${data.message}`);
    // O sistema é otimista, assume que a mudança ocorreu. 
    // Em um sistema robusto, haveria um 'device_state_confirmed' do ESP32.
});

// Evento: Conectado ao servidor Flask
socket.on('connect', () => {
    logMessage(`🌐 Conectado ao Flask Hub (SID: ${socket.id}).`);
    // Se o status inicial for vazio (primeira carga), assume-se online, mas o Hub
    // deve rapidamente enviar o status real do ESP32.
    if (currentStatus === "") {
        updateStatusDisplay('Online'); 
    }
});

// Evento: Desconectado do servidor Flask
socket.on('disconnect', () => {
    logMessage('🚫 Desconectado do Flask Hub.');
    updateStatusDisplay('Desconectado');
});