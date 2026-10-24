# CLAUDE.md — Ham Radio Toolbox

Istruzioni per Claude Code su questo repository. Leggile all'inizio di ogni sessione.

## Il progetto

**Ham Radio Toolbox** è una PWA local-first, installabile su tablet Android (e usabile da browser desktop), che fa da "cassetta degli attrezzi" per radioamatori e SWL: logbook HAM e SWL, explorer di frequenze, segnali, satelliti, APRS e ripetitori, calcolatori RF, propagazione, QSL, risorse e backup.

Il tuo ruolo è quello di **Technical Lead / Senior Full-Stack / Architect / DevOps**: guidi lo sviluppo reale, milestone per milestone, con codice completo e verificabile.

## Vincoli non negoziabili

- **Local-first, nessun backend obbligatorio.** Tutto deve funzionare senza server nostro.
- **Offline-first**: logbook, calcolatori, documenti e dati già scaricati funzionano senza rete.
- **Nessun hardware nella v1**: niente CAT, gateway radio, Raspberry Pi, seriale/USB verso gli apparati.
- **Predisposizione futura** a backend e controllo apparati senza riscrivere il frontend → passa sempre da interfacce (port) nel layer application/domain.
- **Nessuna chiave API segreta nel frontend.** Mai.
- **Nessun endpoint inventato e nessuno scraping non autorizzato.** Se un'integrazione non è verificata (API, CORS, licenza, auth), si ripiega su import manuale o link esterno.
- **Nessun dato dimostrativo presentato come live.** Dati di esempio/fixture devono essere chiaramente etichettati.
- Ascolto aeronautico, marittimo e utility: rispettare normativa e riservatezza (niente funzioni che incoraggino la divulgazione di contenuti di comunicazioni private).
- Non cambiare stack o perimetro senza spiegare e motivare la necessità (e registrare un ADR).

## Stack

Vue 3 (Composition API, `<script setup lang="ts">`) · TypeScript **strict** · Vite · Vue Router · Pinia · Tailwind CSS · IndexedDB + Dexie.js · Workbox / Service Worker · Zod · Leaflet + OpenStreetMap · satellite.js (SGP4) · Vitest · Playwright · ESLint + Prettier · GitHub Actions · **Cloudflare Pages** (hosting statico HTTPS, Direct Upload da GitHub Actions, routing SPA in history mode — ADR-0011).

i18n: catalogo **tipizzato interno** in `src/shared/i18n/` + API `Intl`, nessuna libreria esterna (ADR-0008).

Non introdurre nuove dipendenze runtime senza motivarlo; preferisci soluzioni leggere e tree-shakeable (il target è un tablet).

## Architettura

Architettura modulare a layer, organizzata per **feature module**. Le dipendenze puntano solo verso l'interno:

```
presentation  →  application  →  domain
                      ↑
infrastructure / providers (implementano le interfacce definite in application/domain)
```

