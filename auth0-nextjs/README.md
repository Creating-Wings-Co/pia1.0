# auth0-nextjs

Next.js (App Router) backend/auth service using Auth0 for authentication and MongoDB for user registration storage.

## Features

- Auth0 login/logout/session support via `@auth0/nextjs-auth0`
- Middleware-protected app routes
- Post-login routing logic:
  - Existing user in MongoDB -> redirect to existing user home URL
  - New user -> redirect to frontend registration page with prefilled query params
- Public registration API (`POST /api/register`) with CORS support
- MongoDB connection helper with global client caching

## Tech Stack

- Next.js 15
- React 19
- TypeScript
- Auth0 Next.js SDK v4
- MongoDB Node.js Driver

## Project Structure

```text
src/
  app/
    api/register/route.ts    # Registration endpoint (public)
    post-login/route.ts      # Existing/new user redirect logic
    page.tsx                 # Demo UI for login state
  components/
    LoginButton.tsx
    LogoutButton.tsx
    Profile.tsx
  lib/
    auth0.ts                 # Auth0 client instance
    mongodb.ts               # MongoDB connection/collections
  middleware.ts              # Auth0 middleware + route matching
```

## Prerequisites

- Node.js 20+
- npm 10+
- Auth0 tenant + application
- MongoDB instance (Atlas or self-hosted)

## Environment Variables

Create `.env.local` in the project root:

```bash
# Auth0 (required by @auth0/nextjs-auth0)
AUTH0_SECRET=replace-with-32-byte-hex-string
APP_BASE_URL=http://localhost:3001
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret

# MongoDB (required by src/lib/mongodb.ts)
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=userDB

# App-specific routing
FRONTEND_BASE_URL=http://localhost:3000
EXISTING_USER_HOME_URL=https://www.creatingwings.org/

# Optional: extra CORS origins for /api/register (comma-separated)
CORS_ALLOWED_ORIGINS=http://localhost:5173,https://your-frontend-domain.com
```

## Auth0 Dashboard Setup

Configure your Auth0 Application URLs:

- Allowed Callback URLs: `http://localhost:3001/auth/callback`
- Allowed Logout URLs: `http://localhost:3001`
- Allowed Web Origins: `http://localhost:3001`

If your frontend runs on a different origin, also configure that where required in Auth0 and `CORS_ALLOWED_ORIGINS`.

## Local Development

```bash
npm install
npm run dev
```

App runs on `http://localhost:3001` (or the port Next picks if 3001 is busy; keep `APP_BASE_URL` aligned).

## Auth Flow

1. User visits app and clicks login (`/auth/login`).
2. Auth0 handles authentication and returns session.
3. Optional post-login decision route: `/post-login`
   - Reads session email
   - Checks `users` collection in MongoDB
   - Redirects:
     - existing user -> `EXISTING_USER_HOME_URL`
     - new user -> `${FRONTEND_BASE_URL}/register?email=...&fullName=...`

To force that path after login, use:

```text
/auth/login?returnTo=/post-login
```

## Registration API

### Endpoint

- `POST /api/register`
- `OPTIONS /api/register` (CORS preflight)

### Request Body

```json
{
  "email": "user@example.com",
  "fullName": "Jane Doe",
  "location": "CA",
  "maritalStatus": "Single",
  "householdIncomeRange": "50k-100k",
  "educationLevel": "Bachelor's",
  "employmentStatus": "Employed",
  "acceptedTerms": true,
  "is18OrOlder": true
}
```

### Required Fields

- `email`
- `location`
- `acceptedTerms: true`
- `is18OrOlder: true`

### Behavior

- Upserts by `email` into `users` collection
- Returns:
  - `200` -> `{ "ok": true, "message": "Registration saved" }`
  - `400` -> validation/invalid JSON errors
  - `500` -> DB connection failures

## Route Protection

`src/middleware.ts` runs Auth0 middleware on nearly all routes except:

- `/_next/static`
- `/_next/image`
- `/api/register`
- `/favicon.ico`
- `/sitemap.xml`
- `/robots.txt`

`/api/register` is intentionally public to accept frontend form submissions.

## Scripts

- `npm run dev` - start development server
- `npm run build` - production build
- `npm run start` - run production server
- `npm run lint` - run ESLint

## Deployment Notes

- Set all environment variables in your host (Vercel, Render, etc.).
- Ensure `APP_BASE_URL` exactly matches deployed origin.
- Update Auth0 allowed URLs for production domain.
- Update `FRONTEND_BASE_URL` and `CORS_ALLOWED_ORIGINS` for production frontend origins.

## Troubleshooting

- `Missing MONGODB_URI` or `Missing MONGODB_DB`: set Mongo vars in `.env.local`.
- Auth redirects failing: verify Auth0 callback/logout/web origin URLs.
- CORS issues on `/api/register`: ensure frontend origin is in `FRONTEND_BASE_URL` or `CORS_ALLOWED_ORIGINS`.
- Session/login issues in production: confirm `APP_BASE_URL` and Auth0 app settings match the exact domain and protocol.
