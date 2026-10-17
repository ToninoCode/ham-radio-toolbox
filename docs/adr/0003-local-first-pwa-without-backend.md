# 0003 — PWA local-first senza backend

- **Stato**: Accettato
- **Data**: 2026-10-17
- **Milestone**: M0

## Contesto

PROJECT §1 e §11 e i vincoli CON-01/02/09 richiedono che la v1 funzioni interamente nel browser, offline per le funzioni principali, senza server proprio, account cloud o API a pagamento. Il target è un tablet Android usato anche in portatile senza rete.

## Decisione

- L'app è una **PWA statica** (Vue 3 + Vite) servita in HTTPS da hosting statico, installabile, con service worker Workbox (`vite-plugin-pwa`).
- **IndexedDB (Dexie)** è la fonte di verità per tutti i dati utente e i dataset importati.
- La rete è usata solo per: aggiornare l'app, scaricare dati da fonti native verificate su azione dell'utente, tile/immagini, link esterni.
- Nessun backend, proxy o funzione serverless in v1. Un backend futuro (PROJECT §13) sarà un **adattatore aggiuntivo** dietro le porte dell'application layer ([ADR-0004](0004-layered-feature-modules.md)).

## Alternative considerate

| Alternativa                              | Pro                                            | Contro                                                           |
| ---------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------- |
| App nativa Android                       | Accesso hardware, storage pieno                | Fuori stack, distribuzione via store, niente desktop             |
| PWA + backend leggero (proxy CORS, sync) | Più fonti integrabili                          | Viola CON-01; costi e manutenzione; dati fuori dal dispositivo   |
| localStorage / OPFS invece di IndexedDB  | Semplicità (localStorage) / prestazioni (OPFS) | localStorage limitato e sincrono; OPFS senza query/indici nativi |

## Conseguenze

- Molte fonti diventano **import manuale** o **link** (CORS, HTTP, auth) — documentato in `SOURCES.md`.
- Il rischio principale è la **perdita dei dati locali** (pulizia del browser, quota): mitigato con `navigator.storage.persist()`, backup versionati e promemoria.
- Nessuna sincronizzazione multi-dispositivo in v1.
