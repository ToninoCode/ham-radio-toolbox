# 0002 — Struttura della documentazione

- **Stato**: Accettato
- **Data**: 2026-10-17
- **Milestone**: M0

## Contesto

`CLAUDE.md` indicava come struttura _indicativa_ `docs/architecture.md`, `docs/data-model.md`, `docs/data-sources.md`, `docs/backlog.md`. Il repository contiene invece già (vuoti) `docs/requirements/REQUIREMENTS.md`, `docs/architecture/ARCHITECTURE.md`, `docs/architecture/DATABASE.md`, `docs/data-sources/SOURCES.md`, `docs/roadmap/ROADMAP.md`, `docs/adr/README.md`. `PROJECT.md` resta il riferimento primario per il perimetro.

## Decisione

Adottiamo la struttura presente nel repository:

| Contenuto                            | File                                |
| ------------------------------------ | ----------------------------------- |
| Perimetro e obiettivi                | `docs/PROJECT.md`                   |
| Requisiti e casi d'uso               | `docs/requirements/REQUIREMENTS.md` |
| Architettura                         | `docs/architecture/ARCHITECTURE.md` |
| Modello dati (ex `data-model.md`)    | `docs/architecture/DATABASE.md`     |
| Fonti esterne (ex `data-sources.md`) | `docs/data-sources/SOURCES.md`      |
| Roadmap e backlog (ex `backlog.md`)  | `docs/roadmap/ROADMAP.md`           |
| ADR                                  | `docs/adr/`                         |
| Materiale personale non versionato   | `docs/references/`                  |

La documentazione di progetto è scritta in italiano (come `CLAUDE.md` e la UI); identificatori, nomi di campi e frammenti di codice in inglese. `CLAUDE.md` viene aggiornato di conseguenza.

## Alternative considerate

| Alternativa                                 | Pro                                    | Contro                                                                                          |
| ------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Struttura piatta di `CLAUDE.md`             | Già descritta                          | File vuoti esistenti da eliminare; meno spazio per crescere (es. più documenti di architettura) |
| Documentazione in inglese come `PROJECT.md` | Coerenza con `PROJECT.md` e col codice | Il maintainer lavora in italiano; `CLAUDE.md` è in italiano                                     |

## Conseguenze

Un solo posto per ogni tipo di informazione. Il backlog vive nella roadmap (stessa granularità per milestone). Se in futuro la documentazione utente cresce, si aggiungerà `docs/user/`.
