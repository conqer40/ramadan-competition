const socket = io();
const API = '/api';
let currentUser = JSON.parse(localStorage.getItem('user'));
let currentQuestion = null;
let timerInterval = null;
let startTime = null;

// Ramadan start date (2026-02-18)
const RAMADAN_START = new Date('2026-02-18T00:00:00');

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    updateAuthUI();
    loadStatus();
    loadImsakia();
    loadLeaderboard();
    loadAdhkar('azkar_morning');
    startRamadanCountdown();
});

// Socket Notifications
socket.on('admin_notification', (data) => {
    showToast(data.message, data.type);
});

function showToast(message, type = 'info') {
    const container = document.getElementById('notification-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = { info: 'fa-bell', warning: 'fa-exclamation-triangle', success: 'fa-trophy' };
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 5000);
}

// ==================== AUDIO CONTROL ====================
let audioPlaying = false;
function toggleAudio() {
    const audio = document.getElementById('bgAudio');
    const control = document.getElementById('audioControl');

    if (audioPlaying) {
        audio.pause();
        control.innerHTML = '<i class="fas fa-volume-mute"></i>';
        control.classList.remove('playing');
    } else {
        audio.play().catch(() => { });
        control.innerHTML = '<i class="fas fa-volume-up"></i>';
        control.classList.add('playing');
    }
    audioPlaying = !audioPlaying;
}

// ==================== RAMADAN COUNTDOWN ====================
function startRamadanCountdown() {
    const countdownEl = document.getElementById('ramadan-countdown');
    const activeEl = document.getElementById('ramadan-active');

    function update() {
        const now = new Date();
        const diff = RAMADAN_START - now;

        if (diff <= 0) {
            // Ramadan has started
            countdownEl.style.display = 'none';
            activeEl.style.display = 'block';
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);

        document.getElementById('days').textContent = days;
        document.getElementById('hours').textContent = String(hours).padStart(2, '0');
        document.getElementById('minutes').textContent = String(mins).padStart(2, '0');
        document.getElementById('seconds').textContent = String(secs).padStart(2, '0');
    }

    update();
    setInterval(update, 1000);
}

// ==================== NAVIGATION ====================
function showPage(pageId) {
    document.querySelectorAll('.page-container').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${pageId}`)?.classList.add('active');

    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

    document.querySelectorAll('.nav-link').forEach(l => {
        if (l.onclick && l.onclick.toString().includes(`'${pageId}'`)) {
            l.classList.add('active');
        }
    });

    if (pageId === 'competition') loadCompetition();
    if (pageId === 'leaderboard') loadLeaderboard();
    if (pageId === 'admin') loadAdminStats();
    if (pageId === 'programs') loadPrograms();
}

// ==================== AUTH ====================
function updateAuthUI() {
    const container = document.getElementById('auth-buttons');

    if (currentUser) {
        let html = `
            <div class="user-info">
                <span class="user-name">${currentUser.name}</span>
        `;

        if (currentUser.role === 'admin') {
            html += `<button class="btn btn-outline" onclick="showPage('admin')"><i class="fas fa-cog"></i></button>`;
        }

        html += `
                <button class="btn btn-danger" onclick="doLogout()"><i class="fas fa-sign-out-alt"></i> خروج</button>
            </div>
            <div class="share-promo" style="text-align:center; margin-top:0.5rem;">
                 <button class="btn btn-gold btn-sm" onclick="shareToWin()">
                    <i class="fab fa-facebook"></i> شارك واربح نقطة!
                 </button>
            </div>
        `;
        container.innerHTML = html;
    } else {
        container.innerHTML = `
            <button class="btn btn-outline" onclick="showModal('login')">تسجيل الدخول</button>
            <button class="btn btn-gold" onclick="showModal('register')">حساب جديد</button>
        `;
    }
}

async function shareToWin() {
    if (!currentUser) return showModal('login');

    const url = encodeURIComponent(window.location.origin);
    const text = encodeURIComponent('شارك في مسابقة رمضانك عندنا واربح جوائز قيمة! 🌙✨');
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`;

    // Open share window
    window.open(fbUrl, 'fb-share', 'width=580,height=296');

    // Call API to record share and get point
    // We add a small delay to simulate user actually sharing (naive check)
    setTimeout(async () => {
        try {
            const res = await fetch(`${API}/share-reward`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser.id })
            });
            const data = await res.json();

            if (res.ok) {
                showToast('تم احتساب نقطة المشاركة! 🎉', 'success');
            } else {
                // If error is "already collected", just show info
                if (data.error.includes('حصلت')) {
                    showToast(data.error, 'info');
                } else {
                    console.log(data.error);
                }
            }
        } catch (e) {
            console.error(e);
        }
    }, 5000);
}

