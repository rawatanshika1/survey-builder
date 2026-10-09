# AskFlow

A full-stack survey builder with two USP features that set it apart from a basic CRUD clone:

1. **Conversational Mode** — respondents can take a survey Typeform-style, one question at a time with animated transitions, instead of only a long classic form.
2. **Drop-off & AI Insights** — tracks exactly which question causes people to abandon a survey, and summarizes open-text answers into themes + sentiment using an LLM.

## Tech Stack

- **Frontend:** React (Vite), React Router, Tailwind CSS, Axios, Framer Motion, Recharts, react-hot-toast
- **Backend:** Node.js, Express.js, Mongoose (MongoDB)
- **Auth:** JWT, bcrypt
- **Database:** MongoDB (local or MongoDB Atlas)
- **AI Insights:** Google Gemini API 

## Project Structure

```
survey-builder/
├── client/                    React app (Vite)
│   ├── src/
│   │   ├── components/
│   │   │   └── analytics/     Overview / Drop-off / Insights / Raw Responses tabs
│   │   ├── context/           AuthContext
│   │   ├── pages/
│   │   ├── services/          API call wrappers
│   │   ├── App.jsx
│   │   └── main.jsx
├── server/                    Express API
│   ├── config/                MongoDB connection
│   ├── controllers/
│   ├── middleware/             JWT auth middleware
│   ├── models/                 User, Survey, Response
│   ├── routes/
│   ├── utils/                  slug generator, LLM insights helper
│   └── server.js
└── README.md
```

## Features

- Register / login (JWT + bcrypt), protected routes
- Survey builder: title, description, category, expiration date, 9 question types (short answer, long answer, multiple choice, checkboxes, dropdown, rating, number, yes/no, NPS), conditional branching, drag-free reordering (up/down), Classic vs Conversational mode toggle
- Publish surveys to a shareable public link
- Public survey-taking experience in Classic (all questions at once) or Conversational (Typeform-style, one at a time with animated transitions) mode — no login required for respondents
- Analytics dashboard per survey:
  - **Overview** — response totals, completion rate, average rating, per-question charts, and per-question NPS score and promoter/passive/detractor breakdowns
  - **Drop-off Funnel** — shows exactly which question causes the most abandonment
  - **AI Insights** — auto-generated themes, sentiment breakdown, and example quotes for open-text answers
  - **Raw Responses** — paginated table + CSV export
- Dashboard search/filter (title, category, status) and sort
- Dark mode (persisted, no flash-of-wrong-theme on load)
- Toast notifications for all success/error states
- Ownership protection — surveys are always scoped to their creator; other users' data is never exposed

## Setup

### 1. Install dependencies

```bash
npm run install:all
```

### 2. Configure environment variables

```bash
cp server/.env.example server/.env
```

Required variables in `server/.env`:

| Variable | Description |
|---|---|
| `MONGO_URI` | Local MongoDB URI or MongoDB Atlas connection string |
| `JWT_SECRET` | Any long random string, used to sign auth tokens |
| `PORT` | Backend port (defaults to 5000) |
| `GEMINI_API_KEY` | Needed only for the AI Insights tab. Without it, that tab shows a clear error but everything else still works. |
| `SMTP_HOST` | Optional SMTP hostname for survey email distribution. |
| `SMTP_PORT` | SMTP port (typically `587` with STARTTLS or `465` with implicit TLS). |
| `SMTP_SECURE` | Set to `true` for implicit TLS (typically port 465); otherwise use STARTTLS when supported. |
| `SMTP_USER` / `SMTP_PASS` | SMTP authentication credentials. Never commit these values. |
| `EMAIL_FROM` | Verified sender address/name, for example `Surveys <surveys@example.com>`. |
| `APP_BASE_URL` | Public frontend origin used to construct survey links, for example `https://surveys.example.com`. |
| `EMAIL_PUBLIC_API_URL` | Optional public backend API origin for tracking endpoints. Defaults to `${APP_BASE_URL}/api`. |
| `DISTRIBUTION_TOKEN_SECRET` | Optional separate secret for deterministic per-recipient tracking tokens; defaults to `JWT_SECRET`. |

Email delivery is synchronous because the app does not currently have a background-job queue. “Sent” means accepted by the configured SMTP server; delivery status is not available without a provider webhook. Open tracking uses a pixel and is approximate due to email-client blocking and prefetching. Clicks and completed responses are recorded by the server. The ordinary `/survey/:slug` public share link remains available.

## Developer API

Workspace owners and editors can manage keys from **Developer / API** in the app. A key is generated once, shown only at creation, and stored as a SHA-256 hash. Keys are tied to the creator and a workspace; workspace membership is revalidated for every request. Only read scopes are currently available:

- `READ_SURVEYS` — list surveys and view survey/question details.
- `READ_RESPONSES` — list completed responses for a survey.

Keep API keys in a trusted server-side secret store. Do not commit keys or ship them in browser/mobile clients. Revoke compromised or unused keys in the developer dashboard.

### Key management (existing JWT authentication)

| Method | Endpoint | Access |
|---|---|---|
| `GET` | `/api/developer/workspaces/:workspaceId/keys` | Workspace members; lists metadata only, never the full key |
| `POST` | `/api/developer/workspaces/:workspaceId/keys` | Owner/editor; JSON body: `{"name":"Warehouse sync","scopes":["READ_SURVEYS"]}`; returns the complete key once |
| `DELETE` | `/api/developer/workspaces/:workspaceId/keys/:keyId` | Owner; editor may revoke keys they created |
| `GET` | `/api/developer/workspaces/:workspaceId/usage` | Workspace members; aggregate request counts and last-used time |

Management endpoints use the app's existing JWT bearer authentication. Key creation accepts one or both supported scopes; no create, edit, delete, distribution, or workspace-management operation is available through the public API.

### Version 1 endpoints (API key authentication)

Set `Authorization: Bearer YOUR_API_KEY` and `Accept: application/json` on every `/api/v1` request.

| Method | Endpoint | Required scope | Parameters |
|---|---|---|---|
| `GET` | `/api/v1/surveys` | `READ_SURVEYS` | `page` (1-1000, default 1), `limit` (1-100, default 50) |
| `GET` | `/api/v1/surveys/:surveyId` | `READ_SURVEYS` | `surveyId` MongoDB ObjectId |
| `GET` | `/api/v1/surveys/:surveyId/responses` | `READ_RESPONSES` | `surveyId`; optional `page` and `limit` as above |

Successful responses use `{"success":true,"data":...,"error":null}`. Errors use `{"success":false,"data":null,"error":{"code":"...","message":"..."}}` and HTTP 400 (invalid input), 401 (invalid/revoked key), 403 (scope or membership), 404 (not in the key's workspace), 429 (rate limit), or 500. Responses contain only completed surveys' response data and omit respondent identity/recipient records.

Each API key is limited to 120 requests per minute. Usage counters track authenticated requests within the rate limit, including insufficient-scope requests. The limiter is in-memory per server process, so multi-instance deployments should place a shared API gateway/distributed limiter in front of the service.

### 3. Run the app

```bash
npm run dev
```

- Backend: **http://localhost:5000**
- Frontend: **http://localhost:5173**

Verify with `http://localhost:5000/api/health` → `{ "status": "ok" }`.

## Roadmap (all complete)

- [x] Project scaffolding
- [x] Authentication (register/login/JWT)
- [x] Survey builder (CRUD + 9 question types, including NPS and conditional branching)
- [x] Public survey-taking experience (Classic + Conversational modes)
- [x] Workspace collaboration and role-based access control
- [x] Survey email distribution with private recipients and response attribution
- [x] Workspace-scoped developer API keys and versioned read-only API
- [x] Analytics dashboard + Drop-off & AI Insights
- [x] Polish: search/filter, dark mode, toasts, skeleton loaders, deployment prep

## Deployment

**Frontend (Vercel):**
1. Push this repo to GitHub
2. Import the `client/` directory as a Vercel project (Framework preset: Vite)
3. Set the build command to `npm run build` and the output directory to `dist`
4. In the Vercel project settings, add `VITE_API_URL` with the Render backend URL ending in `/api` (for example, `https://your-service.onrender.com/api`), then redeploy. This is required because the `/api` proxy in `vite.config.js` is only for local development.
5. `client/vercel.json` rewrites frontend routes to `index.html`, so a shared survey URL such as `/survey/<slug>` works when opened directly or refreshed.

**Backend (Render or Railway):**
1. Create a new Web Service pointing at the `server/` directory
2. Build command: `npm install`
3. Start command: `npm start`
4. Set environment variables: `MONGO_URI`, `JWT_SECRET`, `PORT`, `GEMINI_API_KEY`

**Database (MongoDB Atlas):**
1. Create a free cluster
2. Whitelist your backend host's IP (or `0.0.0.0/0` for simplicity during development)
3. Copy the connection string into `MONGO_URI`

## Notes on Design Decisions

- Requesting a survey you don't own returns `404` rather than `403` — this avoids leaking which survey IDs exist to unauthorized users, a standard security practice.
- AI insights are cached on the `Survey` document (`insightsCache`) and only regenerated when the user explicitly clicks "Refresh/Generate Insights," to avoid unnecessary LLM API calls and cost.
