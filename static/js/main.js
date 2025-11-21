
document.addEventListener('DOMContentLoaded', () => {

    // Inicializa a conexão com o Hub
    const socket = io();
    
    // Referências aos contêineres do HTML
    const dashboardContainer = document.getElementById('dashboard-container');
    const logContainer = document.getElementById('log-container');

    // Armazena o estado local de todos os dispositivos (recebido do Hub)
    let localDeviceStates = {};

    // --- FUNÇÃO PRINCIPAL DE RENDERIZAÇÃO ---
    // Esta função é chamada sempre que a lista de dispositivos muda
    function renderDashboard(devices) {
        // 1. Atualiza o estado local
        localDeviceStates = devices;
        
        // 2. Limpa o dashboard para redesenhar
        dashboardContainer.innerHTML = '';

        // 3. VERIFICA O ESTADO VAZIO (Seu requisito)
        if (!devices || Object.keys(devices).length === 0) {
            const emptyMessage = document.createElement('div');
            // Usamos as classes CSS do Tailwind e do seu .main-card
            emptyMessage.className = "main-card text-center text-gray-500 p-8 rounded-lg";
            emptyMessage.innerHTML = `
                <h3 class="text-xl font-semibold">Nenhum microcontrolador encontrado.</h3>
                <p class="mt-2">Aguardando dispositivos (ex: "Auditório", "Secretaria") se conectarem...</p>
            `;
            dashboardContainer.appendChild(emptyMessage);
            return;
        }

        // 4. CRIA OS BLOQUINHOS DINAMICAMENTE (Seu requisito)
        for (const deviceName in devices) {
            const device = devices[deviceName]; // device = { name: "Auditório", lamp: "off", ... }
            
            // Cria o 'bloquinho' (usando a classe .ESP-container do seu style.css)
            const card = document.createElement('section');
            card.className = 'ESP-container';
            // Define um ID único para o card, para fácil atualização
            card.id = `card-${deviceName}`; 

            // Define o estado visual (Online/Offline)
            const isOnline = device.connected;
            const statusText = isOnline ? 'Online' : 'Offline';
            const cardOpacity = isOnline ? 'opacity-100' : 'opacity-60 grayscale';
            card.className += ` ${cardOpacity}`; // Adiciona opacidade se offline

            // Define os estados dos botões
            const lampState = device.lamp || 'off';
            const coolerState = device.cooler || 'off';
            
            // Define o HTML interno do "bloquinho" (baseado no seu HTML estático)
            // (Note os IDs e onclicks dinâmicos)
            card.innerHTML = `
                <!-- Status do Dispositivo -->
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 mb-6 rounded-lg transition duration-300 ${isOnline ? 'bg-green-50' : 'bg-red-50'}" id="status-card-${deviceName}">
                    <span class="text-lg font-semibold text-gray-700 mb-2 sm:mb-0">${deviceName} Status:</span>
                    <span id="esp-status-${deviceName}" class="px-4 py-1 font-bold rounded-full text-white shadow-md ${isOnline ? 'bg-green-600' : 'bg-red-600'}">${statusText}</span>
                </div>

                <div class="flex flex-col gap-4">

                    <!-- Lâmpada -->
                    <div class="bg-blue-50 rounded-lg p-4 shadow-md hover:shadow-lg transition flex justify-between items-center">
                        <div class="flex items-center">
                            <svg id="icon-${deviceName}-lamp" class="w-8 h-8 mr-3 text-gray-400 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 11l3-3m0 0l3 3m-3-3v8m0-13A9 9 0 015 12a9 9 0 0118 0 9 9 0 01-9 9"></path>
                            </svg>
                            <div>
                                <h3 class="font-semibold text-xl text-blue-800">Lâmpada</h3>
                                <p id="label-${deviceName}-lamp" class="text-sm text-gray-500">Relé 1: Desligado</p>
                            </div>
                        </div>

                        <button 
                            id="btn-${deviceName}-lamp" 
                            class="toggle-button bg-red-600 text-white"
                            onclick="toggleDevice('${deviceName}', 'lamp')"
                            ${!isOnline ? 'disabled' : ''}>
                            Ligar
                        </button>
                    </div>

                    <!-- Cooler -->
                    <div class="bg-yellow-50 rounded-lg p-4 shadow-md hover:shadow-lg transition flex justify-between items-center">
                        <div class="flex items-center">
                            <svg id="icon-${deviceName}-cooler" class="w-8 h-8 mr-3 text-gray-400 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l2.5-2.5 2.5 2.5v13m-5-13h5m-5 0l-2.5 2.5V19"></path>
                            </svg>
                            <div>
                                <h3 class="font-semibold text-xl text-yellow-800">Cooler</h3>
                                <p id="label-${deviceName}-cooler" class="text-sm text-gray-500">Relé 2: Desligado</p>
                            </div>
                        </div>

                        <button 
                            id="btn-${deviceName}-cooler" 
                            class="toggle-button bg-red-600 text-white"
                            onclick="toggleDevice('${deviceName}', 'cooler')"
                            ${!isOnline ? 'disabled' : ''}>
                            Ligar
                        </button>
                    </div>

                    <!-- BOTÃO ÚNICO DE AGENDAMENTO PARA ESSE ESP -->
                    
                        <!-- Novo design para o botão de agendamento -->
                        <button
                            class="w-full bg-gray-200 text-gray-900 font-semibold px-4 py-2 rounded-lg shadow-md 
                                hover:bg-blue-200 hover:text-blue-800 
                                transition duration-300 ease-in-out"
                            onclick="openScheduleModal(['${deviceName}'])">
                            ⏱ Agendamento
                        </button>
                    </div>`;

            
            // Adiciona o bloquinho ao dashboard
            dashboardContainer.appendChild(card);
            
            // Atualiza o estado visual (cor/texto) dos botões recém-criados
            updateDeviceButtonUI(deviceName, 'lamp', lampState, isOnline);
            updateDeviceButtonUI(deviceName, 'cooler', coolerState, isOnline);
        }
    }

    // --- FUNÇÃO DE ATUALIZAÇÃO DA UI (BOTÕES) ---
    // (Separada da renderDashboard para clareza)
    function updateDeviceButtonUI(deviceName, target, state, isOnline) {
        const btn = document.getElementById(`btn-${deviceName}-${target}`);
        const label = document.getElementById(`label-${deviceName}-${target}`);
        const icon = document.getElementById(`icon-${deviceName}-${target}`);

        if (!btn || !label || !icon) return; // Sai se o elemento não existir (segurança)

        // Remove classes de cor anteriores
        btn.classList.remove('bg-green-600', 'bg-red-600', 'bg-gray-400');
        icon.classList.remove('text-yellow-600', 'text-gray-400');

        if (!isOnline) {
            btn.textContent = 'Offline';
            btn.classList.add('bg-gray-400');
            btn.disabled = true;
            label.textContent = `Relé ${target === 'lamp' ? 1 : 2}: Offline`;
            icon.classList.add('text-gray-400');
            return;
        }

        btn.disabled = false;
        
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
    }

    // --- FUNÇÃO DE COMANDO (Chamada pelo HTML) ---
    // Tornamos a função global (window.) para que o 'onclick' do HTML possa acessá-la
    window.toggleDevice = function(deviceName, target) {
        const device = localDeviceStates[deviceName];
        if (!device || !device.connected) {
            logMessage(`❌ Erro: Dispositivo ${deviceName} está Offline.`);
            return;
        }

        // Determina o próximo estado (toggle)
        const currentState = device[target] || 'off';
        const nextState = currentState === 'on' ? 'off' : 'on';
        
        // (Opcional: Atualização otimista da UI)
        // localDeviceStates[deviceName][target] = nextState;
        // updateDeviceButtonUI(deviceName, target, nextState, true);
        // (Não é necessário, pois o 'full_device_update' do Hub fará isso)

        // Envia o comando ao Hub (Flask)
        socket.emit('web_command', { 
            device_name: deviceName, // O nome do dispositivo (ex: "Auditório")
            target: target,          // O alvo (ex: "lamp")
            state: nextState         // O novo estado (ex: "on")
        });
        
        logMessage(`Comando enviado: ${deviceName} -> ${target.toUpperCase()} -> ${nextState.toUpperCase()}`);
    }

    // --- LISTENERS DO SOCKET.IO ---

    // Evento principal: Recebe a lista completa de dispositivos do Hub
    socket.on('full_device_update', (devices) => {
        logMessage('Lista de dispositivos atualizada recebida do Hub.');
        renderDashboard(devices);
    });

    // Eventos de conexão e log
    socket.on('connect', () => {
        logMessage(`🌐 Conectado ao Flask Hub (SID: ${socket.id}).`);
        // O 'full_device_update' será enviado pelo Hub logo em seguida.
    });

    socket.on('disconnect', () => {
        logMessage('🚫 Desconectado do Flask Hub.');
        renderDashboard({}); // Limpa o dashboard se o Hub cair
    });
    
    socket.on('status_update', (data) => {
        logMessage(`⚙️ HUB: ${data.message}`);
    });

    // Função de log (para depuração)
    function logMessage(message) {
        const p = document.createElement('p');
        p.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        logContainer.prepend(p); 
        while (logContainer.children.length > 50) {
            logContainer.removeChild(logContainer.lastChild);
        }
    }
});