let usersList = [];
let sortColumn = 'total';
let sortDirection = 'desc';

// Helper to convert title to slug
function toSlug(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// Fetch users from API
async function fetchUsers(refresh = false) {
  showTableLoading(true);
  try {
    const response = await fetch(`/api/users${refresh ? '?refresh=true' : ''}`);
    if (!response.ok) throw new Error('Failed to fetch leaderboard data');
    usersList = await response.json();
    populateUserSelect();
    renderUsers();
    updateLastSyncedTime();
  } catch (error) {
    showBanner(`Error fetching users: ${error.message}`, 'error');
  } finally {
    showTableLoading(false);
  }
}

// Render the users table
function renderUsers() {
  const tbody = document.getElementById('usersBody');
  const table = document.getElementById('usersTable');
  const noResults = document.getElementById('noUsersFound');
  
  tbody.innerHTML = '';
  
  // 1. Filter based on search input
  const query = document.getElementById('searchInput').value.toLowerCase().trim();
  let filtered = usersList.filter(user => {
    return user.name.toLowerCase().includes(query) || 
           user.username.toLowerCase().includes(query);
  });
  
  if (filtered.length === 0) {
    table.style.display = 'none';
    noResults.classList.remove('hidden');
    return;
  }
  
  table.style.display = 'table';
  noResults.classList.add('hidden');

  // 2. Sort the users
  filtered.sort((a, b) => {
    let aVal = a[sortColumn];
    let bVal = b[sortColumn];
    
    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }
    
    if (sortDirection === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  // 3. Render rows
  filtered.forEach((user, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="rank-col"><span class="rank-num">${index + 1}</span></td>
      <td class="name-cell">${user.name}</td>
      <td class="id-cell">
        <a href="https://leetcode.com/u/${user.username}/" target="_blank" rel="noopener noreferrer">
          ${user.username} ↗
        </a>
      </td>
      <td class="total-cell">${user.total}</td>
      <td><span class="badge badge-easy">Easy: ${user.easy}</span></td>
      <td><span class="badge badge-medium">Medium: ${user.medium}</span></td>
      <td><span class="badge badge-hard">Hard: ${user.hard}</span></td>
    `;
    tbody.appendChild(tr);
  });

  updateSortIndicators();
}

// Update sorting arrows in table headers
function updateSortIndicators() {
  const columns = ['name', 'username', 'total', 'easy', 'medium', 'hard'];
  const headers = document.querySelectorAll('th.sortable');
  
  headers.forEach((th, idx) => {
    const colName = columns[idx];
    th.classList.remove('active');
    const iconSpan = th.querySelector('.sort-icon');
    
    if (colName === sortColumn) {
      th.classList.add('active');
      iconSpan.textContent = sortDirection === 'asc' ? '↑' : '↓';
    } else {
      iconSpan.textContent = '⇅';
    }
  });
}

// Change sorting column or toggle direction
function sortTable(column) {
  if (sortColumn === column) {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn = column;
    sortDirection = 'desc';
  }
  renderUsers();
}

// Input search filtering
function filterUsers() {
  renderUsers();
}

// Check if users solved a specific question
async function checkQuestion() {
  const questionInput = document.getElementById('questionInput');
  const questionName = questionInput.value.trim();
  
  if (!questionName) {
    showBanner('Please enter a LeetCode question name.', 'error');
    return;
  }

  showGlobalLoader(true, `Checking status for "${questionName}"...`);
  
  try {
    const response = await fetch(`/api/check/${encodeURIComponent(questionName)}`);
    if (!response.ok) throw new Error('Verification request failed');
    
    const data = await response.json();
    renderCheckResults(data);
    
    // Smooth scroll to results
    document.getElementById('checkResults').scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    showBanner(`Verification error: ${error.message}`, 'error');
  } finally {
    showGlobalLoader(false);
  }
}

// Render the check results container
function renderCheckResults(data) {
  const container = document.getElementById('checkResults');
  container.classList.remove('hidden');
  container.className = 'card animate-slide-up check-result-box';
  
  const solvedCount = data.results.filter(r => r.has_solved).length;
  const problemSlug = data.slug;
  const problemUrl = `https://leetcode.com/problems/${problemSlug}/`;
  
  // Find Display Names for usernames
  const resultsHTML = data.results.map(r => {
    const matched = usersList.find(u => u.username === r.username) || { name: r.username };
    return `
      <div class="user-check-card ${r.has_solved ? 'solved' : 'not-solved'}">
        <span class="u-name">${matched.name}</span>
        <span class="status-badge">${r.has_solved ? '✓ Solved' : '✗ Solved'}</span>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <h3>
      Question: <a href="${problemUrl}" target="_blank" rel="noopener noreferrer">${data.title} ↗</a>
    </h3>
    <div class="solved-stats-summary">
      Solved by ${solvedCount} out of ${data.results.length} users (${Math.round((solvedCount / data.results.length) * 100)}%)
    </div>
    <div class="results-grid">
      ${resultsHTML}
    </div>
  `;
}

// Manually trigger a full sync
async function manualSync() {
  showGlobalLoader(true, 'Syncing statistics with LeetCode API...');
  try {
    const response = await fetch('/api/sync', { method: 'POST' });
    if (!response.ok) throw new Error('Manual sync failed');
    
    const data = await response.json();
    usersList = data.users;
    renderUsers();
    updateLastSyncedTime();
    showBanner('All users synced successfully with LeetCode API!', 'success');
  } catch (error) {
    showBanner(`Sync error: ${error.message}`, 'error');
  } finally {
    showGlobalLoader(false);
  }
}

// UI Helpers
function showBanner(message, type) {
  const banner = document.getElementById('messageBanner');
  banner.className = `banner ${type}`;
  banner.textContent = message;
  banner.classList.remove('hidden');
  
  // Auto-hide banner after 5 seconds
  setTimeout(() => {
    banner.classList.add('hidden');
  }, 5000);
}

function showTableLoading(show) {
  document.getElementById('tableLoading').style.display = show ? 'flex' : 'none';
}

function showGlobalLoader(show, message = '') {
  const loader = document.getElementById('globalLoader');
  const msgEl = document.getElementById('loaderMessage');
  
  if (show) {
    msgEl.textContent = message;
    loader.classList.remove('hidden');
  } else {
    loader.classList.add('hidden');
  }
}

function updateLastSyncedTime() {
  const date = new Date();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  document.getElementById('lastSyncedTime').textContent = `Last synced: ${timeStr}`;
}

function populateUserSelect() {
  const select = document.getElementById('userSelect');
  if (!select) return;
  select.innerHTML = '';
  // Sort users alphabetically by display name for easier selection
  const sorted = [...usersList].sort((a, b) => a.name.localeCompare(b.name));
  sorted.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.username;
    opt.textContent = u.name;
    // Set sukrititalwar as default if it's in the list
    if (u.username === 'sukrititalwar') {
      opt.selected = true;
    }
    select.appendChild(opt);
  });
}

async function addManualSolve() {
  const select = document.getElementById('userSelect');
  const input = document.getElementById('manualQuestionInput');
  const username = select.value;
  const question = input.value.trim();
  
  if (!question) {
    showBanner('Please enter a question name or LeetCode URL.', 'error');
    return;
  }
  
  showGlobalLoader(true, 'Recording solved question...');
  try {
    const response = await fetch('/api/submissions/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, question })
    });
    
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || 'Failed to record solved question');
    }
    
    const data = await response.json();
    showBanner(`Successfully marked "${data.title}" as solved for ${select.options[select.selectedIndex].text}!`, 'success');
    input.value = '';
    
    // Automatically check this question to display results
    document.getElementById('questionInput').value = data.title;
    await checkQuestion();
  } catch (error) {
    showBanner(`Error: ${error.message}`, 'error');
  } finally {
    showGlobalLoader(false);
  }
}

// Initialize application on load
window.addEventListener('DOMContentLoaded', () => {
  fetchUsers();
});
