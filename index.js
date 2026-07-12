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
let isRegisterMode = false;

const ALL_PRODUCTS = {
    doubleXp: { name: "Poção de XP Dobrado", desc: "Próxima tarefa concluída dá o dobro de XP", price: 50, icon: "🧪" },
    extraTime: { name: "Ampulheta do Tempo", desc: "Adiciona +2 horas no prazo limite do dia", price: 30, icon: "⏳" },
    elixirXp: { name: "Elixir Real", desc: "Consome na hora para ganhar +30 XP puro", price: 40, icon: "🧪" },
    scrollBonus: { name: "Pergaminho de Mestre", desc: "Permanente: +10 moedas bônus ao subir de nível", price: 120, icon: "📜" },
    luckyDice: { name: "Dado de Madeira", desc: "Ganha entre 10 e 80 moedas na hora (Sorte)", price: 45, icon: "🎲" },
    shieldProtection: { name: "Escudo do Alvorecer", desc: "Próxima tarefa criada começa dando +15 XP fixo", price: 35, icon: "🛡️" },
    guildContract: { name: "Contrato de Mercenário", desc: "Permanente: Reduz em 5% o XP necessário para upar", price: 160, icon: "📄" },
    coffeeBuff: { name: "Café Alquímico", desc: "Sua próxima tarefa rende +25 moedas extras", price: 25, icon: "☕" }
};

let gameState = {
    heroName: "Herói",
    level: 1, xp: 0, xpNeeded: 100, coins: 0,
    tasks: [], doubleXpActive: false, extraHours: 0, lastResetDate: "",
    bonusCoinsLevelUp: 0,
    bonusTaskXp: 0,
    discountXpPercent: 0,
    nextTaskBonusCoins: 0,
    history: {}, // Guardará objetos: {"DD/MM/AAAA": { count: X, missionNames: [...] }}
    currentDailyShop: []
};

const INITIAL_STATE = {
    heroName: "Herói",
    level: 1, xp: 0, xpNeeded: 100, coins: 0,
    tasks: [], doubleXpActive: false, extraHours: 0, lastResetDate: "",
    bonusCoinsLevelUp: 0,
    bonusTaskXp: 0,
    discountXpPercent: 0,
    nextTaskBonusCoins: 0,
    history: {},
    currentDailyShop: []
};

function getHeroTitle(level) {
    if (level >= 25) return "🧙‍♂️ Mestre Supremo";
    if (level >= 18) return "🔱 Cavaleiro Paladino";
    if (level >= 12) return "⚔️ Guerreiro de Elite";
    if (level >= 6) return "🏹 Caçador Veterano";
    if (level >= 3) return "🛡️ Recruta Destemido";
    return "🌱 Aprendiz da Guilda";
}

function getGravatarUrl(email) {
    const cleanEmail = email.trim().toLowerCase();
    let hash = 0;
    for (let i = 0; i < cleanEmail.length; i++) {
        hash = cleanEmail.charCodeAt(i) + ((hash << 5) - hash);
    }
    return `https://www.gravatar.com/avatar/${Math.abs(hash)}?d=identicon&s=150`;
}

window.showPopup = function(type, title, message, itemsList = null) {
    const popup = document.getElementById('custom-popup');
    const iconElement = document.getElementById('popup-icon');
    const titleElement = document.getElementById('popup-title');
    const msgElement = document.getElementById('popup-message');
    const boxElement = document.querySelector('.popup-box');
    const extraContent = document.getElementById('popup-extra-content');

    titleElement.innerText = title;
    msgElement.innerText = message;
    extraContent.innerHTML = "";

    if (itemsList && itemsList.length > 0) {
        itemsList.forEach(m => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'history-modal-li';
            itemDiv.innerText = m;
            extraContent.appendChild(itemDiv);
        });
    }

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
    } else if (type === 'history') {
        iconElement.innerText = '📜';
        titleElement.style.color = '#a370f7';
        boxElement.style.borderColor = '#a370f7';
    }
    popup.classList.add('active');
}

window.closePopup = function() {
    document.getElementById('custom-popup').classList.remove('active');
}
document.getElementById('btn-popup-close').addEventListener('click', closePopup);

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
        if (!gameState.currentDailyShop) gameState.currentDailyShop = [];
        if (gameState.bonusTaskXp === undefined) gameState.bonusTaskXp = 0;
        if (gameState.discountXpPercent === undefined) gameState.discountXpPercent = 0;
        if (gameState.nextTaskBonusCoins === undefined) gameState.nextTaskBonusCoins = 0;
    } else {
        gameState = { ...INITIAL_STATE };
        const nameInput = document.getElementById('auth-name').value.trim();
        gameState.heroName = nameInput || "Herói Anônimo";
        await setDoc(docRef, gameState);
    }
    checkDailyReset();
    updateUI();
}

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

    if(!name || !email || !password) return showPopup('error', 'Ops!', 'Preencha todos os campos.');
    if(password.length < 6) return showPopup('error', 'Senha Fraca', 'Mínimo de 6 caracteres.');

    try {
        await createUserWithEmailAndPassword(auth, email, password);
        showPopup('success', 'Guilda Aceita!', 'Sua conta de Herói foi gerada.');
    } catch (error) {
        showPopup('error', 'Erro no Cadastro', 'O e-mail inserido já pode estar em uso.');
    }
});

