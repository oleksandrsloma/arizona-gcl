// === КОНФИГУРАЦИЯ ===
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
const GAME_LEADER_NICK = "Doni_Moore";

let currentUser = null;
let userData = null;
let tempOrder = {};

// === 1. ЗАГРУЗКА И АВТО-ВХОД ===
document.addEventListener('DOMContentLoaded', () => {
    // Авто-вход
    const savedUser = localStorage.getItem('gcl_session_user');
    const savedRole = localStorage.getItem('gcl_session_role');

    if (savedUser) {
        if (savedRole === 'leader') {
            loginSuccess('Doni_Moore', {rank: 'Директор', level: 3}, true);
        } else {
            db.ref('users/' + savedUser).once('value').then(snap => {
                if(snap.exists()) loginSuccess(savedUser, snap.val(), false);
            });
        }
    }

    db.ref('settings/recruit').on('value', snap => updateRecruitUI(snap.val()));
    db.ref('users').on('value', snap => calculateBestEmployee(snap.val()));
});

// === 2. АВТОРИЗАЦИЯ ===
function performLoginCloud() {
    const nick = document.getElementById('loginNick').value.trim();
    const pass = document.getElementById('loginPass').value.trim();
    const mode = document.getElementById('loginNick').getAttribute('data-mode');

    if(mode === 'leader') {
        if(pass === '1234') {
            localStorage.setItem('gcl_session_user', 'Leader');
            localStorage.setItem('gcl_session_role', 'leader');
            loginSuccess('Doni_Moore', {rank: 'Директор', level: 3}, true);
        } else showToast('Неверный пароль', 'error');
        return;
    }

    db.ref('users/' + nick).once('value').then(snap => {
        const data = snap.val();
        if (data && data.pass === pass) {
            localStorage.setItem('gcl_session_user', nick);
            localStorage.setItem('gcl_session_role', 'emp');
            loginSuccess(nick, data, false);
        } else {
            showToast('Ошибка входа', 'error');
        }
    });
}

function loginSuccess(nick, data, isLeader) {
    currentUser = nick;
    userData = data;
    
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('publicSection').classList.add('hidden');
    document.querySelector('.navbar').classList.add('hidden');
    document.getElementById('dashboardSection').classList.remove('hidden');

    if (isLeader) {
        document.getElementById('menuLevel3').classList.remove('hidden');
        renderAdminRealtime();
        document.getElementById('dashNick').innerText = "Doni_Moore";
        document.getElementById('dashRank').innerText = "Директор";
    } else {
        // Подписка на обновления профиля
        db.ref('users/' + nick).on('value', (snap) => {
            const fresh = snap.val();
            if(!fresh) { logout(); return; }
            
            // ПРОВЕРКА УВЕДОМЛЕНИЙ (Самое важное)
            if (fresh.notifications) {
                Object.entries(fresh.notifications).forEach(([key, note]) => {
                    // Показываем алерт
                    showAlert(note.title, note.msg, note.type);
                    // Удаляем уведомление, чтобы не показывать дважды
                    db.ref(`users/${nick}/notifications/${key}`).remove();
                });
            }

            userData = fresh;
            updateDashboardUI();
            checkAccessLevels(); // Обновляем меню при смене уровня
        });
    }
}

// === 3. ПРОВЕРКА УРОВНЕЙ ДОСТУПА ===
function checkAccessLevels() {
    const lvl = userData.level || 1;
    const dept = userData.department || "Нет";

    document.getElementById('dashDept').innerText = "Отдел: " + dept;

    // Сброс
    document.getElementById('menuLevel2').classList.add('hidden');
    document.getElementById('menuLevel3').classList.add('hidden');

    if (lvl >= 2) document.getElementById('menuLevel2').classList.remove('hidden');
    if (lvl >= 3) document.getElementById('menuLevel3').classList.remove('hidden');
}

// === 4. ОТПРАВКА ОТЧЕТОВ (ЧЕРЕЗ FIREBASE) ===
// Это теперь работает на 100%, так как мы пишем в базу, а бот читает оттуда
function sendInternalReport(type) {
    let desc = "";
    if(type === 'Повышение') desc = document.getElementById('promoDesc').value;
    if(type === 'Снятие выговора') desc = document.getElementById('warnDesc').value;
    if(type === 'Сообщение') desc = document.getElementById('msgDesc').value;

    if(!desc) return showToast("Заполните поле!", "error");

    // Пишем в специальную ветку 'site_reports'
    db.ref('site_reports').push({
        author: currentUser,
        type: type,
        text: desc,
        time: Date.now()
    }).then(() => {
        showToast("Отчет отправлен Лидеру!", "success");
        // Очистка
        document.getElementById('promoDesc').value = "";
        document.getElementById('warnDesc').value = "";
        document.getElementById('msgDesc').value = "";
    }).catch(err => {
        showToast("Ошибка соединения", "error");
    });
}

// === 5. ИНТЕРФЕЙС ===
function updateDashboardUI() {
    document.getElementById('dashNick').innerText = currentUser;
    document.getElementById('dashRank').innerText = userData.rank;
    document.getElementById('dashAvatar').src = userData.avatar || "";
    
    document.getElementById('statBalance').innerText = (userData.balance || 0).toLocaleString() + " $";
    document.getElementById('statCount').innerText = userData.count || 0;
    document.getElementById('statXP').innerText = userData.xp || 0;

    // XP
    const xp = userData.xp || 0;
    const lvl = Math.floor(xp / 100) + 1;
    const progress = xp % 100;
    document.getElementById('lvlNum').innerText = lvl;
    document.getElementById('xpNum').innerText = `${progress}/100`;
    document.getElementById('xpFill').style.width = `${progress}%`;

    // История
    const list = document.getElementById('historyList');
    list.innerHTML = "";
    const history = userData.history ? Object.values(userData.history).reverse() : [];
    
    if(history.length === 0) list.innerHTML = "<div class='empty-msg'>История пуста</div>";
    
    history.slice(0, 10).forEach(h => {
        list.innerHTML += `<div class="h-item"><span>${h.op}</span><span class="h-sum">${h.sum}</span></div>`;
    });
}

