import { API_BASE_URL } from './config.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('barber-login-form');
    const usernameInput = document.getElementById('barber-username');
    const passwordInput = document.getElementById('barber-password');
    const loginBtn = document.getElementById('btn-login');
    const loginError = document.getElementById('login-error-message');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // SEM ISSO, o formulário tenta enviar GET
    console.log("Submit chamado");
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (!username || !password) {
            loginError.textContent = 'Por favor, preencha todos os campos.';
            loginError.style.display = 'block';
            return;
        }

        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Entrando...';
        loginError.style.display = 'none';

        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                // Salva tokens no localStorage
                localStorage.setItem('barber-access-token', data.accessToken);
                localStorage.setItem('barber-refresh-token', data.refreshToken);

                // Redireciona para a dashboard do barbeiro
                window.location.href = '/dashboard/';
            } else {
                loginError.textContent = data.error || 'Erro de login. Tente novamente.';
                loginError.style.display = 'block';
            }
        } catch (error) {
            console.error('Erro na comunicação com o servidor:', error);
            loginError.textContent = 'Erro de conexão com o servidor. Tente novamente mais tarde.';
            loginError.style.display = 'block';
        } finally {
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i> Entrar';
        }
    });

    // Botão voltar
    const btnBack = document.querySelector('.btn-back-app');
    if (btnBack) {
        btnBack.addEventListener('click', (e) => {
            e.preventDefault();
            window.history.back();
        });
    }
});
