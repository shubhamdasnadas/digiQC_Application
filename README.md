<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/35b2f5b0-c11f-4b9c-8e35-67242c0be883

## Run Locally

**Prerequisites:**  Node.js

The app is split into two independent projects, each with its own `package.json` and dependencies. Run each in its own terminal.

1. Backend (API server, port 3000):
   ```
   cd backend
   npm install
   npm run dev
   ```
2. Frontend (Vite dev server, port 5173, proxies `/api` to the backend):
   ```
   cd frontend
   npm install
   npm run dev
   ```
3. Open http://localhost:5173
