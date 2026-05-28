# Meet

A 1-on-1 Next.js video room app that uses WebRTC for media, Ably for serverless signaling, and coturn-style REST credentials for TURN.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Required environment variables:

- `ABLY_API_KEY`
- `INVITE_SIGNING_SECRET`
- `TURN_URLS`
- `TURN_SHARED_SECRET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Optional:

- `STUN_URLS`

`INVITE_SIGNING_SECRET` should be a long random value. It signs room invite URLs for 24 hours. `TURN_SHARED_SECRET` must match your TURN server's static auth secret. The browser receives only short-lived generated TURN credentials, never the shared secret.

Rooms must be created through `/api/rooms`. The app returns invite links like `/room/{roomId}?token={signedInviteToken}`. `/api/ably-token` and `/api/ice` reject requests without a valid token.

Upstash Redis is used for serverless rate limiting:

- `/api/rooms`: 10 requests per minute per IP.
- `/api/ably-token`: 30 requests per minute per IP and room.
- `/api/ice`: 20 requests per minute per IP and room.

## Ably setup

Create an Ably Pub/Sub app and use an API key that allows these capabilities:

```json
{
  "room:*": ["publish", "subscribe", "presence"]
}
```

The app issues short-lived client tokens scoped to a single room channel, such as `room:eceef22f-bf5c-429c-b87c-c01b3712f928`. If Ably shows `lacking the required 'presence' capability`, edit the API key capabilities in the Ably dashboard or create a new key with `presence` enabled.

## Scripts

```bash
npm run dev
npm run lint
npm run test
npm run build
npm run check
```
