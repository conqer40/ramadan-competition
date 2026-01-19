const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { db, encrypt, decrypt } = require('./database');
const bcrypt = require('bcrypt');
const fs = require('fs');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Site Mode: 'coming-soon' or 'live'
let siteMode = 'coming-soon';

app.use(cors());
app.use(bodyParser.json());

// Middleware to handle site mode redirect
app.use((req, res, next) => {
    // Always allow: API, admin, static assets, coming-soon page
    const allowedPaths = ['/api', '/admin.html', '/css', '/js', '/audio', '/coming-soon.html', '/socket.io'];
    const isAllowed = allowedPaths.some(p => req.path.startsWith(p));

    if (siteMode === 'coming-soon' && req.path === '/' && !isAllowed) {
        return res.redirect('/coming-soon.html');
    }
    if (siteMode === 'coming-soon' && req.path === '/index.html') {
        return res.redirect('/coming-soon.html');
    }
    next();
});

app.use(express.static(path.join(__dirname, '../public')));

// Socket.io
io.on('connection', (socket) => {
    console.log('A user connected');
    socket.on('disconnect', () => console.log('User disconnected'));
});


// Admin Broadcast
app.post('/api/admin/notify', (req, res) => {
    const { message, type } = req.body;
    io.emit('admin_notification', { message, type });
    res.json({ success: true });
});

// Site Mode API
app.get('/api/admin/site-mode', (req, res) => {
    res.json({ mode: siteMode });
});

app.post('/api/admin/site-mode', (req, res) => {
    const { mode } = req.body;
    if (mode === 'coming-soon' || mode === 'live') {
        siteMode = mode;
        res.json({ success: true, mode: siteMode });
    } else {
        res.status(400).json({ error: 'Invalid mode' });
    }
});


// ==================== HELPER FUNCTIONS ====================

// Parse Arabic time string to minutes (e.g., "05:15 ص" -> 315)
function parseTimeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(ص|م)?/);
    if (!match) return 0;
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const period = match[3];
    if (period === 'م' && hours !== 12) hours += 12;
    if (period === 'ص' && hours === 12) hours = 0;
    return hours * 60 + minutes;
}

// Get current time in minutes since midnight
function getCurrentMinutes() {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
}

// Get today's date in YYYY-MM-DD format
function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

// Get competition status based on Imsakia
function getCompetitionStatus(callback) {
    const today = getTodayDate();

    db.get(`SELECT s.id as season_id, s.is_active, s.start_date, s.end_date, s.winner_user_id,
                   p.day_number, p.fajr, p.maghrib, p.gregorian_date
            FROM seasons s
            LEFT JOIN prayers_schedule p ON p.season_id = s.id AND p.gregorian_date = ?
            WHERE s.is_active = 1
            LIMIT 1`, [today], (err, row) => {
        if (err || !row) {
            // Check if Ramadan is upcoming
            db.get(`SELECT * FROM seasons WHERE is_active = 1 LIMIT 1`, [], (err2, season) => {
                if (season && new Date(season.start_date) > new Date()) {
                    const daysLeft = Math.ceil((new Date(season.start_date) - new Date()) / (1000 * 60 * 60 * 24));
                    callback(null, { status: 'upcoming', daysLeft, season });
                } else {
                    callback(null, { status: 'no_season' });
                }
            });
            return;
        }

        if (row.winner_user_id) {
            return callback(null, { status: 'ended', winner_id: row.winner_user_id });
        }

        const currentMinutes = getCurrentMinutes();
        const fajrMinutes = parseTimeToMinutes(row.fajr);
        const maghribMinutes = parseTimeToMinutes(row.maghrib);

        let competitionStatus;
        if (currentMinutes < fajrMinutes) {
            competitionStatus = 'waiting_fajr';
        } else if (currentMinutes >= fajrMinutes && currentMinutes < maghribMinutes) {
            competitionStatus = 'open';
        } else {
            competitionStatus = 'closed_show_result';
        }

        callback(null, {
            status: competitionStatus,
            season_id: row.season_id,
            day_number: row.day_number,
            fajr: row.fajr,
            maghrib: row.maghrib,
            date: row.gregorian_date
        });
        // Load challenges data
        const challengesData = require('./data/challenges');

        // Get current day of Ramadan (1-30) based on start date
        function getCurrentRamadanDay() {
            // For production usage relative to a fixed start date
            const ramadanStart = new Date('2026-02-18T00:00:00');
            const now = new Date();
            // Reset hours for day diff calculation
            const start = new Date(ramadanStart); start.setHours(0, 0, 0, 0);
            const today = new Date(now); today.setHours(0, 0, 0, 0);

            const diff = today - start;
            const days = Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1; // +1 because day 0 is day 1

            if (days < 1) return 1; // Default to 1 if not started
            if (days > 30) return 30; // Cap at 30
            return days;
        }

        // ... existing helpers ...
    });
}