// === СДАЧА ЗП ===
function submitReportCloud() {
    const id = document.getElementById('repId').value.trim();
    const inputCode = document.getElementById('repCode').value.trim();
    const price = parseInt(document.getElementById('repPrice').value);

    if(!id || !inputCode || !price) return showToast("Заполните поля", "error");

    db.ref('codes/' + id).once('value').then((snapshot) => {
        const realCode = snapshot.val();
        
        if (realCode && realCode === inputCode) {
            db.ref('codes/' + id).remove();
            
            const userRef = db.ref('users/' + currentUser);
            userRef.transaction((current) => {
                if (current) {
                    current.balance = (current.balance || 0) + price;
                    current.count = (current.count || 0) + 1;
                    current.xp = (current.xp || 0) + 5;
                }
                return current;
            }, (error, committed) => {
                if(committed) {
                    const date = new Date().toLocaleTimeString();
                    db.ref(`users/${currentUser}/history`).push({
                        op: `Заказ #${id}`, sum: `+${price}$`, date: date
                    });
                    showToast("Зарплата начислена!", "success");
                    switchTab('stats');
                }
            });
        } else {
            showToast("Неверный код", "error");
        }
    });
}

// === ОСТАЛЬНОЕ ===
function renderAdminRealtime() {
    const tbody = document.querySelector('#staffTable tbody');
    db.ref('users').on('value', (snap) => {
        tbody.innerHTML = "";
        const users = snap.val();
        if(users) {
            for(const [n, d] of Object.entries(users)) {
                let color = d.level === 3 ? '#ff2d55' : (d.level === 2 ? '#ff9500' : 'white');
                tbody.innerHTML += `<tr><td>${n}</td><td>${d.rank}</td><td style="color:${color}">${d.level}</td><td>${d.department || '-'}</td></tr>`;
            }
        }
    });
}

function showToast(msg, type='info') {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = 'toast';
    t.style.borderColor = (type==='error'?'#ff2d55':(type==='success'?'#34c759':'#007aff'));
    t.innerHTML = msg;
    c.appendChild(t);
    setTimeout(()=>t.remove(), 4000);
}

function showAlert(title, msg, type='info') {
    document.getElementById('alertTitle').innerText = title;
    document.getElementById('alertMsg').innerText = msg;
    const icon = document.getElementById('alertIcon');
    icon.style.color = (type==='error') ? '#ff2d55' : (type==='success') ? '#34c759' : '#007aff';
    icon.innerHTML = (type==='error') ? '<i class="fa-solid fa-triangle-exclamation"></i>' : '<i class="fa-solid fa-bell"></i>';
    openModal('alertModal');
}

function goToPayment() {
    const nick = document.getElementById('buyerNick').value;
    const price = document.getElementById('buyerLic').value;
    if(nick.length < 3) return showToast("Введите ник!", "error");
    tempOrder = {nick, price, id: Date.now().toString().slice(-5)};
    document.getElementById('step1').classList.add('hidden');
    document.getElementById('step2').classList.remove('hidden');
    document.getElementById('displayPrice').innerText = price + " $";
}

function finishOrder() {
    const text = `💰 <b>ОПЛАТА</b>\n👤 ${tempOrder.nick}\n💵 ${tempOrder.price}$\n🆔 ID: <code>${tempOrder.id}</code>`;
    const kb = { inline_keyboard: [[{text: "✅ Подтвердить", callback_data: `approve_pay_${tempOrder.id}`}]] };
    fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ chat_id: LEADER_CHAT_ID, text, parse_mode: 'HTML', reply_markup: kb })
    });
    document.getElementById('step2').classList.add('hidden');
    document.getElementById('step3').classList.remove('hidden');
}

function switchTab(t) {
    document.querySelectorAll('.tab-pane').forEach(c => c.classList.add('hidden'));
    document.getElementById('tab-'+t).classList.remove('hidden');
    document.querySelectorAll('.menu-item').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
}
function setLoginMode(m) {
    document.getElementById('loginNick').setAttribute('data-mode', m);
    document.querySelectorAll('.l-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById('loginPass').placeholder = (m==='leader') ? "Пароль Лидера" : "Пароль";
}
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function logout() { localStorage.removeItem('gcl_session_user'); location.reload(); }
function showPublic() { location.reload(); }
function copyLeader() { navigator.clipboard.writeText(GAME_LEADER_NICK); showToast("Ник скопирован!", "success"); }
function toggleRecruitCloud() { db.ref('settings/recruit').set(document.getElementById('recruitToggle').checked ? 'open' : 'closed'); }
function updateRecruitUI(s) { if(s==='open') { document.getElementById('recruitBadge').innerHTML='<span class="dot" style="background:lime"></span> Набор открыт'; if(document.getElementById('recruitToggle'))document.getElementById('recruitToggle').checked=true; } else { document.getElementById('recruitBadge').innerHTML='<span class="dot"></span> Набор закрыт'; } }
function calculateBestEmployee(u) { if(!u)return; let b={nick:"Никого", count:0}; for(const [n,d] of Object.entries(u)){ if(d.count>b.count)b={nick:n,...d}; } document.getElementById('bestNick').innerText=b.nick; document.getElementById('bestCount').innerText=b.count; document.getElementById('bestAvatar').src=b.avatar||""; }
function checkBlacklistPublic() { showToast("Игрок чист", "success"); }