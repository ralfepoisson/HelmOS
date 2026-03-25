# HelmOS Webapp

This Angular application is the founder-facing HelmOS product surface.

## Local development

Start the frontend:

```bash
cd src/webapp
npm start
```

The dev server runs on `http://127.0.0.1:4200/` by default.

### Dev proxy

Angular dev proxying is enabled through [proxy.conf.json](/Users/ralfe/Dev/HelmOS/src/webapp/proxy.conf.json).

Local routes are forwarded like this:

- `/api` -> Node control-plane API on `http://127.0.0.1:3001`
- `/api/v1` -> FastAPI Agent Gateway on `http://127.0.0.1:8000`

This keeps frontend code on same-origin paths during local work, avoids browser CORS issues, and removes the need for the ideation screen to depend on dev-server HTML fallback behavior.

## Typical full-stack local setup

Run these services together when testing the ideation agent end to end:

1. Node control plane on `3001`
2. FastAPI Agent Gateway on `8000`
3. LiteLLM proxy on `4000`
4. Angular webapp on `4200`

With that stack up, the ideation workspace can create agent runs through `/api/v1/runs` and still load business-idea workspace data through `/api`.

## Build and test

Build the app:

```bash
ng build
```

Type-check the app:

```bash
./node_modules/.bin/tsc -p tsconfig.app.json --noEmit
```

Run unit tests:

```bash
ng test
```

Run Playwright UI tests:

```bash
npm run ui:test
```
