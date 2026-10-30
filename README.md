# NCBI Church Management System

A MERN-stack platform for New Church Believers International (NCBI), designed for central oversight and independently managed church branches.

## Stack
- **MongoDB + Mongoose** — persistent data and domain models
- **Express + Node.js** — REST API
- **React + Vite** — responsive web application
- **JWT + bcrypt** — authenticated sessions and password hashing

## Initial foundation
- NCBI-branded executive dashboard
- Configurable organisation hierarchy (international, national, regional, district, branch)
- Role-aware API foundation and branch scoping
- Initial member, attendance and finance data models
- Health endpoint and environment validation

## Requirements
Node.js 20+, npm 10+, and MongoDB 7+ (local or managed).

## Run locally
1. Copy `server/.env.example` to `server/.env` and configure MongoDB and a long random JWT secret.
2. Install dependencies: `npm install`
3. Start both applications: `npm run dev`
4. Web client: http://localhost:5173; API: http://localhost:5000/api/health

The API intentionally has no public user-registration endpoint. Initial system administrators must be provisioned through a controlled administrative process. Never commit real credentials or production secrets.

## Workspace commands
- `npm run dev` — client and API
- `npm run build` — production client build
- `npm run check` — syntax checks

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the implementation plan and security boundaries.
