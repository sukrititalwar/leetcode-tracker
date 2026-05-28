const express = require('express');
const path = require('path');
const db = require('./database');
const leetcode = require('./leetcode');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let dbInitialized = false;
async function ensureDbInitialized(req, res, next) {
  if (!dbInitialized) {
    try {
      await db.init();
      await db.seedUsers();
      dbInitialized = true;
    } catch (err) {
      console.error('Database initialization failed:', err);
      return res.status(500).json({ error: 'Database initialization failed: ' + err.message });
    }
  }
  next();
}

app.use(ensureDbInitialized);

// Helper to convert title to slug
function toSlug(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // remove special chars
    .replace(/\s+/g, '-')         // replace spaces with -
    .replace(/-+/g, '-');         // collapse dashes
}

// Background sync function
async function syncAllData() {
  console.log('Background Sync: Starting sync for all users...');
  const users = await db.getUsers();
  
  // Fetch stats and submissions in parallel
  const promises = users.map(async (u) => {
    try {
      // 1. Fetch statistics
      const stats = await leetcode.fetchUserStats(u.username);
      await db.updateUserStats(u.username, stats.total, stats.easy, stats.medium, stats.hard);
      
      // 2. Fetch recent submissions
      const subs = await leetcode.fetchRecentSubmissions(u.username);
      await db.saveSubmissions(u.username, subs);
      
      console.log(`Background Sync: Successfully synced ${u.username}`);
    } catch (error) {
      console.error(`Background Sync: Error syncing user ${u.username}:`, error.message);
    }
  });

  await Promise.all(promises);
  console.log('Background Sync: Completed sync for all users.');
}

// API: Get users list (real-time or cached)
app.get('/api/users', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    let users = await db.getUsers();
    
    // Check if we need to refresh stats (force or cache expired - older than 5 minutes)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const needsRefresh = forceRefresh || users.some(u => !u.last_updated || u.last_updated < fiveMinutesAgo);

    if (needsRefresh) {
      console.log('API: Syncing stats in real-time...');
      const promises = users.map(async (u) => {
        try {
          const stats = await leetcode.fetchUserStats(u.username);
          await db.updateUserStats(u.username, stats.total, stats.easy, stats.medium, stats.hard);
        } catch (error) {
          console.error(`API: Failed to fetch stats for ${u.username}:`, error.message);
        }
      });
      await Promise.all(promises);
      users = await db.getUsers(); // refetch fresh data
    }
    
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Check if users solved a specific question
app.get('/api/check/:question', async (req, res) => {
  try {
    const questionTitle = req.params.question;
    const titleSlug = toSlug(questionTitle);
    
    console.log(`API: Checking question: "${questionTitle}" (slug: "${titleSlug}")`);
    
    // 1. First trigger an on-demand sync of recent submissions for all users
    // to capture any very recent submissions before we check the DB
    const users = await db.getUsers();
    const promises = users.map(async (u) => {
      try {
        const subs = await leetcode.fetchRecentSubmissions(u.username);
        await db.saveSubmissions(u.username, subs);
      } catch (error) {
        console.error(`API Check: Failed to update submissions for ${u.username}:`, error.message);
      }
    });
    await Promise.all(promises);
    
    // 2. Query DB to check who has solved the question slug
    const results = await db.checkSolvedForQuestion(titleSlug);
    res.json({
      title: questionTitle,
      slug: titleSlug,
      results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Force manual sync
app.post('/api/sync', async (req, res) => {
  try {
    await syncAllData();
    const users = await db.getUsers();
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Manually add a solved submission
app.post('/api/submissions/add', async (req, res) => {
  try {
    const { username, question } = req.body;
    
    if (!username || !question) {
      return res.status(400).json({ error: 'Username and question are required' });
    }
    
    // Validate username is in initial users list
    const userExists = db.INITIAL_USERS.some(u => u.username === username);
    if (!userExists) {
      return res.status(400).json({ error: 'Invalid user in roster' });
    }
    
    // Parse slug from URL or title
    let q = question.trim();
    let slug = '';
    
    if (q.includes('leetcode.com/problems/')) {
      const match = q.match(/problems\/([a-z0-9-]+)/i);
      if (match) {
        slug = match[1];
      }
    }
    
    if (!slug) {
      slug = toSlug(q);
    }
    
    // Fetch official title and slug from LeetCode
    let officialTitle = '';
    let officialSlug = '';
    try {
      const details = await leetcode.fetchQuestionDetails(slug);
      if (details) {
        officialTitle = details.title;
        officialSlug = details.titleSlug;
      }
    } catch (e) {
      console.warn(`Could not verify question details from LeetCode: ${e.message}`);
    }
    
    // Fallback if LeetCode verification fails or is empty
    if (!officialTitle) {
      officialSlug = slug;
      officialTitle = slug
        .split('-')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }
    
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Save to DB
    await db.saveSubmissions(username, [{
      title: officialTitle,
      titleSlug: officialSlug,
      timestamp
    }]);
    
    console.log(`API: Manually added solved question "${officialTitle}" for ${username}`);
    
    res.json({
      success: true,
      username,
      title: officialTitle,
      slug: officialSlug
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Start application (local environment only)
if (!process.env.VERCEL) {
  async function start() {
    try {
      await db.init();
      await db.seedUsers();
      
      // Run initial sync in the background
      syncAllData().catch(err => console.error('Initial sync failed:', err.message));
      
      // Set background sync interval (every 10 minutes)
      setInterval(syncAllData, 10 * 60 * 1000);
      
      app.listen(PORT, () => {
        console.log(`Server is running at http://localhost:${PORT}`);
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }
  start();
}

module.exports = app;