// ==================== USER ROUTES ====================

// Register
app.post('/api/register', (req, res) => {
    const { name, phone, national_id, fomi, password, agreed_terms } = req.body;

    if (!name || !phone || !national_id || !password) {
        return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
    }

    if (!agreed_terms) {
        return res.status(400).json({ error: 'يجب الموافقة على الشروط والأحكام' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const encryptedId = encrypt(national_id);
    const encryptedFomi = fomi ? encrypt(fomi) : null;
    const fbUrl = req.body.facebook_url || null;

    db.run(`INSERT INTO users (name, phone, national_id_encrypted, fomi_encrypted, password_hash, agreed_terms, facebook_url) 
            VALUES (?, ?, ?, ?, ?, 1, ?)`,
        [name, phone, encryptedId, encryptedFomi, passwordHash, fbUrl],
        function (err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                    return res.status(400).json({ error: 'رقم الهاتف مسجل مسبقاً' });
                }
                return res.status(500).json({ error: 'حدث خطأ في التسجيل' });
            }
            res.json({ success: true, userId: this.lastID });
        });
});

// Login
app.post('/api/login', (req, res) => {
    const { phone, password } = req.body;

    db.get(`SELECT id, name, phone, score, role, facebook_url FROM users WHERE phone = ?`, [phone], (err, user) => {
        if (!user) return res.status(401).json({ error: 'بيانات غير صحيحة' });

        db.get(`SELECT password_hash FROM users WHERE id = ?`, [user.id], (err2, passRow) => {
            if (bcrypt.compareSync(password, passRow.password_hash)) {
                res.json({ success: true, user });
            } else {
                res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
            }
        });
    });
});

// Profile Get
app.get('/api/profile/:userId', (req, res) => {
    db.get(`SELECT id, name, phone, score, total_time_ms, facebook_url, profile_picture,
            (SELECT COUNT(*)+1 FROM users u2 WHERE u2.score > users.score) as rank
            FROM users WHERE id = ?`, [req.params.userId], (err, user) => {
        if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
        res.json(user);
    });
});

// Profile Update
app.put('/api/profile', (req, res) => {
    const { userId, name, facebook_url, profile_picture, password, current_password } = req.body;

    // Verify user exists and password if changing it
    db.get(`SELECT password_hash FROM users WHERE id = ?`, [userId], (err, user) => {
        if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

        let query = `UPDATE users SET name = ?, facebook_url = ?, profile_picture = ?`;
        let params = [name, facebook_url, profile_picture];

        if (password) {
            if (bcrypt.compareSync(current_password, user.password_hash)) {
                const hash = bcrypt.hashSync(password, 10);
                query += `, password_hash = ?`;
                params.push(hash);
            } else {
                return res.status(401).json({ error: 'كلمة المرور الحالية غير صحيحة' });
            }
        }

        query += ` WHERE id = ?`;
        params.push(userId);

        db.run(query, params, (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    });
});

// ==================== COMPETITION ROUTES ====================

// Status
app.get('/api/status', (req, res) => {
    getCompetitionStatus((err, status) => {
        res.json(status);
    });
});

// Today's Question
app.get('/api/today-question', (req, res) => {
    getCompetitionStatus((err, status) => {
        if (status.status !== 'open') {
            return res.json({ available: false, reason: status.status });
        }

        db.get(`SELECT id, question_text, option1, option2, option3, option4, option5, timer_seconds
                FROM questions WHERE season_id = ? AND day_number = ? AND status = 'published'`,
            [status.season_id, status.day_number], (err, q) => {
                if (!q) return res.json({ available: false, reason: 'no_question' });
                res.json({ available: true, question: q, day: status.day_number });
            });
    });
});

// Submit Answer
app.post('/api/submit-answer', (req, res) => {
    const { userId, questionId, selectedOption, timeTakenMs } = req.body;

    getCompetitionStatus((err, status) => {
        if (status.status !== 'open') {
            return res.status(400).json({ error: 'المسابقة مغلقة حالياً' });
        }

        db.get(`SELECT correct_answer FROM questions WHERE id = ?`, [questionId], (err, q) => {
            if (!q) return res.status(404).json({ error: 'السؤال غير موجود' });

            const isCorrect = parseInt(selectedOption) === q.correct_answer;

            db.run(`INSERT INTO answers (user_id, question_id, selected_option, is_correct, time_taken_ms) 
                    VALUES (?, ?, ?, ?, ?)`,
                [userId, questionId, selectedOption, isCorrect, timeTakenMs || 0],
                function (err) {
                    if (err) {
                        if (err.message.includes('UNIQUE')) {
                            return res.status(400).json({ error: 'لقد أجبت على هذا السؤال مسبقاً' });
                        }
                        return res.status(500).json({ error: 'حدث خطأ' });
                    }

                    if (isCorrect) {
                        db.run(`UPDATE users SET score = score + 3, total_time_ms = total_time_ms + ? WHERE id = ?`,
                            [timeTakenMs || 0, userId]);
                    }

                    res.json({ success: true, recorded: true });
                });
        });
    });
});

// Today's Result (After Maghrib)
app.get('/api/today-result', (req, res) => {
    getCompetitionStatus((err, status) => {
        if (status.status !== 'closed_show_result') {
            return res.json({ available: false });
        }

        db.get(`SELECT q.*, 
                (SELECT COUNT(*) FROM answers a WHERE a.question_id = q.id AND a.is_correct = 1) as correct_count,
                (SELECT COUNT(*) FROM answers a WHERE a.question_id = q.id) as total_answers
                FROM questions q WHERE q.season_id = ? AND q.day_number = ?`,
            [status.season_id, status.day_number], (err, result) => {
                res.json({ available: true, result, day: status.day_number });
            });
    });
});

// Check if user answered today
app.get('/api/my-answer/:userId', (req, res) => {
    getCompetitionStatus((err, status) => {
        if (!status.day_number) return res.json({ answered: false });

        db.get(`SELECT a.*, q.correct_answer 
                FROM answers a 
                JOIN questions q ON a.question_id = q.id
                WHERE a.user_id = ? AND q.season_id = ? AND q.day_number = ?`,
            [req.params.userId, status.season_id, status.day_number], (err, answer) => {
                res.json({ answered: !!answer, answer, showCorrect: status.status === 'closed_show_result' });
            });
    });
});

// Leaderboard
app.get('/api/leaderboard', (req, res) => {
    getCompetitionStatus((err, status) => {
        // If status is 'closed_show_result', we show full scores.
        // If 'open' or 'waiting_fajr', we should hide points from *today's* question to keep it suspenseful.
        // effectively: displayed_score = total_score - (points_from_today if correct)

        let query = `SELECT id, name, score, total_time_ms, role, facebook_url FROM users WHERE role = 'user'`;

        if (status.season_id && status.day_number && status.status !== 'closed_show_result') {
            // Subtract points for today's question if they answered it correctly
            // valid score = score - (is_correct_today * 3)
            query = `SELECT u.id, u.name, u.total_time_ms, u.role, u.facebook_url,
                     (u.score - COALESCE((SELECT 3 FROM answers a 
                                         JOIN questions q ON a.question_id = q.id 
                                         WHERE a.user_id = u.id 
                                         AND q.season_id = ${status.season_id} 
                                         AND q.day_number = ${status.day_number} 
                                         AND a.is_correct = 1), 0)) as score
                     FROM users u WHERE u.role = 'user'`;
        }

        const finalQuery = `SELECT *, ROW_NUMBER() OVER (ORDER BY score DESC, total_time_ms ASC) as rank 
                            FROM (${query}) as sub
                            ORDER BY score DESC, total_time_ms ASC LIMIT 50`;

        db.all(finalQuery, [], (err, rows) => {
            res.json(rows || []);
        });
    });
});

// ==================== IMSAKIA ROUTES ====================

app.get('/api/imsakia', (req, res) => {
    db.all(`SELECT * FROM prayers_schedule WHERE season_id = (SELECT id FROM seasons WHERE is_active = 1) ORDER BY day_number`,
        [], (err, rows) => {
            res.json(rows || []);
        });
});

app.get('/api/imsakia/today', (req, res) => {
    const today = getTodayDate();
    db.get(`SELECT * FROM prayers_schedule WHERE gregorian_date = ?`, [today], (err, row) => {
        res.json(row || { message: 'لا توجد بيانات لليوم' });
    });
});

// ==================== CONTENT ROUTES ====================

app.get('/api/content/:type', (req, res) => {
    db.all(`SELECT * FROM content WHERE type = ? AND is_active = 1 ORDER BY sort_order`,
        [req.params.type], (err, rows) => {
            res.json(rows || []);
        });
});

// ==================== ADMIN ROUTES ====================

// Upload Imsakia (simplified - expects JSON array)
app.post('/api/admin/upload-imsakia', (req, res) => {
    const { season_id, data } = req.body;

    if (!data || !Array.isArray(data)) {
        return res.status(400).json({ error: 'بيانات غير صالحة' });
    }

    const stmt = db.prepare(`INSERT OR REPLACE INTO prayers_schedule 
        (season_id, day_number, day_name, gregorian_date, fajr, sunrise, dhuhr, asr, maghrib, isha) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    data.forEach(d => {
        stmt.run(season_id, d.ramadan_date, d.day_name, d.gregorian_date,
            d.fajr, d.sunrise, d.dhuhr, d.asr, d.maghrib, d.isha);
    });

    stmt.finalize();
    res.json({ success: true, count: data.length });
});

// Force Seed (For troubleshooting)
app.get('/api/admin/force-seed', (req, res) => {
    try {
        require('../load_data').seedDatabase(db);
        res.json({ success: true, message: 'Seeding triggered. Check server logs.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Add/Update Question
app.post('/api/admin/question', (req, res) => {
    const { season_id, day_number, question_text, option1, option2, option3, option4, option5, correct_answer, timer_seconds, status } = req.body;

    db.run(`INSERT OR REPLACE INTO questions 
            (season_id, day_number, question_text, option1, option2, option3, option4, option5, correct_answer, timer_seconds, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [season_id, day_number, question_text, option1, option2, option3, option4, option5, correct_answer, timer_seconds || 60, status || 'draft'],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        });
});

// Get Questions
app.get('/api/admin/questions/:seasonId', (req, res) => {
    db.all(`SELECT * FROM questions WHERE season_id = ? ORDER BY day_number`, [req.params.seasonId], (err, rows) => {
        res.json(rows || []);
    });
});

// Announce Winner
app.post('/api/admin/announce-winner', (req, res) => {
    db.get(`SELECT id FROM users WHERE role = 'user' ORDER BY score DESC, total_time_ms ASC LIMIT 1`, [], (err, winner) => {
        if (!winner) return res.status(404).json({ error: 'لا يوجد فائز' });

        db.run(`UPDATE seasons SET winner_user_id = ? WHERE is_active = 1`, [winner.id], (err) => {
            res.json({ success: true, winner_id: winner.id });
        });
    });
});

// Dashboard Stats
app.get('/api/admin/stats', (req, res) => {
    db.get(`SELECT 
            (SELECT COUNT(*) FROM users WHERE role = 'user') as total_users,
            (SELECT COUNT(*) FROM answers) as total_answers,
            (SELECT COUNT(*) FROM questions WHERE status = 'published') as published_questions,
            (SELECT COUNT(*) FROM content) as total_content,
            (SELECT COUNT(*) FROM playlists) as total_playlists
        `, [], (err, stats) => {
        res.json(stats || {});
    });
});

// Yesterday's Champion
app.get('/api/yesterday-winner', (req, res) => {
    const today = getCurrentRamadanDay();
    const yesterday = today - 1;

    if (yesterday < 1) return res.json({ available: false });

    db.get(`SELECT id FROM seasons WHERE is_active = 1`, [], (err, season) => {
        if (!season) return res.json({ available: false });

        // Find question for yesterday
        db.get(`SELECT id FROM questions WHERE season_id = ? AND day_number = ?`,
            [season.id, yesterday], (err, question) => {
                if (!question) return res.json({ available: false });

                // Find fastest correct answer
                db.get(`SELECT u.name, u.profile_picture, u.facebook_url, a.time_taken_ms 
                    FROM answers a 
                    JOIN users u ON a.user_id = u.id
                    WHERE a.question_id = ? AND a.is_correct = 1
                    ORDER BY a.time_taken_ms ASC LIMIT 1`,
                    [question.id], (err, winner) => {
                        if (!winner) return res.json({ available: false });
                        res.json({ available: true, winner, day: yesterday });
                    });
            });
    });
});

// ==================== ADMIN: USERS MANAGEMENT ====================

// Get all users
app.get('/api/admin/users', (req, res) => {
    db.all(`SELECT id, name, phone, score, total_time_ms, role, created_at,
            (SELECT COUNT(*) FROM answers WHERE user_id = users.id) as answers_count
            FROM users ORDER BY created_at DESC`, [], (err, rows) => {
        res.json(rows || []);
    });
});

// Get single user
app.get('/api/admin/users/:id', (req, res) => {
    db.get(`SELECT * FROM users WHERE id = ?`, [req.params.id], (err, user) => {
        if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
        // Decrypt sensitive data for admin view
        if (user.national_id_encrypted) {
            try { user.national_id = decrypt(user.national_id_encrypted); } catch (e) { }
        }
        if (user.fomi_encrypted) {
            try { user.fomi = decrypt(user.fomi_encrypted); } catch (e) { }
        }
        res.json(user);
    });
});

// Add user
app.post('/api/admin/users', (req, res) => {
    const { name, phone, national_id, fomi, password, role } = req.body;
    const passwordHash = bcrypt.hashSync(password, 10);
    const encryptedId = encrypt(national_id || '0000000000');
    const encryptedFomi = fomi ? encrypt(fomi) : null;

    db.run(`INSERT INTO users (name, phone, national_id_encrypted, fomi_encrypted, password_hash, role, agreed_terms) 
            VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [name, phone, encryptedId, encryptedFomi, passwordHash, role || 'user'],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        });
});

// Update user
app.put('/api/admin/users/:id', (req, res) => {
    const { name, phone, score, role, password } = req.body;

    let query = `UPDATE users SET name = ?, phone = ?, score = ?, role = ?`;
    let params = [name, phone, score, role];

    if (password) {
        query += `, password_hash = ?`;
        params.push(bcrypt.hashSync(password, 10));
    }

    query += ` WHERE id = ?`;
    params.push(req.params.id);

    db.run(query, params, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Delete user
app.delete('/api/admin/users/:id', (req, res) => {
    db.run(`DELETE FROM users WHERE id = ?`, [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ==================== ADMIN: QUESTIONS MANAGEMENT ====================

// Get all questions with answers stats
app.get('/api/admin/questions', (req, res) => {
    db.all(`SELECT q.*, 
            (SELECT COUNT(*) FROM answers a WHERE a.question_id = q.id) as total_answers,
            (SELECT COUNT(*) FROM answers a WHERE a.question_id = q.id AND a.is_correct = 1) as correct_answers
            FROM questions q ORDER BY q.day_number`, [], (err, rows) => {
        res.json(rows || []);
    });
});

// Get question details with user answers
app.get('/api/admin/questions/:id/answers', (req, res) => {
    db.all(`SELECT a.*, u.name as user_name, u.phone as user_phone 
            FROM answers a 
            JOIN users u ON a.user_id = u.id 
            WHERE a.question_id = ? 
            ORDER BY a.is_correct DESC, a.time_taken_ms ASC`, [req.params.id], (err, rows) => {
        res.json(rows || []);
    });
});

// Update question
app.put('/api/admin/questions/:id', (req, res) => {
    const { question_text, option1, option2, option3, option4, option5, correct_answer, timer_seconds, status } = req.body;

    db.run(`UPDATE questions SET question_text = ?, option1 = ?, option2 = ?, option3 = ?, option4 = ?, option5 = ?, 
            correct_answer = ?, timer_seconds = ?, status = ? WHERE id = ?`,
        [question_text, option1, option2, option3, option4, option5, correct_answer, timer_seconds, status, req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});

// Delete question
app.delete('/api/admin/questions/:id', (req, res) => {
    db.run(`DELETE FROM questions WHERE id = ?`, [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Import questions from JSON file
app.post('/api/admin/import-questions', (req, res) => {
    const { season_id } = req.body;
    const questionsPath = path.join(__dirname, 'questions.json');

    if (!fs.existsSync(questionsPath)) {
        return res.status(404).json({ error: 'ملف الأسئلة غير موجود' });
    }

    try {
        const questionsData = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
        let imported = 0;

        const stmt = db.prepare(`INSERT OR REPLACE INTO questions 
            (season_id, day_number, question_text, option1, option2, option3, option4, option5, correct_answer, timer_seconds, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

        questionsData.forEach(q => {
            stmt.run(
                season_id || 1,
                q.day,
                q.text,
                q.options[0] || '',
                q.options[1] || '',
                q.options[2] || '',
                q.options[3] || '',
                q.options[4] || '',
                q.correctAnswer + 1, // Convert 0-indexed to 1-indexed
                60,
                'published'
            );
            imported++;
        });

        stmt.finalize();
        res.json({ success: true, count: imported });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==================== ADMIN: CONTENT MANAGEMENT ====================

// Get all content
app.get('/api/admin/content', (req, res) => {
    db.all(`SELECT * FROM content ORDER BY type, sort_order`, [], (err, rows) => {
        res.json(rows || []);
    });
});

// Add content
app.post('/api/admin/content', (req, res) => {
    const { type, title, body, sort_order } = req.body;

    db.run(`INSERT INTO content (type, title, body, sort_order, is_active) VALUES (?, ?, ?, ?, 1)`,
        [type, title, body, sort_order || 0],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        });
});

// Update content
app.put('/api/admin/content/:id', (req, res) => {
    const { type, title, body, sort_order, is_active } = req.body;

    db.run(`UPDATE content SET type = ?, title = ?, body = ?, sort_order = ?, is_active = ? WHERE id = ?`,
        [type, title, body, sort_order, is_active ? 1 : 0, req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});

// Delete content
app.delete('/api/admin/content/:id', (req, res) => {
    db.run(`DELETE FROM content WHERE id = ?`, [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ==================== ADMIN: PLAYLISTS (PROGRAMS) ====================

// Get all playlists
app.get('/api/admin/playlists', (req, res) => {
    db.all(`SELECT p.*, (SELECT COUNT(*) FROM playlist_videos v WHERE v.playlist_id = p.id) as video_count 
            FROM playlists p ORDER BY p.sort_order`, [], (err, rows) => {
        res.json(rows || []);
    });
});

// Get playlist with videos
app.get('/api/admin/playlists/:id', (req, res) => {
    db.get(`SELECT * FROM playlists WHERE id = ?`, [req.params.id], (err, playlist) => {
        if (!playlist) return res.status(404).json({ error: 'البلاي ليست غير موجودة' });

        db.all(`SELECT * FROM playlist_videos WHERE playlist_id = ? ORDER BY sort_order`, [req.params.id], (err, videos) => {
            playlist.videos = videos || [];
            res.json(playlist);
        });
    });
});

// Add playlist
app.post('/api/admin/playlists', (req, res) => {
    const { title, description, thumbnail_url, sort_order } = req.body;

    db.run(`INSERT INTO playlists (title, description, thumbnail_url, sort_order, is_active) VALUES (?, ?, ?, ?, 1)`,
        [title, description, thumbnail_url, sort_order || 0],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        });
});

// Update playlist
app.put('/api/admin/playlists/:id', (req, res) => {
    const { title, description, thumbnail_url, sort_order, is_active } = req.body;

    db.run(`UPDATE playlists SET title = ?, description = ?, thumbnail_url = ?, sort_order = ?, is_active = ? WHERE id = ?`,
        [title, description, thumbnail_url, sort_order, is_active ? 1 : 0, req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});

// Delete playlist
app.delete('/api/admin/playlists/:id', (req, res) => {
    db.run(`DELETE FROM playlist_videos WHERE playlist_id = ?`, [req.params.id], () => {
        db.run(`DELETE FROM playlists WHERE id = ?`, [req.params.id], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    });
});

// Add video to playlist
app.post('/api/admin/playlists/:id/videos', (req, res) => {
    const { title, video_url, thumbnail_url, duration, sort_order } = req.body;

    db.run(`INSERT INTO playlist_videos (playlist_id, title, video_url, thumbnail_url, duration, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
        [req.params.id, title, video_url, thumbnail_url, duration, sort_order || 0],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        });
});

// Update video
app.put('/api/admin/videos/:id', (req, res) => {
    const { title, video_url, thumbnail_url, duration, sort_order } = req.body;

    db.run(`UPDATE playlist_videos SET title = ?, video_url = ?, thumbnail_url = ?, duration = ?, sort_order = ? WHERE id = ?`,
        [title, video_url, thumbnail_url, duration, sort_order, req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});

// Delete video
app.delete('/api/admin/videos/:id', (req, res) => {
    db.run(`DELETE FROM playlist_videos WHERE id = ?`, [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ==================== PUBLIC: PLAYLISTS ====================

app.get('/api/playlists', (req, res) => {
    db.all(`SELECT p.*, (SELECT COUNT(*) FROM playlist_videos v WHERE v.playlist_id = p.id) as video_count 
            FROM playlists p WHERE p.is_active = 1 ORDER BY p.sort_order`, [], (err, rows) => {
        res.json(rows || []);
    });
});

app.get('/api/playlists/:id', (req, res) => {
    db.get(`SELECT * FROM playlists WHERE id = ? AND is_active = 1`, [req.params.id], (err, playlist) => {
        if (!playlist) return res.status(404).json({ error: 'البلاي ليست غير موجودة' });

        db.all(`SELECT * FROM playlist_videos WHERE playlist_id = ? ORDER BY sort_order`, [req.params.id], (err, videos) => {
            playlist.videos = videos || [];
            res.json(playlist);
        });
    });
});

app.get('/api/playlists/:id/videos', (req, res) => {
    db.all(`SELECT * FROM playlist_videos WHERE playlist_id = ? ORDER BY sort_order`, [req.params.id], (err, videos) => {
        res.json(videos || []);
    });
});

// ==================== RESULTS & SCORES ====================

app.get('/api/admin/results', (req, res) => {
    db.all(`SELECT u.id, u.name, u.phone, u.score, u.total_time_ms,
            (SELECT COUNT(*) FROM answers a WHERE a.user_id = u.id AND a.is_correct = 1) as correct_answers,
            (SELECT COUNT(*) FROM answers a WHERE a.user_id = u.id) as total_answers,
            ROW_NUMBER() OVER (ORDER BY u.score DESC, u.total_time_ms ASC) as rank
            FROM users u WHERE u.role = 'user' ORDER BY u.score DESC, u.total_time_ms ASC`, [], (err, rows) => {
        res.json(rows || []);
    });
});

// ==================== CHALLENGES ROUTES ====================

// ==================== CHALLENGES ROUTES ====================

// Get all challenges
app.get('/api/challenges', (req, res) => {
    res.json(challengesData);
});

// Smart completion check
app.post('/api/smart-completion', (req, res) => {
    const { userId, type, value, count } = req.body;
    const day = getCurrentRamadanDay();
    // Find challenge for today
    const challenge = challengesData.find(c => c.day === day);

    if (!challenge) return res.json({ success: false, reason: 'No challenge for today' });

    let matched = false;

    // Check condition
    if (challenge.type === type) {
        if (type === 'khatmah') {
            // value is juz number
            if (parseInt(value) == parseInt(challenge.target)) matched = true;
            if (challenge.target === 'finish' && value === 30) matched = true; // Simple logic
        }
        else if (type === 'worship') {
            // value is worship id (e.g. 'taraweeh', 'fajr')
            if (value === challenge.target) matched = true;
        }
        else if (type === 'tasbih') {
            // value is tasbih key, count is amount done
            if (value === challenge.target) {
                if (!challenge.count || (count >= challenge.count)) matched = true;
            }
        }
    }

    if (matched) {
        // Mark as complete using existing logic
        db.run(`INSERT INTO user_challenges (user_id, day_number, points) VALUES (?, ?, ?)`,
            [userId, day, challenge.points],
            function (err) {
                if (err) {
                    // Already completed
                    return res.json({ success: true, completed: true, new: false });
                }
                // Update score
                db.run(`UPDATE users SET score = score + ? WHERE id = ?`, [challenge.points, userId]);
                res.json({ success: true, completed: true, new: true, points: challenge.points, name: challenge.name });
            });
    } else {
        res.json({ success: false, reason: 'Condition not met' });
    }
});

// Get my challenges status
app.get('/api/challenges/my-status/:userId', (req, res) => {
    db.all(`SELECT day_number FROM user_challenges WHERE user_id = ?`, [req.params.userId], (err, rows) => {
        const completedDays = rows ? rows.map(r => r.day_number) : [];
        res.json({ completedDays });
    });
});

// Manual Complete challenge (still kept for manual ones)
app.post('/api/challenges/complete', (req, res) => {
    const { userId, dayNumber, points } = req.body;

    db.run(`INSERT INTO user_challenges (user_id, day_number, points) VALUES (?, ?, ?)`,
        [userId, dayNumber, points],
        function (err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                    return res.json({ success: true, message: 'Completed already' });
                }
                return res.status(500).json({ error: err.message });
            }

            // Update user total score
            db.run(`UPDATE users SET score = score + ? WHERE id = ?`, [points, userId]);
            res.json({ success: true });
        });
});

// Challenges Leaderboard
app.get('/api/challenges/leaderboard', (req, res) => {
    db.all(`SELECT u.name, u.facebook_url, SUM(uc.points) as total_points, COUNT(uc.day_number) as completed_count
            FROM user_challenges uc
            JOIN users u ON uc.user_id = u.id
            GROUP BY uc.user_id
            ORDER BY total_points DESC, completed_count DESC
            LIMIT 50`, [], (err, rows) => {
        res.json(rows || []);
    });
});

// ==================== SHARE REWARD ROUTE ====================

app.post('/api/share-reward', (req, res) => {
    const { userId } = req.body;
    const today = getTodayDate();

    db.run(`INSERT INTO share_logs (user_id, share_date) VALUES (?, ?)`,
        [userId, today],
        function (err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                    return res.status(400).json({ error: 'لقد حصلت على نقاط المشاركة اليوم بالفعل' });
                }
                return res.status(500).json({ error: err.message });
            }

            // Award 1 point
            db.run(`UPDATE users SET score = score + 1 WHERE id = ?`, [userId]);
            res.json({ success: true, points: 1 });
        });
});

// Start Server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Network access: http://0.0.0.0:${PORT}`);

    // Seed Questions if empty
    db.get(`SELECT COUNT(*) as count FROM questions`, [], (err, row) => {
        if (!err && row.count === 0) {
            console.log('Seeding questions from JSON...');
            try {
                const qPath = path.join(__dirname, 'questions.json');
                if (fs.existsSync(qPath)) {
                    const qData = JSON.parse(fs.readFileSync(qPath, 'utf8'));
                    const stmt = db.prepare(`INSERT OR REPLACE INTO questions 
                        (season_id, day_number, question_text, option1, option2, option3, option4, option5, correct_answer, timer_seconds, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

                    qData.forEach(q => {
                        stmt.run(1, q.day, q.text,
                            q.options[0] || '', q.options[1] || '', q.options[2] || '', q.options[3] || '', q.options[4] || '',
                            q.correctAnswer + 1, 30, 'published'); // Updated to 30s
                    });
                    stmt.finalize();
                    console.log(`Seeded ${qData.length} questions.`);
                }
            } catch (e) { console.error('Error seeding questions:', e); }
        }
    });
});


