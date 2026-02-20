# QA Resource Planning Tool

A 12-week day-level roster for QA resource planning with risk tracking, Gantt timeline, and scenario management.

## Run Instructions

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

### Build for production

```bash
npm run build
npm run preview
```

## Screens

- **Roster** (default): Day-level grid showing all people and their allocations across 12 weeks. Click any cell to open the side panel with details.
- **Dashboard**: Risk summary for the next 2 weeks and a Gantt-style timeline grouped by pod.
- **Edit Plan**: Bulk assignment form and quick actions (clear allocations, duplicate scenario).
- **Work Items**: CRUD management of work items.

## Data

All data is stored locally in IndexedDB via Dexie. Seed data is generated on first load. Use the Export/Import JSON buttons in the toolbar to back up or restore data.

## Tech Stack

- React + Vite + TypeScript
- Zustand (state management)
- Dexie (IndexedDB)
- date-fns (date utilities)
- Plain CSS (no UI framework)
