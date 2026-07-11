import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyC6jf8HCB5LVOti0o2KcWqxNFm7c-T1HSk",
    authDomain: "levelup-a85ae.firebaseapp.com",
    projectId: "levelup-a85ae",
    storageBucket: "levelup-a85ae.firebasestorage.app",
    messagingSenderId: "27165459988",
    appId: "1:27165459988:web:d0091fca271be085db0901",
    measurementId: "G-VDV7ZEJJS8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let isRegisterMode = false; // Controle de tela Login / Cadastro

let gameState = {
    heroName: "Herói",
    level: 1, xp: 0, xpNeeded: 100, coins: 0,
    tasks: [], doubleXpActive: false, extraHours: 0, lastResetDate: "",
    bonusCoinsLevelUp: 0,
    history: {} // Armazena {"DD/MM/AAAA": totalConcluido}
};

const INITIAL_STATE = {
    heroName: "Herói",
    level: 1, xp: 0, xpNeeded: 100, coins: 0,
    tasks: [], doubleXpActive: false, extraHours: 0, lastResetDate: "",
    bonusCoinsLevelUp: 0,
    history: {}
};

// TITULOS DE ACORDO COM O NÍVEL
function getHeroTitle(level) {
    if (level >= 25) return "🧙‍♂️ Mestre Supremo";
    if (level >= 18) return "🔱 Cavaleiro Paladino";
    if (level >= 12) return "⚔️ Guerreiro de Elite";
    if (level >= 6) return "🏹 Caçador Veterano";
    if (level >= 3) return "🛡️ Recruta Destemido";
    return "🌱 Aprendiz da Guilda";
}

// GERA IMAGEM DE PERFIL DINÂMICA VIA EMAIL DO GRAVATAR (Identicon gamer se o e-mail não tiver cadastro lá)
function getGravatarUrl(email) {
    const cleanEmail = email.trim().toLowerCase();
    // Função simples para gerar um hash numérico rápido para o avatar padrão
    let hash = 0;
    for (let i = 0; i < cleanEmail.length; i++) {
        hash = cleanEmail.charCodeAt(i) + ((hash << 5) - hash);
    }
    return `https://www.gravatar.com/avatar/${Math.abs(hash)}?d=identicon&s=150`;
}

// POP-UP CUSTOMIZADO
window.showPopup = function(type, title, message) {
    const popup = document.getElementById('custom-popup');
    const iconElement = document.getElementById('popup-icon');
    const titleElement = document.getElementById('popup-title');
    const msgElement = document.getElementById('popup-message');
    const boxElement = document.querySelector('.popup-box');

    titleElement.innerText = title;
    msgElement.innerText = message;

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

window.closePopup = function() {
    document.getElementById('custom-popup').classList.remove('active');
}
document.getElementById('btn-popup-close').addEventListener('click', closePopup);

// GRAVAÇÃO E LEITURA CLOUD FIRESTORE
async function saveGameProgress() {
    if (!currentUser) return;
    try {
        await setDoc(doc(db, "users", currentUser.uid), gameState);
    } catch (e) {
        console.error("Erro ao salvar dados: ", e);
    }
}

async function loadGameProgress(user) {
    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        gameState = docSnap.data();
        if (!gameState.history) gameState.history = {};
        if (!gameState.heroName) gameState.heroName = "Herói";
        if (gameState.bonusCoinsLevelUp === undefined) gameState.bonusCoinsLevelUp = 0;
    } else {
        gameState = { ...INITIAL_STATE };
        const nameInput = document.getElementById('auth-name').value.trim();
        gameState.heroName = nameInput || "Herói Anônimo";
        await setDoc(docRef, gameState);
    }
    checkDailyReset();
    updateUI();
}

// CHANGER DE LOGIN / CADASTRO
function updateAuthUI() {
    const nameGroup = document.getElementById('group-auth-name');
    const title = document.getElementById('auth-title');
    const toggleLink = document.getElementById('toggle-auth-mode');
    const btnLogin = document.getElementById('btn-login');
    const btnRegister = document.getElementById('btn-register');

    if (isRegisterMode) {
        nameGroup.style.display = 'flex';
        title.innerText = "📜 Registrar Novo Herói";
        toggleLink.innerText = "Já tem uma conta? Entrar na guilda";
        btnLogin.style.display = 'none';
        btnRegister.style.display = 'block';
    } else {
        nameGroup.style.display = 'none';
        title.innerText = "🛡️ Acessar Guilda";
        toggleLink.innerText = "Não tem uma conta? Criar Novo Herói";
        btnLogin.style.display = 'block';
        btnRegister.style.display = 'none';
    }
}
document.getElementById('toggle-auth-mode').addEventListener('click', (e) => {
    e.preventDefault();
    isRegisterMode = !isRegisterMode;
    updateAuthUI();
});

