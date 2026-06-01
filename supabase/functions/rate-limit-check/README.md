# rate-limit-check Edge Function

Provides per-user, per-action sliding-window rate limiting backed by
**Upstash Redis** (REST API, edge-native — no Postgres writes).

## Algorithm

Uses a Redis **Sorted Set** keyed `rate:<userId>:<actionType>`:

1. `ZREMRANGEBYSCORE` — evict entries older than the window
2. `ZADD` — record current request (score = `Date.now()`)
3. `ZCARD` — count active requests in the window
4. `EXPIRE` — refresh TTL to avoid stale keys

All four commands run in a single **pipeline** request to Upstash.

## Required Environment Variables

| Variable | Description |
|---|---|
| `UPSTASH_REDIS_REST_URL` | REST endpoint from Upstash console (e.g. `https://xxx.upstash.io`) |
| `UPSTASH_REDIS_REST_TOKEN` | Read/Write token from Upstash console |
| `SUPABASE_URL` | Auto-injected by Supabase Edge runtime |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected by Supabase Edge runtime |

### Set secrets in Supabase

```bash
supabase secrets set UPSTASH_REDIS_REST_URL=https://<your-db>.upstash.io
supabase secrets set UPSTASH_REDIS_REST_TOKEN=<your-token>
```

### Local development

Create `supabase/functions/.env` (gitignored):

```
UPSTASH_REDIS_REST_URL=https://<your-db>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<your-token>
```

Then serve locally:

```bash
supabase functions serve rate-limit-check --env-file supabase/functions/.env
```

## Request / Response

### Request

```json
POST /functions/v1/rate-limit-check
Authorization: Bearer <user-jwt>

{
  "action_type": "create_post",
  "max_requests": 10,
  "window_minutes": 60
}
```

### Success (200)

```json
{
  "allowed": true,
  "current": 3,
  "limit": 10,
  "remaining": 7
}
```

Response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`

### Rate Limited (429)

```json
{
  "allowed": false,
  "message": "Rate limit exceeded",
  "retry_after": 1842,
  "current": 11,
  "limit": 10
}
```

Response headers: `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining: 0`