function showModal(type) {
    document.getElementById('auth-modal').classList.add('active');
    document.getElementById('login-form').style.display = type === 'login' ? 'block' : 'none';
    document.getElementById('register-form').style.display = type === 'register' ? 'block' : 'none';
}

function closeModal() {
    document.getElementById('auth-modal').classList.remove('active');
}

function toggleAuthForm() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    loginForm.style.display = loginForm.style.display === 'none' ? 'block' : 'none';
    registerForm.style.display = registerForm.style.display === 'none' ? 'block' : 'none';
}

async function doLogin() {
    const phone = document.getElementById('login-phone').value;
    const password = document.getElementById('login-pass').value;

    const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
    });

    const data = await res.json();
    if (res.ok) {
        currentUser = data.user;
        localStorage.setItem('user', JSON.stringify(currentUser));
        updateAuthUI();
        closeModal();
        updateAuthUI();
        closeModal();
        showToast(`أهلاً ${currentUser.name}! 🌙`, 'success');
        // Promo for share
        setTimeout(() => {
            showToast('نصيحة: شارك الموقع يومياً لتربح نقاط إضافية! 💡', 'info');
        }, 2000);
        loadCompetition();
    } else {
        showToast(data.error, 'warning');
    }
}

async function doRegister() {
    const name = document.getElementById('reg-name').value;
    const phone = document.getElementById('reg-phone').value;
    const national_id = document.getElementById('reg-id').value;
    const password = document.getElementById('reg-pass').value;
    const agreed_terms = document.getElementById('reg-terms').checked;

    if (!agreed_terms) {
        return showToast('يجب الموافقة على الشروط', 'warning');
    }

    const res = await fetch(`${API}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, national_id, password, agreed_terms })
    });

    const data = await res.json();
    if (res.ok) {
        showToast('تم التسجيل بنجاح! سجل دخولك الآن 🎉', 'success');
        toggleAuthForm();
    } else {
        showToast(data.error, 'warning');
    }
}

function doLogout() {
    currentUser = null;
    localStorage.removeItem('user');
    updateAuthUI();
    showPage('home');
    showToast('تم تسجيل الخروج', 'info');
}

// ==================== STATUS & DATE ====================
async function loadStatus() {
    try {
        const res = await fetch(`${API}/status`);
        const status = await res.json();

        const compStatus = document.getElementById('comp-status');
        const compMessage = document.getElementById('competition-message');
        const countdownEl = document.getElementById('ramadan-countdown');
        const activeEl = document.getElementById('ramadan-active');

        if (status.status === 'upcoming') {
            // Show countdown
            countdownEl.style.display = 'block';
            activeEl.style.display = 'none';
        } else if (status.status === 'open' || status.status === 'closed_show_result' || status.status === 'waiting_fajr') {
            // Ramadan is active
            countdownEl.style.display = 'none';
            activeEl.style.display = 'block';

            if (status.status === 'open') {
                compStatus.className = 'status-badge status-open';
                compStatus.innerHTML = '<i class="fas fa-door-open"></i> المسابقة مفتوحة';
                compMessage.textContent = 'سؤال اليوم متاح الآن!';
                document.getElementById('hijri-date').textContent = `${status.day_number} رمضان 1447`;
                startPrayerCountdown(status.maghrib, 'المغرب');
            } else if (status.status === 'closed_show_result') {
                compStatus.className = 'status-badge status-closed';
                compStatus.innerHTML = '<i class="fas fa-door-closed"></i> انتهت المسابقة';
                compMessage.textContent = 'شاهد نتيجة اليوم';
            } else if (status.status === 'waiting_fajr') {
                compStatus.className = 'status-badge status-waiting';
                compStatus.innerHTML = '<i class="fas fa-moon"></i> انتظر الفجر';
                startPrayerCountdown(status.fajr, 'الفجر');
            }
        }

        // Load today's prayer data
        const todayRes = await fetch(`${API}/imsakia/today`);
        const today = await todayRes.json();
        if (today.gregorian_date) {
            document.getElementById('gregorian-date').textContent = today.gregorian_date;
            document.getElementById('hijri-date').textContent = `${today.day_number} رمضان 1447`;
        }
    } catch (e) {
        console.error('Error loading status:', e);
    }
}

function startPrayerCountdown(timeStr, prayerName) {
    const display = document.getElementById('prayer-countdown');
    document.getElementById('prayer-name').textContent = prayerName;

    const match = timeStr?.match(/(\d{1,2}):(\d{2})\s*(ص|م)?/);
    if (!match) return;

    let hours = parseInt(match[1]);
    const mins = parseInt(match[2]);
    const period = match[3];
    if (period === 'م' && hours !== 12) hours += 12;
    if (period === 'ص' && hours === 12) hours = 0;

    const now = new Date();
    const target = new Date(now);
    target.setHours(hours, mins, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);

    setInterval(() => {
        const diff = target - new Date();
        if (diff <= 0) { display.textContent = 'حان الوقت!'; return; }

        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        display.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }, 1000);
}

// ==================== COMPETITION ====================
async function loadCompetition() {
    const loginRequired = document.getElementById('comp-login-required');
    const questionDiv = document.getElementById('comp-question');
    const answeredDiv = document.getElementById('comp-answered');
    const resultDiv = document.getElementById('comp-result');

    [questionDiv, answeredDiv, resultDiv].forEach(d => d.style.display = 'none');

    if (!currentUser) {
        loginRequired.style.display = 'block';
        return;
    }
    loginRequired.style.display = 'none';

    const status = await (await fetch(`${API}/status`)).json();
    const myAnswer = await (await fetch(`${API}/my-answer/${currentUser.id}`)).json();

    if (status.status === 'waiting_fajr' || status.status === 'upcoming') {
        answeredDiv.style.display = 'block';
        answeredDiv.innerHTML = `
            <i class="fas fa-moon" style="font-size:4rem; color:var(--gold); margin-bottom:1.5rem;"></i>
            <h3>المسابقة تبدأ مع أذان الفجر</h3>
            <p style="color:var(--text-muted);">الفجر: ${status.fajr || 'قريباً'}</p>
        `;
    } else if (status.status === 'open') {
        if (myAnswer.answered) {
            answeredDiv.style.display = 'block';
        } else {
            await loadQuestion();
        }
    } else if (status.status === 'closed_show_result') {
        await loadResult();
    }
}

async function loadQuestion() {
    const res = await fetch(`${API}/today-question`);
    const data = await res.json();

    if (!data.available) return;

    currentQuestion = data.question;
    document.getElementById('q-day').textContent = data.day;
    document.getElementById('q-text').textContent = currentQuestion.question_text;
    document.getElementById('q-timer').textContent = currentQuestion.timer_seconds;

    const optionsList = document.getElementById('options-list');
    optionsList.innerHTML = '';

    [1, 2, 3, 4, 5].forEach(i => {
        const opt = currentQuestion[`option${i}`];
        if (opt) {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.textContent = opt;
            btn.onclick = () => selectOption(i, btn);
            optionsList.appendChild(btn);
        }
    });

    document.getElementById('comp-question').style.display = 'block';
    startQuestionTimer(currentQuestion.timer_seconds);
    startTime = Date.now();
}

let selectedOption = null;

function selectOption(num, btn) {
    selectedOption = num;
    document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    document.getElementById('submit-btn').disabled = false;
}

function startQuestionTimer(seconds) {
    let remaining = seconds;
    const timerEl = document.getElementById('q-timer');

    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        remaining--;
        timerEl.textContent = remaining;

        if (remaining <= 0) {
            clearInterval(timerInterval);
            submitAnswer();
        }
    }, 1000);
}

async function submitAnswer() {
    if (!selectedOption || !currentQuestion) return;

    clearInterval(timerInterval);
    const timeTakenMs = Date.now() - startTime;

    const res = await fetch(`${API}/submit-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: currentUser.id,
            questionId: currentQuestion.id,
            selectedOption,
            timeTakenMs
        })
    });

    const data = await res.json();
    if (res.ok) {
        document.getElementById('comp-question').style.display = 'none';
        document.getElementById('comp-answered').style.display = 'block';
        showToast('تم تسجيل إجابتك بنجاح! 🎉', 'success');
    } else {
        showToast(data.error, 'warning');
    }
}

