# 0004 — Moduli per feature con layer e porte/adattatori

- **Stato**: Accettato
- **Data**: 2026-10-17
- **Milestone**: M0

## Contesto

14 moduli funzionali, forte quantità di logica di dominio pura (bande, locator, ADIF, SGP4, calcoli RF) da testare in isolamento, e la richiesta di predisporre backend e controllo apparati senza riscrivere il frontend.

## Decisione

- Codice organizzato per **feature module** in `src/modules/<modulo>/` con sottocartelle `domain/`, `application/`, `infrastructure/`, `presentation/` (solo quelle necessarie) e un `index.ts` pubblico.
- Domain condiviso in `src/core/`; componenti e utility generiche in `src/shared/`; infrastruttura comune in `src/infrastructure/`; composition root in `src/app/`.
- Dipendenze verso l'interno: `presentation → application → domain`; `infrastructure`/`providers` implementano porte definite in `application`/`domain`.
- Le regole sono **imposte da ESLint** (`no-restricted-imports` per percorso) a partire da M1.
- DI manuale tramite un container creato in `app/container.ts` e fornito con `provide/inject`; nessun framework DI.
- Gli store Pinia chiamano casi d'uso, mai Dexie.

## Alternative considerate

| Alternativa                                                    | Pro                   | Contro                                                                |
| -------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------- |
| Struttura per tipo (`components/`, `stores/`, `services/`)     | Familiare             | Accoppiamento fra moduli, logica nei componenti, difficile da testare |
| Clean architecture con classi e DI container (es. InversifyJS) | Formalismo            | Peso e complessità eccessivi per una SPA su tablet                    |
| `eslint-plugin-boundaries`                                     | Regole più espressive | Dipendenza in più; `no-restricted-imports` basta                      |

## Conseguenze

Più file e qualche indirezione per moduli semplici (mitigato: i layer vuoti non si creano). Il domain è testabile senza browser. Un futuro adattatore di sync o di controllo CAT si aggiunge senza toccare la presentation.
