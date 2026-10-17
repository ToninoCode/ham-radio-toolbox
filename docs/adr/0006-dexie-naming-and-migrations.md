# 0006 — Naming Dexie e politica delle migrazioni

- **Stato**: Accettato (2026-10-17, avvio M2)
- **Data**: 2026-10-17
- **Milestone**: M2

## Contesto

`CLAUDE.md` impone tabelle `snake_case` come da specifica (`qso_logs`, `swl_receptions`, `orbital_elements`) e campi TypeScript `camelCase`, chiedendo di scegliere e documentare la mappatura in M2. Ogni modifica di schema deve essere una nuova versione Dexie con migrazione testata; le versioni rilasciate non si modificano.

Verifiche all'avvio di M2:

- Dexie 4.4 è già fra le dipendenze runtime (introdotto in M1, non ancora usato). `EntityTable<T, K>` accetta chiavi diverse da `id` (`settings.key`, `data_sources.key`).
- I tipi dei campi derivano dagli schemi Zod di `src/core/validation` ([ADR-0013](0013-core-domain-types-and-validation.md)). I tipi _branded_ (`FrequencyHz`, `UtcDateTime`, `Callsign`, `Locator`) esistono solo a compile time: a runtime sono `number` e `string`, quindi Dexie li memorizza e li indicizza senza adattatori.
- `fake-indexeddb` non è installato: servirà come dipendenza di sviluppo nel Blocco B.

## Decisione

- **Tabelle** `snake_case` plurale; **campi** `camelCase` identici nel DB e nel tipo TypeScript (nessuno strato di mapping). I nomi dei campi indicizzati nella stringa `stores()` sono quindi `camelCase` (`'id, callsign, datetimeOn, [band+mode]'`).
- Accesso alle tabelle tipizzato con `EntityTable<T, 'id'>` di Dexie 4 (`EntityTable<T, 'key'>` per `settings` e `data_sources`). `T` è il tipo `z.infer` dello schema dell'entità.
- Ogni cambio di schema: `db.version(n+1).stores(...).upgrade(...)`; le dichiarazioni delle versioni precedenti restano nel codice invariate.
- Trasformazioni di dati come funzioni pure `vN → vN+1`, senza dipendenze da Dexie, riusate dal restore dei backup.
- Test obbligatori di ogni migrazione con `fake-indexeddb` (DB popolato a `n`, apertura a `n+1`).
- Una versione è "rilasciata" quando è stata pubblicata su `main` **e** deployata in produzione. Fino ad allora, cioè per tutta la durata di M2, lo schema v1 si può ancora correggere. Dalla chiusura di M2 è immutabile.

## Alternative considerate

| Alternativa                                          | Pro                            | Contro                                                                         |
| ---------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------ |
| Campi `snake_case` nel DB + mapper verso `camelCase` | Coerenza visiva con le tabelle | Doppio modello, mapper da mantenere e testare, rischio di errori su ogni campo |
| Tutto `camelCase` anche nelle tabelle (`qsoLogs`)    | Uniformità                     | Contraddice `CLAUDE.md` e la specifica                                         |

## Conseguenze

Nessun mapping da mantenere; backup JSON con gli stessi nomi del codice. I nomi dei campi diventano parte del formato di backup: rinominarli richiede una migrazione.

Questioni da risolvere nel Blocco B/C, prima del codice che ne dipende (registrate in [ROADMAP § 4, M2](../roadmap/ROADMAP.md#m2-16-h)):

1. **Collocazione delle funzioni di migrazione pure.** Servono sia all'`upgrade` Dexie (infrastructure) sia al restore (orchestrato da un caso d'uso in application, che non può importare infrastructure). Proposta: funzioni in `src/infrastructure/db/migrations/`, esposte al restore tramite la porta del backup implementata in infrastructure.
2. **Gestione `versionchange`/`blocked`** (DATABASE § 7): la chiusura della connessione e la richiesta di ricaricare richiedono una notifica in UI. Va definita la porta verso la presentation.
