const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'data/ramadan.db');
const db = new sqlite3.Database(dbPath);

console.log('--- Seasons ---');
db.all("SELECT * FROM seasons", (err, rows) => {
    if (err) console.error(err);
    else console.log(JSON.stringify(rows, null, 2));
});
