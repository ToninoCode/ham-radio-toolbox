# Ham Radio Toolbox

PWA local-first e offline-first per radioamatori e SWL, pensata per tablet Android e utilizzabile da browser desktop: logbook HAM e SWL, explorer di frequenze, segnali, satelliti, APRS e ripetitori, calcolatori RF, propagazione, QSL, risorse e backup.

> **Stato**: Milestone **M0 — Analisi e progettazione** chiusa il 2026-10-17; prossima milestone **M1** (fondamenta PWA). Le funzionalità non sono ancora implementate: `src/` contiene solo lo scaffold iniziale di Vite, che verrà sostituito in M1.

## Documentazione

| Documento                                                              | Contenuto                                                        |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [docs/PROJECT.md](docs/PROJECT.md)                                     | Perimetro funzionale e obiettivi (riferimento primario)          |
| [docs/requirements/REQUIREMENTS.md](docs/requirements/REQUIREMENTS.md) | Requisiti funzionali e non funzionali, casi d'uso                |
| [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) | Architettura, struttura del codice, verifica di coerenza         |
| [docs/architecture/DATABASE.md](docs/architecture/DATABASE.md)         | Modello dati, schema IndexedDB/Dexie, import, backup             |
| [docs/data-sources/SOURCES.md](docs/data-sources/SOURCES.md)           | Fonti dati esterne: endpoint, CORS, licenze, modalità di accesso |
| [docs/roadmap/ROADMAP.md](docs/roadmap/ROADMAP.md)                     | Milestone, dipendenze, backlog                                   |
| [docs/adr/](docs/adr/README.md)                                        | Architecture Decision Records                                    |
| [CLAUDE.md](CLAUDE.md)                                                 | Vincoli e convenzioni di sviluppo                                |

## Stack

Vue 3 · TypeScript strict · Vite · Vue Router · Pinia · Tailwind CSS · IndexedDB/Dexie.js · Zod · Workbox (vite-plugin-pwa) · Leaflet/OpenStreetMap · satellite.js · Vitest · Playwright · ESLint/Prettier · GitHub Actions · Cloudflare Pages.

## Sviluppo

Ambiente: Linux / WSL2, Node.js 22.

```bash
npm install
npm run dev       # dev server
npm run build     # build di produzione
npm run preview   # anteprima della build
```

Gli script di typecheck, lint, format e test verranno aggiunti in M1 (vedi [CLAUDE.md](CLAUDE.md#comandi)).

## Vincoli principali

Nessun backend obbligatorio, nessun hardware in v1, nessuna chiave API nel frontend, nessuno scraping: le fonti non accessibili dal browser si usano tramite import manuale o link esterni.
