const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'data/ramadan.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error(err.message);
        return;
    }
    console.log('Connected to database.');
});

db.serialize(() => {
    console.log('--- Seasons ---');
    db.all("SELECT * FROM seasons", (err, rows) => {
        if (err) console.error(err);
        else console.log(rows);

        console.log('\n--- Prayer Schedule (First 5) ---');
        db.all("SELECT * FROM prayers_schedule LIMIT 5", (err, rows) => {
            if (err) console.error(err);
            else console.log(rows);

            console.log('\n--- Count ---');
            db.get("SELECT COUNT(*) as count FROM prayers_schedule", (err, row) => {
                console.log("Total prayers:", row.count);
            });
        });
    });
});
