# EXUN Portal

EXUN Portal is a Next.js application with interactive home, board, lens, map, and profile pages.

## Requirements

- Node.js
- npm

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Available commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Generate Next.js types and run TypeScript checks |
| `npm test` | Run the tests |

## Project structure

- `app/` — Next.js routes and global styles
- `components/` — page and UI components, grouped by feature
- `lib/` — shared application logic and tests
- `scripts/` — asset-building and demo scripts
- `public/` — static assets, when present

Keep these folders in place: the app's routes, imports, and scripts depend on them. The folders are organization, not extra files to upload separately.

## Uploading to GitHub

Upload the project with its folder structure intact. The existing `.gitignore` excludes dependencies, build output, environment files, and local-only assets. Do not upload secrets or private environment files.
