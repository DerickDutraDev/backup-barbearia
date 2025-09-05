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
    const barberPreviewDiv = document.getElementById('barber-preview');
    const clientNameDisplay = document.getElementById('client-name-display');
    const barberNameDisplay = document.getElementById('barber-name-display');
    const queuePositionDisplay = document.getElementById('queue-position-display');

    let currentClientId = null;
    let queueCheckInterval = null;
    let previewInterval = null;

    const POLL_INTERVAL = 1500; // 1.5s para quase real-time
    const barbers = { junior: 'Junior', yago: 'Yago', reine: 'Reine' };

    // Seleção do barbeiro (UI) com preview da posição
    barberItems.forEach(item => {
        item.addEventListener('click', () => {
            barberItems.forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            selectedBarberInput.value = item.dataset.barber.toLowerCase();
            barbeiroErrorDiv.textContent = '';
            updateBarberPreview(); // atualização instantânea
        });
    });

    async function updateBarberPreview() {
        const barberId = selectedBarberInput.value;
        if (!barberId) { barberPreviewDiv.textContent = ''; return; }

        barberPreviewDiv.style.color = '#D4AF37';
        barberPreviewDiv.textContent = 'Carregando...';

        try {
            const resp = await fetch(`${API_BASE_URL}/public/barber-queue/${barberId}`);
            if (!resp.ok) throw new Error('Erro ao buscar fila');
            const data = await resp.json();
            const position = (data.queue?.length || 0) + 1;
            barberPreviewDiv.textContent = `Sua posição será ${position}`;
        } catch (err) {
            console.error(err);
            barberPreviewDiv.textContent = '';
        }
    }

    nomeClienteInput.addEventListener('input', updateBarberPreview);

    function startPreviewInterval() {
        stopPreviewInterval();
        previewInterval = setInterval(updateBarberPreview, POLL_INTERVAL);
    }
    function stopPreviewInterval() {
        if (previewInterval) clearInterval(previewInterval);
    }

    function toggleSections(showQueueResponse = false) {
        clienteFormSection.style.display = showQueueResponse ? 'none' : 'block';
        queueResponseSection.style.display = showQueueResponse ? 'block' : 'none';
        if (!showQueueResponse) startPreviewInterval();
        else stopPreviewInterval();
    }

    // Entrar na fila
    clienteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = nomeClienteInput.value.trim();
        const barbeiroId = selectedBarberInput.value;
        let isValid = true;

        if (!nome) { nomeClienteInput.classList.add('is-invalid'); nomeErrorDiv.textContent = 'Digite seu nome.'; isValid=false; }
        else { nomeClienteInput.classList.remove('is-invalid'); nomeErrorDiv.textContent = ''; }

        if (!barbeiroId) { barbeiroErrorDiv.textContent = 'Selecione um barbeiro.'; isValid=false; }
        if (!isValid) return;

        joinQueueBtn.disabled = true;
        joinQueueBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Entrando na fila...';

        try {
            const response = await fetch(`${API_BASE_URL}/public/join-queue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: nome, barber: barbeiroId })
            });

            if (!response.ok) throw new Error((await response.json().catch(()=>({error:'Erro'}))).error || 'Erro');

            const data = await response.json();
            currentClientId = data.clientId;
            localStorage.setItem('clientId', currentClientId);
            localStorage.setItem('clientName', nome);
            localStorage.setItem('barber', barbeiroId);

            clientNameDisplay.textContent = nome;
            barberNameDisplay.textContent = barbers[barbeiroId] || barbeiroId;
            queuePositionDisplay.textContent = data.position;

            document.getElementById('modal-queue-info').innerHTML =
                `Você é o número <b>${data.position}</b> da fila para cortar com <b>${barbers[barbeiroId]}</b>.`;
            new bootstrap.Modal(document.getElementById('queueModal')).show();

            toggleSections(true);
            startQueueCheck(true);
        } catch (err) { console.error(err); alert('Erro ao entrar na fila'); }
        finally { joinQueueBtn.disabled = false; joinQueueBtn.innerHTML = '<i class="fas fa-paper-plane me-2"></i> Entrar na Fila'; }
    });

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
            if (response.ok) { stopQueueCheck(); clearClientSession(); toggleSections(false); }
            else alert('Erro ao sair da fila');
        } catch (err) { console.error(err); alert('Erro de conexão'); }
        finally { btnSairFila.disabled = false; btnSairFila.innerHTML = '<i class="fas fa-door-open me-2"></i> Sair da Fila'; }
    });

    function clearClientSession() {
        currentClientId = null;
        localStorage.removeItem('clientId');
        localStorage.removeItem('clientName');
        localStorage.removeItem('barber');
    }

    async function checkMyPosition() {
        if (!currentClientId) { stopQueueCheck(); return; }
        try {
            const resp = await fetch(`${API_BASE_URL}/public/position?clientId=${currentClientId}`);
            if (!resp.ok) return;
            const data = await resp.json();
            if (data?.found) {
                queuePositionDisplay.textContent = data.position;
                barberNameDisplay.textContent = barbers[data.barber] || (localStorage.getItem('barber')||'');
                clientNameDisplay.textContent = data.name || localStorage.getItem('clientName')||'';
                document.getElementById('queue-message').textContent = 'Você já está na fila. Por favor, aguarde seu atendimento.';
                toggleSections(true);
            } else { clearClientSession(); stopQueueCheck(); toggleSections(false); }
        } catch (err) { console.error(err); }
    }

    function startQueueCheck(runImmediate=false) { stopQueueCheck(); if(runImmediate) checkMyPosition(); queueCheckInterval=setInterval(checkMyPosition,POLL_INTERVAL); }
    function stopQueueCheck() { if(queueCheckInterval){clearInterval(queueCheckInterval); queueCheckInterval=null;} }

    function restoreClientSession() {
        const savedClientId = localStorage.getItem('clientId');
        const savedName = localStorage.getItem('clientName');
        const savedBarber = localStorage.getItem('barber');
        if(savedClientId && savedBarber){
            currentClientId = savedClientId;
            clientNameDisplay.textContent = savedName || '';
            barberNameDisplay.textContent = barbers[savedBarber] || savedBarber;
            toggleSections(true);
            startQueueCheck(true);
        } else startPreviewInterval();
    }

    restoreClientSession();
});
