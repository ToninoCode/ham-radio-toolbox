# 0014 — Repository, UnitOfWork ed errori di persistenza

- **Stato**: Accettato (2026-10-24, approvazione del Blocco B di M2)
- **Data**: 2026-10-24
- **Milestone**: M2

## Contesto

BL-M2-05/06 introducono il database Dexie v1 ([DATABASE.md](../architecture/DATABASE.md) § 3, § 5), i repository e le transazioni. Vincoli: domain e application senza Dexie ([ADR-0004](0004-layered-feature-modules.md)); campi `camelCase` identici nel DB e nel tipo, `EntityTable` di Dexie ([ADR-0006](0006-dexie-naming-and-migrations.md)); allegati come Blob con deduplicazione limitata al proprietario ([ADR-0009](0009-attachments-in-indexeddb.md)); tipi branded, `Result` e schemi Zod costruiti sul domain ([ADR-0013](0013-core-domain-types-and-validation.md)); integrità referenziale applicativa e cascate di DATABASE § 6; import atomici (FR-GEN-03); nessun dato parziale (NFR-REL-01).

Fatti verificati con Dexie 4.4.6 e `fake-indexeddb` 6.2.6 (spike e test di integrazione):

- un `db.transaction()` annidato si unisce alla transazione esterna se le tabelle sono un suo sottoinsieme, altrimenti `SubTransactionError`; un'eccezione nel blocco annidato **abortisce anche la transazione esterna**;
- un errore di una richiesta intercettato con `catch` (es. `ConstraintError`) **non** abortisce la transazione;
- un `await` su una promessa estranea a IndexedDB (timer, `fetch`, `crypto.subtle`, lettura file) dentro la transazione la fa chiudere: le scritture precedenti restano committate e l'operazione successiva fallisce con `TransactionInactiveError`;
- Dexie 4 **apre** un database la cui versione installata è più recente di quella dichiarata (aggiungendo le parti mancanti dello schema dichiarato) invece di rifiutarlo;
- un errore in una funzione `upgrade()` annulla l'intero upgrade: il database resta alla versione precedente con i suoi dati;
- Zod 4, alla costruzione del primo schema oggetto, prova `new Function("")` per compilare il parser: con la CSP dell'app (senza `unsafe-eval`) il browser registra una violazione anche se l'eccezione è intercettata (rilevato dal test E2E della CSP).

## Decisione

1. **Porte.** Le interfacce dei repository stanno nell'`application` del modulo proprietario (`modules/<m>/application/ports.ts`). Le porte comuni (errori, `UnitOfWork`, `Clock`, `IdGenerator`, `ContentHasher`, `DatabaseLifecycle`, repository delle entità condivise, contratti di import, backup e storage) stanno in **`src/shared/application/`**, nuova area con le regole ESLint dell'application più quelle di `shared` (nessun modulo, nessuna API del browser).
2. **Schemi delle entità.** Uno schema Zod `strictObject` per tabella, nel `domain` del modulo proprietario (in `core/` per allegati, job di import e fonti dati), costruito con gli schemi di `core/validation`. Campi sconosciuti rifiutati: nessuna colonna non documentata entra nel database, e per aeronautica e marittima nessun campo per il contenuto delle comunicazioni (FR-SWL-04).
3. **Repository come ultimo cancello.** Ogni scrittura passa dallo schema completo dell'entità (validazione e normalizzazione), poi i campi `undefined` vengono rimossi (DATABASE § 1). Il repository genera `id` (UUID v4), `createdAt` e `updatedAt` (`updatedAt` mai precedente a `createdAt`). Input: _draft_ e _patch_ con i valori grezzi (`z.input`); output: entità canoniche e branded (`z.infer`). Un repository per **aggregato**: la ricezione SWL e i suoi dettagli (1:1) si scrivono insieme.
4. **Errori.** `PersistenceError` con sei codici stabili: `persistence.not-found`, `persistence.invalid-input` (con le issue `{ path, code }`), `persistence.conflict` (`reason`: `duplicate`, `missing-reference`, `referenced`, `invariant`; `rule` stabile, es. `station-profile.last`), `persistence.transaction-failed`, `persistence.quota-exceeded`, `persistence.unavailable` (`reason`: `missing-api`, `open-failed`, `newer-version`, `upgrade-failed`, `closed`). Solo i guasti dello storage e dell'ambiente vengono mappati; gli altri errori (es. `TypeError`, `DataError`) si propagano come eccezioni.
5. **UnitOfWork** = una transazione Dexie `rw` su **tutte** le tabelle; i repository chiamati nel `work` vi si uniscono, qualunque tabella tocchino. `work` che restituisce `err` → rollback e stesso errore; eccezione → rollback e rilancio. Un guasto dello storage dentro una unità **abortisce la transazione ambiente** anche se il `work` ignora l'errore restituito. Regola: nel `work` si attendono solo chiamate ai repository; file, hashing e `fetch` si fanno prima. Le unità annidate si uniscono a quella esterna.
6. **Integrità** (DATABASE § 6) nei repository, con controlli e scritture nella stessa transazione e gli helper condivisi di `src/infrastructure/db/integrity.ts`, che dichiara anche l'ambito (tabelle) di ogni operazione. I controlli si fanno prima di qualsiasi scrittura, così un esito atteso non lascia scritture parziali e non abortisce un'unità esterna.
7. **Migrazioni.** `SCHEMA_VERSIONS` elenca le versioni (dichiarazione `stores()` + migrazione dei dati dalla precedente); `applySchemaVersions` le registra e rifiuta liste non consecutive. Le trasformazioni dei dati sono funzioni pure `RecordMigration` in `src/infrastructure/db/migrations/` (senza Dexie), applicate dall'`upgrade()` tramite `toDexieUpgrade` e, nel Blocco C, dal restore tramite la porta `BackupGateway` (risolve Q-M2-02). `SCHEMA_V1` è congelato a runtime e verificato da un test contro DATABASE § 5.
8. **Versioni più recenti rifiutate.** L'app non apre un database con versione installata superiore alla propria (`unavailable/newer-version`), a differenza del comportamento predefinito di Dexie 4: record del vecchio formato in dati già migrati li corromperebbero.
9. **Ciclo di vita** (Q-M2-03): `AppDatabase` implementa `DatabaseLifecycle`. Su `versionchange` chiude la connessione senza riapertura automatica e notifica `version-change`; su `blocked` notifica `blocked`. L'avviso in UI è del Blocco D.
10. **Zod senza `eval`**: `z.config({ jitless: true })` in `core/validation/zod-config.ts`, importato per primo da `core/validation/schemas.ts`.
11. **Composition root** (Q-M2-05): `src/app/container.ts` crea `AppDatabase` (aperto in modo pigro alla prima operazione, o con `connect()`), gli adattatori e i repository, e li fornisce con `APP_CONTAINER_KEY` / `useContainer()`.

