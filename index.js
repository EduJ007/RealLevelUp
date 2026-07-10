// IMPORTAÇÃO DOS MÓDULOS OFICIAIS DO FIREBASE
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

// SUAS CONFIGURAÇÕES FORNECIDAS DO FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyC6jf8HCB5LVOti0o2KcWqxNFm7c-T1HSk",
    authDomain: "levelup-a85ae.firebaseapp.com",
    projectId: "levelup-a85ae",
    storageBucket: "levelup-a85ae.firebasestorage.app",
    messagingSenderId: "27165459988",
    appId: "1:27165459988:web:d0091fca271be085db0901",
    measurementId: "G-VDV7ZEJJS8"
};

// INICIALIZANDO OS SERVIÇOS
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ESTADO GLOBAL DO JOGADOR LOGADO
let currentUser = null;
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

// REGRA PADRÃO PARA INICIAR NOVOS CONTAS
const INITIAL_STATE = {
    level: 1, xp: 0, xpNeeded: 100, coins: 0,
    tasks: [], doubleXpActive: false, extraHours: 0, lastResetDate: ""
};

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

// SALVAR DADOS NA NUVEM (FIRESTORE)
async function saveGameProgress() {
    if (!currentUser) return;
    try {
        await setDoc(doc(db, "users", currentUser.uid), gameState);
    } catch (e) {
        console.error("Erro ao salvar progresso na nuvem: ", e);
    }
}

// CARREGAR DADOS DA NUVEM (FIRESTORE)
async function loadGameProgress(user) {
    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        gameState = docSnap.data();
    } else {
        // Se for um usuário novo sem documento no banco, cria o primeiro registro
        gameState = { ...INITIAL_STATE };
        await setDoc(docRef, gameState);
    }
    checkDailyReset();
    updateUI();
}

// MONITOR DE AUTENTICAÇÃO (Roda automático quando abre o site)
onAuthStateChanged(auth, async (user) => {
    const authContainer = document.getElementById('auth-container');
    const gameContainer = document.getElementById('game-container');

    if (user) {
        currentUser = user;
        await loadGameProgress(user);
        authContainer.classList.add('hidden');
        gameContainer.classList.remove('hidden');
    } else {
        currentUser = null;
        authContainer.classList.remove('hidden');
        gameContainer.classList.add('hidden');
    }
});

// EVENTOS DOS BOTÕES DE LOGIN / CADASTRO / LOGOUT
document.getElementById('btn-login').addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    if(!email || !password) return showPopup('error', 'Ops!', 'Preencha todos os campos.');
    
    try {
        await signInWithEmailAndPassword(auth, email, password);
        showPopup('success', 'Bem-vindo de volta!', 'Sua sessão foi carregada.');
    } catch (error) {
        showPopup('error', 'Falha no Login', 'Verifique seu e-mail e senha.');
    }
});

document.getElementById('btn-register').addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    if(!email || !password) return showPopup('error', 'Ops!', 'Preencha todos os campos.');
    if(password.length < 6) return showPopup('error', 'Senha Fraca', 'A senha deve conter no mínimo 6 dígitos.');

    try {
        await createUserWithEmailAndPassword(auth, email, password);
        showPopup('success', 'Herói Registrado!', 'Sua conta foi criada com sucesso.');
    } catch (error) {
        showPopup('error', 'Erro no Cadastro', 'Este e-mail pode já estar em uso.');
    }
});

document.getElementById('btn-logout').addEventListener('click', () => {
    signOut(auth);
});

// LÓGICA DO GAMEPLAY (MANTIDA IGUAL, MAS SALVANDO NA NUVEM)
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
    
    let buffsHtml = "";
    if (gameState.doubleXpActive) buffsHtml += "<div>⚡ Multiplicador de XP 2x Ativo!</div>";
    if (gameState.extraHours > 0) buffsHtml += `<div>⏳ Ampulheta: +${gameState.extraHours}h extras de prazo.</div>`;
    document.getElementById('buffs-ativos').innerHTML = buffsHtml;

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
}

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
        gameState.coins += 50;
        showPopup('success', `LEVEL UP!`, `Parabéns! Você subiu para o Nível ${gameState.level} e faturou 50 Moedas!`);
    }
}

async function buyItem(item, cost) {
    if (gameState.coins < cost) {
        showPopup('error', 'Ação Bloqueada', 'Moedas insuficientes! Vá concluir mais algumas missões primeiro.');
        return;
    }
    gameState.coins -= cost;

    if (item === 'doubleXp') {
        gameState.doubleXpActive = true;
        showPopup('info', 'Item Consumido', 'Você bebeu a Poção! Sua próxima missão dará o dobro de XP.');
    } else if (item === 'extraTime') {
        gameState.extraHours += 2;
        showPopup('info', 'Item Consumido', 'Ampulheta ativa! Você ganhou +2 horas de tempo extra no prazo diário.');
    }
    updateUI();
    await saveGameProgress();
}
document.getElementById('btn-buy-xp').addEventListener('click', () => buyItem('doubleXp', 50));
document.getElementById('btn-buy-time').addEventListener('click', () => buyItem('extraTime', 30));

// RELÓGIO REGRESSIVO (BRASÍLIA)
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

// RESET DIÁRIO
async function checkDailyReset() {
    const options = { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' };
    const dataBrasilia = new Intl.DateTimeFormat('pt-BR', options).format(new Date());

    if (gameState.lastResetDate !== dataBrasilia && currentUser) {
        gameState.tasks.forEach(t => t.completed = false);
        gameState.extraHours = 0; 
        gameState.lastResetDate = dataBrasilia;
        updateUI();
        await saveGameProgress();
        showPopup('info', 'Novo Dia!', 'Suas missões diárias foram renovadas! Boa sorte hoje.');
    }
}

// INICIALIZAÇÃO E LOADING SCREEN
window.addEventListener('DOMContentLoaded', () => {
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