- **domain**: entità, value object, regole pure (es. calcolo banda da frequenza, Maidenhead, validazioni RST/SINPO). Nessuna dipendenza da Vue, Dexie, fetch o browser API.
- **application**: casi d'uso, interfacce di repository e provider (port), orchestrazione import/export.
- **infrastructure**: Dexie (DB, repository, migrazioni), service worker, storage, file system API.
- **providers**: adapter verso fonti esterne (EiBi, HFCC, CelesTrak, SatNOGS, HamQSL…). Ognuno dichiara capacità, licenza, CORS e fallback.
- **presentation**: componenti Vue, viste, store Pinia (gli store chiamano casi d'uso, non Dexie direttamente).

Struttura del repository (confermata in M0, dettagli in `docs/architecture/ARCHITECTURE.md` §4; aggiornare qui se cambia):

```
src/
  app/                 # composition root: bootstrap, container DI, router, layout, pwa/ (registrazione SW)
  shared/              # ui components, utils, i18n, types comuni, application/ (porte comuni: errori di persistenza, UnitOfWork, Clock…)
  core/                # domain condiviso: frequency, locator, time, callsign, reports, validation (zod), attachment, import-job, data-source
  modules/
    dashboard/
    ham-logbook/       # ognuno con domain/ application/ infrastructure/ presentation/
    swl-logbook/
    frequency-explorer/
    signal-explorer/
    satellite-explorer/
    resource-manager/
    dx-cluster/
    qsl-manager/
    aprs-explorer/
    repeater-explorer/
    rf-calculators/
    propagation/
    settings-backup/
  infrastructure/
    db/                # AppDatabase, versioni di schema, migrazioni pure, UnitOfWork, integrità, repository condivisi
    providers/         # http client, registry, adapter fonti esterne
    files/             # lettura/salvataggio file, hashing, limiti
    system/            # orologio e generatore di UUID (adattatori di Clock e IdGenerator)
    workers/           # Web Worker (parsing grandi file, passaggi satellitari)
public/
  _headers             # header HTTP Cloudflare Pages (CSP, sicurezza, cache)
  favicon.svg, icons/  # icone PWA (generate con npm run icons)
scripts/               # script di sviluppo (icone, controlli sulla build)
eslint/                # regole ESLint locali (confini fra moduli)
.github/               # workflow CI/CD, Dependabot, ruleset di main
tests/
  integration/         # repository Dexie con fake-indexeddb (db/), container, test delle regole ESLint
  cloudflare/          # hosting: header, fallback SPA, CSP (emulatore Pages o deploy reale)
  support/             # setup Vitest e helper di mount
  e2e/                 # Playwright
  fixtures/            # file di test ridotti e anonimizzati
docs/                  # struttura decisa in ADR-0002
  PROJECT.md           # perimetro e obiettivi (riferimento primario)
  requirements/REQUIREMENTS.md   # requisiti, casi d'uso
  architecture/ARCHITECTURE.md   # architettura, verifica di coerenza
  architecture/DATABASE.md       # modello dati, schema Dexie, backup
  data-sources/SOURCES.md        # stato verifica di ogni fonte esterna
  roadmap/ROADMAP.md             # milestone e backlog
  adr/                 # Architecture Decision Records (NNNN-titolo.md)
  references/          # materiale personale, non versionato
```

I test unitari stanno accanto ai sorgenti (`*.spec.ts`).

## Convenzioni di dati (obbligatorie)

- **ID**: UUID v4 (`crypto.randomUUID()`).
- **Frequenze**: sempre in **Hz**, come `number` intero. Conversioni (kHz/MHz) solo in presentation.
- **Date/ore**: **UTC, ISO 8601** (`2026-10-17T13:21:00Z`). Mai ora locale nei dati persistiti. L'UI mostra UTC per default nei logbook.
- **Coordinate**: WGS84, gradi decimali (`lat`, `lon`).
- **Locator**: Maidenhead, validato e normalizzato in maiuscolo/minuscolo standard (`JN45dl`).
- **Nominativi**: normalizzati in maiuscolo, validati con Zod.
- Ogni entità persistita ha uno **schema Zod** e un tipo derivato (`z.infer`). Valida in ingresso (form, import, restore) prima di scrivere su IndexedDB.
- Dati importati da fonti esterne conservano **fonte, versione/stagione, data di import** e, dove previsto, il dato originale.

## Database (Dexie / IndexedDB)

- Tabelle in `snake_case` come da specifica (`qso_logs`, `swl_receptions`, `orbital_elements`, …); campi TypeScript in `camelCase` mappati coerentemente (scegli una convenzione in M2 e documentala in un ADR).
- Ogni modifica di schema = **nuova versione Dexie con migrazione** esplicita e testata. Mai modificare una versione già rilasciata.
- Le relazioni sono applicative: l'integrità (cascate, orfani) è gestita nei repository e coperta da test.
- **Importazioni atomiche**: usa transazioni Dexie; flusso standard = parse → validazione → anteprima → report errori → commit unico. Un import fallito non lascia dati parziali.
- Il backup JSON è **versionato** (campo `schemaVersion`) e il restore gestisce versioni precedenti.

## Fonti esterne

Prima di implementare qualsiasi integrazione, verifica e documenta in `docs/data-sources/SOURCES.md`: endpoint reale, formato, CORS, licenza/termini, autenticazione, rate limit, fallback.

Regole:

- Se il browser non può accedere direttamente (CORS, auth, ToS) → **import manuale** (file CSV/ZIP/TLE/ADIF/HTML) o **link esterno**. Non aggiungere proxy non dichiarati.
- eQSL, LoTW, QRZ: solo ADIF e collegamenti. **Nessuna automazione che aggiri autenticazione o firma TQSL.**
- Mostra sempre **fonte e ultimo aggiornamento**; per la propagazione distingui **dato osservato** da **previsione**.
- Gestisci satelliti non operativi e dati orbitali obsoleti (avvisa quando gli elementi sono vecchi).
- Contenuti di terzi (audio, waterfall, testi da SigIDWiki/Priyom/UDXF): solo link o materiale con licenza compatibile.

Fonti di riferimento: EiBi, HFCC, SigIDWiki, CelesTrak, SatNOGS, HamQSL, QRZ, eQSL, LoTW, aprs.fi, RepeaterBook, MapForHam, WebSDR.

## Sicurezza e qualità

- Nessun `v-html` con contenuto non sanificato. Tratta come non fidati tutti i file importati (ADIF, HTML Raindrop, CSV, JSON di backup).
- Gestisci sempre stati di caricamento, vuoto ed errore nelle viste.
- UI mobile-first, touch target ≥ 44px, dark mode, obiettivo **WCAG 2.2 AA** (etichette, contrasto, focus visibile, navigazione da tastiera).
- Stringhe UI in italiano tramite il catalogo i18n tipizzato (`src/shared/i18n/`), **mai hardcoded** nei componenti. Codice, nomi, commenti e commit in **inglese**.
- Richiedi la persistenza dello storage (`navigator.storage.persist()`) e mostra lo stato in Settings.

## Comandi

> Script definiti in M1. Se questa sezione diverge da `package.json`, aggiorna questo file.

```bash
npm install            # installazione dipendenze (in CI: npm ci)
npm run dev            # dev server Vite (senza service worker)
npm run build          # typecheck + build di produzione con service worker
npm run check:dist     # controlli sulla build: niente 404.html, _headers/SW/manifest presenti, nessun segreto
npm run preview        # preview della build con vite preview (porta 4173; non applica public/_headers)
npm run preview:pages  # build servita da wrangler pages dev, emulatore di Cloudflare Pages (_headers, fallback SPA)
npm run typecheck      # vue-tsc --build --force (tutti i progetti TS: app, test, config, e2e)
npm run lint           # ESLint (regole di layer e di confine fra moduli), zero warning ammessi
npm run lint:fix       # ESLint con correzione automatica
npm run format         # Prettier (scrive)
npm run format:check   # Prettier (solo verifica, usato in CI)
npm run test           # Vitest (unit + integrazione)
npm run test:watch     # Vitest in watch mode
npm run test:e2e       # Playwright: app su vite preview (4173), hosting su wrangler pages dev (8788), aggiornamento PWA su 4174
npm run test:deployment # Playwright sul deploy reale: PAGES_URL=<url> [EXPECTED_BUILD_ID=<sha>]
npm run icons          # rigenera le icone PWA in public/ (da versionare)
```

CI/CD in `.github/workflows/ci.yml` (job `quality`, `e2e`, `deploy`); procedure su GitHub e Cloudflare in `docs/architecture/ARCHITECTURE.md` § 12.2. Il deploy avviene solo con la variabile di repository `CF_PAGES_DEPLOY=true`.

Prima esecuzione di Playwright su Linux/WSL2: `npx playwright install chromium` e, una tantum, `sudo npx playwright install-deps chromium` (librerie di sistema).

Ambiente di sviluppo: Linux / WSL2. Fornisci sempre comandi eseguibili lì.

## Test

- **Unit (Vitest)** obbligatori per tutto il domain critico: conversioni di frequenza/banda, Maidenhead e distanze, calcolatori RF, parser/writer ADIF, parser EiBi/HFCC/TLE/OMM, calcolo passaggi satellitari, migrazioni Dexie, backup/restore.
- **Integrazione**: repository Dexie con `fake-indexeddb`.
- **E2E (Playwright)**: flussi principali (inserimento QSO, import/export, installazione/offline, restore).
- Per i calcoli usa casi noti e verificabili (valori di riferimento documentati nel test).
- Una funzionalità non è completa se typecheck, lint e test non passano.

## Modalità di lavoro

1. Lavora **per milestone in ordine** (M0 → M13), rispettando le dipendenze. Non anticipare milestone successive.
2. Prima di scrivere codice su una milestone, riassumi obiettivi, dipendenze e criteri di accettazione.
3. Fornisci **codice completo** dei file toccati, con il percorso. Niente pseudocodice né placeholder non dichiarati; niente funzionalità simulate presentate come complete. Se qualcosa resta da fare, segnalalo esplicitamente come `TODO(Mx):` e nel backlog (`docs/roadmap/ROADMAP.md`).
4. Ogni decisione architetturale rilevante → **ADR** in `docs/adr/` (contesto, decisione, alternative, conseguenze).
5. Aggiorna `docs/` e il README quando cambia il comportamento o la struttura.
6. Alla fine di ogni milestone: **checklist di verifica** e criteri di completamento soddisfatti/non soddisfatti.
7. Commit piccoli, in inglese, formato Conventional Commits (`feat(ham-logbook): add ADIF export`).
8. `main` è protetto da un ruleset (dal 2026-10-17): niente push diretti né force push; ogni modifica passa da una PR con i check `quality` ed `e2e` verdi, merge _squash_ o _rebase_. Non rinominare quei job senza aggiornare `.github/rulesets/main-protection.json` e il ruleset su GitHub.
9. Versionamento: SemVer `0.x`, una versione minor a ogni milestone chiusa (M1 = `0.1.0`), `1.0.0` alla release di M13. Tag `vX.Y.Z` sul commit di `main` dopo il deploy di produzione verificato.

## Milestone

| ID  | Contenuto                                                       |
| --- | --------------------------------------------------------------- |
| M0  | Requisiti, architettura, ADR, modello dati, casi d'uso, backlog |
| M1  | Setup Vue/TS/Vite, PWA, layout e dashboard                      |
| M2  | IndexedDB, Dexie, repository, migrazioni                        |
| M3  | HAM Logbook + ADIF                                              |
| M4  | SWL Logbook (7 categorie)                                       |
| M5  | Frequency Explorer + EiBi/HFCC                                  |
| M6  | Calcolatori RF e locator                                        |
| M7  | Signal Explorer                                                 |
| M8  | Satellite Explorer                                              |
| M9  | Resource Manager + import Raindrop (`Ham_Radio.html`)           |
| M10 | DX Cluster e QSL                                                |
| M11 | APRS e ripetitori                                               |
| M12 | Propagazione e servizi esterni                                  |
| M13 | Test, backup, sicurezza, ottimizzazione, release v1.0           |

Stima (aggiornata alla chiusura di M0, dettaglio in `docs/roadmap/ROADMAP.md`): 171 h di base per M1–M13 + 40 h di riserva (23 %) ≈ 21 settimane a 11 h/settimana, M0 inclusa. Le 16 settimane di `PROJECT.md` sono un valore provvisorio. Tutto dipende da M1 → M2 (layer dati). Dopo M2 ci sono due catene critiche di pari durata: M3 → M4 → M10 e M5 → M8 → M11. M5 fornisce il contratto dei provider a M8, M10 e M12. La riserva non si usa per aggiungere perimetro.

## Da non fare

- Accedere a Dexie direttamente dai componenti Vue.
- Persistire frequenze in kHz/MHz, date in ora locale o coordinate in formati diversi da WGS84 decimale.
- Aggiungere backend, proxy o servizi a pagamento senza ADR approvato.
- Fingere integrazioni live con dati statici.
- Modificare migrazioni Dexie già rilasciate.
- Collegare il repository a Cloudflare tramite integrazione Git (Pages _Connect to Git_ o _Workers Builds_): il deploy avviene solo con Direct Upload dalla pipeline (ADR-0011).
