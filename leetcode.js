const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';

/**
 * Fetch a user's solved question counts (Total, Easy, Medium, Hard).
 * @param {string} username - LeetCode username
 */
async function fetchUserStats(username) {
  const query = `
    query userProblemsSolved($username: String!) {
      matchedUser(username: $username) {
        submitStatsGlobal {
          acSubmissionNum {
            difficulty
            count
          }
        }
      }
    }
  `;

  const response = await fetch(LEETCODE_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    },
    body: JSON.stringify({
      query,
      variables: { username }
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch stats for ${username}: ${response.statusText}`);
  }

  const result = await response.json();
  const acSubmissions = result.data?.matchedUser?.submitStatsGlobal?.acSubmissionNum || [];
  
  const stats = {
    total: 0,
    easy: 0,
    medium: 0,
    hard: 0
  };

  acSubmissions.forEach(item => {
    if (item.difficulty === 'All') stats.total = item.count;
    else if (item.difficulty === 'Easy') stats.easy = item.count;
    else if (item.difficulty === 'Medium') stats.medium = item.count;
    else if (item.difficulty === 'Hard') stats.hard = item.count;
  });

  return stats;
}

/**
 * Fetch a user's recent accepted submissions.
 * @param {string} username - LeetCode username
 * @param {number} limit - Number of submissions (max 20)
 */
async function fetchRecentSubmissions(username, limit = 20) {
  const query = `
    query recentAcSubmissions($username: String!, $limit: Int!) {
      recentAcSubmissionList(username: $username, limit: $limit) {
        id
        title
        titleSlug
        timestamp
      }
    }
  `;

  const response = await fetch(LEETCODE_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    },
    body: JSON.stringify({
      query,
      variables: { username, limit }
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch submissions for ${username}: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data?.recentAcSubmissionList || [];
}

/**
 * Fetch a question's official title and titleSlug from LeetCode.
 * @param {string} titleSlug - The question slug
 */
async function fetchQuestionDetails(titleSlug) {
  const query = `
    query questionTitle($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        title
        titleSlug
      }
    }
  `;

  const response = await fetch(LEETCODE_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    },
    body: JSON.stringify({
      query,
      variables: { titleSlug }
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch question details for ${titleSlug}: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data?.question || null;
}

module.exports = {
  fetchUserStats,
  fetchRecentSubmissions,
  fetchQuestionDetails
};

