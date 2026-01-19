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
    const text = encodeURIComponent('تابعوا صلاتكم وقراءتكم وشاركوا في التحديات اليومية على موقع رمضانك عندنا! 🌙✨');
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

// ... existing code ...

// ==================== LEADERBOARD ====================
async function loadLeaderboard() {
    const res = await fetch(`${API}/leaderboard`);
    const data = await res.json();

    const list = document.getElementById('leaderboard-list');
    list.innerHTML = data.map((u, i) => `
        <div class="leaderboard-item ${i < 3 ? 'top-3' : ''} ${currentUser?.id === u.id ? 'me' : ''}">
            <div class="rank">${i + 1}</div>
            <a href="profile.html?id=${u.id}" class="player-name player-link" style="text-decoration:none; color:inherit;">${u.name}</a>
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
