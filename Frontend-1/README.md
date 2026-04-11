# Frontend-1

React frontend for Creating Wings authentication and registration, integrated with an Auth0-enabled Next.js backend.

## Features

- Login screen with Google/Auth0 sign-in button
- Redirects to backend Auth0 route (`/auth/login`) with post-login return target
- Registration form for new users
- Prefills `email` and `fullName` from URL query params after Auth0 login
- Terms and conditions modal sourced from a local text asset
- Client-side validation for:
  - terms acceptance
  - age confirmation (18+)
  - location format (`City, State`)
- Submits profile data to backend registration API (`POST /api/register`)

## Tech Stack

- React 19
- React Router v6
- Create React App (react-scripts 5)

## Project Structure

```text
src/
  App.js                       # Router and page routes
  components/
    Login.js                   # Login UI + Auth0 redirect
    Registration.js            # Registration form + API submit
    withRouter.js              # Class component router helper
  utils/
    validators.js              # Form validation helpers
    api.js                     # Generic register helper (not primary flow)
  assets/
    terms.txt                  # Terms & conditions content
```

## App Routes

- `/` -> Login page
- `/login` -> Login page
- `/register` -> Registration page

## Environment Variables

Create `.env` (or `.env.local`) in this project root:

```bash
REACT_APP_AUTH_BACKEND_URL=http://localhost:3001
```

Notes:
- `REACT_APP_AUTH_BACKEND_URL` must point to your backend (the `auth0-nextjs` app).
- After changing env vars, restart the dev server.

## Backend Contract

This frontend expects the backend to provide:

- `GET /auth/login`
  - used by the login button
  - current flow calls:
    - `/auth/login?connection=google-oauth2&returnTo=/post-login`
- `GET /post-login`
  - backend decides whether user is existing/new and redirects accordingly
- `POST /api/register`
  - receives registration JSON and stores/upserts the user

### Registration Payload Sent

```json
{
  "email": "user@example.com",
  "fullName": "Jane Doe",
  "location": "Los Angeles, CA",
  "maritalStatus": "Single",
  "householdIncomeRange": "$50,000-$74,999",
  "educationLevel": "Bachelor's Degree",
  "employmentStatus": "Employed full-time",
  "acceptedTerms": true,
  "is18OrOlder": true
}
```

## Local Development

```bash
npm install
npm start
```

Runs at `http://localhost:3000`.

## Login and Registration Flow

1. User opens login page and clicks `Continue with Google`.
2. Browser is redirected to `${REACT_APP_AUTH_BACKEND_URL}/auth/login?...`.
3. Backend/Auth0 authenticates user.
4. Backend `/post-login` redirects:
   - existing user -> home site
   - new user -> frontend `/register?email=...&fullName=...`
5. Registration page submits profile data to `${REACT_APP_AUTH_BACKEND_URL}/api/register`.
6. On success, user is redirected to `https://www.creatingwings.org/`.

## Validation Rules

- Age checkbox must be checked (`I confirm I am 18 or older`)
- Terms checkbox must be checked
- Location must match `City, State`
- Email is read-only and expected from Auth0 redirect query params

## Available Scripts

- `npm start` - runs development server
- `npm test` - runs tests
- `npm run build` - creates production build in `build/`
- `npm run eject` - ejects CRA config (irreversible)

## Deployment Notes

- Set `REACT_APP_AUTH_BACKEND_URL` to your deployed backend URL.
- Ensure backend CORS allows this frontend origin for `/api/register`.
- Ensure Auth0 app settings include correct callback/logout/web origins via backend config.
- If deploying under a subpath/domain, verify static assets like `/logo.png` resolve correctly.

## Troubleshooting

- Login button does nothing or redirects incorrectly:
  - confirm `REACT_APP_AUTH_BACKEND_URL` is set and dev server restarted.
- Registration fails with network/CORS errors:
  - confirm backend is running and CORS includes frontend origin.
- Registration page not prefilled:
  - verify backend redirects with `email` and `fullName` query params.