## Alternative considerate

| Alternativa                                                                      | Pro                                         | Contro                                                                                                                                 |
| -------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| UnitOfWork con ambito di tabelle esplicito (`run(['qso_logs', …], work)`)        | Meno serializzazione fra scritture          | L'application dovrebbe conoscere le tabelle toccate da ogni repository (cascate incluse); un ambito incompleto fallisce solo a runtime |
| Contesto di transazione passato esplicitamente ai repository (`repo.add(tx, …)`) | Nessuna transazione "ambiente" implicita    | Firma di ogni metodo legata alla persistenza; il contesto Dexie trapelerebbe nelle porte                                               |
| Validazione solo nei casi d'uso, repository "fiduciosi"                          | Nessuna doppia validazione                  | Import, restore e casi d'uso futuri potrebbero scrivere dati non validi; la validazione su un valore canonico costa poco               |
| Eccezioni tipizzate al posto di `Result`                                         | Codice più corto                            | Contrario ad ADR-0013 e ARCHITECTURE § 5.5; errori attesi non visibili nei tipi                                                        |
| Repository generico `Repository<T>` per tutte le tabelle                         | Meno codice                                 | Le regole di integrità sono diverse per tabella; un'astrazione generica le nasconderebbe                                               |
| Lasciare il comportamento di Dexie 4 sulle versioni più recenti                  | Un downgrade dell'app continua a funzionare | Rischio di corrompere dati già migrati; il caso reale (due versioni dell'app in due schede) è gestito da `versionchange`               |
| CSP con `unsafe-eval` per il JIT di Zod                                          | Parser più veloce sugli oggetti             | Indebolisce la CSP di tutta l'app (ARCHITECTURE § 11) per un guadagno trascurabile sui volumi di un logbook                            |

## Conseguenze

- Scritture concorrenti serializzate da IndexedDB: un'unità lunga ritarda le altre scritture e le letture sulle stesse tabelle. Le unità devono contenere solo le operazioni del commit (il parsing degli import resta fuori, Blocco C).
- La regola "solo chiamate ai repository dentro `work`" non è verificabile dal compilatore: è documentata nella porta e coperta da un test che mostra l'effetto della sua violazione (commit prematuro).
- Gli errori di Zod a livello di oggetto (regole fra campi) compaiono solo quando i singoli campi sono validi: i report di import mostreranno gli errori in due passaggi.
- Dexie e Zod entrano nel chunk iniziale perché il container è creato all'avvio: il chunk principale passa da 18,6 a 86,0 kB gzip (JS iniziale ≈ 122 kB gzip, entro i 200 kB di NFR-PERF-01). Da riverificare in M13; possibile caricamento pigro dei repository per modulo se il budget si avvicina.
- Prima di rifiutare un database più recente, Dexie 4 può già avervi aggiunto le parti dello schema v1 mancanti; nessun dato viene modificato.
- I messaggi i18n dei codici `persistence.*` si aggiungono al catalogo con la prima vista che li mostra (Blocco D / M3), come per i codici del core (ADR-0013).
