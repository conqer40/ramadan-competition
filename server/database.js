const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const dbPath = path.resolve(__dirname, '../data/ramadan.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initDb();
    }
});

// Encryption helpers for sensitive data
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'ramadan2026secretkey1234567890!!';
const IV_LENGTH = 16;

function encrypt(text) {
    if (!text) return null;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
    if (!text) return null;
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encrypted = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

function initDb() {
    db.serialize(() => {
        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT UNIQUE NOT NULL,
            national_id_encrypted TEXT NOT NULL,
            fomi_encrypted TEXT,
            password_hash TEXT NOT NULL,
            agreed_terms BOOLEAN DEFAULT 0,
            facebook_url TEXT,
            profile_picture TEXT,
            role TEXT DEFAULT 'user',
            score INTEGER DEFAULT 0,
            total_time_ms INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Seasons table
        db.run(`CREATE TABLE IF NOT EXISTS seasons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            year_hijri TEXT,
            start_date DATE,
            end_date DATE,
            total_days INTEGER DEFAULT 29,
            is_active BOOLEAN DEFAULT 0,
            winner_user_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Prayers Schedule (Imsakia)
        db.run(`CREATE TABLE IF NOT EXISTS prayers_schedule (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            season_id INTEGER,
            day_number INTEGER,
            day_name TEXT,
            gregorian_date DATE,
            fajr TEXT,
            sunrise TEXT,
            dhuhr TEXT,
            asr TEXT,
            maghrib TEXT,
            isha TEXT,
            FOREIGN KEY(season_id) REFERENCES seasons(id)
        )`);

        // Questions table
        db.run(`CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            season_id INTEGER,
            day_number INTEGER,
            question_text TEXT NOT NULL,
            option1 TEXT NOT NULL,
            option2 TEXT NOT NULL,
            option3 TEXT NOT NULL,
            option4 TEXT NOT NULL,
            option5 TEXT NOT NULL,
            correct_answer INTEGER NOT NULL,
            timer_seconds INTEGER DEFAULT 60,
            status TEXT DEFAULT 'draft',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(season_id, day_number),
            FOREIGN KEY(season_id) REFERENCES seasons(id)
        )`);

        // Answers table
        db.run(`CREATE TABLE IF NOT EXISTS answers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            question_id INTEGER NOT NULL,
            selected_option INTEGER NOT NULL,
            is_correct BOOLEAN,
            time_taken_ms INTEGER DEFAULT 0,
            answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, question_id),
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(question_id) REFERENCES questions(id)
        )`);

        // Content table (Azkar, Good Deeds, Programs)
        db.run(`CREATE TABLE IF NOT EXISTS content (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            title TEXT,
            body TEXT,
            is_active BOOLEAN DEFAULT 1,
            sort_order INTEGER DEFAULT 0
        )`);

        // Playlists table (for Programs section)
        db.run(`CREATE TABLE IF NOT EXISTS playlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            thumbnail_url TEXT,
            is_active BOOLEAN DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Playlist Videos
        db.run(`CREATE TABLE IF NOT EXISTS playlist_videos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            playlist_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            video_url TEXT NOT NULL,
            thumbnail_url TEXT,
            duration TEXT,
            sort_order INTEGER DEFAULT 0,
            FOREIGN KEY(playlist_id) REFERENCES playlists(id)
        )`);

        // User Challenges (New)
        db.run(`CREATE TABLE IF NOT EXISTS user_challenges (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            day_number INTEGER NOT NULL,
            points INTEGER DEFAULT 0,
            completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, day_number),
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // Share Logs (New)
        db.run(`CREATE TABLE IF NOT EXISTS share_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            share_date DATE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, share_date),
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // Create default season for 2026
        db.get("SELECT id FROM seasons WHERE year_hijri = '1447'", [], (err, row) => {
            if (!row) {
                db.run(`INSERT INTO seasons (year_hijri, start_date, end_date, total_days, is_active) 
                        VALUES ('1447', '2026-02-18', '2026-03-19', 30, 1)`);
                console.log("Default season 1447 created.");
            }
        });

        // Create Admin user with new credentials
        const adminPhone = "01021870610";
        db.get("SELECT id FROM users WHERE phone = ?", [adminPhone], (err, row) => {
            if (!row) {
                const hash = bcrypt.hashSync("01065584603", 10);
                const encryptedId = encrypt("00000000000000");
                db.run(`INSERT INTO users (name, national_id_encrypted, phone, password_hash, role, agreed_terms) 
                        VALUES (?, ?, ?, ?, ?, ?)`,
                    ["مدير النظام", encryptedId, adminPhone, hash, "admin", 1]);
                console.log("Admin user created with phone: 01021870610");
            }
        });

        // Seed initial data (Imsakia, Content, Playlists)
        try {
            require('../load_data').seedDatabase(db);
        } catch (e) {
            console.error('Failed to seed database:', e);
        }
    });
}

module.exports = { db, encrypt, decrypt };