// MONITOR DE CONTAS DO FIREBASE
onAuthStateChanged(auth, async (user) => {
    const authContainer = document.getElementById('auth-container');
    const gameContainer = document.getElementById('game-container');

    if (user) {
        currentUser = user;
        await loadGameProgress(user);
        document.getElementById('hero-avatar').src = getGravatarUrl(user.email);
        authContainer.classList.add('hidden');
        gameContainer.classList.remove('hidden');
    } else {
        currentUser = null;
        isRegisterMode = false;
        updateAuthUI();
        authContainer.classList.remove('hidden');
        gameContainer.classList.add('hidden');
    }
});

// EVENTOS DE CLICK AUTENTICAÇÃO
document.getElementById('btn-login').addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    if(!email || !password) return showPopup('error', 'Ops!', 'Preencha os campos de Email e Senha.');
    
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        showPopup('error', 'Falha no Login', 'Verifique suas credenciais.');
    }
});

document.getElementById('btn-register').addEventListener('click', async () => {
    const name = document.getElementById('auth-name').value.trim();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;

    if(!name || !email || !password) return showPopup('error', 'Ops!', 'Preencha todos os campos para o registro.');
    if(password.length < 6) return showPopup('error', 'Senha Fraca', 'A senha precisa ter pelo menos 6 caracteres.');

    try {
        await createUserWithEmailAndPassword(auth, email, password);
        showPopup('success', 'Guilda Aceita!', 'Sua conta de Herói foi gerada.');
    } catch (error) {
        showPopup('error', 'Erro no Cadastro', 'O e-mail inserido já pode estar em uso.');
    }
});

document.getElementById('btn-logout').addEventListener('click', () => {
    signOut(auth);
});

// RENDEREZAÇÃO DA TELA
function updateUI() {
    document.getElementById('lbl-hero-name').innerText = gameState.heroName;
    document.getElementById('lbl-hero-title').innerText = getHeroTitle(gameState.level);
    document.getElementById('lbl-level').innerText = gameState.level;
    document.getElementById('lbl-coins').innerText = gameState.coins;
    document.getElementById('lbl-current-xp').innerText = gameState.xp;
    document.getElementById('lbl-next-level-xp').innerText = gameState.xpNeeded;
    
    let xpPercent = (gameState.xp / gameState.xpNeeded) * 100;
    document.getElementById('xp-bar').style.width = `${xpPercent}%`;
    document.getElementById('xp-dinamico').innerText = `XP por tarefa atual: ${calculateTaskXp()} XP`;
    
    let buffsHtml = "";
    if (gameState.doubleXpActive) buffsHtml += "<div>⚡ Multiplicador de XP 2x Ativo!</div>";
    if (gameState.extraHours > 0) buffsHtml += `<div>⏳ Ampulheta: +${gameState.extraHours}h extras no prazo.</div>`;
    if (gameState.bonusCoinsLevelUp > 0) buffsHtml += `<div>📜 Pergaminho: +${gameState.bonusCoinsLevelUp}🪙 extras no Level Up!</div>`;
    document.getElementById('buffs-ativos').innerHTML = buffsHtml;

    // Listagem de tarefas ativas
    const list = document.getElementById('task-list');
    list.innerHTML = "";
    gameState.tasks.forEach((task, index) => {
        if (!task.completed) {
            const li = document.createElement('li');
            li.innerHTML = `<span>${task.text}</span>`;
            const btn = document.createElement('button');
            btn.className = 'btn-complete';
            btn.innerText = '✔ Concluir';
            btn.onclick = () => completeTask(index);
            li.appendChild(btn);
            list.appendChild(li);
        }
    });

    // Listagem de Histórico Diário
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = "";
    const sortedDates = Object.keys(gameState.history).sort((a,b) => b.localeCompare(a));
    
    if (sortedDates.length === 0) {
        historyList.innerHTML = `<li style="background:transparent; border:none; padding:5px; color:#7c7c8a;">Nenhuma missão concluída registrada ainda.</li>`;
    } else {
        sortedDates.forEach(date => {
            const hLi = document.createElement('li');
            hLi.style.padding = "8px 12px";
            hLi.style.background = "#14111f";
            hLi.innerHTML = `<span>📅 ${date}</span> <strong style="color:var(--green)">✓ ${gameState.history[date]} concluídas</strong>`;
            historyList.appendChild(hLi);
        });
    }
}

function calculateTaskXp() {
    let totalTasks = gameState.tasks.filter(t => !t.completed).length;
    if (totalTasks <= 1) return gameState.doubleXpActive ? 200 : 100;
    let baseXp = Math.max(15, Math.floor(100 / totalTasks));
    return gameState.doubleXpActive ? baseXp * 2 : baseXp;
}

