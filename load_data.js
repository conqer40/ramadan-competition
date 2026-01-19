const { db } = require('./server/database');
const fs = require('fs');
const path = require('path');

// Read Imsakia JSON
const imsakiaPath = path.join(__dirname, 'data', 'imsakia.json');
const imsakiaData = JSON.parse(fs.readFileSync(imsakiaPath, 'utf8'));

// Wait for DB to initialize
setTimeout(() => {
    // Get active season
    db.get(`SELECT id FROM seasons WHERE is_active = 1`, [], (err, season) => {
        if (!season) {
            console.log('No active season found!');
            return;
        }

        console.log(`Loading Imsakia for season ID: ${season.id}`);

        // Clear existing data for this season
        db.run(`DELETE FROM prayers_schedule WHERE season_id = ?`, [season.id], () => {
            const stmt = db.prepare(`INSERT INTO prayers_schedule 
                (season_id, day_number, day_name, gregorian_date, fajr, sunrise, dhuhr, asr, maghrib, isha) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

            imsakiaData.forEach(day => {
                // Parse gregorian date to YYYY-MM-DD format
                let dateStr = day.gregorian_date;
                // Convert "18 فبراير، 2026" to "2026-02-18"
                const months = {
                    'يناير': '01', 'فبراير': '02', 'مارس': '03', 'أبريل': '04',
                    'مايو': '05', 'يونيو': '06', 'يوليو': '07', 'أغسطس': '08',
                    'سبتمبر': '09', 'أكتوبر': '10', 'نوفمبر': '11', 'ديسمبر': '12'
                };

                const match = dateStr.match(/(\d+)\s+(\S+)،?\s*(\d+)/);
                let formattedDate = dateStr;
                if (match) {
                    const d = match[1].padStart(2, '0');
                    const m = months[match[2]] || '01';
                    const y = match[3];
                    formattedDate = `${y}-${m}-${d}`;
                }

                stmt.run(
                    season.id,
                    day.ramadan_date,
                    day.day_name,
                    formattedDate,
                    day.fajr,
                    day.sunrise,
                    day.dhuhr,
                    day.asr,
                    day.maghrib,
                    day.isha
                );
            });

            stmt.finalize(() => {
                console.log(`Loaded ${imsakiaData.length} days into prayers_schedule`);

                // Also seed some questions
                const questions = [
                    { day: 1, text: "ما هو الشهر الذي أنزل فيه القرآن؟", opts: ["رمضان", "رجب", "شعبان", "محرم", "ذو الحجة"], correct: 1 },
                    { day: 2, text: "كم عدد سور القرآن الكريم؟", opts: ["110", "114", "120", "100", "115"], correct: 2 },
                    { day: 3, text: "من هو أول مؤذن في الإسلام؟", opts: ["عمر بن الخطاب", "علي بن أبي طالب", "بلال بن رباح", "عثمان بن عفان", "أبو بكر الصديق"], correct: 3 },
                    { day: 4, text: "ما هي أول سورة نزلت في القرآن؟", opts: ["الفاتحة", "البقرة", "العلق", "المدثر", "الإخلاص"], correct: 3 },
                    { day: 5, text: "كم عدد ركعات صلاة التراويح؟", opts: ["8 ركعات", "20 ركعة", "11 ركعة", "8 أو 20 ركعة", "12 ركعة"], correct: 4 }
                ];

                const qStmt = db.prepare(`INSERT OR REPLACE INTO questions 
                    (season_id, day_number, question_text, option1, option2, option3, option4, option5, correct_answer, timer_seconds, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

                questions.forEach(q => {
                    qStmt.run(season.id, q.day, q.text, q.opts[0], q.opts[1], q.opts[2], q.opts[3], q.opts[4], q.correct, 60, 'published');
                });

                qStmt.finalize(() => {
                    console.log('Sample questions seeded!');
                    process.exit(0);
                });
            });
        });
    });
}, 2000);
