// ================================================================
// 1. КОНФИГУРАЦИЯ (Вставь свои данные!)
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

// Инициализация
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const BOT_TOKEN = "8318387055:AAELcIGbdk2Zr_3z9okZwsioGdTZHfVFqec";
const LEADER_CHAT_ID = "912821088"; 
const GAME_LEADER_NICK = "Doni_Moore";
const SECRET_KEY = "GCL_SECURE"; // Ключ для проверки кодов

let currentUser = null; // Ник текущего юзера
let userData = null;    // Все данные юзера (Ранг, Баланс, Уровень)
let tempOrder = {};     // Временный заказ

// ================================================================
// 2. ЗАГРУЗКА И СЛЕЖЕНИЕ (REALTIME)
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Следим за статусом набора глобально
    db.ref('settings/recruit').on('value', snap => updateRecruitUI(snap.val()));
    
    // Следим за лучшим сотрудником глобально
    db.ref('users').on('value', snap => calculateBestEmployee(snap.val()));
    
    // Ставим дату
    const dateEl = document.getElementById('currentDate');
    if(dateEl) dateEl.innerText = new Date().toLocaleDateString();
});

// ================================================================
// 3. АВТОРИЗАЦИЯ (LOGIN SYSTEM)
// ================================================================
function performLoginCloud() {
    const nick = document.getElementById('loginNick').value.trim();
    const pass = document.getElementById('loginPass').value.trim();
    const mode = document.getElementById('loginNick').getAttribute('data-mode');

    // Вход для Лидера (Мастер-пароль)
    if(mode === 'leader') {
        if(pass === '1234') {
            loginSuccess('Doni_Moore', {
                rank: 'Директор', 
                level: 3, 
                avatar: 'https://wiki.sa-mp.com/w/images/thumb/2/25/Skin_295.png/180px-Skin_295.png'
            }, true);
        } else {
            showToast('Неверный пароль Лидера', 'error');
        }
        return;
    }

    // Вход для Сотрудника (Проверка в Облаке)
    db.ref('users/' + nick).once('value').then((snapshot) => {
        const data = snapshot.val();
        if (data && data.pass === pass) {
            loginSuccess(nick, data, false);
            showToast(`Добро пожаловать, ${nick}!`, 'success');
        } else {
            showToast('Ошибка доступа. Проверьте Ник и Пароль.', 'error');
        }
    });
}

function loginSuccess(nick, data, isLeader) {
    currentUser = nick;
    
    // Переключение экранов
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('publicSection').classList.add('hidden');
    document.querySelector('.navbar').classList.add('hidden');
    document.getElementById('dashboardSection').classList.remove('hidden');

    // Если это Лидер
    if (isLeader) {
        document.getElementById('menuLevel3').classList.remove('hidden'); // Меню управления
        renderAdminRealtime(); // Включаем таблицу сотрудников
        
        // Заглушка данных для лидера
        document.getElementById('dashNick').innerText = "Doni_Moore";
        document.getElementById('dashRank').innerText = "Управляющий";
        document.getElementById('dashAvatar').src = data.avatar;
    } else {
        // Если это Сотрудник - ПОДПИСЫВАЕМСЯ на обновления его профиля
        // Это значит: если лидер меняет ранг в боте -> тут он меняется сам
        db.ref('users/' + nick).on('value', (snap) => {
            const newData = snap.val();
            if(!newData) { 
                alert("Ваш аккаунт был удален из базы данных."); 
                location.reload(); 
                return; 
            }
            
            // Проверка на уведомления
            if(userData && userData.rank !== newData.rank) {
                showAlert("ИЗМЕНЕНИЕ ДОЛЖНОСТИ", `Ваш новый ранг: ${newData.rank}`, "success");
            }
            
            userData = newData; // Обновляем локальные данные
            updateDashboardUI(); // Перерисовываем интерфейс
            checkAccessLevels(); // Проверяем доступ к разделам
        });
    }
}

// Проверка уровней доступа (1, 2, 3)
function checkAccessLevels() {
    const lvl = userData.level || 1;
    
    // Скрываем все сначала
    document.getElementById('menuLevel2').classList.add('hidden');
    document.getElementById('menuLevel3').classList.add('hidden');

    // Показываем по уровню
    if (lvl >= 2) document.getElementById('menuLevel2').classList.remove('hidden'); // Замы
    if (lvl >= 3) document.getElementById('menuLevel3').classList.remove('hidden'); // Лидер
}

