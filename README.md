# Ham Radio Toolbox

PWA local-first e offline-first per radioamatori e SWL, pensata per tablet Android e utilizzabile da browser desktop: logbook HAM e SWL, explorer di frequenze, segnali, satelliti, APRS e ripetitori, calcolatori RF, propagazione, QSL, risorse e backup.

> **Stato**: versione **0.1.0**. Milestone **M0** chiusa e **M1 — Fondamenta PWA e dashboard** approvata per la chiusura il 2026-10-17: PWA installabile e offline, dashboard, navigazione dei 14 moduli, CI su GitHub Actions, deploy Cloudflare Pages verificato sulla preview, `main` protetto. Rilascio in produzione e tag `v0.1.0` in corso ([ROADMAP § 6](docs/roadmap/ROADMAP.md#6-checklist-di-completamento-m1)). **M2 (persistenza IndexedDB) in corso**: core domain, database Dexie v1, repository, import, backup e restore approvati; il Blocco D (pagina Impostazioni e backup, in attesa di approvazione) aggiunge profili stazione, tema e preferiti persistenti, stato dello storage, backup scaricabile e ripristino con anteprima. Gli altri 12 moduli mostrano la pagina "In sviluppo" con la milestone prevista.

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
npm run dev            # dev server
npm run build          # typecheck + build di produzione
npm run check:dist     # controlli sulla build (404.html, header, segreti)
npm run preview        # anteprima della build (vite preview)
npm run preview:pages  # anteprima con l'emulatore di Cloudflare Pages (header e fallback SPA reali)
npm run typecheck      # vue-tsc
npm run lint           # ESLint (regole di layer e confini fra moduli)
npm run format         # Prettier (scrive)
npm run format:check   # Prettier (solo verifica, come in CI)
npm run test           # Vitest (unit + integrazione)
npm run test:e2e       # Playwright sulla build di produzione
```

Per gli E2E su Linux/WSL2 servono il browser e le librerie di sistema: `npx playwright install chromium` e `sudo npx playwright install-deps chromium`. Elenco completo degli script in [CLAUDE.md](CLAUDE.md#comandi).

## CI e deploy

Ogni pull request verso `main` e ogni push su `main` eseguono la pipeline GitHub Actions (`quality`: audit, typecheck, lint, format, unit; `e2e`: build, controlli sulla build, Playwright). Il deploy su Cloudflare Pages (Direct Upload, [ADR-0011](docs/adr/0011-static-hosting-and-routing.md)) parte solo dopo i test verdi e solo quando il maintainer lo abilita. Produzione da `main`, preview dalle PR. Configurazione, header HTTP e procedure operative in [ARCHITECTURE.md § 12](docs/architecture/ARCHITECTURE.md#12-qualità-test-e-ci).

## Installazione e uso offline

L'app è una PWA: si installa dal browser, senza store.

- **Android (Chrome)**: apri l'URL dell'app in HTTPS, attendi l'avviso "App pronta per l'uso offline", poi menu ⋮ → _Installa app_. L'app si avvia dall'icona a schermo intero.
- **Offline**: dopo la prima visita completa, dashboard e pagine di tutti i moduli si aprono senza rete, anche da link diretto o dopo una ricarica. L'indicatore nell'intestazione mostra lo stato della connessione.
- **Aggiornamenti**: quando è pubblicata una nuova versione compare l'avviso "Nuova versione disponibile". _Aggiorna_ ricarica l'app sulla nuova versione, _Più tardi_ la rimanda al prossimo avvio. L'aggiornamento non tocca i dati salvati sul dispositivo.

Strategie di cache, limitazioni e collaudo manuale su tablet: [ARCHITECTURE.md § 8](docs/architecture/ARCHITECTURE.md#8-pwa-service-worker-e-strategia-offline).

Per provare in locale la PWA serve la build di produzione: `npm run build && npm run preview`, poi `http://localhost:4173`. Il dev server (`npm run dev`) non registra il service worker. Strumenti per sviluppatori → _Application_ → _Service workers_ permette di simulare l'offline.

## Dati sul dispositivo e backup

I dati (profili, preferenze, in futuro i logbook) restano **solo su questo dispositivo**, in IndexedDB: nessun server li riceve. In _Impostazioni e backup_:

- **Archiviazione**: stato del database, spazio usato e quota (stime del browser, non garanzie), archiviazione persistente con richiesta esplicita.
- **Backup**: un file JSON (`hrt-backup-AAAAMMGG-HHMMZ.json`), allegati solo su richiesta, scaricabile dopo la verifica. Limite di un file: 100 MiB. Il file non è cifrato; le impronte SHA-256 rilevano file danneggiati ma non sono una firma digitale.
- **Ripristino**: analisi senza modifiche, anteprima per tabella, modalità _Sostituisci_ o _Unisci_, conferma esplicita; l'operazione è atomica e, una volta avviata, non si interrompe.

Esporta un backup periodicamente e conservalo fuori dal dispositivo. Dettagli in [DATABASE.md § 9–10](docs/architecture/DATABASE.md#9-backup-e-restore).

## Vincoli principali

Nessun backend obbligatorio, nessun hardware in v1, nessuna chiave API nel frontend, nessuno scraping: le fonti non accessibili dal browser si usano tramite import manuale o link esterni.
