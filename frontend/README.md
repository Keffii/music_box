# Music Box web player

React + TypeScript (Create React App). In Docker, nginx serves the build and proxies `/api` and
`/media` to the backend ([nginx.conf](nginx.conf)). The [main README](../README.md) covers running
the whole stack.

```bash
npm install
npm start        # http://localhost:3000; the dev server proxies API calls to http://localhost:8080
npm test
npm run build    # CI=true npm run build treats lint warnings as errors
```

The app calls the API on its own origin. To point it at a backend somewhere else, set
`REACT_APP_API_BASE` (see `.env.example`).
