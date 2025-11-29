// ================================================================
// 1. КОНФИГУРАЦИЯ (ВСТАВЬ СВОИ ДАННЫЕ!)
// ================================================================
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

// ================================================================
// 2. АВТО-ВХОД И ПОДПИСКИ
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
    const savedUser = localStorage.getItem('gcl_session_user');
    const savedRole = localStorage.getItem('gcl_session_role');

    if (savedUser) {
        if (savedRole === 'leader') {
            loginSuccess('Doni_Moore', {rank: 'Директор', level: 3, avatar: ''}, true);
        } else {
            db.ref('users/' + savedUser).once('value').then(snap => {
                if(snap.exists()) loginSuccess(savedUser, snap.val(), false);
            });
        }
    }

    // Слушаем глобальный статус набора
    db.ref('settings/recruit').on('value', snap => {
        const text = document.getElementById('recruitText');
        const dot = document.querySelector('.status-dot');
        if(snap.val() === 'open') {
            text.innerText = "НАБОР ОТКРЫТ";
            text.style.color = "var(--success)";
            dot.style.background = "var(--success)";
            dot.style.boxShadow = "0 0 10px var(--success)";
        } else {
            text.innerText = "НАБОР ЗАКРЫТ";
            text.style.color = "var(--text-sec)";
            dot.style.background = "var(--text-sec)";
            dot.style.boxShadow = "none";
        }
    });
});

// ================================================================
// 3. АВТОРИЗАЦИЯ
// ================================================================
function performLoginCloud() {
    const nick = document.getElementById('loginNick').value.trim();
    const pass = document.getElementById('loginPass').value.trim();
    const isLeader = document.getElementById('isLeaderLogin').checked;

    if (isLeader) {
        if(pass === '1234') {
            localStorage.setItem('gcl_session_user', 'Leader');
            localStorage.setItem('gcl_session_role', 'leader');
            loginSuccess('Doni_Moore', {rank: 'Директор', level: 3}, true);
        } else showToast('Неверный пароль Лидера', 'error');
        return;
    }

    db.ref('users/' + nick).once('value').then(snap => {
        const data = snap.val();
        if (data && data.pass === pass) {
            localStorage.setItem('gcl_session_user', nick);
            localStorage.setItem('gcl_session_role', 'emp');
            loginSuccess(nick, data, false);
        } else {
            showToast('Неверный ник или пароль', 'error');
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
        // Заглушка аватарки для лидера
        document.getElementById('dashAvatar').src = "https://wiki.sa-mp.com/w/images/thumb/2/25/Skin_295.png/180px-Skin_295.png";
    } else {
        // Подписка на профиль
        db.ref('users/' + nick).on('value', (snap) => {
            const fresh = snap.val();
            if(!fresh) { logout(); return; }
            
            // Уведомления
            if (fresh.notifications) {
                Object.entries(fresh.notifications).forEach(([key, note]) => {
                    showAlert(note.title, note.msg, note.type);
                    db.ref(`users/${nick}/notifications/${key}`).remove();
                });
            }

            userData = fresh;
            updateDashboardUI();
            checkAccessLevels();
        });
    }
    
    showToast(`Добро пожаловать, ${nick}!`, 'success');
}

// === 4. UI ИНТЕРФЕЙС ===
function updateDashboardUI() {
    document.getElementById('dashNick').innerText = currentUser;
    document.getElementById('dashRank').innerText = userData.rank;
    document.getElementById('dashDept').innerText = "Отдел: " + (userData.department || "Нет");
    document.getElementById('dashAvatar').src = userData.avatar || "";
    
    document.getElementById('statBalance').innerText = (userData.balance || 0).toLocaleString() + " $";
    document.getElementById('statCount').innerText = userData.count || 0;
    document.getElementById('statXP').innerText = userData.xp || 0;

    // История
    const list = document.getElementById('historyList');
    list.innerHTML = "";
    const history = userData.history ? Object.values(userData.history).reverse() : [];
    
    if(history.length === 0) {
        list.innerHTML = "<tr><td colspan='3' style='text-align:center; padding:20px; color:gray'>История пуста</td></tr>";
    } else {
        history.slice(0, 10).forEach(h => {
            list.innerHTML += `<tr><td>${h.op}</td><td style="color:var(--success)">${h.sum}</td><td>${h.date}</td></tr>`;
        });
    }
}

function checkAccessLevels() {
    const lvl = userData.level || 1;
    document.getElementById('menuLevel2').classList.add('hidden');
    document.getElementById('menuLevel3').classList.add('hidden');
    if (lvl >= 2) document.getElementById('menuLevel2').classList.remove('hidden');
    if (lvl >= 3) document.getElementById('menuLevel3').classList.remove('hidden');
}

// === 5. ФУНКЦИИ ОТЧЕТОВ ===
function submitReportCloud() {
    const id = document.getElementById('repId').value.trim();
    const inputCode = document.getElementById('repCode').value.trim();
    const price = parseInt(document.getElementById('repPrice').value);

    if(!id || !inputCode || !price) return showToast("Заполните все поля", "error");

    db.ref('codes/' + id).once('value').then((snapshot) => {
        const realCode = snapshot.val();
        
        if (realCode && realCode === inputCode) {
            db.ref('codes/' + id).remove(); // Удаляем код
            
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
                    const date = new Date().toLocaleDateString();
                    db.ref(`users/${currentUser}/history`).push({
                        op: `Заказ #${id}`, sum: `+${price}$`, date: date
                    });
                    showToast("Зарплата начислена!", "success");
                    switchTab('stats');
                }
            });
        } else {
            showToast("Неверный код или ID", "error");
        }
    });
}

