# Architecture Decision Records

Decisioni architetturali di Ham Radio Toolbox. Formato e regole in [0001](0001-record-architecture-decisions.md); modello in [0000-template.md](0000-template.md).

| #                                                                | Titolo                                                           | Stato                                   | Milestone          |
| ---------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------- | ------------------ |
| [0001](0001-record-architecture-decisions.md)                    | Registrare le decisioni architetturali                           | Accettato                               | M0                 |
| [0002](0002-documentation-layout.md)                             | Struttura della documentazione                                   | Accettato                               | M0                 |
| [0003](0003-local-first-pwa-without-backend.md)                  | PWA local-first senza backend                                    | Accettato                               | M0                 |
| [0004](0004-layered-feature-modules.md)                          | Moduli per feature con layer e porte/adattatori                  | Accettato                               | M0                 |
| [0005](0005-data-conventions.md)                                 | Convenzioni dei dati persistiti                                  | Accettato                               | M0                 |
| [0006](0006-dexie-naming-and-migrations.md)                      | Naming Dexie e politica delle migrazioni                         | Accettato                               | M2                 |
| [0007](0007-external-provider-policy.md)                         | Policy per le fonti esterne                                      | Accettato                               | M0                 |
| [0008](0008-i18n-approach.md)                                    | Approccio all'internazionalizzazione                             | Accettato                               | M0 (attuazione M1) |
| [0009](0009-attachments-in-indexeddb.md)                         | Allegati come Blob in IndexedDB                                  | Accettato con precisazioni              | M2                 |
| [0010](0010-noaa-swpc-propagation-source.md)                     | NOAA SWPC come fonte numerica per la propagazione                | Proposto (decisione in M12)             | M12                |
| [0011](0011-static-hosting-and-routing.md)                       | Hosting statico (Cloudflare Pages) e routing in history mode     | Accettato                               | M0 (attuazione M1) |
| [0012](0012-hfcc-in-v1-scope.md)                                 | HFCC nel perimetro della v1 con dipendenze esplicite             | Accettato                               | M0 (attuazione M5) |
| [0013](0013-core-domain-types-and-validation.md)                 | Core domain: tipi branded, `Result` e schemi di validazione      | Accettato (2026-10-24)                  | M2                 |
| [0014](0014-repositories-unit-of-work-and-persistence-errors.md) | Repository, UnitOfWork ed errori di persistenza                  | Accettato (2026-10-24)                  | M2                 |
| [0015](0015-backup-format-and-atomic-restore.md)                 | Formato di backup v1, elaborazione progressiva e restore atomico | Proposto (approvazione con il Blocco C) | M2                 |

## Regole

- Nuovo ADR: copia `0000-template.md` con il numero successivo, stato _Proposto_.
- Un ADR _Accettato_ non si riscrive: si sostituisce con un nuovo ADR e si aggiorna lo stato del vecchio a _Sostituito da NNNN_.
- Gli ADR _Proposti_ vanno decisi entro la milestone indicata, prima di scrivere il codice che ne dipende.
