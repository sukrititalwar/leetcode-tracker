const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.VERCEL
  ? '/tmp/leetcode_tracker.db'
  : path.join(__dirname, 'leetcode_tracker.db');
const db = new sqlite3.Database(dbPath);

function init() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Create users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          username TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          total INTEGER DEFAULT 0,
          easy INTEGER DEFAULT 0,
          medium INTEGER DEFAULT 0,
          hard INTEGER DEFAULT 0,
          last_updated INTEGER
        )
      `, (err) => {
        if (err) return reject(err);
      });

      // Create submissions table
      db.run(`
        CREATE TABLE IF NOT EXISTS submissions (
          username TEXT,
          title TEXT,
          title_slug TEXT,
          timestamp INTEGER,
          PRIMARY KEY (username, title_slug)
        )
      `, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  });
}

// Seed initial users if they don't exist
const INITIAL_USERS = [
  { name: "Shubham", username: "Shubham_kh" },
  { name: "Aryan Baglane", username: "aryanbaglane123" },
  { name: "Ansh gupta", username: "AnshGuptaDtu28" },
  { name: "Soumya Sourav Das", username: "celestial317" },
  { name: "Sudhanshu Shekhar", username: "sudhanshu_727" },
  { name: "Sukriti", username: "sukrititalwar" },
  { name: "Shivam", username: "Err_rr" },
  { name: "Devyanshi Bansal", username: "DevyanshiBansal" },
  { name: "Smriti", username: "smriti_2404" },
  { name: "Aditya", username: "Aditya_04" },
  { name: "Saransh", username: "Saurav_Saransh" },
  { name: "Nikhil Singh", username: "mrsta_rk25" },
  { name: "Yannabathina Sasank", username: "Swedsid" },
  { name: "Tushar Mathur", username: "tusharmathur09" }
];

function seedUsers() {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO users (username, name, total, easy, medium, hard, last_updated)
      VALUES (?, ?, 0, 0, 0, 0, 0)
    `);
    
    let completed = 0;
    let hasError = false;

    if (INITIAL_USERS.length === 0) {
      resolve();
      return;
    }

    INITIAL_USERS.forEach(u => {
      stmt.run(u.username, u.name, (err) => {
        if (err && !hasError) {
          hasError = true;
          stmt.finalize();
          return reject(err);
        }
        completed++;
        if (completed === INITIAL_USERS.length) {
          stmt.finalize();
          resolve();
        }
      });
    });
  });
}

function getUsers() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM users ORDER BY total DESC`, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function updateUserStats(username, total, easy, medium, hard) {
  return new Promise((resolve, reject) => {
    db.run(`
      UPDATE users
      SET total = ?, easy = ?, medium = ?, hard = ?, last_updated = ?
      WHERE username = ?
    `, [total, easy, medium, hard, Date.now(), username], (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function saveSubmissions(username, submissions) {
  return new Promise((resolve, reject) => {
    if (submissions.length === 0) {
      resolve();
      return;
    }

    const stmt = db.prepare(`
      INSERT OR IGNORE INTO submissions (username, title, title_slug, timestamp)
      VALUES (?, ?, ?, ?)
    `);

    let completed = 0;
    let hasError = false;

    submissions.forEach(sub => {
      stmt.run(username, sub.title, sub.titleSlug, sub.timestamp, (err) => {
        if (err && !hasError) {
          hasError = true;
          stmt.finalize();
          return reject(err);
        }
        completed++;
        if (completed === submissions.length) {
          stmt.finalize();
          resolve();
        }
      });
    });
  });
}

function checkSolvedForQuestion(titleSlug) {
  return new Promise((resolve, reject) => {
    // We want to return an array of { username, has_solved } for all initialized users
    db.all(`
      SELECT u.username, 
             CASE WHEN s.title_slug IS NOT NULL THEN 1 ELSE 0 END as has_solved
      FROM users u
      LEFT JOIN submissions s ON u.username = s.username AND s.title_slug = ?
    `, [titleSlug], (err, rows) => {
      if (err) return reject(err);
      // Map to boolean has_solved
      const results = rows.map(r => ({
        username: r.username,
        has_solved: r.has_solved === 1
      }));
      resolve(results);
    });
  });
}

module.exports = {
  init,
  seedUsers,
  getUsers,
  updateUserStats,
  saveSubmissions,
  checkSolvedForQuestion,
  INITIAL_USERS
};
