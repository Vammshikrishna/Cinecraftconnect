/**
 * CineCraft Connect - Concurrent Load Test
 * Simulates 100 users performing various actions simultaneously.
 */

const fs = require('fs');
const path = require('path');

// Manually parse .env
const envPath = path.resolve(process.cwd(), '.env');
const env = fs.readFileSync(envPath, 'utf8');
const envVars = {};
env.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) envVars[key.trim()] = value.trim();
});

// Configuration
const CONFIG = {
  CONCURRENT_USERS: 100,
  TEST_DURATION_MS: 30000, // 30 seconds
  SUPABASE_URL: envVars.VITE_SUPABASE_URL,
  SUPABASE_KEY: envVars.VITE_SUPABASE_ANON_KEY,
  ENDPOINTS: {
    FEED: '/rest/v1/posts?select=*&order=created_at.desc&limit=20',
    PROFILES: '/rest/v1/profiles?select=*&limit=50',
    SEARCH: '/rest/v1/profiles?select=*&full_name=ilike.*a*&limit=10',
    MARKETPLACE: '/rest/v1/marketplace_listings?select=*&limit=20',
    PROJECTS: '/rest/v1/projects?select=*&limit=20',
    ROOMS: '/rest/v1/discussion_rooms?select=*&limit=20',
    JOBS: '/rest/v1/jobs?select=*&limit=20',
    ANNOUNCEMENTS: '/rest/v1/announcements?select=*&limit=10',
    REVIEWS: '/rest/v1/film_reviews?select=*&limit=20',
    PAGES: '/rest/v1/company_pages?select=*&limit=20'
  }
};

const stats = {
  totalRequests: 0,
  successRequests: 0,
  failedRequests: 0,
  latencies: [],
  featureStats: {}
};

async function performAction(sessionName, endpointKey) {
  const url = `${CONFIG.SUPABASE_URL}${CONFIG.ENDPOINTS[endpointKey]}`;
  const start = Date.now();
  
  try {
    const response = await fetch(url, {
      headers: {
        'apikey': CONFIG.SUPABASE_KEY,
        'Authorization': `Bearer ${CONFIG.SUPABASE_KEY}`
      }
    });

    const duration = Date.now() - start;
    stats.totalRequests++;
    
    if (response.ok) {
      stats.successRequests++;
      stats.latencies.push(duration);
      
      if (!stats.featureStats[endpointKey]) {
        stats.featureStats[endpointKey] = { count: 0, totalLat: 0 };
      }
      stats.featureStats[endpointKey].count++;
      stats.featureStats[endpointKey].totalLat += duration;
    } else {
      stats.failedRequests++;
      console.error(`[${sessionName}] Failed ${endpointKey}: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    stats.totalRequests++;
    stats.failedRequests++;
    console.error(`[${sessionName}] Error ${endpointKey}:`, error.message);
  }
}

async function userSession(id) {
  const sessionName = `User-${id}`;
  const startTime = Date.now();
  
  while (Date.now() - startTime < CONFIG.TEST_DURATION_MS) {
    // Pick a random feature to test
    const features = Object.keys(CONFIG.ENDPOINTS);
    const feature = features[Math.floor(Math.random() * features.length)];
    
    await performAction(sessionName, feature);
    
    // Simulate user "thinking" or interacting with the UI
    const waitTime = Math.floor(Math.random() * 2000) + 500; // 500ms - 2500ms
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
}

async function runTest() {
  console.log(`🚀 Starting Load Test with ${CONFIG.CONCURRENT_USERS} concurrent users...`);
  console.log(`⏱️  Duration: ${CONFIG.TEST_DURATION_MS / 1000}s`);
  
  const sessions = [];
  for (let i = 1; i <= CONFIG.CONCURRENT_USERS; i++) {
    sessions.push(userSession(i));
  }
  
  await Promise.all(sessions);
  
  // Reporting
  console.log('\n--- Load Test Results ---');
  console.log(`Total Requests: ${stats.totalRequests}`);
  console.log(`Successful: ${stats.successRequests} (${((stats.successRequests / stats.totalRequests) * 100).toFixed(2)}%)`);
  console.log(`Failed: ${stats.failedRequests}`);
  
  if (stats.latencies.length > 0) {
    const avgLat = stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length;
    const sortedLat = [...stats.latencies].sort((a, b) => a - b);
    const p95 = sortedLat[Math.floor(sortedLat.length * 0.95)];
    const max = Math.max(...stats.latencies);
    
    console.log(`Average Latency: ${avgLat.toFixed(2)}ms`);
    console.log(`95th Percentile (p95): ${p95}ms`);
    console.log(`Max Latency: ${max}ms`);
    
    console.log('\n--- Breakdown by Feature ---');
    for (const [feature, data] of Object.entries(stats.featureStats)) {
      const avg = data.totalLat / data.count;
      console.log(`${feature.padEnd(12)}: ${data.count.toString().padStart(4)} requests | Avg: ${avg.toFixed(2)}ms`);
    }
  }
}

runTest().catch(err => console.error('Critical Error:', err));
