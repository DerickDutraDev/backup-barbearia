import { API_BASE_URL } from './config.js';

document.addEventListener('DOMContentLoaded', () => {
    const clienteForm = document.getElementById('cliente-form');
    const nomeClienteInput = document.getElementById('nome-cliente');
    const nomeErrorDiv = document.getElementById('nome-error');
    const barbeiroErrorDiv = document.getElementById('barber-error');
    const clienteFormSection = document.getElementById('cliente-form-section');
    const queueResponseSection = document.getElementById('queue-response');
    const joinQueueBtn = document.getElementById('join-queue-btn');
    const btnSairFila = document.getElementById('btn-sair-fila');
    const barberItems = document.querySelectorAll('.barber-item');
    const selectedBarberInput = document.getElementById('selected-barber');
    const clientNameDisplay = document.getElementById('client-name-display');
    const barberNameDisplay = document.getElementById('barber-name-display');
    const queuePositionDisplay = document.getElementById('queue-position-display');

    let currentClientId = null;
    let queueCheckInterval = null;

    // retry logic
    let missingCount = 0;
    const MAX_MISSING = 3;          // quantas checagens consecutivas sem achar antes de considerar removido
    const POLL_INTERVAL = 5000;     // 5s

    const barbers = { junior: 'Junior', yago: 'Yago', reine: 'Reine' };

    // Seleção do barbeiro (UI)
    barberItems.forEach(item => {
        item.addEventListener('click', () => {
            barberItems.forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            selectedBarberInput.value = item.dataset.barber.toLowerCase();
            barbeiroErrorDiv.textContent = '';
        });
    });

    function toggleSections(showQueueResponse = false) {
        clienteFormSection.style.display = showQueueResponse ? 'none' : 'block';
        queueResponseSection.style.display = showQueueResponse ? 'block' : 'none';
    }

    // Entrar na fila
    clienteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = nomeClienteInput.value.trim();
        const barbeiroId = selectedBarberInput.value;

        let isValid = true;
        if (!nome) {
            nomeClienteInput.classList.add('is-invalid');
            nomeErrorDiv.textContent = 'Por favor, digite seu nome.';
            isValid = false;
        } else {
            nomeClienteInput.classList.remove('is-invalid');
            nomeErrorDiv.textContent = '';
        }
        if (!barbeiroId) {
            barbeiroErrorDiv.textContent = 'Por favor, selecione um barbeiro.';
            isValid = false;
        }
        if (!isValid) return;

        joinQueueBtn.disabled = true;
        joinQueueBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Entrando na fila...';

        try {
            const response = await fetch(`${API_BASE_URL}/public/join-queue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: nome, barber: barbeiroId })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(()=>({error:'Erro'}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            const data = await response.json();
            currentClientId = data.clientId;

            // salva para persistir entre sessões
            localStorage.setItem('clientId', currentClientId);
            localStorage.setItem('clientName', nome);
            localStorage.setItem('barber', barbeiroId);

            clientNameDisplay.textContent = nome;
            barberNameDisplay.textContent = barbers[barbeiroId] || barbeiroId;
            queuePositionDisplay.textContent = data.position;

            document.getElementById('modal-queue-info').innerHTML =
                `Você é o número <b>${data.position}</b> da fila para cortar com <b>${barbers[barbeiroId]}</b>.`;
            new bootstrap.Modal(document.getElementById('queueModal')).show();

            // reset counters e inicia polling
            missingCount = 0;
            toggleSections(true);
            startQueueCheck(true); // true => run immediate check
        } catch (error) {
            console.error('Erro ao entrar na fila:', error);
            alert(`Erro ao entrar na fila: ${error.message || 'Erro desconhecido'}`);
        } finally {
            joinQueueBtn.disabled = false;
            joinQueueBtn.innerHTML = '<i class="fas fa-paper-plane me-2"></i> Entrar na Fila';
        }
    });

    // Sair da fila
    btnSairFila.addEventListener('click', async () => {
        if (!currentClientId) return;
        btnSairFila.disabled = true;
        btnSairFila.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Saindo...';
        try {
            const response = await fetch(`${API_BASE_URL}/public/leave-queue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId: currentClientId })
            });
            if (response.ok) {
                stopQueueCheck();
                clearClientSession();
                toggleSections(false);
            } else {
                const errorData = await response.json().catch(()=>({error:'Erro'}));
                alert(`Erro: ${errorData.error || 'Erro desconhecido'}`);
            }
        } catch (err) {
            console.error('Erro ao sair da fila:', err);
            alert('Erro de conexão com o servidor.');
        } finally {
            btnSairFila.disabled = false;
            btnSairFila.innerHTML = '<i class="fas fa-door-open me-2"></i> Sair da Fila';
        }
    });

    // Limpa sessão local
    function clearClientSession() {
        currentClientId = null;
        missingCount = 0;
        localStorage.removeItem('clientId');
        localStorage.removeItem('clientName');
        localStorage.removeItem('barber');
    }

    // Checa posição via endpoint /public/position (mais confiável)
    async function checkMyPosition() {
        if (!currentClientId) {
            stopQueueCheck();
            return;
        }

        try {
            // endpoint dedicado que retorna só a posição do clientId
            const resp = await fetch(`${API_BASE_URL}/public/position?clientId=${currentClientId}`);
            if (!resp.ok) {
                // fallback: não remova imediatamente, incremente missing e volte
                missingCount++;
                console.warn('position endpoint erro, missingCount:', missingCount);
            } else {
                const data = await resp.json();
                if (data && data.found) {
                    // sucesso: atualiza UI e reseta contador de faltas
                    missingCount = 0;
                    queuePositionDisplay.textContent = data.position;
                    barberNameDisplay.textContent = barbers[data.barber] || (localStorage.getItem('barber') || '');
                    clientNameDisplay.textContent = data.name || localStorage.getItem('clientName') || '';
                    document.getElementById('queue-message').textContent = 'Você já está na fila. Por favor, aguarde seu atendimento.';
                    // ensure UI showed
                    toggleSections(true);
                    return;
                } else {
                    // not found
                    missingCount++;
                    console.log('Client não encontrado na posição (missingCount):', missingCount);
                }
            }
        } catch (err) {
            console.error('Erro checando posição:', err);
            missingCount++;
        }

        // só remove depois de várias tentativas sem sucesso
        if (missingCount >= MAX_MISSING) {
            console.log('Cliente considerado removido após', missingCount, 'tentativas.');
            clearClientSession();
            stopQueueCheck();
            toggleSections(false);
        }
    }

    function startQueueCheck(runImmediate = false) {
        if (queueCheckInterval) clearInterval(queueCheckInterval);
        if (runImmediate) checkMyPosition(); // checar na hora ao iniciar
        queueCheckInterval = setInterval(checkMyPosition, POLL_INTERVAL);
    }

    function stopQueueCheck() {
        if (queueCheckInterval) {
            clearInterval(queueCheckInterval);
            queueCheckInterval = null;
        }
    }

    // Restaura sessão do localStorage caso exista
    function restoreClientSession() {
        const savedClientId = localStorage.getItem('clientId');
        const savedName = localStorage.getItem('clientName');
        const savedBarber = localStorage.getItem('barber');

        if (savedClientId && savedBarber) {
            currentClientId = savedClientId;
            clientNameDisplay.textContent = savedName || '';
            barberNameDisplay.textContent = barbers[savedBarber] || savedBarber;
            toggleSections(true);
            missingCount = 0;
            startQueueCheck(true); // checa imediatamente
        }
    }

    // iniciar restauração
    restoreClientSession();
});
