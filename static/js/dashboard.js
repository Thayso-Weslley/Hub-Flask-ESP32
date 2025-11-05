document.addEventListener('DOMContentLoaded', () => {

    // Conecta ao servidor Socket.IO (no namespace padrão)
    const socket = io();
    const dashboard = document.getElementById('dashboard-container');

    /**
     * Função principal: Ouve por atualizações de estado do Hub.
     * 'data' é o objeto JSON completo com o estado de TODOS os dispositivos.
     * Ex: {"ESP-Sala": {"lamp": "off", "cooler": "on", "connected": true}, ...}
     */
    socket.on('update_dashboard', (data) => {
        console.log('Estado recebido do Hub:', data);
        
        // Limpa o dashboard para redesenhar do zero
        dashboard.innerHTML = '';

        // Itera sobre cada dispositivo recebido
        for (const deviceName in data) {
            const state = data[deviceName]; // state = {"lamp": "off", ...}

            // 1. Cria o "bloquinho" (div principal)
            const block = document.createElement('div');
            block.className = 'device-block';
            if (!state.connected) {
                block.classList.add('disconnected');
            }

            // 2. Adiciona o título
            const title = document.createElement('h3');
            title.textContent = deviceName;
            block.appendChild(title);

            // 3. Cria o botão da Lâmpada
            const btnLamp = createButton(deviceName, 'lamp', state.lamp, state.connected);
            block.appendChild(btnLamp);
            
            // 4. Cria o botão do Cooler
            const btnCooler = createButton(deviceName, 'cooler', state.cooler, state.connected);
            block.appendChild(btnCooler);
            
            // 5. Adiciona o bloquinho ao dashboard
            dashboard.appendChild(block);
        }
    });

    /**
     * Função helper para criar os botões dinamicamente
     */
    function createButton(deviceName, target, currentState, isConnected) {
        const btn = document.createElement('button');
        const stateText = currentState.toUpperCase(); // "ON" ou "OFF"
        const targetText = target.charAt(0).toUpperCase() + target.slice(1); // "Lamp" ou "Cooler"

        btn.textContent = `${targetText} (${stateText})`;
        btn.className = `btn-control ${currentState === 'on' ? 'btn-on' : 'btn-off'}`;
        
        // Desabilita o botão se o dispositivo não estiver conectado
        if (!isConnected) {
            btn.disabled = true;
        }

        // Adiciona o listener de clique
        btn.addEventListener('click', () => {
            // Determina o NOVO estado (o oposto do atual)
            const newState = (currentState === 'on') ? 'off' : 'on';
            
            // Envia o comando para o Hub
            sendCommand(deviceName, target, newState);
        });

        return btn;
    }

    /**
     * Função que envia o comando para o Hub (servidor)
     */
    function sendCommand(deviceName, target, state) {
        console.log(`Enviando comando: ${deviceName}/${target} -> ${state}`);
        socket.emit('user_command', {
            device: deviceName,
            target: target,
            state: state
        });
    }

    // Gerenciamento de erros de conexão
    socket.on('connect_error', (err) => {
        console.error('Falha na conexão com o Hub:', err.message);
        dashboard.innerHTML = '<h2>Erro: Não foi possível conectar ao Hub. Tentando reconectar...</h2>';
    });

    socket.on('disconnect', () => {
        console.warn('Desconectado do Hub.');
        dashboard.innerHTML = '<h2>Desconectado. Tentando reconectar...</h2>';
    });

});