// EVENTOS DE GAMEPLAY
async function addTask() {
    const input = document.getElementById('task-input');
    if (input.value.trim() === "") return;

    gameState.tasks.push({ text: input.value, completed: false });
    input.value = "";
    updateUI();
    await saveGameProgress();
}
document.getElementById('btn-add-task').addEventListener('click', addTask);

async function completeTask(index) {
    let earnedXp = calculateTaskXp();
    gameState.tasks[index].completed = true;
    
    if (gameState.doubleXpActive) gameState.doubleXpActive = false;

    // Adiciona ao Histórico do Dia
    const options = { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' };
    const dataBrasilia = new Intl.DateTimeFormat('pt-BR', options).format(new Date());
    gameState.history[dataBrasilia] = (gameState.history[dataBrasilia] || 0) + 1;

    gainXp(earnedXp);
    updateUI();
    await saveGameProgress();
}

function gainXp(amount) {
    gameState.xp += amount;
    while (gameState.xp >= gameState.xpNeeded) {
        gameState.xp -= gameState.xpNeeded;
        gameState.level++;
        gameState.xpNeeded = Math.floor(gameState.xpNeeded * 1.2);
        
        let baseAward = 50 + gameState.bonusCoinsLevelUp;
        gameState.coins += baseAward;
        
        showPopup('success', `LEVEL UP!`, `Parabéns! Alcançou o nível ${gameState.level} (${getHeroTitle(gameState.level)}) e ganhou ${baseAward} Moedas!`);
    }
}

// CONTROLE DO MERCADO AMPLIADO
async function buyItem(item, cost) {
    if (gameState.coins < cost) {
        showPopup('error', 'Sem fundos', 'Moedas insuficientes! Conclua mais tarefas diárias.');
        return;
    }
    gameState.coins -= cost;

    if (item === 'doubleXp') {
        gameState.doubleXpActive = true;
        showPopup('info', 'Poção Ingerida', 'Sua próxima missão renderá o dobro de XP total!');
    } else if (item === 'extraTime') {
        gameState.extraHours += 2;
        showPopup('info', 'Tempo Distorcido', 'Você estendeu o prazo diário em mais +2 horas.');
    } else if (item === 'elixirXp') {
        gainXp(30);
        showPopup('success', 'Elixir Consumido', 'Você tomou o Elixir Real e absorveu 30 XP instantaneamente!');
    } else if (item === 'scrollBonus') {
        gameState.bonusCoinsLevelUp += 10;
        showPopup('success', 'Conhecimento Antigo', 'Pergaminho decifrado! Agora você ganhará +10 moedas adicionais a cada Level Up.');
    }
    updateUI();
    await saveGameProgress();
}

document.getElementById('btn-buy-xp').addEventListener('click', () => buyItem('doubleXp', 50));
document.getElementById('btn-buy-time').addEventListener('click', () => buyItem('extraTime', 30));
document.getElementById('btn-buy-elixir').addEventListener('click', () => buyItem('elixirXp', 40));
document.getElementById('btn-buy-scroll').addEventListener('click', () => buyItem('scrollBonus', 120));

// RESET DO HISTÓRICO
document.getElementById('btn-clear-history').addEventListener('click', async () => {
    gameState.history = {};
    updateUI();
    await saveGameProgress();
    showPopup('info', 'Histórico Limpo', 'Seu livro de registros passados foi zerado.');
});

// CONTADORES E RELÓGIOS DE BRASÍLIA
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
    let secondsLeft = (24 * 3600) - totalSecondsInDay + (gameState.extraHours * 3600);

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

async function checkDailyReset() {
    const options = { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' };
    const dataBrasilia = new Intl.DateTimeFormat('pt-BR', options).format(new Date());

    if (gameState.lastResetDate !== dataBrasilia && currentUser) {
        gameState.tasks.forEach(t => t.completed = false);
        gameState.extraHours = 0; 
        gameState.lastResetDate = dataBrasilia;
        updateUI();
        await saveGameProgress();
        showPopup('info', 'Novo Dia!', 'Suas missões diárias recomeçaram.');
    }
}

// INICIALIZADOR DO PRODUTO
window.addEventListener('DOMContentLoaded', () => {
    updateAuthUI();
    let progress = 0;
    const loaderBar = document.getElementById('loader-progress');
    const loadingScreen = document.getElementById('loading-screen');

    const loadingInterval = setInterval(() => {
        progress += Math.floor(Math.random() * 15) + 8;
        if (progress >= 100) {
            progress = 100;
            clearInterval(loadingInterval);
            setTimeout(() => {
                loadingScreen.style.opacity = '0';
                loadingScreen.style.visibility = 'hidden';
            }, 300);
        }
        loaderBar.style.width = `${progress}%`;
    }, 40);

    setInterval(checkDailyReset, 60000);
    setInterval(updateCountdown, 1000);
});