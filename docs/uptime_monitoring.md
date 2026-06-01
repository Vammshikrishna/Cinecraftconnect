# Uptime Monitoring Configuration Guide

This guide explains how to set up full-stack uptime monitoring for the CineCraft Connect application using **Better Stack Uptime** (formerly Better Uptime) and the existing Supabase `health-check` Edge Function.

---

## 1. Deploy the Health Check Edge Function

CineCraft Connect comes with a pre-configured, comprehensive health check edge function located in:
`supabase/functions/health-check/index.ts`

This function validates:
- **Database Connectivity**: Executes a quick query on the `profiles` table to measure query latency.
- **Storage Subsystems**: Tests read/write abilities by listing existing Storage buckets.
- **Background Jobs Health**: Queries the `background_jobs` table to report pending/failed job queues.

### Deployment Command

Run the following command in your terminal to deploy the function to your Supabase project:
```bash
supabase functions deploy health-check --no-verify-jwt
```
> [!IMPORTANT]
> The `--no-verify-jwt` flag is required so that Better Uptime can query the endpoint directly without needing a bearer authentication token.

---

## 2. Locate Your Health Check Endpoint URL

Once successfully deployed, your health check endpoint will be served at:
`https://<supabase-project-ref>.supabase.co/functions/v1/health-check`

*(Replace `<supabase-project-ref>` with your actual Supabase Project ID found in your Supabase Dashboard settings).*

### Test the Endpoint
Verify the endpoint responds with an HTTP status `200` and the following payload structure by running a `curl` request:
```bash
curl -i https://<supabase-project-ref>.supabase.co/functions/v1/health-check
```

Response body:
```json
{
  "timestamp": "2026-05-27T06:00:00.000Z",
  "status": "healthy",
  "checks": {
    "database": {
      "status": "healthy",
      "responseTime": 12,
      "error": null
    },
    "storage": {
      "status": "healthy",
      "responseTime": 18,
      "buckets": 4,
      "error": null
    },
    "backgroundJobs": {
      "status": "healthy",
      "pendingCount": 0,
      "failedCount": 2
    }
  },
  "responseTime": 35
}
```

---

## 3. Set Up Better Stack Uptime

1. Create a free or paid account at [Better Stack Uptime](https://betterstack.com/uptime).
2. Go to **Monitors** → **Create Monitor**.
3. Configure the monitor details:
   - **URL to monitor**: `https://<supabase-project-ref>.supabase.co/functions/v1/health-check`
   - **Monitor name**: `CineCraft Connect Stack Health`
   - **Alert us when the URL**: `Returns any HTTP status other than 200`
   - **Check frequency**: `Every 3 minutes` or `Every 5 minutes` (recommended to avoid excessive billing/API load).
   - **Confirmation period**: `2 minutes` (pings from multiple locations before firing alerts, preventing false positives).
4. Save the monitor.

---

## 4. How Uptime Alerting Works
- **Database Downtime**: If the database crashes or exceeds query limits, the DB check returns `unhealthy`, forcing the health check function to return HTTP `503`. Better Stack will immediately flag the incident and trigger email/SMS alerts.
- **Queue Backup Warnings**: If background worker jobs fail repeatedly (e.g. video transcode failure counts exceed 10), the status degrades to `warning`, letting you monitor issues before they lead to outages.
