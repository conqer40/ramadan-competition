const fs = require('fs');
const path = require('path');

function seedDatabase(db) {
    seedImsakia(db);
    seedContent(db);
    seedPlaylists(db);
}

function seedImsakia(db) {
    // Check if Imsakia exists
    db.get('SELECT COUNT(*) as count FROM prayers_schedule', (err, row) => {
        if (row && row.count > 0) return; // Already populated

        console.log('Seeding Imsakia...');
        const imsakiaPath = path.join(__dirname, 'data', 'imsakia.json');
        if (!fs.existsSync(imsakiaPath)) return;

        const imsakiaData = JSON.parse(fs.readFileSync(imsakiaPath, 'utf8'));

        db.get(`SELECT id FROM seasons WHERE is_active = 1`, [], (err, season) => {
            if (!season) return;

            const stmt = db.prepare(`INSERT INTO prayers_schedule 
                (season_id, day_number, day_name, gregorian_date, fajr, sunrise, dhuhr, asr, maghrib, isha) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

            const months = {
                'يناير': '01', 'فبراير': '02', 'مارس': '03', 'أبريل': '04',
                'مايو': '05', 'يونيو': '06', 'يوليو': '07', 'أغسطس': '08',
                'سبتمبر': '09', 'أكتوبر': '10', 'نوفمبر': '11', 'ديسمبر': '12'
            };

            imsakiaData.forEach(day => {
                let dateStr = day.gregorian_date;
                const match = dateStr.match(/(\d+)\s+([^\s،0-9]+)(?:،)?\s*(\d+)/);
                let formattedDate = dateStr;
                if (match) {
                    const d = match[1].padStart(2, '0');
                    const m = months[match[2].trim()] || '01';
                    const y = match[3];
                    formattedDate = `${y}-${m}-${d}`;
                }

                stmt.run(season.id, day.ramadan_date, day.day_name, formattedDate,
                    day.fajr, day.sunrise, day.dhuhr, day.asr, day.maghrib, day.isha);
            });

            stmt.finalize(() => console.log('Imsakia seeded.'));
        });
    });
}

function seedContent(db) {
    db.get('SELECT COUNT(*) as count FROM content', (err, row) => {
        if (row && row.count > 10) return; // Already populated

        console.log('Seeding Content (Azkar & Duas)...');

        const azkarMorning = [
            "قراءة آية الكرسي: {الله لا إله إلا هو الحي القيوم...}",
            "أصبحنا على فطرة الإسلام وكلِمة الإخلاص، ودين نبينا محمد صلى الله عليه وسلم...",
            "رضيت بالله ربا، وبالإسلام دينا، وبمحمد صلى الله عليه وسلم نبياً.",
            "اللهم إني أسألك علماً نافعاً، ورزقاً طيباً، وعملاً متقبلاً.",
            "اللهم بك أصبحنا، وبك أمسينا، وبك نحيا، وبك نموت، وإليك النشور.",
            "لا إله إلا الله وحده، لا شريك له، له الملك، وله الحمد، وهو على كل شيء قدير.",
            "يا حيُّ يا قيوم برحمتك أستغيثُ، أصلح لي شأني كله، ولا تَكلني إلى نفسي طَرْفَةَ عين أبدًا.",
            "اللهم أنت ربي، لا إله إلا أنت، خلقتني وأنا عبدُك...",
            "اللهم فاطر السموات والأرض، عالم الغيب والشهادة...",
            "أصبحنا وأصبح الملك لله، والحمد لله ولا إله إلا الله...",
            "اللهم إني أسألك العفو والعافية في الدنيا والآخرة...",
            "بسم الله الذي لا يضر مع اسمه شيء في الأرض ولا في السماء...",
            "سبحان الله عدد خلقه، سبحان الله رضا نفسه...",
            "اللهم عافني في بدني، اللهم عافني في سمعي...",
            "قراءة سور: الإخلاص، والفلق، والناس.",
            "حسبي الله لا إله إلا هو عليه توكلت...",
            "اللهم إني أصبحت، أُشهدك وأُشهد حملة عرشك...",
            "لا إله إلا الله وحده، لا شريك له... (10 مرات)",
            "سبحان الله وبحمده. (100 مرة)",
            "أستغفر الله. (100 مرة)"
        ];

        const azkarEvening = [
            "قراءة آية الكرسي",
            "أمسينا على فطرة الإسلام وكلِمة الإخلاص...",
            "رضيت بالله ربا، وبالإسلام دينا...",
            "اللهم بك أمسينا، وبك أصبحنا...",
            "لا إله إلا الله وحده لا شريك له...",
            "يا حيُّ يا قيوم برحمتك أستغيثُ...",
            "اللهم أنت ربي، لا إله إلا أنت...",
            "اللهم فاطر السموات والأرض...",
            "أمسينا وأمسى الملك لله...",
            "اللهم إني أسألك العفو والعافية...",
            "بسم الله الذي لا يضر مع اسمه شيء...",
            "أعوذ بكلمات الله التامَّات من شر ما خلق.",
            "اللهم عافني في بدني...",
            "قراءة سور: الإخلاص، والفلق، والناس.",
            "حسبي الله لا إله إلا هو عليه توكلت...",
            "اللهم إني أمسيت أُشهدك...",
            "لا إله إلا الله وحده... (10 مرات)",
            "سبحان الله وبحمده. (100 مرة)",
            "أستغفر الله. (100 مرة)",
            "سبحان الله، والحمد لله، والله أكبر..."
        ];

        const duas = [
            { t: 'daily', title: 'دعاء اليوم 1', body: 'اللهم اجعل صيامنا فيه صيام الصائمين وقيمنا فيه قيام القائمين...' },
            { t: 'daily', title: 'دعاء اليوم 2', body: 'اللهم قربني فيه إلى مرضاتك، وجنبني فيه من سخطك ونقماتك...' },
            { t: 'iftar', title: 'دعاء الإفطار', body: 'اللهم لك صمت وعلي رزقك أفطرت...' },
            { t: 'suhoor', title: 'دعاء السحور', body: 'نويت صيام غد من شهر رمضان...' },
            { t: 'laylat_qadr', title: 'دعاء ليلة القدر', body: 'اللهم إنك عفو تحب العفو فاعف عني' },
            // Adding placeholders to be expanded via admin or loop
        ];

        // Add more generic duas to reach higher count simulation
        for (let i = 3; i <= 30; i++) {
            duas.push({ t: 'daily', title: `دعاء اليوم ${i}`, body: `اللهم إني أسألك في يوم ${i} من رمضان أن تغفر لي وترحمني...` });
        }
        for (let i = 1; i <= 20; i++) {
            duas.push({ t: 'forgiveness', title: `دعاء مغفرة ${i}`, body: `رب اغفر لي وتب علي إنك أنت التواب الرحيم.` });
            duas.push({ t: 'family', title: `دعاء للأهل ${i}`, body: `اللهم احفظ أهلي وأحبتي في هذا الشهر الكريم.` });
        }

        const stmt = db.prepare(`INSERT INTO content (type, title, body, is_active) VALUES (?, ?, ?, 1)`);

        azkarMorning.forEach(z => stmt.run('azkar_morning', 'أذكار الصباح', z));
        azkarEvening.forEach(z => stmt.run('azkar_evening', 'أذكار المساء', z));

        duas.forEach(d => stmt.run(d.t, d.title, d.body));

        stmt.finalize(() => console.log('Content seeded.'));
    });
}

function seedPlaylists(db) {
    db.get('SELECT COUNT(*) as count FROM playlists', (err, row) => {
        if (row && row.count > 0) return;

        console.log('Seeding Playlists...');

        db.run(`INSERT INTO playlists (title, description, thumbnail_url, is_active, sort_order) VALUES (?, ?, ?, 1, 1)`,
            ['خواطر رمضانية', 'مقاطع دينية قصيرة ومفيدة', 'https://img.youtube.com/vi/ABCD1234/hqdefault.jpg'],
            function (err) {
                if (!this.lastID) return;
                const plId = this.lastID;

                // Add sample videos
                const videoStmt = db.prepare(`INSERT INTO playlist_videos (playlist_id, title, video_url, sort_order) VALUES (?, ?, ?, ?)`);
                videoStmt.run(plId, 'فضل شهر رمضان', 'https://www.youtube.com/watch?v=sJ5p_sQA3N4', 1);
                videoStmt.run(plId, 'كيف نستقبل رمضان', 'https://www.youtube.com/watch?v=sample2', 2);
                videoStmt.finalize();
            }
        );

        db.run(`INSERT INTO playlists (title, description, thumbnail_url, is_active, sort_order) VALUES (?, ?, ?, 1, 2)`,
            ['تلاوات خاشعة', 'أجمل التلاوات القرآنية', 'https://img.youtube.com/vi/XYZ/hqdefault.jpg']
        );
    });
}

module.exports = { seedDatabase };
