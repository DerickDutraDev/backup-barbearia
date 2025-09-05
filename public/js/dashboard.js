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
                        if (queueList.querySelectorAll('li.list-group-item').length === 0) {
                            queueList.innerHTML = '<li class="list-group-item empty-queue animate-fade-in">Nenhum cliente na fila.</li>';
                        }
                    } catch (error) { console.error('Erro de conexão:', error); }
                });
            }
        });

        // ⚠️ AQUI ESTAVA FALTANDO
        if (newQueue.length === 0 && !queueList.querySelector('.empty-queue')) {
            queueList.innerHTML = '<li class="list-group-item empty-queue animate-fade-in">Nenhum cliente na fila.</li>';
        }

        // Atualiza numeração
        const items = queueList.querySelectorAll('li.list-group-item:not(.empty-queue)');
        items.forEach((li, idx) => {
            const num = li.querySelector('.queue-number');
            if (num) num.textContent = `${idx + 1}.`;
        });

        currentQueues[key] = newQueue;
    });
}
