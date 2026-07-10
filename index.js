let gameState = {
    level: 1,
    xp: 0,
    xpNeeded: 100,
    coins: 0,
    tasks: [],
    doubleXpActive: false,
    extraHours: 0,
    lastResetDate: ""
};

// Carregar dados salvos
if (localStorage.getItem('levelup_rpg_state')) {
    gameState = JSON.parse(localStorage.getItem('levelup_rpg_state'));
}

// FUNÇÃO PARA EXIBIR POP-UP CUSTOMIZADO E MANEIRO
function showPopup(type, title, message) {
    const popup = document.getElementById('custom-popup');
    const iconElement = document.getElementById('popup-icon');
    const titleElement = document.getElementById('popup-title');
    const msgElement = document.getElementById('popup-message');
    const boxElement = document.querySelector('.popup-box');

    titleElement.innerText = title;
    msgElement.innerText = message;

    // customizar de acordo com o tipo de mensagem
    if (type === 'error') {
        iconElement.innerText = '❌';
        titleElement.style.color = '#ff5577';
        boxElement.style.borderColor = '#ff5577';
    } else if (type === 'success') {
        iconElement.innerText = '🎉';
        titleElement.style.color = '#04d361';
        boxElement.style.borderColor = '#04d361';
    } else if (type === 'info') {
        iconElement.innerText = '⚡';
        titleElement.style.color = '#ffc83b';
        boxElement.style.borderColor = '#ffc83b';
    }

    popup.classList.add('active');
}

function closePopup() {
    document.getElementById('custom-popup').classList.remove('active');
}

// Lógica de cálculo de XP (Inversamente proporcional)
function calculateTaskXp() {
    let totalTasks = gameState.tasks.filter(t => !t.completed).length;
    if (totalTasks <= 1) return gameState.doubleXpActive ? 200 : 100;
    
    let baseXp = Math.max(15, Math.floor(100 / totalTasks));
    return gameState.doubleXpActive ? baseXp * 2 : baseXp;
}