document.getElementById('btn-logout').addEventListener('click', () => { signOut(auth); });

function generateDailyShopRotation() {
    const productKeys = Object.keys(ALL_PRODUCTS);
    const shuffled = productKeys.sort(() => 0.5 - Math.random());
    gameState.currentDailyShop = shuffled.slice(0, 5);
}

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
    if (gameState.bonusTaskXp > 0) buffsHtml += `<div>🛡️ Escudo: Próxima missão começa com +${gameState.bonusTaskXp} XP fixo!</div>`;
    if (gameState.discountXpPercent > 0) buffsHtml += `<div>📄 Contrato: Requisito de XP reduzido em -${gameState.discountXpPercent}%!</div>`;
    if (gameState.nextTaskBonusCoins > 0) buffsHtml += `<div>☕ Café: Próxima missão dá +${gameState.nextTaskBonusCoins} moedas bônus!</div>`;
    document.getElementById('buffs-ativos').innerHTML = buffsHtml;

    // Listar missões com botão de Concluir e Deletar
    const list = document.getElementById('task-list');
    list.innerHTML = "";
    gameState.tasks.forEach((task, index) => {
        if (!task.completed) {
            const li = document.createElement('li');
            li.innerHTML = `<span>${task.text}</span>`;
            
            const actionsDiv = document.createElement('div');
            actionsDiv.style.display = "flex";
            actionsDiv.style.gap = "6px";

            const btnComp = document.createElement('button');
            btnComp.className = 'btn-complete';
            btnComp.innerText = '✔';
            btnComp.onclick = () => completeTask(index);

            const btnDel = document.createElement('button');
            btnDel.className = 'btn-delete-task';
            btnDel.innerText = '🗑️';
            btnDel.onclick = () => deleteTask(index);

            actionsDiv.appendChild(btnComp);
            actionsDiv.appendChild(btnDel);
            li.appendChild(actionsDiv);
            list.appendChild(li);
        }
    });

    // Renderizar Lojinha
    const shopContainer = document.getElementById('shop-container');
    shopContainer.innerHTML = "";
    if(gameState.currentDailyShop.length === 0) generateDailyShopRotation();

    gameState.currentDailyShop.forEach(itemKey => {
        const item = ALL_PRODUCTS[itemKey];
        if(!item) return;

        const itemDiv = document.createElement('div');
        itemDiv.className = 'shop-item';
        itemDiv.innerHTML = `
            <div>
                <strong>${item.icon} ${item.name}</strong>
                <small>${item.desc}</small>
            </div>
            <button class="btn-shop" id="btn-buy-${itemKey}">Comprar (<span class="price">${item.price}🪙</span>)</button>
        `;
        shopContainer.appendChild(itemDiv);
        document.getElementById(`btn-buy-${itemKey}`).onclick = () => buyItem(itemKey, item.price);
    });

    // Histórico Clicável
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = "";
    const sortedDates = Object.keys(gameState.history).sort((a,b) => b.localeCompare(a));
    if (sortedDates.length === 0) {
        historyList.innerHTML = `<li style="background:transparent; border:none; padding:5px; color:#7c7c8a;">Nenhuma missão registrada ainda.</li>`;
    } else {
        sortedDates.forEach(date => {
            const record = gameState.history[date];
            // Garante compatibilidade caso o registro antigo seja apenas um número
            const totalCount = (typeof record === 'object') ? record.count : record;
            const names = (typeof record === 'object') ? record.missionNames : [];

            const hLi = document.createElement('li');
            hLi.className = "history-item-clickable";
            hLi.style.padding = "8px 12px"; 
            hLi.style.background = "#14111f";
            hLi.innerHTML = `<span>📅 ${date}</span> <strong style="color:var(--green)">✓ ${totalCount} concluídas</strong>`;
            
            // Evento de clique para abrir os detalhes das missões concluídas naquele dia
            hLi.onclick = () => {
                showPopup('history', `Conquistas de ${date}`, `Você concluiu ${totalCount} missão(ões) neste dia:`, names);
            };

            historyList.appendChild(hLi);
        });
    }
}

