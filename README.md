# TrackMacros

A macro tracker that runs as an installable web app. Log meals, save the ones you eat often, and track
calories, protein, carbs, fats and added sugar against daily goals.

Live at https://trackmacros.theabhayperspective.com

## Stack

- React, TypeScript and Vite
- Tailwind CSS for styling, with light and dark themes defined in `src/index.css`
- Dexie (IndexedDB) for on-device storage; no data leaves the device
- `vite-plugin-pwa` for install and offline support

## Develop

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

## Layout

- `src/db.ts`: database tables and all write operations
- `src/hooks.ts`: live queries, the current day, and the theme preference
- `src/lib/`: date and macro helpers, with tests
- `src/components/`: shared UI (summary ring, week strip, sheets, forms, navigation)
- `src/screens/`: Today, Trends, Meals and Profile
