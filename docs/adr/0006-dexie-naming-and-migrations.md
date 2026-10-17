# 0006 — Naming Dexie e politica delle migrazioni

- **Stato**: Proposto (da confermare all'avvio di M2)
- **Data**: 2026-10-17
- **Milestone**: M2

## Contesto

`CLAUDE.md` impone tabelle `snake_case` come da specifica (`qso_logs`, `swl_receptions`, `orbital_elements`) e campi TypeScript `camelCase`, chiedendo di scegliere e documentare la mappatura in M2. Ogni modifica di schema deve essere una nuova versione Dexie con migrazione testata; le versioni rilasciate non si modificano.

## Decisione (proposta)

- **Tabelle** `snake_case` plurale; **campi** `camelCase` identici nel DB e nel tipo TypeScript (nessuno strato di mapping). I nomi dei campi indicizzati nella stringa `stores()` sono quindi `camelCase` (`'id, callsign, datetimeOn, [band+mode]'`).
- Accesso alle tabelle tipizzato con `EntityTable<T, 'id'>` di Dexie 4.
- Ogni cambio di schema: `db.version(n+1).stores(...).upgrade(...)`; le dichiarazioni delle versioni precedenti restano nel codice invariate.
- Trasformazioni di dati come funzioni pure `vN → vN+1`, riusate dal restore dei backup.
- Test obbligatori di ogni migrazione con `fake-indexeddb` (DB popolato a `n`, apertura a `n+1`).
- Una versione è "rilasciata" quando è stata pubblicata su `main` e deployata; da quel momento è immutabile.

## Alternative considerate

| Alternativa                                          | Pro                            | Contro                                                                         |
| ---------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------ |
| Campi `snake_case` nel DB + mapper verso `camelCase` | Coerenza visiva con le tabelle | Doppio modello, mapper da mantenere e testare, rischio di errori su ogni campo |
| Tutto `camelCase` anche nelle tabelle (`qsoLogs`)    | Uniformità                     | Contraddice `CLAUDE.md` e la specifica                                         |

## Conseguenze

Nessun mapping da mantenere; backup JSON con gli stessi nomi del codice. I nomi dei campi diventano parte del formato di backup: rinominarli richiede una migrazione.