async function loadResult() {
    const res = await fetch(`${API}/today-result`);
    const data = await res.json();

    if (!data.available) return;

    const result = data.result;
    const resultDiv = document.getElementById('comp-result');

    resultDiv.innerHTML = `
        <div style="text-align:center;">
            <h3 style="margin-bottom:1rem;">نتيجة اليوم</h3>
            <div class="question-text">${result.question_text}</div>
            <div style="background:rgba(34,197,94,0.15); border:1px solid rgba(34,197,94,0.3); padding:1rem; border-radius:10px; margin:1rem 0;">
                <strong style="color:#4ade80;">✅ الإجابة الصحيحة:</strong> ${result[`option${result.correct_answer}`]}
            </div>
            <div style="display:flex; justify-content:center; gap:2rem; color:var(--text-muted);">
                <span>المشاركون: ${result.total_answers}</span>
                <span>الإجابات الصحيحة: ${result.correct_count}</span>
            </div>
        </div>
    `;

    resultDiv.style.display = 'block';
}

// ==================== LEADERBOARD ====================
async function loadLeaderboard() {
    const res = await fetch(`${API}/leaderboard`);
    const data = await res.json();

    const list = document.getElementById('leaderboard-list');
    list.innerHTML = data.map((u, i) => `
        <div class="leaderboard-item ${i < 3 ? 'top-3' : ''} ${currentUser?.id === u.id ? 'me' : ''}">
            <div class="rank">${i + 1}</div>
            ${u.facebook_url
            ? `<a href="${u.facebook_url}" target="_blank" class="player-name player-link">${u.name}</a>`
            : `<span class="player-name">${u.name}</span>`}
            <span class="player-score">${u.score} نقطة</span>
        </div>
    `).join('') || '<div style="text-align:center; color:var(--text-muted); padding:2rem;">لا توجد بيانات</div>';
}