function sendInternalReport(type) {
    let desc = "";
    if(type === 'Повышение') desc = document.getElementById('promoDesc').value;
    if(type === 'Снятие выговора') desc = document.getElementById('warnDesc').value;
    if(type === 'Сообщение') desc = document.getElementById('msgDesc').value;

    if(!desc) return showToast("Напишите текст!", "error");

    const text = `
📩 <b>НОВОЕ ЗАЯВЛЕНИЕ</b>
👤 От: ${currentUser}
🔰 Ранг: ${userData.rank}
📌 Тип: ${type}
📝 Текст: ${desc}
    `;
    
    // Прямая отправка в ТГ
    fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ chat_id: LEADER_CHAT_ID, text: text, parse_mode: 'HTML' })
    }).then(res => {
        if(res.ok) showToast("Отправлено Лидеру!", "success");
        else showToast("Ошибка отправки", "error");
    });
}

function saveSettings() {
    const av = document.getElementById('setAvatar').value;
    const pass = document.getElementById('setPass').value;
    const updates = {};
    if(av) updates.avatar = av;
    if(pass) updates.pass = pass;
    
    db.ref('users/' + currentUser).update(updates);
    showToast("Настройки сохранены", "success");
}

// === 6. АДМИНКА ===
function renderAdminRealtime() {
    const tbody = document.querySelector('#staffTable tbody');
    db.ref('users').on('value', (snap) => {
        tbody.innerHTML = "";
        const users = snap.val();
        if(users) {
            for(const [n, d] of Object.entries(users)) {
                let color = d.level === 3 ? '#ff2d55' : (d.level === 2 ? '#ff9500' : 'white');
                tbody.innerHTML += `
                    <tr>
                        <td>${n}</td>
                        <td>${d.rank}</td>
                        <td style="color:${color}; font-weight:bold">${d.level}</td>
                        <td>${d.department || '-'}</td>
                    </tr>`;
            }
        }
    });
}

function toggleRecruitCloud() {
    // Читаем текущее состояние и меняем его
    db.ref('settings/recruit').once('value').then(snap => {
        const current = snap.val();
        const next = current === 'open' ? 'closed' : 'open';
        db.ref('settings/recruit').set(next);
        showToast("Статус набора изменен", "success");
    });
}

// === 7. УТИЛИТЫ (КРАСИВЫЙ TOAST) ===
function showToast(msg, type='info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    
    // Настройка иконки и цвета
    let icon = 'fa-info-circle';
    let color = 'var(--primary)';
    let title = 'ИНФОРМАЦИЯ';

    if (type === 'success') { icon = 'fa-check-circle'; color = 'var(--success)'; title = 'УСПЕШНО'; }
    if (type === 'error') { icon = 'fa-circle-exclamation'; color = 'var(--accent)'; title = 'ОШИБКА'; }
    if (type === 'warning') { icon = 'fa-bell'; color = '#f59e0b'; title = 'ВНИМАНИЕ'; }

    toast.style.borderLeftColor = color;
    toast.innerHTML = `
        <div class="toast-icon"><i class="fa-solid ${icon}" style="color:${color}"></i></div>
        <div class="toast-content">
            <h4 style="margin:0; font-size:0.9rem; color:${color}">${title}</h4>
            <p style="margin:0; font-size:0.8rem; color:#ccc">${msg}</p>
        </div>
    `;
    
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function showAlert(title, msg, type='info') {
    document.getElementById('alertTitle').innerText = title;
    document.getElementById('alertMsg').innerText = msg;
    const icon = document.getElementById('alertIcon');
    icon.style.color = (type==='error') ? 'var(--accent)' : (type==='success') ? 'var(--success)' : 'var(--primary)';
    openModal('alertModal');
}

function switchTab(t) {
    document.querySelectorAll('.content-tab').forEach(c => c.classList.add('hidden'));
    document.getElementById('tab-'+t).classList.remove('hidden');
    document.querySelectorAll('.menu-item').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
}

// Payment
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

function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function logout() { localStorage.removeItem('gcl_session_user'); location.reload(); }
function showPublic() { location.reload(); }
function copyLeader() { navigator.clipboard.writeText(GAME_LEADER_NICK); showToast("Ник скопирован!", "success"); }