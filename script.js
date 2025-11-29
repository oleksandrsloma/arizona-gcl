// === КОНФИГУРАЦИЯ FIREBASE (ВСТАВЬ СВОИ ДАННЫЕ!) ===
const firebaseConfig = {
  apiKey: "AIzaSyC-jCAxq5N0YSGlJkANVAPJvtjavfeqFJg",
  authDomain: "arizona-gcl.firebaseapp.com",
  databaseURL: "https://arizona-gcl-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "arizona-gcl",
  storageBucket: "arizona-gcl.firebasestorage.app",
  messagingSenderId: "449641048790",
  appId: "1:449641048790:web:a094cdeb4ffb95f600b777",
  measurementId: "G-VV5W7WV5B2"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const BOT_TOKEN = "8318387055:AAELcIGbdk2Zr_3z9okZwsioGdTZHfVFqec";
const LEADER_CHAT_ID = "912821088"; 

let currentUser = null;
let userData = null;
let tempOrder = {};

document.addEventListener('DOMContentLoaded', () => {
    // Подписка на глобальные обновления
    db.ref('settings/recruit').on('value', snap => updateRecruitUI(snap.val()));
    db.ref('users').on('value', snap => calculateBestEmployee(snap.val()));
    applyTheme();
});

// === АВТОРИЗАЦИЯ ===
function performLoginCloud() {
    const nick = document.getElementById('loginNick').value.trim();
    const pass = document.getElementById('loginPass').value.trim();
    const mode = document.getElementById('loginNick').getAttribute('data-mode');

    if(mode === 'leader') {
        if(pass === '1234') loginSuccess('Директор', {rank: 'Руководство', avatar: ''}, true);
        else showToast('Неверный пароль Лидера');
        return;
    }

    db.ref('users/' + nick).once('value').then((snapshot) => {
        const data = snapshot.val();
        if (data && data.pass === pass) {
            loginSuccess(nick, data, false);
        } else {
            showToast('Сотрудник не найден или пароль неверный');
        }
    });
}

function loginSuccess(nick, data, isLeader) {
    currentUser = nick;
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('publicSection').classList.add('hidden');
    document.querySelector('.navbar').classList.add('hidden');
    document.getElementById('dashboardSection').classList.remove('hidden');

    if (isLeader) {
        document.getElementById('adminBtn').classList.remove('hidden');
        renderAdminRealtime();
        document.getElementById('dashNick').innerText = "Doni_Moore";
        document.getElementById('dashRank').innerText = "Директор";
    } else {
        // Подписка на свой профиль
        db.ref('users/' + nick).on('value', (snap) => {
            userData = snap.val();
            if(!userData) { alert("Вас удалили из базы!"); location.reload(); return; }
            updateDashboardUI();
        });
    }
}

// === ИНТЕРФЕЙС ===
function updateDashboardUI() {
    document.getElementById('dashNick').innerText = currentUser;
    document.getElementById('dashRank').innerText = userData.rank;
    document.getElementById('dashAvatar').src = userData.avatar || "";
    document.getElementById('statBalance').innerText = (userData.balance || 0).toLocaleString() + " $";
    document.getElementById('statCount').innerText = userData.count || 0;

    // XP
    const xp = userData.xp || 0;
    const lvl = Math.floor(xp / 100) + 1;
    const progress = xp % 100;
    document.getElementById('lvlNum').innerText = lvl;
    document.getElementById('xpNum').innerText = `${progress}/100`;
    document.getElementById('xpFill').style.width = `${progress}%`;

    // Ачивки
    const count = userData.count || 0;
    if(count >= 10) document.getElementById('ach1').classList.add('unlocked');
    if(count >= 50) document.getElementById('ach2').classList.add('unlocked');
    if(count >= 100) document.getElementById('ach3').classList.add('unlocked');

    // История
    const list = document.getElementById('historyList');
    list.innerHTML = "";
    const history = userData.history ? Object.values(userData.history).reverse() : [];
    if(history.length === 0) list.innerHTML = "<div class='empty-msg'>История пуста</div>";
    
    history.forEach(h => {
        list.innerHTML += `<div class="h-item"><span>${h.op}</span><span class="h-sum">${h.sum}</span></div>`;
    });
}

// === ОТЧЕТ (ПРОВЕРКА В ОБЛАКЕ) ===
function submitReportCloud() {
    const id = document.getElementById('repId').value.trim();
    const inputCode = document.getElementById('repCode').value.trim();
    const price = parseInt(document.getElementById('repPrice').value);

    if(!id || !inputCode || !price) return showToast("Заполните поля");

    // Проверяем код в Firebase
    db.ref('codes/' + id).once('value').then((snapshot) => {
        const realCode = snapshot.val();
        
        if (realCode && realCode === inputCode) {
            db.ref('codes/' + id).remove(); // Удаляем код
            
            const userRef = db.ref('users/' + currentUser);
            userRef.transaction((current) => {
                if (current) {
                    current.balance = (current.balance || 0) + price;
                    current.count = (current.count || 0) + 1;
                    current.xp = (current.xp || 0) + 10;
                }
                return current;
            }, (error, committed) => {
                if(committed) {
                    // Пишем историю отдельно
                    db.ref(`users/${currentUser}/history`).push({
                        op: `Заказ #${id}`, 
                        sum: `+${price}$`, 
                        date: new Date().toISOString()
                    });
                    showToast("Зарплата начислена!", "success");
                    document.getElementById('repId').value = "";
                    document.getElementById('repCode').value = "";
                    switchTab('stats');
                }
            });
        } else {
            showToast("Неверный код!", "error");
        }
    });
}

// === АДМИНКА ===
function renderAdminRealtime() {
    const tbody = document.querySelector('#staffTable tbody');
    db.ref('users').on('value', (snap) => {
        tbody.innerHTML = "";
        const users = snap.val();
        if(users) {
            for(const [nick, d] of Object.entries(users)) {
                tbody.innerHTML += `<tr><td>${nick}</td><td>${d.rank}</td><td>${d.count}</td><td>${d.balance}$</td></tr>`;
            }
        }
    });
}

// === ОСТАЛЬНОЕ ===
function toggleRecruitCloud() {
    const status = document.getElementById('recruitToggle').checked ? 'open' : 'closed';
    db.ref('settings/recruit').set(status);
}
function updateRecruitUI(status) {
    const badge = document.getElementById('recruitBadge');
    if (status === 'open') {
        badge.innerHTML = '<span class="dot" style="background:lime; box-shadow:0 0 10px lime"></span> Набор открыт';
        badge.style.borderColor = "lime";
        badge.style.color = "lime";
        if(document.getElementById('recruitToggle')) document.getElementById('recruitToggle').checked = true;
    } else {
        badge.innerHTML = '<span class="dot"></span> Набор закрыт';
        badge.style.borderColor = "var(--primary)";
        badge.style.color = "var(--primary)";
    }
}
function calculateBestEmployee(users) {
    if(!users) return;
    let best = {nick: "Никого", count: 0, avatar: ""};
    for(const [nick, d] of Object.entries(users)) {
        if(d.count > best.count) best = {nick: nick, ...d};
    }
    document.getElementById('bestNick').innerText = best.nick;
    document.getElementById('bestCount').innerText = best.count;
    document.getElementById('bestAvatar').src = best.avatar || "";
}

// === AHK BUILDER ===
function generateAHK() {
    const nick = document.getElementById('ahkNick').value || "Name";
    const rank = document.getElementById('ahkRank').value || "Rank";
    const content = `Numpad1::\nSendMessage, 0x50,, 0x4190419,, A\nSendInput, {F6}Я ${rank} ${nick}.{Enter}\nReturn`;
    const blob = new Blob([content], {type: "text/plain"});
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Script.ahk";
    link.click();
}

// === UI & PAYMENTS ===
function showToast(msg, type='info') {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = msg;
    c.appendChild(t);
    setTimeout(()=>t.remove(), 4000);
}
function goToPayment() {
    const nick = document.getElementById('buyerNick').value;
    const price = document.getElementById('buyerLic').value;
    if(nick.length < 3) return showToast("Введите ник");
    tempOrder = {nick, price, id: Date.now().toString().slice(-5)};
    document.getElementById('step1').classList.add('hidden');
    document.getElementById('step2').classList.remove('hidden');
    document.getElementById('displayPrice').innerText = price + " $";
}
function finishOrder() {
    const text = `💰 <b>ОПЛАТА</b>\n👤 ${tempOrder.nick}\n💵 ${tempOrder.price}$\n🆔 ${tempOrder.id}`;
    const kb = { inline_keyboard: [[{text: "✅ OK", callback_data: `approve_pay_${tempOrder.id}`}]] };
    fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ chat_id: LEADER_CHAT_ID, text, parse_mode: 'HTML', reply_markup: kb })
    });
    document.getElementById('step2').classList.add('hidden');
    document.getElementById('step3').classList.remove('hidden');
}
function setLoginMode(m) {
    document.getElementById('loginNick').setAttribute('data-mode', m);
    document.querySelectorAll('.l-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById('loginPass').placeholder = (m==='leader') ? "Пароль Лидера" : "Пароль (1234)";
}
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
}
function applyTheme() { /* theme logic */ }
function switchTab(t) {
    document.querySelectorAll('.content-tab').forEach(c => c.classList.add('hidden'));
    document.getElementById('tab-'+t).classList.remove('hidden');
}
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function logout() { location.reload(); }
function showPublic() { location.reload(); }
function checkBlacklistPublic() { showToast("Чист.", "success"); }
function copyLecture() { navigator.clipboard.writeText("/s Лекция..."); showToast("Скопировано!"); }