// ==================== IMSAKIA ====================
async function loadImsakia() {
    try {
        const res = await fetch(`${API}/imsakia`);
        const data = await res.json();

        const tbody = document.getElementById('imsakia-tbody');
        tbody.innerHTML = data.map(d => `
            <tr class="${d.day_number === 1 ? 'today' : ''}">
                <td>${d.day_name}</td>
                <td>${d.day_number}</td>
                <td>${d.gregorian_date}</td>
                <td>${d.fajr}</td>
                <td>${d.sunrise || '-'}</td>
                <td>${d.dhuhr || '-'}</td>
                <td>${d.asr || '-'}</td>
                <td>${d.maghrib}</td>
                <td>${d.isha || '-'}</td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('Error loading imsakia:', e);
    }
}

// ==================== ADHKAR ====================
async function loadAdhkar(type, btn) {
    document.querySelectorAll('.adhkar-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');

    try {
        const res = await fetch(`${API}/content/${type}`);
        const data = await res.json();

        document.getElementById('adhkar-list').innerHTML = data.map(a => `
            <div class="adhkar-card">
                <h4 class="adhkar-title">${a.title}</h4>
                <p class="adhkar-text">${a.body}</p>
            </div>
        `).join('') || '<div style="text-align:center; color:var(--text-muted); padding:2rem;">لا يوجد محتوى</div>';
    } catch (e) {
        console.error('Error loading adhkar:', e);
    }
}

// ==================== ADMIN ====================
async function loadAdminStats() {
    try {
        const res = await fetch(`${API}/admin/stats`);
        const stats = await res.json();

        document.getElementById('admin-stats').innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${stats.total_users || 0}</div>
                <div class="stat-label">مستخدم</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.total_answers || 0}</div>
                <div class="stat-label">إجابة</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.published_questions || 0}</div>
                <div class="stat-label">سؤال</div>
            </div>
        `;
    } catch (e) {
        console.error('Error loading admin stats:', e);
    }
}

async function sendAdminNotify() {
    const message = document.getElementById('admin-msg').value;
    const type = document.getElementById('admin-msg-type').value;

    if (!message) return showToast('اكتب رسالة!', 'warning');

    await fetch(`${API}/admin/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, type })
    });

    document.getElementById('admin-msg').value = '';
    showToast('تم الإرسال! 📢', 'success');
}

// ==================== PROGRAMS ====================
async function loadPrograms() {
    try {
        const res = await fetch(`${API}/playlists`);
        const playlists = await res.json();

        const container = document.getElementById('programs-list');

        if (!playlists.length) {
            container.innerHTML = `
                <div style="text-align:center; color:var(--text-muted); padding:3rem; grid-column:1/-1;">
                    <i class="fas fa-video" style="font-size:4rem; margin-bottom:1rem; opacity:0.5;"></i>
                    <p>لا توجد برامج حالياً</p>
                </div>
            `;
            return;
        }

        container.innerHTML = playlists.map(p => `
            <div class="program-card" onclick="openPlaylist(${p.id})">
                <div class="program-thumb" style="background-image:url('${p.thumbnail_url || ''}');">
                    ${!p.thumbnail_url ? '<i class="fas fa-play-circle"></i>' : ''}
                </div>
                <div class="program-info">
                    <h4 class="program-title">${p.title}</h4>
                    <p class="program-desc">${p.description || ''}</p>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error('Error loading programs:', e);
    }
}

async function openPlaylist(id) {
    try {
        const res = await fetch(`${API}/playlists/${id}/videos`);
        const videos = await res.json();

        const container = document.getElementById('programs-list');
        container.innerHTML = `
            <div style="grid-column:1/-1; margin-bottom:1rem;">
                <button class="btn btn-outline" onclick="loadPrograms()"><i class="fas fa-arrow-right"></i> رجوع</button>
            </div>
            ${videos.map(v => `
                <div class="video-card">
                    <div class="video-thumb" style="background-image:url('${v.thumbnail_url || ''}');">
                        <i class="fas fa-play"></i>
                    </div>
                    <div class="video-info">
                        <h4>${v.title}</h4>
                        <span>${v.duration || ''}</span>
                    </div>
                    <button class="btn btn-gold" onclick="playVideo('${v.video_url}', '${v.title}')">مشاهدة</button>
                </div>
            `).join('') || '<p style="color:var(--text-muted); text-align:center; grid-column:1/-1;">لا توجد فيديوهات</p>'}
        `;
    } catch (e) {
        console.error('Error loading videos:', e);
    }
}

// Embedded Video Player Modal
function playVideo(url, title) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('video-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'video-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content video-modal-content">
                <button class="modal-close" onclick="closeVideoModal()">&times;</button>
                <h3 id="video-modal-title" style="color:var(--gold); margin-bottom:1rem;"></h3>
                <div id="video-player-container" style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden; border-radius:12px;">
                    <iframe id="video-iframe" style="position:absolute; top:0; left:0; width:100%; height:100%; border:none;" allowfullscreen></iframe>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Set video URL and title
    document.getElementById('video-modal-title').textContent = title;

    // Convert normal YouTube URL to embed format if needed
    let embedUrl = url;
    if (url.includes('youtube.com/watch')) {
        const videoId = url.split('v=')[1]?.split('&')[0];
        embedUrl = `https://www.youtube.com/embed/${videoId}`;
    } else if (url.includes('youtu.be/')) {
        const videoId = url.split('youtu.be/')[1]?.split('?')[0];
        embedUrl = `https://www.youtube.com/embed/${videoId}`;
    }

    document.getElementById('video-iframe').src = embedUrl + '?autoplay=1';
    modal.classList.add('active');
}

function closeVideoModal() {
    const modal = document.getElementById('video-modal');
    if (modal) {
        modal.classList.remove('active');
        document.getElementById('video-iframe').src = ''; // Stop video
    }
}
