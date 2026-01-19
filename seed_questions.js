const db = require('./server/database');

const questions = [
    {
        day: 1,
        text: "ما هو الشهر الذي أنزل فيه القرآن؟",
        options: ["رمضان", "رجب", "شعبان", "محرم", "ذو القعدة"],
        correct: 1
    },
    {
        day: 2,
        text: "كم عدد سور القرآن الكريم؟",
        options: ["110", "114", "120", "100", "115"],
        correct: 2
    },
    {
        day: 3,
        text: "من هو أول مؤذن في الإسلام؟",
        options: ["عمر بن الخطاب", "علي بن أبي طالب", "بلال بن رباح", "عثمان بن عفان", "أبو بكر الصديق"],
        correct: 3
    }
];

// Give DB a moment to initialize tables from index.js/database.js requirement
setTimeout(() => {
    questions.forEach(q => {
        db.run(`INSERT OR IGNORE INTO questions (day_number, question_text, option1, option2, option3, option4, option5, correct_answer) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [q.day, q.text, q.options[0], q.options[1], q.options[2], q.options[3], q.options[4], q.correct],
            (err) => {
                if (err) console.error("Error inserting question day " + q.day, err.message);
                else console.log("Inserted question day " + q.day);
            });
    });
}, 2000);