function updateUI() {
    document.getElementById('lbl-level').innerText = gameState.level;
    document.getElementById('lbl-coins').innerText = gameState.coins;
    document.getElementById('lbl-current-xp').innerText = gameState.xp;
    document.getElementById('lbl-next-level-xp').innerText = gameState.xpNeeded;
    
    let xpPercent = (gameState.xp / gameState.xpNeeded) * 100;
    document.getElementById('xp-bar').style.width = `${xpPercent}%`;

    document.getElementById('xp-dinamico').innerText = `XP por tarefa atual: ${calculateTaskXp()} XP`;
    
    // Mostra buffs ativos
    let buffsHtml = "";
    if (gameState.doubleXpActive) buffsHtml += "<div>⚡ Multiplicador de XP 2x Ativo!</div>";
    if (gameState.extraHours > 0) buffsHtml += `<div>⏳ Ampulheta: +${gameState.extraHours}h extras de prazo.</div>`;
    document.getElementById('buffs-ativos').innerHTML = buffsHtml;

    // Renderizar Lista de Tarefas
    const list = document.getElementById('task-list');
    list.innerHTML = "";
    gameState.tasks.forEach((task, index) => {
        if (!task.completed) {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${task.text}</span>
                <button class="btn-complete" onclick="completeTask(${index})">✔ Concluir</button>
            `;
            list.appendChild(li);
        }
    });

    // Salva o progresso
    localStorage.setItem('levelup_rpg_state', JSON.stringify(gameState));
}

function addTask() {
    const input = document.getElementById('task-input');
    if (input.value.trim() === "") return;

    gameState.tasks.push({
        text: input.value,
        completed: false
    });
    input.value = "";
    updateUI();
}

function completeTask(index) {
    let earnedXp = calculateTaskXp();
    gameState.tasks[index].completed = true;
    
    if (gameState.doubleXpActive) {
        gameState.doubleXpActive = false;
    }

    gainXp(earnedXp);
    updateUI();
}

function gainXp(amount) {
    gameState.xp += amount;
    while (gameState.xp >= gameState.xpNeeded) {
        gameState.xp -= gameState.xpNeeded;
        gameState.level++;
        gameState.xpNeeded = Math.floor(gameState.xpNeeded * 1.2);
        gameState.coins += 50;
        
        // POP-UP NOVO AO SUBIR DE NÍVEL
        showPopup('success', `LEVEL UP!`, `Parabéns! Você subiu para o Nível ${gameState.level} e faturou 50 Moedas!`);
    }
}

function buyItem(item, cost) {
    if (gameState.coins < cost) {
        // POP-UP NOVO SE TENTAR COMPRAR SEM DINHEIRO
        showPopup('error', 'Ação Bloqueada', 'Moedas insuficientes! Vá concluir mais algumas missões primeiro.');
        return;
    }

    gameState.coins -= cost;

    if (item === 'doubleXp') {
        gameState.doubleXpActive = true;
        showPopup('info', 'Item Consumido', 'Você bebeu a Poção! Sua próxima missão dará o dobro de XP.');
    } else if (item === 'extraTime') {
        gameState.extraHours += 2;
        showPopup('info', 'Item Consumido', 'Ampulheta ativada! Você ganhou +2 horas de tempo extra no prazo diário.');
    }
    updateUI();
}

// Relógio Regressivo baseado no Horário de Brasília
function updateCountdown() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
    
    const parts = formatter.formatToParts(now);
    const hrs = parseInt(parts.find(p => p.type === 'hour').value);
    const mins = parseInt(parts.find(p => p.type === 'minute').value);
    const secs = parseInt(parts.find(p => p.type === 'second').value);

    const totalSecondsInDay = (hrs * 3600) + (mins * 60) + secs;
    const secondsIn24Hours = 24 * 3600;

    let secondsLeft = secondsIn24Hours - totalSecondsInDay;
    secondsLeft += (gameState.extraHours * 3600);

    if (secondsLeft <= 0) {
        checkDailyReset();
        return;
    }

    const displayHrs = Math.floor(secondsLeft / 3600);
    const displayMins = Math.floor((secondsLeft % 3600) / 60);
    const displaySecs = secondsLeft % 60;

    const pad = (num) => String(num).padStart(2, '0');
    document.getElementById('reset-timer').innerText = `⏳ ${pad(displayHrs)}h ${pad(displayMins)}m ${pad(displaySecs)}s`;
}

// Lógica de Reset Diário Automático
function checkDailyReset() {
    const options = { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' };
    const dataBrasilia = new Intl.DateTimeFormat('pt-BR', options).format(new Date());

    if (gameState.lastResetDate !== dataBrasilia) {
        gameState.tasks.forEach(t => t.completed = false);
        gameState.extraHours = 0; 
        gameState.lastResetDate = dataBrasilia;
        updateUI();
        showPopup('info', 'Novo Dia!', 'Suas missões diárias foram renovadas! Boa sorte nas jornadas de hoje.');
    }
}

// TELA DE LOADING E INICIALIZAÇÃO
window.addEventListener('DOMContentLoaded', () => {
    let progress = 0;
    const loaderBar = document.getElementById('loader-progress');
    const loadingScreen = document.getElementById('loading-screen');

    // Simula uma barra de carregamento gamer fluida antes de revelar o app
    const loadingInterval = setInterval(() => {
        progress += Math.floor(Math.random() * 15) + 5;
        if (progress >= 100) {
            progress = 100;
            clearInterval(loadingInterval);
            
            // Oculta a tela de loading suavemente
            setTimeout(() => {
                loadingScreen.style.opacity = '0';
                loadingScreen.style.visibility = 'hidden';
            }, 300);
        }
        loaderBar.style.width = `${progress}%`;
    }, 50);

    checkDailyReset();
    setInterval(checkDailyReset, 60000);
    setInterval(updateCountdown, 1000);

    updateCountdown();
    updateUI();
});