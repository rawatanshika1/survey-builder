# Smart Survey Builder

A full-stack survey builder with two USP features that set it apart from a basic CRUD clone:

1. **Conversational Mode** — respondents can take a survey Typeform-style, one question at a time with animated transitions, instead of only a long classic form.
2. **Drop-off & AI Insights** — tracks exactly which question causes people to abandon a survey, and summarizes open-text answers into themes + sentiment using an LLM.

## Tech Stack

- **Frontend:** React (Vite), React Router, Tailwind CSS, Axios, Framer Motion, Recharts, react-hot-toast
- **Backend:** Node.js, Express.js, Mongoose (MongoDB)
- **Auth:** JWT, bcrypt
- **Database:** MongoDB (local or MongoDB Atlas)
- **AI Insights:** Anthropic API (Claude)

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
- Survey builder: title, description, category, expiration date, 7 question types (short answer, long answer, multiple choice, checkboxes, dropdown, rating, yes/no), drag-free reordering (up/down), Classic vs Conversational mode toggle
- Publish surveys to a shareable public link
- Public survey-taking experience in Classic (all questions at once) or Conversational (Typeform-style, one at a time with animated transitions) mode — no login required for respondents
- Analytics dashboard per survey:
  - **Overview** — response totals, completion rate, average rating, per-question charts
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
| `ANTHROPIC_API_KEY` | Needed only for the AI Insights tab. Without it, that tab shows a clear error but everything else still works. |

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
- [x] Survey builder (CRUD + 7 question types)
- [x] Public survey-taking experience (Classic + Conversational modes)
- [x] Analytics dashboard + Drop-off & AI Insights
- [x] Polish: search/filter, dark mode, toasts, skeleton loaders, deployment prep

## Deployment

**Frontend (Vercel):**
1. Push this repo to GitHub
2. Import the `client/` directory as a Vercel project (Framework preset: Vite)
3. Set the build output directory to `dist`
4. No environment variables needed on the frontend — API calls are proxied via `/api` during local dev; in production, either deploy the backend under the same domain or set `VITE_API_URL` and update `services/api.js`'s `baseURL` accordingly

**Backend (Render or Railway):**
1. Create a new Web Service pointing at the `server/` directory
2. Build command: `npm install`
3. Start command: `npm start`
4. Set environment variables: `MONGO_URI`, `JWT_SECRET`, `PORT`, `ANTHROPIC_API_KEY`

**Database (MongoDB Atlas):**
1. Create a free cluster
2. Whitelist your backend host's IP (or `0.0.0.0/0` for simplicity during development)
3. Copy the connection string into `MONGO_URI`

## Notes on Design Decisions

- Requesting a survey you don't own returns `404` rather than `403` — this avoids leaking which survey IDs exist to unauthorized users, a standard security practice.
- AI insights are cached on the `Survey` document (`insightsCache`) and only regenerated when the user explicitly clicks "Refresh/Generate Insights," to avoid unnecessary LLM API calls and cost.
