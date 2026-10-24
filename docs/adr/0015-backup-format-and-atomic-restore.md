# 0015 — Formato di backup v1, elaborazione progressiva e restore atomico

- **Stato**: Accettato (2026-10-24, approvazione del Blocco C di M2, con le precisazioni della revisione riportate in fondo)
- **Data**: 2026-10-24
- **Milestone**: M2

## Contesto

BL-M2-07/08 introducono pipeline di import, backup e restore (FR-GEN-03, FR-SET-05/06/07, NFR-REL-01/04). Vincoli: contratto del backup approvato in [DATABASE.md](../architecture/DATABASE.md) § 9.1 (un oggetto JSON con `format`, `schemaVersion`, `backupFormatVersion`, `appVersion`, `exportedAt`, `includesAttachments`, `tables`, `counts`); allegati in base64 solo su richiesta ([ADR-0009](0009-attachments-in-indexeddb.md)); migrazioni pure riusate dal restore ([ADR-0006](0006-dexie-naming-and-migrations.md)); dentro una `UnitOfWork` solo richieste IndexedDB ([ADR-0014](0014-repositories-unit-of-work-and-persistence-errors.md)); 500 MB proposti in DATABASE § 8, non gestibili con un solo `JSON.parse` (Q-M2-04).

Fatti verificati:

- `crypto.subtle.digest` non è incrementale: un checksum di un file letto a pezzi richiede un'implementazione propria.
- `Blob.stream()` e `TextDecoderStream` (con `fatal: true`) esistono in Chromium e in Node 22; il decoder non spezza i caratteri multibyte fra due chunk.
- Una transazione IndexedDB non può coprire due database; un `await` estraneo a IndexedDB chiude la transazione (ADR-0014).
- In Chromium i `Blob` letti da IndexedDB restano validi dopo la transazione; i `Blob` creati in memoria vivono nel _blob storage_ del browser, non nell'heap JavaScript.
- Chiudere la pagina durante la transazione di restore la annulla: i dati locali restano quelli di prima (test `tests/e2e/backup-browser.spec.ts`).
- Misure su Chromium desktop (Playwright, Linux/WSL2, 2026-10-24), file sintetici, tabelle esportate identiche al file in ogni caso:

| Dataset                         | File   | Record  | Analisi | Commit | Export | Picco heap JS¹ (analisi / export) |
| ------------------------------- | ------ | ------- | ------- | ------ | ------ | --------------------------------- |
| 10 000 QSO                      | 5 MB   | 16 005  | 0,9 s   | 2,1 s  | 1,0 s  | +50 / +44 MB                      |
| 50 000 QSO                      | 27 MB  | 80 005  | 4,2 s   | 11,1 s | 4,4 s  | +145 / +130 MB                    |
| 100 000 QSO                     | 54 MB  | 160 005 | 8,0 s   | 22,0 s | 8,1 s  | +123 / +37 MB                     |
| 200 000 QSO                     | 109 MB | 320 005 | 16,3 s  | 45,1 s | 17,7 s | +195 / +505 MB                    |
| 1 000 QSO + 10 allegati × 5 MiB | 70 MB  | 1 615   | 1,7 s   | 0,3 s  | 1,0 s  | +161 / +89 MB                     |
| 1 000 QSO + 15 allegati × 5 MiB | 105 MB | 1 620   | 2,2 s   | 0,3 s  | 1,4 s  | +281 / +99 MB                     |
| 1 000 QSO + 30 allegati × 5 MiB | 210 MB | 1 635   | 5,4 s   | 0,5 s  | 3,1 s  | +174 / +86 MB                     |
| 1 000 QSO + 60 allegati × 5 MiB | 420 MB | 1 665   | 7,8 s   | 0,6 s  | 5,3 s  | +126 / +86 MB                     |

¹ Massimo di `performance.memory.usedJSHeapSize` (con `--enable-precise-memory-info`) rispetto all'inizio della fase, campionato ogni 20 ms: include la memoria non ancora raccolta dal garbage collector, quindi sovrastima la memoria viva. Non misura il _blob storage_. Con `fake-indexeddb` in Node, 50 000 QSO: analisi 2,7 s, restore 5,2 s, export 4,7 s.

## Decisione

