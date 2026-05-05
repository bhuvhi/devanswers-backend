# DevAnswers Backend Agent Guide

## Purpose
This repository is a Node.js + Express 5 + MongoDB backend for a Q&A platform.
Use this file to quickly align with current architecture, conventions, and testing workflow.

## Run And Test
- Install deps: `npm install`
- Start dev server: `npm run dev`
- Start production-style server: `npm start`
- Run tests: `npm test`
- Seed database: `npm run populate`

## Required Environment Variables
Defined through `.env` and loaded in `main.js`.
- `MONGODB_URI`
- `JWT_SECRET`
- `JWT_EXPIRATION`
- `PORT` (optional, defaults to `3000`)
- `NODE_ENV` (set to `development` to include stack traces in API errors)

## Request Flow And Boundaries
- Entry point: `main.js` -> `connectToDB()` -> `startServer()`.
- HTTP app setup: `src/app.js`.
- API base path: `/api` via `src/routes/index.js`.
- Controller layer in `src/controllers/` should delegate business logic to `src/services/`.
- Service layer performs DB operations and throws app errors.
- Shared API errors should be created with `createAppError()` from `src/utils/createAppError.js`.
- Global error JSON response is handled by `src/middleware/errorHandler.js`.

## Current API Surface (Important)
Mounted routes in `src/routes/index.js`:
- `/api/auth/*` from `src/routes/auth.js`
- `/api/tags/*` from `src/routes/tags.js`
- `/api/questions/*` from `src/routes/questions.js`
- `/api/answers/*` from `src/routes/answers.js`

Implemented question endpoints include list/get/create/update/delete and vote operations.
Implemented answer endpoints include create/list-by-question/update/delete and vote operations.
Route param naming currently uses `:id` for question routes and `:answerId` for answer routes.

## Auth And Error Conventions
- Auth middleware: `src/middleware/authHandler.js` expects `Authorization: Bearer <token>`.
- JWT payload includes `id` and `isAdmin`.
- `req.user` shape after auth: `{ id, isAdmin }`.
- Async controllers/services rely on Express 5 async error propagation; avoid swallowing thrown errors.

## Data Model Notes
- `Question` references tags with `tags` and author with `author`.
- `Answer` references question via `questionId` and user via `author`.
- Vote updates are centralized in `src/services/voteService.js` and depend on `upvotes`, `downvotes`, `voteCount` fields.

## Testing Notes
- Test runner: Vitest (`vitest.config.js`).
- Test DB uses `mongodb-memory-server` in `tests/setup.js`.
- Current global setup clears `Question` and `Answer` collections before/after test run.
- Existing tests also clear `User` and `Tag` in `beforeEach` for isolation:
  - `tests/unit/services/questionService.test.js`
  - `tests/integration/questions.test.js`
- For features touching `User` or `Tag`, keep cleanup explicit at suite level.

## Existing Custom Agent
- Question testing specialist agent:
  - `.github/agents/backend-testing-agent.agent.md`
- Answer testing specialist agent:
  - `.github/agents/answer-testing-agent.agent.md`

## Change Checklist For Agents
- Keep controller/service separation.
- Use `createAppError()` for expected client/business errors.
- Preserve response envelope pattern:
  - success responses: `{ success: true, message, data }`
  - error responses: `{ success: false, message, ... }`
- When adding new endpoints, update route mounting in `src/routes/index.js` and add/adjust tests in `tests/`.