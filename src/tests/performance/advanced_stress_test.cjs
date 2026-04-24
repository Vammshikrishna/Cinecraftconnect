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

const URL = envVars.VITE_SUPABASE_URL;
const KEY = envVars.VITE_SUPABASE_ANON_KEY;

if (!URL || !KEY) {
  console.error('Missing Supabase environment variables.');
  process.exit(1);
}

const CONCURRENT_USERS = 100;
const DURATION_MS = 30000; // 30 seconds

// Simulated Actions (Mixture of Read & Write)
const ACTIONS = [
  { name: 'Login Simulation', path: '/auth/v1/token?grant_type=password', method: 'POST' },
  { name: 'Post Creation', path: '/rest/v1/posts', method: 'POST' },
  { name: 'Join Discussion', path: '/rest/v1/room_members', method: 'POST' },
  { name: 'Job Application', path: '/rest/v1/job_applications', method: 'POST' },
  { name: 'Send Network Request', path: '/rest/v1/network_requests', method: 'POST' },
  { name: 'Add Review', path: '/rest/v1/marketplace_reviews', method: 'POST' },
  { name: 'Create Announcement', path: '/rest/v1/announcements', method: 'POST' },
  { name: 'Search Feed', path: '/rest/v1/posts?select=*&limit=20', method: 'GET' },
  { name: 'Open Marketplace', path: '/rest/v1/marketplace_listings?select=*&limit=20', method: 'GET' }
];

const results = {
  total: 0,
  success: 0,
  failed: 0,
  latencies: [],
  breakdown: {}
};

ACTIONS.forEach(a => results.breakdown[a.name] = { total: 0, success: 0, failed: 0, latencies: [] });

// Note: Using native fetch (Node 18+)
async function runAction(action) {
  const start = Date.now();
  results.total++;
  results.breakdown[action.name].total++;

  try {
    const response = await fetch(`${URL}${action.path}`, {
      method: action.method,
      headers: {
        'apikey': KEY,
        'Authorization': `Bearer ${KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: action.method === 'POST' ? JSON.stringify({ dummy: true }) : undefined
    });

    const duration = Date.now() - start;
    results.latencies.push(duration);
    results.breakdown[action.name].latencies.push(duration);

    // We count 2xx, 401, and 403 as "API Gateway Success"
    if (response.status < 400 || response.status === 401 || response.status === 403) {
      results.success++;
      results.breakdown[action.name].success++;
    } else {
      results.failed++;
      results.breakdown[action.name].failed++;
    }
  } catch (err) {
    results.failed++;
    results.breakdown[action.name].failed++;
  }
}

async function simulateUser() {
  const endTime = Date.now() + DURATION_MS;
  while (Date.now() < endTime) {
    const action = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
    await runAction(action);
    await new Promise(r => setTimeout(r, Math.random() * 500)); // Random delay between actions
  }
}

async function main() {
  console.log(`🚀 Starting ADVANCED STRESS TEST with ${CONCURRENT_USERS} concurrent users...`);
  console.log(`⏱️  Simulating Reads, Writes, and Auth for ${DURATION_MS/1000}s\n`);

  const users = Array(CONCURRENT_USERS).fill(0).map(() => simulateUser());
  await Promise.all(users);

  const avgLatency = results.latencies.reduce((a, b) => a + b, 0) / results.latencies.length;
  const sortedLatencies = results.latencies.sort((a, b) => a - b);
  const p95 = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)];

  console.log('--- Stress Test Final Report ---');
  console.log(`Total Actions Attempted: ${results.total}`);
  console.log(`API Gateway Success: ${results.success} (${((results.success/results.total)*100).toFixed(2)}%)`);
  console.log(`Average Latency: ${avgLatency.toFixed(2)}ms`);
  console.log(`95th Percentile (p95): ${p95}ms`);
  console.log(`Max Latency: ${Math.max(...results.latencies)}ms\n`);

  console.log('--- Breakdown by Action ---');
  Object.keys(results.breakdown).forEach(name => {
    const b = results.breakdown[name];
    const avg = b.latencies.reduce((a, b) => a + b, 0) / b.latencies.length;
    console.log(`${name.padEnd(20)}: ${b.total.toString().padStart(4)} attempts | Avg: ${avg.toFixed(2)}ms`);
  });
}

main();
