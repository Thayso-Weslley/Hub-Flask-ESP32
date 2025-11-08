const socket = io();
const statusElement = document.getElementById('esp-status');
const statusCard = document.getElementById('status-card');
const logContainer = document.getElementById('log-container');

let deviceStates = {
    lamp: 'off',
    cooler: 'off'
};

let currentStatus = typeof initialStatus !== 'undefined' ? initialStatus : "";

// --- Funções de UI ---

function logMessage(message) {
    const p = document.createElement('p');
    p.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logContainer.prepend(p);

    while (logContainer.children.length > 20) {
        logContainer.removeChild(logContainer.lastChild);
    }
}

function updateStatusDisplay(status) {
    statusElement.textContent = status;
    statusElement.className = statusElement.className.replace(/bg-(green|red|yellow)-600/g, '');
    statusCard.className = statusCard.className.replace(/bg-(green|red|yellow)-50/g, '');

    if (status === 'Online') {
        statusElement.classList.add('bg-green-600');
        statusCard.classList.add('bg-green-50');
    } else if (status === 'Offline') {
        statusElement.classList.add('bg-red-600');
        statusCard.classList.add('bg-red-50');
    } else {
        statusElement.classList.add('bg-yellow-600');
        statusCard.classList.add('bg-yellow-50');
    }
}

function updateDeviceButton(target, state) {
    const btn = document.getElementById(`btn-${target}`);
    const label = document.getElementById(`label-${target}`);
    const icon = document.getElementById(`icon-${target}`);

    if (!btn) return;

    btn.classList.remove('bg-green-600', 'bg-red-600');
    icon.classList.remove('text-yellow-600', 'text-gray-400');

    if (state === 'on') {
        btn.textContent = 'Desligar';
        btn.classList.add('bg-green-600');
        label.textContent = `Relé ${target === 'lamp' ? 1 : 2}: Ligado`;
        icon.classList.add('text-yellow-600');
    } else {
        btn.textContent = 'Ligar';
        btn.classList.add('bg-red-600');
        label.textContent = `Relé ${target === 'lamp' ? 1 : 2}: Desligado`;
        icon.classList.add('text-gray-400');
    }

    deviceStates[target] = state;
}

// Inicializa o estado visual
updateDeviceButton('lamp', 'off');
updateDeviceButton('cooler', 'off');

// --- Funções de Comunicação ---

function toggleDevice(target) {
    if (currentStatus !== 'Online') {
        logMessage('❌ Erro: ESP32 está Offline. Não é possível enviar comandos.');
        return;
    }

    const currentState = deviceStates[target];
    const nextState = currentState === 'on' ? 'off' : 'on';
    updateDeviceButton(target, nextState);

    socket.emit('web_command', { target: target, state: nextState });
    logMessage(`Comando enviado: ${target.toUpperCase()} -> ${nextState.toUpperCase()}`);
}

// --- Eventos Socket.IO ---

updateStatusDisplay(currentStatus);

socket.on('esp_status_update', (data) => {
    currentStatus = data.status;
    updateStatusDisplay(data.status);
    logMessage(`✅ Status atualizado: ESP32 agora está ${data.status}.`);
});

socket.on('status_update', (data) => {
    logMessage(`⚙️ HUB: ${data.message}`);
});

socket.on('connect', () => {
    logMessage(`🌐 Conectado ao Flask Hub (SID: ${socket.id}).`);
    if (currentStatus === "") updateStatusDisplay('Online');
});

socket.on('disconnect', () => {
    logMessage('🚫 Desconectado do Flask Hub.');
});