// REMOÇÃO DO LIMITE MÍNIMO DE 15 XP
function calculateTaskXp() {
    let totalTasks = gameState.tasks.filter(t => !t.completed).length;
    let baseXp = 100;
    if (totalTasks > 1) {
        baseXp = Math.floor(100 / totalTasks); // Sem o Math.max(15, ...) antigo! Vai diminuindo livremente.
    }
    
    baseXp += gameState.bonusTaskXp; 
    return gameState.doubleXpActive ? baseXp * 2 : baseXp;
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

// APAGAR TAREFA COMPLETAMENTE
async function deleteTask(index) {
    gameState.tasks.splice(index, 1);
    updateUI();
    await saveGameProgress();
}

async function completeTask(index) {
    let earnedXp = calculateTaskXp();
    const finishedTaskText = gameState.tasks[index].text;
    gameState.tasks[index].completed = true;
    
    if (gameState.doubleXpActive) gameState.doubleXpActive = false;
    if (gameState.bonusTaskXp > 0) gameState.bonusTaskXp = 0;

    const options = { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' };
    const dataBrasilia = new Intl.DateTimeFormat('pt-BR', options).format(new Date());
    
    // Inicializa a nova estrutura estruturada de histórico se não existir
    if (!gameState.history[dataBrasilia] || typeof gameState.history[dataBrasilia] !== 'object') {
        const oldVal = gameState.history[dataBrasilia] || 0;
        gameState.history[dataBrasilia] = {
            count: typeof oldVal === 'object' ? oldVal.count : oldVal,
            missionNames: []
        };
    }
    
    gameState.history[dataBrasilia].count += 1;
    gameState.history[dataBrasilia].missionNames.push(finishedTaskText);

    gameState.coins += gameState.nextTaskBonusCoins;
    if(gameState.nextTaskBonusCoins > 0) gameState.nextTaskBonusCoins = 0;

    gainXp(earnedXp);
    updateUI();
    await saveGameProgress();
}

function gainXp(amount) {
    gameState.xp += amount;
    while (gameState.xp >= gameState.xpNeeded) {
        gameState.xp -= gameState.xpNeeded;
        gameState.level++;
        
        let multiplier = 1.2 - (gameState.discountXpPercent / 100);
        gameState.xpNeeded = Math.floor(gameState.xpNeeded * Math.max(1.05, multiplier));
        
        let baseAward = 50 + gameState.bonusCoinsLevelUp;
        gameState.coins += baseAward;
        
        showPopup('success', `LEVEL UP!`, `Alcançou o nível ${gameState.level} (${getHeroTitle(gameState.level)}) e ganhou ${baseAward} Moedas!`);
    }
}

async function buyItem(item, cost) {
    if (gameState.coins < cost) {
        showPopup('error', 'Sem moedas', 'Vá terminar suas missões para conseguir fundos!');
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
        showPopup('success', 'Elixir Consumido', 'Você absorveu 30 XP instantaneamente!');
    } else if (item === 'scrollBonus') {
        gameState.bonusCoinsLevelUp += 10;
        showPopup('success', 'Conhecimento Antigo', 'Você ganhará +10 moedas adicionais a cada Level Up.');
    } else if (item === 'luckyDice') {
        let sortedCoins = Math.floor(Math.random() * 71) + 10;
        gameState.coins += sortedCoins;
        showPopup('success', 'Dado Rolado! 🎲', `O dado parou! Você tirou a sorte grande e ganhou ${sortedCoins} moedas!`);
    } else if (item === 'shieldProtection') {
        gameState.bonusTaskXp += 15;
        showPopup('info', 'Escudo Equipado', 'Sua próxima missão diária dará +15 XP bônus de partida.');
    } else if (item === 'guildContract') {
        gameState.discountXpPercent += 5;
        showPopup('success', 'Contrato Assinado', 'O custo de XP para subir de nível reduziu em +5% permanentemente!');
    } else if (item === 'coffeeBuff') {
        gameState.nextTaskBonusCoins += 25;
        showPopup('info', 'Energia Pura ☕', 'Foco total! Sua próxima missão concederá +25 moedas bônus.');
    }
    updateUI();
    await saveGameProgress();
}

document.getElementById('btn-clear-history').addEventListener('click', async () => {
    gameState.history = {};
    updateUI();
    await saveGameProgress();
    showPopup('info', 'Histórico Limpo', 'Seu livro de registros passados foi zerado.');
});

function updateCountdown() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
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
    document.getElementById('shop-timer').innerText = `🔄 Nova Loja em: ${pad(displayHrs)}h`;
}

async function checkDailyReset() {
    const options = { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' };
    const dataBrasilia = new Intl.DateTimeFormat('pt-BR', options).format(new Date());

    if (gameState.lastResetDate !== dataBrasilia && currentUser) {
        gameState.tasks.forEach(t => t.completed = false);
        gameState.extraHours = 0; 
        gameState.lastResetDate = dataBrasilia;
        generateDailyShopRotation(); 
        updateUI();
        await saveGameProgress();
        showPopup('info', 'Dia Atualizado!', 'As missões e os itens do Mercado Diário mudaram!');
    }
}

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