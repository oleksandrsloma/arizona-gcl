// === КОНФИГУРАЦИЯ ===
const BOT_TOKEN = "8318387055:AAELcIGbdk2Zr_3z9okZwsioGdTZHfVFqec";
const LEADER_CHAT_ID = "912821088"; 
const GAME_LEADER_NICK = "Doni_Moore";
// СЕКРЕТНЫЙ КЛЮЧ ОРГАНИЗАЦИИ (Нужен для проверки кодов)
const SECRET_KEY = "ARIZONA_GCL_2025"; 

// === ИНИЦИАЛИЗАЦИЯ ===
if (!localStorage.getItem('gcl_staff')) {
    localStorage.setItem('gcl_staff', JSON.stringify({
        "James_Cameron": { rank: "Мл. Инструктор (4)", balance: 0, count: 0, avatar: "https://wiki.sa-mp.com/w/images/thumb/7/7c/Skin_113.png/180px-Skin_113.png" }
    }));
}
if (!localStorage.getItem('gcl_blacklist')) localStorage.setItem('gcl_blacklist', JSON.stringify([]));
if (!localStorage.getItem('gcl_recruit')) localStorage.setItem('gcl_recruit', 'closed');

let currentUser = null;
let tempOrder = {};

document.addEventListener('DOMContentLoaded', () => {
    checkRecruitStatus();
    updateBestEmployee();
});

// === АВТО-ДОСКА ПОЧЕТА ===
function updateBestEmployee() {
    const staff = JSON.parse(localStorage.getItem('gcl_staff'));
    let bestUser = null, maxCount = -1;
    for (const [nick, data] of Object.entries(staff)) {
        if (data.count > maxCount) { maxCount = data.count; bestUser = { nick, ...data }; }
    }
    if (bestUser && maxCount > 0) {
        document.getElementById('bestNick').innerText = bestUser.nick;
        document.getElementById('bestAvatar').src = bestUser.avatar;
        document.getElementById('bestCount').innerText = bestUser.count;
    } else {
        document.getElementById('bestNick').innerText = "Никого...";
        document.getElementById('bestCount').innerText = "0";
    }
}

// === СИСТЕМА ЗАЩИТЫ (АНТИ-ФРОД) ===
// Эта функция создает уникальный код на основе ID заказа
function generateSecureCode(orderId) {
    // Простая криптография: берем ID + Секретный ключ, переводим в Base64 и берем кусок
    const rawString = orderId + SECRET_KEY;
    // Имитация хеша (для простоты используем btoa)
    const hash = btoa(rawString).replace(/[^a-zA-Z0-9]/g, ''); 
    // Берем 3 буквы с начала и 3 с конца
    return (hash.substring(0, 3) + "-" + hash.substring(hash.length - 3)).toUpperCase();
}

// === ПОКУПКА (КЛИЕНТ) ===
function goToPayment() {
    const nick = document.getElementById('buyerNick').value;
    const price = document.getElementById('buyerLic').value;
    const licName = document.getElementById('buyerLic').options[document.getElementById('buyerLic').selectedIndex].text;
    
    if(nick.length < 3) return alert("Введите ник!");
    
    // Генерируем ID
    const orderId = Date.now().toString().slice(-5);
    // Генерируем ЗАЩИЩЕННЫЙ КОД
    const secureCode = generateSecureCode(orderId);
    
    tempOrder = { nick, price, licName, id: orderId, code: secureCode };
    
    document.getElementById('step1').classList.add('hidden');
    document.getElementById('step2').classList.remove('hidden');
    document.getElementById('displayPrice').innerText = price + " $";
}

function finishOrder() {
    // Отправляем в ТГ сразу С КОДОМ (чтобы боту не нужно было думать)
    const text = `💰 <b>ЗАПРОС ОПЛАТЫ</b>\n👤 ${tempOrder.nick}\n💵 ${tempOrder.price} $\n📄 ${tempOrder.licName}\n🆔 ID: <code>${tempOrder.id}</code>\n🔐 Код: <code>${tempOrder.code}</code>`;
    
    const kb = { inline_keyboard: [[{text: "✅ Подтвердить", callback_data: `approve_pay_${tempOrder.id}`}], [{text: "❌ Отказ", callback_data: `deny_pay_${tempOrder.id}`}]] };
    
    fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ chat_id: LEADER_CHAT_ID, text, parse_mode: 'HTML', reply_markup: kb })
    });

    document.getElementById('step2').classList.add('hidden');
    document.getElementById('step3').classList.remove('hidden');
}

// === ОТЧЕТ СОТРУДНИКА (ПРОВЕРКА КОДА) ===
function submitReport() {
    const id = document.getElementById('repId').value.trim();
    const inputCode = document.getElementById('repCode').value.trim().toUpperCase();
    const price = parseInt(document.getElementById('repPrice').value);

    if (!id || !inputCode || !price) return alert("Заполните все поля!");

    // 🛑 ГЛАВНАЯ ПРОВЕРКА 🛑
    // Мы заново генерируем правильный код для этого ID и сравниваем с тем, что ввел сотрудник
    const realCode = generateSecureCode(id);

    if (inputCode !== realCode) {
        // Если коды не совпали - это обман!
        alert(`⛔ ОШИБКА! Неверный секретный код.\nСистема ожидает код для заказа #${id}, но вы ввели неверные данные.`);
        return; // Деньги не даем!
    }

    // Если код верный - начисляем
    const staff = JSON.parse(localStorage.getItem('gcl_staff'));
    if (staff[currentUser]) {
        staff[currentUser].balance += price;
        staff[currentUser].count += 1;
        localStorage.setItem('gcl_staff', JSON.stringify(staff));

        alert(`✅ УСПЕХ! Код принят.\nЗарплата начислена: +${price}$`);
        document.getElementById('repId').value = "";
        document.getElementById('repCode').value = "";
        document.getElementById('repPrice').value = "";
        updateStats();
        switchTab('stats');
    }
}