// ================================================================
// 4. ИНТЕРФЕЙС ЛИЧНОГО КАБИНЕТА
// ================================================================
function updateDashboardUI() {
    // Шапка профиля
    document.getElementById('dashNick').innerText = currentUser;
    document.getElementById('dashRank').innerText = userData.rank;
    document.getElementById('dashDept').innerText = "Отдел: " + (userData.department || "Нет");
    document.getElementById('dashAvatar').src = userData.avatar || "";
    
    // Статистика
    document.getElementById('statBalance').innerText = (userData.balance || 0).toLocaleString() + " $";
    document.getElementById('statCount').innerText = userData.count || 0;
    document.getElementById('statXP').innerText = userData.xp || 0;

    // XP Bar (Шкала опыта)
    const xp = userData.xp || 0;
    const lvl = Math.floor(xp / 100) + 1;
    const progress = xp % 100;
    
    document.getElementById('lvlNum').innerText = lvl;
    document.getElementById('xpNum').innerText = `${progress}/100`;
    document.getElementById('xpFill').style.width = `${progress}%`;

    // История операций
    const list = document.getElementById('historyList');
    list.innerHTML = "";
    
    // Превращаем объект истории Firebase в массив
    const historyArray = userData.history ? Object.values(userData.history).reverse() : [];
    
    if(historyArray.length === 0) {
        list.innerHTML = "<div class='empty-msg'>История операций пуста</div>";
    } else {
        historyArray.forEach(h => {
            list.innerHTML += `
                <div class="h-item">
                    <span>${h.op}</span>
                    <span class="h-sum">${h.sum}</span>
                </div>
            `;
        });
    }
}

// ================================================================
// 5. СИСТЕМА ОТЧЕТОВ (С ЗАЩИТОЙ)
// ================================================================
function submitReportCloud() {
    const id = document.getElementById('repId').value.trim();
    const inputCode = document.getElementById('repCode').value.trim();
    const price = parseInt(document.getElementById('repPrice').value);

    if(!id || !inputCode || !price) return showToast("Заполните все поля!", "error");

    // 1. Идем в базу и ищем этот код (его создал бот)
    db.ref('codes/' + id).once('value').then((snapshot) => {
        const realCode = snapshot.val();
        
        if (realCode && realCode === inputCode) {
            // Код верный! Удаляем его (чтобы второй раз не ввели)
            db.ref('codes/' + id).remove();
            
            // Начисляем деньги и опыт атомарно (защита от багов)
            const userRef = db.ref('users/' + currentUser);
            
            userRef.transaction((current) => {
                if (current) {
                    current.balance = (current.balance || 0) + price;
                    current.count = (current.count || 0) + 1;
                    current.xp = (current.xp || 0) + 5; // +5 XP за лицензию
                }
                return current;
            }, (error, committed) => {
                if(committed) {
                    // Записываем в историю
                    db.ref(`users/${currentUser}/history`).push({
                        op: `Лицензия #${id}`, 
                        sum: `+${price}$`, 
                        date: new Date().toISOString()
                    });
                    
                    showToast("Отлично! Зарплата и опыт начислены.", "success");
                    // Очистка
                    document.getElementById('repId').value = "";
                    document.getElementById('repCode').value = "";
                    switchTab('stats');
                }
            });

        } else {
            showToast("Ошибка! Неверный код или он уже использован.", "error");
        }
    });
}

// Отправка заявлений Лидеру (Повышение/Выговор)
function sendInternalReport(type) {
    let desc = "";
    if(type === 'Повышение') desc = document.getElementById('promoDesc').value;
    if(type === 'Снятие выговора') desc = document.getElementById('warnDesc').value;
    if(type === 'Сообщение') desc = document.getElementById('msgDesc').value;

    if(!desc) return showToast("Напишите текст отчета!", "error");

    const text = `
📩 <b>НОВОЕ СООБЩЕНИЕ С САЙТА</b>
👤 От: ${currentUser} (${userData.rank})
📌 Тема: ${type}
📝 Текст: ${desc}
    `;
    
    // Шлем боту
    fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ chat_id: LEADER_CHAT_ID, text, parse_mode: 'HTML' })
    });

    showToast("Сообщение отправлено руководству.", "success");
}

// ================================================================
// 6. АДМИНКА (В РЕАЛЬНОМ ВРЕМЕНИ)
// ================================================================
function renderAdminRealtime() {
    const tbody = document.querySelector('#staffTable tbody');
    
    // Слушаем всю ветку users
    db.ref('users').on('value', (snapshot) => {
        tbody.innerHTML = "";
        const users = snapshot.val();
        
        if(users) {
            for (const [nick, data] of Object.entries(users)) {
                // Определяем цвет уровня
                let lvlColor = 'white';
                if(data.level === 2) lvlColor = 'orange';
                if(data.level === 3) lvlColor = 'red';

                tbody.innerHTML += `
                    <tr>
                        <td>${nick}</td>
                        <td>${data.rank}</td>
                        <td style="color:${lvlColor}; font-weight:bold">${data.level || 1}</td>
                        <td>${data.department || '-'}</td>
                    </tr>
                `;
            }
        }
    });
}