1. **Formato v1 = un solo oggetto JSON**, il contenitore di DATABASE § 9.1, con precisazioni compatibili (il formato non è ancora rilasciato: `backupFormatVersion` resta 1):
   - ordine fisso dei membri della radice: intestazione con `format` per primo, `counts`, `tables`, `integrity` per ultimo;
   - nuovi campi `backupId` (UUID v4) e `integrity` (`algorithm: "SHA-256"`, `tables`: SHA-256 dei byte UTF-8 dell'array di ogni tabella, da `[` a `]`);
   - record in JSON canonico (chiavi ordinate), un record per riga, ordinati per chiave primaria; tabelle nell'ordine di `TABLE_NAMES`, anche vuote; `attachments` presente solo con `includesAttachments: true`, con `dataBase64` canonico (RFC 4648);
   - campi sconosciuti rifiutati alla radice, nel manifest e nei record.
2. **Elaborazione progressiva**, mai un `JSON.parse`/`JSON.stringify` dell'intero file. Scrittura: record serializzati uno alla volta in parti di `Blob` da circa 512 KiB, ciascuna sommata al checksum della sua tabella (SHA-256 incrementale in TypeScript, verificato con i vettori FIPS 180-4); un allegato alla volta, in base64 a blocchi. Lettura: stream con decodifica UTF-8 stretta, scanner strutturale dell'involucro e delle tabelle, `JSON.parse` per singolo record, checksum calcolato durante il passaggio. Limiti: 64 KiB per membro dell'intestazione, 1 MiB per record, base64 di 20 MB + 64 KiB per un allegato.
3. **Export** da uno snapshot coerente: una transazione di sola lettura su tutte le tabelle, serializzazione sincrona nei callback del cursore, contenuti degli allegati letti dopo. Ogni record passa dallo schema della sua entità; un record non valido impedisce il backup (`backup.source-invalid`).
4. **Restore in fasi**: analisi (nessuna scrittura: identificazione, versioni, record, migrazioni pure record per record, checksum, conteggi, riferimenti), anteprima (lettura dello stato locale e piano), conferma esplicita, commit in una `UnitOfWork`. Nel commit si rilegge lo stato locale e si ricalcola il piano (diverso → `backup.preview-stale`), poi svuotamento, eliminazioni e scritture, verifica dei conteggi dentro la transazione e job `committed`. Lettura del file, decodifica e hashing degli allegati avvengono tutti prima. Nessuna cancellazione preventiva: svuotamento e scrittura stanno nella stessa transazione.
5. **Modalità** _sostituisci_ (default) e _unisci_ con le regole di DATABASE § 9.2, calcolate da una funzione pura (`restore-planner.ts`).
6. **Limite operativo di 100 MB** per il file (export e restore), configurabile (`DEFAULT_MAX_BACKUP_BYTES`): verificato su Chromium desktop sia con soli record (109 MB, 320 005 record) sia con allegati (fino a 420 MB). Il restore tiene in memoria tutti i record validati fino al commit. Prima di un export con allegati la dimensione è stimata e un backup oltre il limite è rifiutato subito.
7. **Caricamento pigro**: codec, gateway e casi d'uso stanno in un chunk separato, caricato da `AppContainer.loadBackupService()`.
8. Il restore è registrato in `import_jobs` (`kind: 'backup'`), riconoscibile dal `backupId` nelle `options`; `fileSha256` non è calcolato (sarebbe un secondo hash completo del file).

### Proposta per backup oltre il limite (non attuata, da decidere in M13)

Restore in un database di appoggio (`ham-radio-toolbox-restore-<id>`) scritto a lotti, verificato, poi attivato con lo scambio di un puntatore al database attivo; il database precedente si elimina dopo la verifica, quello di appoggio orfano all'avvio successivo. È atomico e con memoria limitata, ma cambia una convenzione approvata (nome fisso del database, apertura e ciclo di vita delle connessioni in `AppDatabase`), quindi richiede un ADR dedicato e test su tablet. Insieme si rivaluta il contenitore ZIP (allegati senza base64) di ADR-0009.

## Precisazioni all'accettazione (revisione del Blocco C, 2026-10-24)

1. **Ordine canonico del writer.** Il writer produce sempre lo stesso ordine: membri della radice `format`, `backupFormatVersion`, `schemaVersion`, `appVersion`, `backupId`, `exportedAt`, `includesAttachments`, `counts`, `tables`, `integrity`; tabelle nell'ordine di `TABLE_NAMES`; record per chiave primaria; chiavi di ogni record in ordine lessicografico.
2. **Cosa richiede il lettore.** Il lettore impone solo l'ordine che gli serve per lavorare in streaming e rifiuta il resto con `backup.layout-invalid`:
   - `format` è il primo membro (altrimenti `backup.not-a-backup`);
   - tutti i membri dell'intestazione precedono `tables`, così il file si rifiuta prima di leggere un record;
   - `integrity` segue `tables` ed è l'ultimo membro;
   - nessun membro è ripetuto.

   Non richiede invece l'ordine reciproco dei membri dell'intestazione dopo `format`, l'ordine delle tabelle dentro `tables` né quello dei record (le chiavi duplicate sono comunque rilevate: `backup.duplicate-id`). Il checksum copre il testo esatto di ogni array: riordinare i record di una tabella cambia il checksum e il file è rifiutato (`backup.checksum-mismatch`).

3. **Determinismo.** La serializzazione dei record è deterministica: stessi dati → stesso testo di ogni tabella, quindi stesse impronte. `backupId` e `exportedAt` cambiano a ogni esportazione, e con loro il nome del file: due backup degli stessi dati hanno tabelle identiche byte per byte ma file diversi.
4. **Integrità, non autenticità.** SHA-256 rileva corruzione e troncamento accidentali. Non è una firma: chi modifica il file può ricalcolare le impronte. Per questo ogni record è comunque validato con lo schema della sua entità e con le regole di riferimento (test `tests/integration/backup/backup-block-d.spec.ts`, file manomessi con impronte ricalcolate). L'interfaccia lo dice esplicitamente (Impostazioni, sezione Backup).
5. **Staging rinviato a M13.** Il restore in un database di appoggio per file oltre il limite operativo non è implementato in M2 (Q-M2-10); resta la proposta descritta sopra.

### Unità di misura e limiti (precisazione del Blocco D)

- Il limite operativo è `DEFAULT_MAX_BACKUP_BYTES = 100 × 1024 × 1024` byte, cioè **100 MiB = 104 857 600 byte ≈ 104,9 MB** decimali. Nei documenti "100 MB" indica questo valore; l'interfaccia mostra le dimensioni in unità binarie (KiB, MiB, GiB).
- Le misure della tabella con file oltre 100 MiB (fino a 420 MB) sono state ottenute **alzando il limite** nell'harness di test (`maxBackupBytes`), per misurare tempi e memoria: non sono una capacità supportata. Nell'app il limite resta 100 MiB.
- Memoria: il restore tiene in memoria tutti i record validati fino al commit (transazione unica); con allegati, i loro contenuti sono `Blob` nel _blob storage_ del browser. Il picco dell'heap JS misurato su desktop va da +50 a +505 MB (tabella sopra).
- **Android non verificato**: nessuna misura su tablet. Il limite di 100 MiB è verificato solo su Chromium desktop e va confermato con la checklist progressiva di ROADMAP § 7.2 (Q-M2-11); se non regge si abbassa via configurazione.
- **Requisito residuo**: backup fino a 500 MB (DATABASE § 8) richiede lo staging e probabilmente il contenitore ZIP (M13, Q-M2-10).

## Alternative considerate

| Alternativa                                                     | Pro                                       | Contro                                                                                          |
| --------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| JSON Lines (un record per riga, file non JSON)                  | Lettura per righe banale                  | Cambia il contratto approvato; file non più leggibile come JSON                                 |
| ZIP (manifest, JSON per tabella, allegati binari)               | Niente base64 (-25 %), streaming naturale | Writer/lettore ZIP o nuova dipendenza; già rinviato a M13 da ADR-0009                           |
| `JSON.parse` del file intero                                    | Semplice                                  | Testo e oggetti in memoria insieme: impraticabile oltre poche decine di MB su tablet            |
| Libreria di parsing JSON in streaming                           | Parser generale                           | Nuova dipendenza runtime per leggere solo l'involucro di un formato che scriviamo noi           |
| Checksum dell'intero file (file separato o riga fuori dal JSON) | Copre anche l'intestazione                | Due file da conservare, oppure un file non più JSON; l'intestazione è comunque validata con Zod |
| Web Crypto sull'array di ogni tabella                           | Implementazione nativa                    | Serve l'intero array in memoria                                                                 |
| Restore in più transazioni sulle tabelle attive                 | Memoria limitata                          | Un'interruzione lascia il database a metà: escluso dai requisiti                                |
| Staging in tabelle dedicate dello stesso database               | Atomicità con memoria limitata            | Nuove tabelle nello schema v1, con migrazione e regole proprie                                  |
| Restore con i repository (`create` per record)                  | Riusa le regole dei repository            | I repository generano id e date: il round-trip non sarebbe identico; molto più lento            |

## Conseguenze

- Il round-trip è identico byte per byte sulle tabelle (stessi dati → stesso testo), verificato su `fake-indexeddb` e su Chromium; la fixture `tests/fixtures/backup/v1-basic.json` deve restare ripristinabile da ogni versione futura.
- L'ordine dei membri della radice fa parte del formato (`backup.layout-invalid`). Il checksum copre il testo esatto degli array delle tabelle: un file riformattato o modificato a mano non è accettato (`backup.checksum-mismatch`); sono ammessi solo spazi fuori dagli array. Il checksum rileva corruzione e troncamento, non è una firma.
- Memoria del restore proporzionale ai record del backup; analisi e commit di 320 000 record richiedono circa un minuto su desktop. Analisi e scrittura girano nel thread principale con pause a ogni chunk: valutare un Web Worker se il collaudo su tablet mostra blocchi dell'interfaccia (Q-M2-08).
- Il limite di 100 MB è verificato solo su Chromium desktop; va confermato su tablet Android (Blocco D / M13) e, se serve, abbassato via configurazione. I 500 MB di DATABASE § 8 restano un requisito residuo (staging).
- Il chunk iniziale cresce di 1,4 kB gzip (86,0 → 87,4 kB, helper dell'import dinamico); il chunk del backup pesa 10,6 kB gzip ed è precaricato dal service worker, quindi il backup funziona offline.
- `.prettierignore` e `.gitattributes` escludono le fixture dei backup da riformattazione e conversione dei fine riga.