// === ОСТАЛЬНОЙ КОД БЕЗ ИЗМЕНЕНИЙ ===
function checkBlacklistPublic() {
    const nick = document.getElementById('blCheckInput').value.trim();
    if (!nick) return alert("Введите ник!");
    const bl = JSON.parse(localStorage.getItem('gcl_blacklist'));
    const found = bl.find(item => item.nick.toLowerCase() === nick.toLowerCase());
    found ? alert(`🚫 ИГРОК В ЧС!\nНик: ${found.nick}\nПричина: ${found.reason}`) : alert("✅ Игрок чист.");
}
function performLogin() {
    const input = document.getElementById('loginInput');
    const val = input.value;
    const isLeader = (input.placeholder.includes("Пароль"));
    if (isLeader && val === "1234") {
        loginSuccess("Doni_Moore", {rank:"Директор", avatar:"https://wiki.sa-mp.com/w/images/thumb/2/25/Skin_295.png/180px-Skin_295.png"}, true);
    } else if (!isLeader && JSON.parse(localStorage.getItem('gcl_staff'))[val]) {
        loginSuccess(val, JSON.parse(localStorage.getItem('gcl_staff'))[val], false);
    } else {
        alert("Ошибка входа!");
    }
}
function loginSuccess(nick, data, isLeader) {
    currentUser = nick;
    document.getElementById('publicSection').classList.add('hidden');
    document.querySelector('.navbar').classList.add('hidden');
    document.getElementById('dashboardSection').classList.remove('hidden');
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('dashNick').innerText = nick;
    document.getElementById('dashRank').innerText = data.rank;
    document.getElementById('dashAvatar').src = data.avatar;
    if (isLeader) {
        document.getElementById('adminBtn').classList.remove('hidden');
        renderAdminPanel();
    } else { updateStats(); }
}
function updateStats() {
    const data = JSON.parse(localStorage.getItem('gcl_staff'))[currentUser];
    document.getElementById('statBalance').innerText = data.balance + " $";
    document.getElementById('statCount').innerText = data.count;
}
function renderAdminPanel() {
    const staff = JSON.parse(localStorage.getItem('gcl_staff'));
    const tbody = document.querySelector('#staffTable tbody');
    tbody.innerHTML = "";
    for (const [nick, data] of Object.entries(staff)) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${nick}</td><td>${data.rank}</td><td>${data.count}</td><td>${data.balance}$</td><td><button class="btn-danger" onclick="fireStaff('${nick}')">Уволить</button></td>`;
        tbody.appendChild(tr);
    }
    const bl = JSON.parse(localStorage.getItem('gcl_blacklist'));
    const ul = document.getElementById('blList');
    ul.innerHTML = "";
    bl.forEach((item, index) => {
        const li = document.createElement('li');
        li.innerHTML = `<span><b>${item.nick}</b>: ${item.reason}</span> <button class="btn-danger" onclick="removeFromBL(${index})">X</button>`;
        ul.appendChild(li);
    });
}
function fireStaff(nick) {
    if(confirm(`Уволить ${nick}?`)) {
        const staff = JSON.parse(localStorage.getItem('gcl_staff'));
        delete staff[nick];
        localStorage.setItem('gcl_staff', JSON.stringify(staff));
        renderAdminPanel();
    }
}
function resetAllStats() {
    if(confirm("Обнулить неделю?")) {
        const staff = JSON.parse(localStorage.getItem('gcl_staff'));
        for(let n in staff) { staff[n].count=0; staff[n].balance=0; }
        localStorage.setItem('gcl_staff', JSON.stringify(staff));
        renderAdminPanel();
    }
}
function addToBlacklist() {
    const nick = document.getElementById('blNick').value;
    const reason = document.getElementById('blReason').value;
    if(nick) {
        const bl = JSON.parse(localStorage.getItem('gcl_blacklist'));
        bl.push({nick, reason});
        localStorage.setItem('gcl_blacklist', JSON.stringify(bl));
        renderAdminPanel();
    }
}
function removeFromBL(index) {
    const bl = JSON.parse(localStorage.getItem('gcl_blacklist'));
    bl.splice(index, 1);
    localStorage.setItem('gcl_blacklist', JSON.stringify(bl));
    renderAdminPanel();
}
function setLoginMode(mode) {
    document.getElementById('loginInput').placeholder = (mode === 'leader') ? "Пароль Лидера" : "Nick_Name";
    document.querySelectorAll('.lt-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
}
function switchTab(t) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    document.getElementById('tab-'+t).classList.remove('hidden');
}
function logout() { location.reload(); }
function showPublic() { location.reload(); }
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function checkRecruitStatus() {
    const status = localStorage.getItem('gcl_recruit');
    const badge = document.getElementById('recruitBadge');
    badge.className = `status-badge ${status}`;
    badge.innerText = (status === 'open') ? "Набор открыт!" : "Набор закрыт";
}
function toggleRecruit() {
    const status = document.getElementById('recruitToggle').checked ? 'open' : 'closed';
    localStorage.setItem('gcl_recruit', status);
    checkRecruitStatus();
}
function copyText(btn) {
    navigator.clipboard.writeText(btn.previousElementSibling.innerText);
    alert("Скопировано!");
}
function copyLeader() { navigator.clipboard.writeText(GAME_LEADER_NICK); alert("Ник скопирован"); }