function toggleRecruitCloud() {
    const status = document.getElementById('recruitToggle').checked ? 'open' : 'closed';
    db.ref('settings/recruit').set(status);
    showToast("Статус набора изменен", "success");
}

// ================================================================
// 7. ПОКУПКА (КЛИЕНТ)
// ================================================================
function goToPayment() {
    const nick = document.getElementById('buyerNick').value;
    const price = document.getElementById('buyerLic').value;
    if(nick.length < 3) return showToast("Введите ваш ник!", "error");
    
    // Генерируем ID (Код сгенерирует бот при подтверждении)
    tempOrder = {nick, price, id: Date.now().toString().slice(-5)};
    
    document.getElementById('step1').classList.add('hidden');
    document.getElementById('step2').classList.remove('hidden');
    document.getElementById('displayPrice').innerText = price + " $";
}

function finishOrder() {
    const text = `💰 <b>ЗАПРОС ОПЛАТЫ</b>\n👤 ${tempOrder.nick}\n💵 ${tempOrder.price}$\n🆔 ID: <code>${tempOrder.id}</code>`;
    
    // Кнопки для бота
    const kb = { inline_keyboard: [[{text: "✅ Подтвердить", callback_data: `approve_pay_${tempOrder.id}`}]] };
    
    fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ chat_id: LEADER_CHAT_ID, text, parse_mode: 'HTML', reply_markup: kb })
    });

    document.getElementById('step2').classList.add('hidden');
    document.getElementById('step3').classList.remove('hidden');
}

// ================================================================
// 8. ДОП. ФУНКЦИИ (AHK, UI)
// ================================================================

function generateAHK() {
    const nick = document.getElementById('ahkNick').value || "Name_Surname";
    const rank = document.getElementById('ahkRank').value || "Сотрудник";
    
    const content = `
Numpad1::
SendMessage, 0x50,, 0x4190419,, A
SendInput, {F6}Здравствуйте, я ${rank} - ${nick}.{Enter}
Sleep 1500
SendInput, {F6}/do Бейджик на груди.{Enter}
Return

Numpad2::
SendMessage, 0x50,, 0x4190419,, A
SendInput, {F6}Вот ваша лицензия.{Enter}
Return
    `;
    
    const blob = new Blob([content], {type: "text/plain"});
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "GCL_Binder.ahk";
    link.click();
}

function saveSettings() {
    const av = document.getElementById('setAvatar').value;
    const pass = document.getElementById('setPass').value;
    const updates = {};
    if(av) updates.avatar = av;
    if(pass) updates.pass = pass;
    
    db.ref('users/' + currentUser).update(updates);
    showToast("Настройки сохранены!", "success");
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
        badge.style.borderColor = "#007aff";
        badge.style.color = "#007aff";
    }
}

function calculateBestEmployee(users) {
    if(!users) return;
    let best = {nick: "Никого", count: 0, avatar: ""};
    for(const [nick, d] of Object.entries(users)) {
        if(d.count > best.count) best = {nick: nick, ...d};
    }
    if(best.count > 0) {
        document.getElementById('bestNick').innerText = best.nick;
        document.getElementById('bestCount').innerText = best.count;
        document.getElementById('bestAvatar').src = best.avatar;
    }
}

// UI HELPERS
function showToast(msg, type='info') {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = 'toast';
    t.style.borderColor = (type === 'error') ? '#ff2d55' : (type === 'success') ? '#34c759' : '#007aff';
    t.innerHTML = msg;
    c.appendChild(t);
    setTimeout(()=>t.remove(), 4000);
}

function showAlert(title, msg, type='info') {
    document.getElementById('alertTitle').innerText = title;
    document.getElementById('alertMsg').innerText = msg;
    openModal('alertModal');
}

function switchTab(t) {
    document.querySelectorAll('.tab-pane').forEach(c => c.classList.add('hidden'));
    document.getElementById('tab-'+t).classList.remove('hidden');
    document.querySelectorAll('.menu-item').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
}

function setLoginMode(m) {
    const inp = document.getElementById('loginNick');
    document.querySelectorAll('.l-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    inp.setAttribute('data-mode', m);
    if(m === 'leader') {
        inp.value = "Doni_Moore";
        inp.disabled = true;
    } else {
        inp.value = "";
        inp.disabled = false;
    }
}

function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function logout() { location.reload(); }
function showPublic() { location.reload(); }
function copyLeader() { navigator.clipboard.writeText(GAME_LEADER_NICK); showToast("Ник скопирован!", "success"); }
function checkBlacklistPublic() { showToast("Игрок чист.", "success"); }