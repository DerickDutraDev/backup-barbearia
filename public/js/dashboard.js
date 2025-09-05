import { API_BASE_URL } from './config.js';

document.addEventListener('DOMContentLoaded', () => {
    const accessTokenKey = 'barber-access-token';
    const refreshTokenKey = 'barber-refresh-token';

    function getAccessToken() { return localStorage.getItem(accessTokenKey); }
    function getRefreshToken() { return localStorage.getItem(refreshTokenKey); }
    function setTokens(a, r) { localStorage.setItem(accessTokenKey, a); localStorage.setItem(refreshTokenKey, r); }
    function clearTokens() { localStorage.removeItem(accessTokenKey); localStorage.removeItem(refreshTokenKey); }
    function handleLogout() {
        clearTokens();
        window.location.href = '/'; // <-- aqui vai para a página inicial
    }


    async function fetchWithAuth(url, options = {}) {
        let token = getAccessToken();
        if (!options.headers) options.headers = {};
        options.headers['Authorization'] = `Bearer ${token}`;

        let response = await fetch(url, options);

        if (response.status === 401 || response.status === 403) {
            const refreshToken = getRefreshToken();
            if (!refreshToken) { handleLogout(); return; }

            const refreshResp = await fetch(`${API_BASE_URL}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });

            if (!refreshResp.ok) { handleLogout(); return; }

            const data = await refreshResp.json();
            setTokens(data.accessToken, data.refreshToken);

            options.headers['Authorization'] = `Bearer ${data.accessToken}`;
            response = await fetch(url, options);
        }

        return response;
    }

    const barbers = ['Junior', 'Yago', 'Reine'];
    const btnLogout = document.getElementById('btn-logout');
    const addClientForm = document.getElementById('add-client-form');
    const addClientModal = new bootstrap.Modal(document.getElementById('addClientModal'));
    const barberItemsModal = document.querySelectorAll('#barber-selection-modal .barber-item');
    const selectedBarberModalInput = document.getElementById('selected-barber-modal');
    const successModal = new bootstrap.Modal(document.getElementById('successModal'));
    const clientNameInput = document.getElementById('client-name');
    const clientNameErrorDiv = document.getElementById('client-name-error');
    const barberModalErrorDiv = document.getElementById('barber-modal-error');
    const timeElement = document.getElementById('current-time');

    let currentQueues = { junior: [], yago: [], reine: [] };
    let fetchingQueues = false;

    function updateTime() {
        const now = new Date();
        if (timeElement) timeElement.textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    updateTime();
    setInterval(updateTime, 1000);

    // Atualização incremental da fila
// Atualização incremental da fila
function renderQueuesIncremental(data) {
    barbers.forEach(barber => {
        const key = barber.toLowerCase();
        const queueList = document.getElementById(`queue-${key}`);
        if (!queueList) return;

        const newQueue = data[key] || [];
        const oldQueue = currentQueues[key] || [];

        // Remove clientes que saíram
        const oldIds = new Set(oldQueue.map(c => c.clientId));
        const newIds = new Set(newQueue.map(c => c.clientId));

        oldQueue.forEach(client => {
            if (!newIds.has(client.clientId)) {
                const li = queueList.querySelector(`[data-client-id="${client.clientId}"]`);
                if (li) li.remove();
            }
        });

        // Remove o item "Nenhum cliente na fila" se houver novos clientes
        const emptyItem = queueList.querySelector('.empty-queue');
        if (emptyItem && newQueue.length > 0) emptyItem.remove();

        // Adiciona novos clientes
        newQueue.forEach((client, idx) => {
            if (!oldIds.has(client.clientId)) {
                const li = document.createElement('li');
                li.className = 'list-group-item d-flex justify-content-between align-items-center animate-fade-in';
                li.dataset.clientId = client.clientId;
                li.innerHTML = `
                    <div class="client-info">
                        <span class="queue-number">${idx + 1}.</span>
                        <span>${client.name}</span>
                    </div>
                    <button class="btn btn-sm btn-atender" data-client-id="${client.clientId}" data-barber="${barber}">
                        <i class="fas fa-check me-1"></i> Atender
                    </button>
                `;
                queueList.appendChild(li);

                const btnAtender = li.querySelector('.btn-atender');
                btnAtender.addEventListener('click', async () => {
                    try {
                        const response = await fetchWithAuth(`${API_BASE_URL}/barber/serve-client`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ clientId: client.clientId })
                        });
                        if (!response.ok) console.error('Erro ao atender cliente:', await response.text());
                        li.remove();
                        // Se remover último cliente, mostrar "Nenhum cliente na fila"
                        if (queueList.querySelectorAll('li.list-group-item').length === 0) {
                            queueList.innerHTML = '<li class="list-group-item empty-queue animate-fade-in">Nenhum cliente na fila.</li>';
                        }
                    } catch (error) { console.error('Erro de conexão:', error); }
                });
            }
        });

        // Atualiza numeração
        const items = queueList.querySelectorAll('li.list-group-item:not(.empty-queue)');
        items.forEach((li, idx) => {
            const num = li.querySelector('.queue-number');
            if (num) num.textContent = `${idx + 1}.`;
        });

        currentQueues[key] = newQueue;
    });
}


    async function fetchQueuesSafe() {
        if (fetchingQueues) return;
        fetchingQueues = true;
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/barber/queues`, { headers: { 'Content-Type': 'application/json' } });
            if (!response.ok) throw new Error('Erro ao buscar filas');
            const data = await response.json();
            renderQueuesIncremental(data);
        } catch (error) {
            console.error('Erro:', error);
        } finally {
            fetchingQueues = false;
        }
    }

    // Barbeiro modal
    barberItemsModal.forEach(btn => {
        btn.addEventListener('click', () => {
            barberItemsModal.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedBarberModalInput.value = btn.getAttribute('data-barber').toLowerCase();
            barberModalErrorDiv.textContent = '';
        });
    });

    // Adicionar cliente
    if (addClientForm) {
        addClientForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const clientName = clientNameInput.value.trim();
            const barber = selectedBarberModalInput.value;

            clientNameErrorDiv.textContent = '';
            barberModalErrorDiv.textContent = '';

            if (!clientName) { clientNameErrorDiv.textContent = 'Digite o nome do cliente'; return; }
            if (!barber) { barberModalErrorDiv.textContent = 'Escolha um barbeiro'; return; }

            try {
                const response = await fetchWithAuth(`${API_BASE_URL}/barber/adicionar-cliente-manual`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nome: clientName, barber })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(errorText);
                }

                addClientModal.hide();
                clientNameInput.value = '';
                selectedBarberModalInput.value = '';
                barberItemsModal.forEach(btn => btn.classList.remove('active'));

                successModal.show();
                setTimeout(() => successModal.hide(), 1000);

                fetchQueuesSafe();
            } catch (error) {
                console.error('Erro ao adicionar cliente:', error);
            }
        });
    }

    if (btnLogout) btnLogout.addEventListener('click', handleLogout);

    fetchQueuesSafe();
    setInterval(fetchQueuesSafe, 5000);
});
