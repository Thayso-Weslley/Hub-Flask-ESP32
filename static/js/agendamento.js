/*
 * AGENDAMENTO.JS — Lógica do CRUD de Agendamentos
 * 100% separado do main.js
 */


document.addEventListener("DOMContentLoaded", () => {

    // Referências do HTML
    const modal = document.getElementById("schedule-modal");
    const deviceSelect = document.getElementById("schedule-device");
    const schedulesListContainer = document.getElementById("schedules-list-container");

    const newScheduleForm = document.getElementById("new-schedule-form");
    const daysContainer = document.getElementById("schedule-days-container");

    // Estado global interno de agendamentos carregados
    let selectedDevice = null;
    let schedulesCache = {}; // { "Auditório": [ ... ] }

    // =====================================================================
    // 1. POPULAR LISTA DE DIAS DA SEMANA
    // =====================================================================

    const daysOfWeek = [
        { label: "Seg", value: "mon" },
        { label: "Ter", value: "tue" },
        { label: "Qua", value: "wed" },
        { label: "Qui", value: "thu" },
        { label: "Sex", value: "fri" },
        { label: "Sáb", value: "sat" },
        { label: "Dom", value: "sun" },
    ];

    daysOfWeek.forEach(day => {
        const wrapper = document.createElement("label");
        wrapper.className = "flex items-center gap-1 text-sm";
        wrapper.innerHTML = `
            <input type="checkbox" value="${day.value}" class="day-checkbox">
            ${day.label}
        `;
        daysContainer.appendChild(wrapper);
    });

    // =====================================================================
    // 2. ABERTURA/FECHAMENTO DO MODAL — Funções globais
    // =====================================================================

    window.openScheduleModal = function(deviceNameList) {
        
        // Limpa select de dispositivos
        deviceSelect.innerHTML = "";

        deviceNameList.forEach(name => {
            const op = document.createElement("option");
            op.value = name;
            op.textContent = name;
            deviceSelect.appendChild(op);
        });

        // Seleciona o primeiro por padrão
        selectedDevice = deviceNameList[0] || null;

        document.getElementById("hidden-device-name").value = selectedDevice; // Atualiza campo hidden do form

        // Carrega lista de agendamentos do primeiro dispositivo
        if (selectedDevice) {
            loadSchedules(selectedDevice);
        }

        modal.classList.remove("hidden");
    };

    window.closeScheduleModal = function() {
        modal.classList.add("hidden");
    };

    // =====================================================================
    // 3. QUANDO O DEVICE DO SELECT MUDA, RECARRREGAR LISTA
    // =====================================================================

    deviceSelect.addEventListener("change", () => {
        selectedDevice = deviceSelect.value;
        loadSchedules(selectedDevice);
    });

    // =====================================================================
    // 4. FUNÇÃO PARA CARREGAR AGENDAMENTOS DE UM DISPOSITIVO
    // =====================================================================

    async function loadSchedules(deviceName) {
        schedulesListContainer.innerHTML =
            `<p class="text-gray-500">Carregando agendamentos...</p>`;

        try {
            const response = await fetch(`/api/schedules/${deviceName}`);
            const schedules = await response.json();

            schedulesCache[deviceName] = schedules;
            renderSchedules(deviceName);

        } catch (error) {
            schedulesListContainer.innerHTML =
                `<p class="text-red-600">Erro ao carregar agendamentos.</p>`;
            console.error(error);
        }
    }

    // =====================================================================
    // 5. RENDERIZAÇÃO DA LISTA DE AGENDAMENTOS
    // =====================================================================

    function renderSchedules(deviceName) {
    const list = schedulesCache[deviceName] || [];

    if (list.length === 0) {
        schedulesListContainer.innerHTML = `
            <p class="text-center text-gray-500 p-4 bg-gray-100 rounded-lg">
                Nenhum agendamento encontrado.
            </p>`;
        return;
    }

    schedulesListContainer.innerHTML = "";

    list.forEach(schedule => {

        const item = document.createElement("div");
        item.className =
            "p-4 rounded-lg shadow bg-white border flex justify-between items-center";

        item.innerHTML = `
            <div>
                <p class="font-semibold text-gray-800">${schedule.time} — ${schedule.state.toUpperCase()}</p>
                <p class="text-sm text-gray-500">
                    ${schedule.target === "lamp" ? "Lâmpada" : "Cooler"}
                </p>
                <p class="text-xs text-gray-400">
                    Repetir: ${schedule.days.join(", ").toUpperCase()}
                </p>
            </div>

            <div class="flex gap-3">

                <!-- Botão editar -->
                <button
                    class="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-500 hover:bg-blue-600 text-white"
                    onclick="editSchedule('${deviceName}', '${schedule.id}')">
                    <i class="fa-solid fa-pen"></i>
                </button>

                <!-- Botão excluir -->
                <button
                    class="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500 hover:bg-red-600 text-white"
                    onclick="deleteSchedule('${deviceName}', '${schedule.id}')">
                    <i class="fa-solid fa-trash"></i>
                </button>

            </div>
        `;


        schedulesListContainer.appendChild(item);
    });
    }

    // =====================================================================
    // 6. CRIAÇÃO DE NOVOS AGENDAMENTOS
    // =====================================================================

    newScheduleForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const deviceName = document.getElementById("hidden-device-name").value;

        const selectedDays = [...document.querySelectorAll(".day-checkbox:checked")].map(c => c.value);

        if (selectedDays.length === 0) {
            alert("Selecione pelo menos 1 dia.");
            return;
        }

        const payload = {
            device_name: deviceName,
            target: document.querySelector('select[name="target"]').value,
            state: document.querySelector('select[name="state"]').value,
            time: document.querySelector('input[name="time"]').value,
            days: selectedDays
        };

        // Se estamos editando → PUT
        if (editingScheduleId) {

            const response = await fetch(`/api/schedules/${editingScheduleId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success) {
                alert("Agendamento atualizado!");
                loadSchedules(deviceName);
                leaveEditMode();
                newScheduleForm.reset();
            } else {
                alert("Erro ao atualizar.");
            }

            return;
        }

        // Se NÃO estamos editando → POST
        const response = await fetch("/api/schedules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.success) {
            alert("Agendamento criado!");
            loadSchedules(deviceName);
            newScheduleForm.reset();
        } else {
            alert("Erro ao criar.");
        }
    });


    // =====================================================================
    // 7. EXCLUIR AGENDAMENTO (Função global)
    // =====================================================================

    window.deleteSchedule = async function(deviceName, scheduleId) {

        if (!confirm("Deseja realmente excluir este agendamento?")) return;

        try {
            const response = await fetch(`/api/schedules/${scheduleId}`, {
                method: "DELETE"
            });

            const result = await response.json();

            if (result.success) {
                loadSchedules(deviceName);
            } else {
                alert("Erro ao excluir.");
            }

        } catch (error) {
            console.error(error);
            alert("Erro de conexão com servidor.");
        }
    };

    // =====================================================================
    // X. FUNÇÕES DE ENTRAR / SAIR DO MODO DE EDIÇÃO
    // =====================================================================

    function leaveEditMode() {

        editingScheduleId = null;

        const saveBtn = document.getElementById("save-btn");

        saveBtn.textContent = "Adicionar Agendamento";
        saveBtn.classList.remove("bg-green-600", "hover:bg-green-700");
        saveBtn.classList.add("bg-blue-600", "hover:bg-blue-700");

        document.getElementById("cancel-edit-btn").classList.add("hidden");

        newScheduleForm.reset();
    }


    function enterEditMode(scheduleId, deviceName) {

        editingScheduleId = scheduleId;

        const saveBtn = document.getElementById("save-btn");

        saveBtn.textContent = "Atualizar Agendamento";
        saveBtn.classList.remove("bg-blue-600", "hover:bg-blue-700");
        saveBtn.classList.add("bg-green-600", "hover:bg-green-700");

        document.getElementById("cancel-edit-btn").classList.remove("hidden");
    }



    // =====================================================================
    // 8. EDITAR AGENDAMENTO
    // =====================================================================

    let editingScheduleId = null;

    window.editSchedule = function (deviceName, scheduleId) {
        
        modal.classList.remove("hidden");

        const schedule = schedulesCache[deviceName].find(s => s.id === scheduleId);
        if (!schedule) return;

        editingScheduleId = scheduleId;

        // Preenche os campos do formulário:
        document.getElementById("schedule-device").value = deviceName;
        document.getElementById("hidden-device-name").value = deviceName;

        // target (lamp/cooler)
        document.querySelector(`select[name="target"]`).value = schedule.target;

        // state (on/off)
        document.querySelector(`select[name="state"]`).value = schedule.state;

        // time
        document.querySelector('input[name="time"]').value = schedule.time;

        // dias
        document.querySelectorAll(".day-checkbox").forEach(chk => {
            chk.checked = schedule.days.includes(chk.value);
        });

        enterEditMode(scheduleId, deviceName);
    };

    // =====================================================================
    // 9. FUNÇÃO DE ATUALIZAÇÃO DE AGENDAMENTO
    // =====================================================================
    async function updateSchedule(deviceName, scheduleId) {

        const selectedDays = [...document.querySelectorAll(".day-checkbox:checked")].map(c => c.value);

        const payload = {
            device_name: deviceName,
            target: document.querySelector('select[name="target"]').value,
            state: document.querySelector('select[name="state"]').value,
            time: document.querySelector('input[name="time"]').value,


            days: selectedDays
        };

        try {
            const response = await fetch(`/api/schedules/${scheduleId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success) {
                alert("Agendamento atualizado!");
                loadSchedules(deviceName);
                newScheduleForm.reset();
                resetSaveButton();
            } else {
                alert("Erro ao atualizar.");
            }

        } catch (err) {
            console.error(err);
            alert("Erro ao conectar com servidor.");
        }
    }

    // =====================================================================
    // 10. FUNÇÃO PARA RESETAR BOTÃO DE SALVAR
    // =====================================================================
    function resetSaveButton() {
        leaveEditMode();
        newScheduleForm.reset();
    }


    document.getElementById("cancel-edit-btn").addEventListener("click", leaveEditMode);

});
