# Modello dati e database — Ham Radio Toolbox v1

| Campo                | Valore                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stato                | M0 — Progettazione · **M2**: schema v1 approvato (Blocco B, 2026-10-24) · import, backup e restore approvati (Blocco C, 2026-10-24) · preferenze, storage e UI approvati (Blocco D, 2026-10-24)                                                                                                                                                                                         |
| Ultimo aggiornamento | 2026-10-24                                                                                                                                                                                                                                                                                                                                                                              |
| Tecnologia           | IndexedDB tramite Dexie.js 4.x, validazione Zod 4.x                                                                                                                                                                                                                                                                                                                                     |
| Documenti collegati  | [Architettura](ARCHITECTURE.md) · [Requisiti](../requirements/REQUIREMENTS.md) · [ADR-0005](../adr/0005-data-conventions.md) · [ADR-0006](../adr/0006-dexie-naming-and-migrations.md) · [ADR-0009](../adr/0009-attachments-in-indexeddb.md) · [ADR-0014](../adr/0014-repositories-unit-of-work-and-persistence-errors.md) · [ADR-0015](../adr/0015-backup-format-and-atomic-restore.md) |

Questo documento definisce entità, tabelle, indici, relazioni, migrazioni, flussi di import e formato di backup. È il riferimento per M2; i moduli successivi possono **aggiungere** campi e tabelle solo tramite nuove versioni di schema.

---

## 1. Convenzioni

| Ambito               | Regola                                                                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nomi tabelle         | `snake_case` plurale (`qso_logs`).                                                                                                                              |
| Nomi campi           | `camelCase` (`frequencyHz`), identici al tipo TypeScript: nessun mapping fra DB e dominio ([ADR-0006](../adr/0006-dexie-naming-and-migrations.md), accettato).  |
| Chiave primaria      | `id: string` UUID v4 da `crypto.randomUUID()`. Eccezioni: `settings` (chiave stringa `key`).                                                                    |
| Frequenze            | `number` intero in **Hz** (suffisso `Hz`). `Number.isSafeInteger` garantito fino a ~9 PHz.                                                                      |
| Toni sub-audio       | Intero in **decimi di Hz** (suffisso `DeciHz`: 88,5 Hz → `885`). Eccezione motivata in [ADR-0005](../adr/0005-data-conventions.md).                             |
| Date/ore             | Stringa ISO 8601 UTC con `Z`, precisione al secondo (`2026-10-17T13:21:00Z`). Ordinabile lessicograficamente → indicizzabile.                                   |
| Orari di palinsesto  | Minuti dal 00:00 UTC (`0..1440`).                                                                                                                               |
| Date senza ora       | `YYYY-MM-DD` (es. validità di un palinsesto).                                                                                                                   |
| Coordinate           | `lat`, `lon` in gradi decimali WGS84 (`lat ∈ [-90, 90]`, `lon ∈ [-180, 180)`).                                                                                  |
| Locator              | Maidenhead normalizzato: campo e quadrato maiuscoli, sottoquadrato minuscolo (`JN45dl`).                                                                        |
| Nominativi           | Maiuscolo, senza spazi; validazione con Zod (`/^[A-Z0-9]{1,4}(\/[A-Z0-9]{1,8}){0,2}$/`-like, definita in `core/callsign`).                                      |
| Booleani indicizzati | IndexedDB **non** indicizza booleani: se un flag serve come indice si usa `0 \| 1` (es. `isFavorite`). Booleani non indicizzati restano `boolean`.              |
| Campi opzionali      | Assenti (non `null`) quando non valorizzati; IndexedDB non indicizza `undefined`, comportamento voluto per indici sparsi.                                       |
| Metadati comuni      | Ogni entità utente ha `createdAt` e `updatedAt` (UTC ISO), aggiornati dal repository. Eccezione: `attachments` ha solo `createdAt` (allegati immutabili, § 11). |
| Provenienza          | Dati importati: `sourceKey`, `importJobId` e, dove previsto, `raw` (record originale) per tracciabilità e re-parsing.                                           |
| Dati di esempio      | Campo `isSample: 1` sui record caricati da fixture dimostrative (FR-GEN-04); esclusi da statistiche ed export salvo scelta esplicita.                           |

Ogni entità ha uno schema Zod in `modules/<modulo>/domain/` (o `core/` se condivisa) e il tipo derivato `z.infer<typeof Schema>`. Implementati in M2 (Blocco B): `settings-backup/domain/station-profile.ts` e `setting.ts`, `ham-logbook/domain/qso-log.ts`, `swl-logbook/domain/swl-reception.ts` e `reception-details.ts`, `qsl-manager/domain/qsl-record.ts`, `core/attachment`, `core/import-job`, `core/data-source`. Gli schemi sono `strictObject`: un campo non documentato qui è rifiutato.

---

## 2. Mappa entità → tabelle

| Entità (`PROJECT.md` §7)            | Tabella                  | Modulo proprietario     | Backup                         | Prima versione |
| ----------------------------------- | ------------------------ | ----------------------- | ------------------------------ | -------------- |
| StationProfile                      | `station_profiles`       | settings-backup         | ✅                             | v1 (M2)        |
| QsoLog                              | `qso_logs`               | ham-logbook             | ✅                             | v1             |
| SwlReception                        | `swl_receptions`         | swl-logbook             | ✅                             | v1             |
| ReceptionDetails                    | `reception_details`      | swl-logbook             | ✅                             | v1             |
| QslRecord                           | `qsl_records`            | qsl-manager             | ✅                             | v1             |
| Attachment                          | `attachments`            | shared (infrastructure) | ✅ (opz.)                      | v1             |
| Settings                            | `settings`               | settings-backup         | ✅                             | v1             |
| DataSource                          | `data_sources`           | shared (providers)      | ✅                             | v1             |
| ImportJob                           | `import_jobs`            | shared (infrastructure) | ✅                             | v1             |
| Station                             | `stations`               | frequency-explorer      | ✅                             | v2 (M5)        |
| Frequency                           | `frequencies`            | frequency-explorer      | ✅                             | v2 (M5)        |
| BroadcastSchedule                   | `broadcast_schedules`    | frequency-explorer      | ⚠️ opz. (rigenerabile da file) | v2 (M5)        |
| SignalType                          | `signal_types`           | signal-explorer         | ✅ (solo voci utente)          | v3 (M7)        |
| Satellite                           | `satellites`             | satellite-explorer      | ✅                             | v4 (M8)        |
| OrbitalElements                     | `orbital_elements`       | satellite-explorer      | ⚠️ opz.                        | v4 (M8)        |
| SatelliteTransmitter                | `satellite_transmitters` | satellite-explorer      | ✅                             | v4 (M8)        |
| SatellitePass                       | `satellite_passes`       | satellite-explorer      | ❌ cache derivata              | v4 (M8)        |
| Resource                            | `resources`              | resource-manager        | ✅                             | v5 (M9)        |
| ResourceCategory                    | `resource_categories`    | resource-manager        | ✅                             | v5 (M9)        |
| DxSpot                              | `dx_spots`               | dx-cluster              | ❌ effimero                    | v6 (M10)       |
| Repeater                            | `repeaters`              | repeater-explorer       | ✅                             | v7 (M11)       |
| — (aggiunta M0) AprsBookmark        | `aprs_bookmarks`         | aprs-explorer           | ✅                             | v7 (M11)       |
| — (aggiunta M0) SpaceWeatherReading | `space_weather`          | propagation             | ❌ cache                       | v8 (M12)       |

Le versioni oltre la v1 sono **pianificate**: si materializzano solo nella milestone indicata, ciascuna con la propria migrazione. Le tabelle `aprs_bookmarks` e `space_weather` non compaiono in `PROJECT.md` §7; sono necessarie per FR-APR-02 e FR-PRP-03.

### 2.1 Diagramma delle relazioni

```mermaid
erDiagram
  station_profiles ||--o{ qso_logs : "stationProfileId"
  station_profiles ||--o{ swl_receptions : "stationProfileId"
  swl_receptions ||--|| reception_details : "receptionId"
  qso_logs ||--o{ qsl_records : "subjectId (qso)"
  swl_receptions ||--o{ qsl_records : "subjectId (swl)"
  qso_logs ||--o{ attachments : "ownerId"
  swl_receptions ||--o{ attachments : "ownerId"
  qsl_records ||--o{ attachments : "ownerId"
  resources ||--o{ attachments : "ownerId"
  import_jobs ||--o{ qso_logs : "importJobId"
  import_jobs ||--o{ broadcast_schedules : "importJobId"
  data_sources ||--o{ import_jobs : "sourceKey"
  stations ||--o{ broadcast_schedules : "stationId"
  broadcast_schedules |o--o{ swl_receptions : "scheduleId"
  satellites ||--o{ orbital_elements : "satelliteId"
  satellites ||--o{ satellite_transmitters : "satelliteId"
  satellites ||--o{ satellite_passes : "satelliteId"
  satellites |o--o{ swl_receptions : "satelliteId"
  resource_categories ||--o{ resources : "categoryId"
  resource_categories ||--o{ resource_categories : "parentId"
```

---

## 3. Tabelle — schema v1 (M2)

Notazione: **PK** chiave primaria, **IDX** indicizzato, **opz.** opzionale. I tipi sono quelli TypeScript/Zod.

### `station_profiles`

Profilo della stazione (fissa, portatile, SWL). Un solo profilo predefinito.

| Campo                       | Tipo                                          | Note                                                                                                    |
| --------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `id`                        | uuid                                          | PK                                                                                                      |
| `name`                      | string                                        | Es. "Casa", "Portatile SOTA"                                                                            |
| `kind`                      | `'ham' \| 'swl' \| 'both'`                    | IDX                                                                                                     |
| `callsign`                  | string opz.                                   | IDX; obbligatorio se `kind ≠ 'swl'`                                                                     |
| `swlId`                     | string opz.                                   | Identificativo SWL (es. `I-12345`)                                                                      |
| `operatorName`              | string opz.                                   |                                                                                                         |
| `locator`                   | string opz.                                   | Maidenhead 6 car. consigliato                                                                           |
| `lat`, `lon`                | number opz.                                   | Derivati dal locator se non forniti; fonte indicata in `positionSource: 'locator' \| 'manual' \| 'gps'` |
| `altitudeM`                 | number opz.                                   | Per calcoli satellitari                                                                                 |
| `qth`, `country`            | string opz.                                   |                                                                                                         |
| `dxcc`, `cqZone`, `ituZone` | number opz.                                   |                                                                                                         |
| `equipment`                 | `{ rig?, receiver?, antenna?, powerW? }` opz. | Testo libero                                                                                            |
| `isDefault`                 | `0 \| 1`                                      | IDX; vincolo applicativo: esattamente uno a `1`                                                         |
| `createdAt`, `updatedAt`    | iso                                           |                                                                                                         |

### `qso_logs`

| Campo                    | Tipo                                            | Note                                                             |
| ------------------------ | ----------------------------------------------- | ---------------------------------------------------------------- |
| `id`                     | uuid                                            | PK                                                               |
| `stationProfileId`       | uuid                                            | IDX → `station_profiles`                                         |
| `callsign`               | string                                          | IDX; nominativo del corrispondente                               |
| `datetimeOn`             | iso                                             | IDX; inizio QSO                                                  |
| `datetimeOff`            | iso opz.                                        | ≥ `datetimeOn`                                                   |
| `frequencyHz`            | int                                             | TX                                                               |
| `frequencyRxHz`          | int opz.                                        | Split                                                            |
| `band`                   | string                                          | IDX; derivata (`'20m'`, `'2m'`, `'70cm'`) con valori ADIF `BAND` |
| `mode`                   | string                                          | IDX; enumerazione ADIF `MODE`                                    |
| `submode`                | string opz.                                     | ADIF `SUBMODE` (es. `USB`, `FT4`)                                |
| `rstSent`, `rstRcvd`     | string opz.                                     | Validati in base al modo                                         |
| `txPowerW`               | number opz.                                     |                                                                  |
| `name`, `qth`            | string opz.                                     |                                                                  |
| `gridsquare`             | string opz.                                     | Locator del corrispondente                                       |
| `lat`, `lon`             | number opz.                                     | Derivati da `gridsquare`                                         |
| `country`                | string opz.                                     |                                                                  |
| `dxcc`                   | int opz.                                        | IDX; codice entità ADIF                                          |
| `cqZone`, `ituZone`      | int opz.                                        |                                                                  |
| `continent`              | `'AF'\|'AN'\|'AS'\|'EU'\|'NA'\|'OC'\|'SA'` opz. |                                                                  |
| `potaRef`, `sotaRef`     | string opz.                                     | Riferimento del corrispondente                                   |
| `myPotaRef`, `mySotaRef` | string opz.                                     | Riferimento proprio                                              |
| `contestId`              | string opz.                                     |                                                                  |
| `comment`, `notes`       | string opz.                                     | `comment` ↔ ADIF `COMMENT`, `notes` ↔ ADIF `NOTES`               |
| `adifExtra`              | `Record<string, string>` opz.                   | Campi ADIF non mappati, conservati per l'export                  |
| `origin`                 | `'manual' \| 'adif-import' \| 'restore'`        |                                                                  |
| `importJobId`            | uuid opz.                                       | IDX                                                              |
| `isSample`               | `1` opz.                                        |                                                                  |
| `createdAt`, `updatedAt` | iso                                             |                                                                  |

Indici composti: `[band+mode]`, `[callsign+datetimeOn]` (duplicati e storico per nominativo), `[stationProfileId+datetimeOn]`.

### `swl_receptions`

| Campo                        | Tipo                                                                                                | Note                                                     |
| ---------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `id`                         | uuid                                                                                                | PK                                                       |
| `stationProfileId`           | uuid                                                                                                | IDX                                                      |
| `category`                   | `'broadcast' \| 'amateur' \| 'utility' \| 'digital' \| 'aeronautical' \| 'maritime' \| 'satellite'` | IDX                                                      |
| `datetimeStart`              | iso                                                                                                 | IDX                                                      |
| `datetimeEnd`                | iso opz.                                                                                            |                                                          |
| `frequencyHz`                | int                                                                                                 | IDX                                                      |
| `band`                       | string opz.                                                                                         | Derivata (bande metriche broadcast o radioamatoriali)    |
| `modulation`                 | string                                                                                              | `AM`, `USB`, `LSB`, `CW`, `FM`, `DRM`, `NFM`, `DIGITAL`… |
| `stationName`                | string                                                                                              | IDX; nome/identificativo della stazione ascoltata        |
| `stationId`                  | uuid opz.                                                                                           | → `stations`                                             |
| `country`                    | string opz.                                                                                         | IDX; codice ITU/ISO dichiarato                           |
| `language`                   | string opz.                                                                                         | IDX                                                      |
| `sinpo`                      | string opz.                                                                                         | 5 cifre `1-5`, es. `45444`                               |
| `rst`                        | string opz.                                                                                         |                                                          |
| `receiverLocator`            | string opz.                                                                                         | Se diverso dal profilo (portatile)                       |
| `receiverLat`, `receiverLon` | number opz.                                                                                         |                                                          |
| `equipment`                  | `{ receiver?, antenna?, software? }` opz.                                                           |                                                          |
| `notes`                      | string opz.                                                                                         |                                                          |
| `scheduleId`                 | uuid opz.                                                                                           | → `broadcast_schedules` (FR-SWL-09)                      |
| `satelliteId`                | uuid opz.                                                                                           | → `satellites`                                           |
| `isSample`                   | `1` opz.                                                                                            |                                                          |
| `createdAt`, `updatedAt`     | iso                                                                                                 |                                                          |

Indici composti: `[category+datetimeStart]`.

### `reception_details`

Dati specifici per categoria, relazione 1:1 con `swl_receptions`. Schema Zod **discriminato** su `category`.

| Campo                    | Tipo               | Note                             |
| ------------------------ | ------------------ | -------------------------------- |
| `id`                     | uuid               | PK                               |
| `receptionId`            | uuid               | IDX univoco (`&receptionId`)     |
| `category`               | come sopra         | Deve coincidere con la ricezione |
| `data`                   | union discriminata | Vedi tabella                     |
| `createdAt`, `updatedAt` | iso                |                                  |

| Categoria      | Campi di `data` (tutti opzionali salvo indicazione)                                                                                                                                           |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `broadcast`    | `programme`, `targetArea`, `transmitterSite`, `powerKw`, `scheduleSource` (`'eibi' \| 'hfcc' \| 'manual'`), `qslRequested: boolean`                                                           |
| `amateur`      | `callsignHeard` (obbl.), `workingCallsign`, `amateurMode`, `heardLocator`                                                                                                                     |
| `utility`      | `serviceType` (`'time-signal' \| 'beacon' \| 'weather' \| 'navtex' \| 'military' \| 'other'`), `identifier`, `scheduleNote`                                                                   |
| `digital`      | `digitalMode` (obbl., es. `RTTY`, `PSK31`, `FT8`, `DRM`, `HFDL`, `STANAG 4285`), `baudRate`, `shiftHz`, `decoderSoftware`, `decoded: boolean`                                                 |
| `aeronautical` | `service` (`'volmet' \| 'hf-atc' \| 'hfdl' \| 'acars' \| 'other'`), `groundStation`, `region` — **nessun campo per il contenuto dei messaggi** (FR-SWL-04)                                    |
| `maritime`     | `service` (`'coast-station' \| 'navtex' \| 'dsc' \| 'weather' \| 'other'`), `coastStation`, `navtexId` — **nessun campo per il contenuto dei messaggi** né per identificativi di navi private |
| `satellite`    | `satelliteName` (obbl.), `noradId`, `downlinkMode`, `aos`, `los`, `maxElevationDeg`                                                                                                           |

### `qsl_records`

Unica fonte di verità sugli stati QSL (D-12 in [Architettura](ARCHITECTURE.md#132-divergenze-e-lacune-da-risolvere-nella-milestone-indicata)).

| Campo                                                | Tipo                                                              | Note                            |
| ---------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------- |
| `id`                                                 | uuid                                                              | PK                              |
| `subjectType`                                        | `'qso' \| 'swl'`                                                  |                                 |
| `subjectId`                                          | uuid                                                              | → `qso_logs` o `swl_receptions` |
| `channel`                                            | `'paper' \| 'eqsl' \| 'lotw' \| 'qrz' \| 'clublog' \| 'other'`    | IDX                             |
| `via`                                                | `'bureau' \| 'direct' \| 'manager' \| 'electronic'` opz.          |                                 |
| `managerCallsign`                                    | string opz.                                                       |                                 |
| `status`                                             | `'pending' \| 'requested' \| 'sent' \| 'received' \| 'confirmed'` | IDX; stato corrente             |
| `requestedAt`, `sentAt`, `receivedAt`, `confirmedAt` | iso opz.                                                          | Data di ogni transizione        |
| `notes`                                              | string opz.                                                       |                                 |
| `origin`                                             | `'manual' \| 'adif-import'`                                       |                                 |
| `importJobId`                                        | uuid opz.                                                         |                                 |
| `createdAt`, `updatedAt`                             | iso                                                               |                                 |

Indici: `[subjectType+subjectId]`, `[channel+status]`. Vincolo applicativo: al più un record per `(subjectType, subjectId, channel)`.

Mapping ADIF (M3): `QSL_SENT/QSL_RCVD/QSLSDATE/QSLRDATE/QSL_VIA` → canale `paper`; `LOTW_QSL_SENT/LOTW_QSL_RCVD/LOTW_QSLSDATE/LOTW_QSLRDATE` → `lotw`; `EQSL_QSL_*` → `eqsl`; `QRZCOM_QSO_UPLOAD_*`/`QRZCOM_QSO_DOWNLOAD_*` → `qrz`. Valori ADIF `Y/N/R/Q/I` mappati sugli stati (tabella dettagliata in M3).

### `attachments`

| Campo       | Tipo                                              | Note                                                                                 |
| ----------- | ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `id`        | uuid                                              | PK                                                                                   |
| `ownerType` | `'qso' \| 'swl_reception' \| 'qsl' \| 'resource'` |                                                                                      |
| `ownerId`   | uuid                                              |                                                                                      |
| `fileName`  | string                                            | Sanitizzato                                                                          |
| `mimeType`  | string                                            | Lista ammessa: immagini, audio, PDF, testo                                           |
| `sizeBytes` | int                                               | ≤ limite configurato (default 20 MB)                                                 |
| `sha256`    | string                                            | IDX; deduplicazione                                                                  |
| `blob`      | Blob                                              | Contenuto binario in IndexedDB ([ADR-0009](../adr/0009-attachments-in-indexeddb.md)) |
| `createdAt` | iso                                               |                                                                                      |

Indice composto: `[ownerType+ownerId]`. Le query di elenco **non** devono caricare `blob` inutilmente: i repository espongono metadati e contenuto con metodi distinti.

### `settings`

Chiave-valore per preferenze applicative.

| Campo       | Tipo                                         | Note                                    |
| ----------- | -------------------------------------------- | --------------------------------------- |
| `key`       | string                                       | PK (`'app'`, `'dashboard'`, `'units'`…) |
| `value`     | JSON validato con lo schema Zod della chiave |                                         |
| `updatedAt` | iso                                          |                                         |

Chiavi in uso (M2, Blocco D; schemi in `settings-backup/domain/preferences.ts`, [ADR-0016](../adr/0016-persistent-preferences-startup-and-tabs.md)). IndexedDB è l'unica fonte di verità delle preferenze: nessuna copia in `localStorage`.

| Chiave      | Valore                                     | Default               | Note                                                                                                                                 |
| ----------- | ------------------------------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `app`       | `{ theme: 'system' \| 'light' \| 'dark' }` | `{ theme: 'system' }` | FR-DSH-06, FR-SET-02                                                                                                                 |
| `dashboard` | `{ favorites: string[] }`                  | `{ favorites: [] }`   | FR-DSH-03: id dei moduli in ordine di fissaggio, senza ripetizioni, massimo 32; id sconosciuti conservati e ignorati dalla dashboard |
| `units`     | —                                          | —                     | Pianificata (M3/M6: unità di frequenza e lunghezza)                                                                                  |

Un valore salvato che non rispetta più lo schema della sua chiave (es. scritto da una versione più recente) non viene corretto in silenzio: la lettura usa il default, l'interfaccia lo segnala e la modifica successiva lo sostituisce.

### `data_sources`

Registro delle fonti esterne e del loro stato locale (FR-SET-08, FR-DSH-05).

| Campo                | Tipo                                    | Note                                                                                                                 |
| -------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `key`                | string                                  | PK stabile (`'eibi'`, `'hfcc'`, `'celestrak'`, `'satnogs'`, …) — eccezione all'UUID: è un identificatore di catalogo |
| `accessMode`         | `'native' \| 'manual-import' \| 'link'` | Dichiarato nel codice, copiato qui per diagnostica                                                                   |
| `lastAttemptAt`      | iso opz.                                |                                                                                                                      |
| `lastSuccessAt`      | iso opz.                                |                                                                                                                      |
| `lastError`          | string opz.                             |                                                                                                                      |
| `datasetVersion`     | string opz.                             | Es. stagione `A26`, epoca più recente                                                                                |
| `nextAllowedFetchAt` | iso opz.                                | Rispetto del rate limit                                                                                              |

I metadati statici (nome, licenza, URL) restano nel `ProviderDescriptor` nel codice; la tabella contiene solo lo stato.

### `import_jobs`

| Campo                     | Tipo                                                                                           | Note                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `id`                      | uuid                                                                                           | PK                                        |
| `kind`                    | `'adif' \| 'eibi' \| 'hfcc' \| 'tle' \| 'omm' \| 'satnogs' \| 'raindrop' \| 'csv' \| 'backup'` | IDX                                       |
| `sourceKey`               | string opz.                                                                                    | → `data_sources.key`                      |
| `fileName`                | string opz.                                                                                    |                                           |
| `fileSha256`              | string opz.                                                                                    | Rileva il re-import dello stesso file     |
| `datasetVersion`          | string opz.                                                                                    |                                           |
| `status`                  | `'committed' \| 'failed' \| 'cancelled'`                                                       | IDX                                       |
| `startedAt`, `finishedAt` | iso                                                                                            | IDX su `startedAt`                        |
| `counts`                  | `{ total, valid, invalid, duplicates, inserted, updated, skipped }`                            |                                           |
| `errors`                  | `Array<{ location: string, field?: string, code: string, message: string }>`                   | Max 500 voci, poi `errorsTruncated: true` |
| `options`                 | object opz.                                                                                    | Politica duplicati ecc.                   |

Il job viene scritto **nella stessa transazione** del commit (o da solo in caso di fallimento/annullamento). L'anteprima non produce scritture.

---

## 4. Tabelle pianificate (M5–M12)

Descritte qui per validare il modello complessivo; dettagli e indici definitivi si fissano nella milestone, con nuova versione di schema.

### `stations` (v2, M5)

`id`, `name` (IDX), `kind` (`'broadcast' \| 'utility' \| 'other'`), `country` (IDX, codice ITU), `callsign?`, `homepage?`, `notes?`, `sourceKey?`, `createdAt`, `updatedAt`. Popolata dagli import (deduplicata per `name+country`) o a mano.

### `frequencies` (v2, M5)

Memorie/catalogo personale: `id`, `frequencyHz` (IDX), `bandwidthHz?`, `mode`, `service?`, `label`, `stationId?`, `tags: string[]` (IDX multiEntry `*tags`), `notes?`, `sourceKey?`, `createdAt`, `updatedAt`.

### `broadcast_schedules` (v2, M5)

| Campo                      | Tipo               | Note                                                                                                                                                                               |
| -------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                       | uuid               | PK                                                                                                                                                                                 |
| `importJobId`              | uuid               | IDX; identifica il dataset                                                                                                                                                         |
| `sourceKey`                | `'eibi' \| 'hfcc'` |                                                                                                                                                                                    |
| `season`                   | string             | IDX; `A26`, `B26`                                                                                                                                                                  |
| `frequencyHz`              | int                | IDX (EiBi è in kHz con decimali e HFCC in kHz interi → ×1000, con arrotondamento)                                                                                                  |
| `startMinute`, `endMinute` | int `0..1440`      | Fasce a cavallo di mezzanotte: `endMinute < startMinute`                                                                                                                           |
| `days`                     | int bitmask opz.   | Lun=1 … Dom=64; assente = tutti i giorni                                                                                                                                           |
| `validFrom`, `validTo`     | date opz.          | Colonne Start/Stop di EiBi, `FDATE`/`TDATE` di HFCC (`DDMMYY`)                                                                                                                     |
| `stationName`              | string             | IDX                                                                                                                                                                                |
| `stationId`                | uuid opz.          |                                                                                                                                                                                    |
| `itu`                      | string opz.        | IDX; paese ITU                                                                                                                                                                     |
| `language`                 | string opz.        | IDX                                                                                                                                                                                |
| `targetArea`               | string opz.        | EiBi `Target`; HFCC zone CIRAF (es. `4,9,27,37-39`)                                                                                                                                |
| `transmitterSite`          | string opz.        | EiBi colonna sito; HFCC `LOC` (codice da `site.txt`)                                                                                                                               |
| `powerKw`, `azimuthDeg`    | number opz.        | HFCC `POWR`, `AZIMUTH`                                                                                                                                                             |
| `hfcc`                     | object opz.        | Solo HFCC: `{ adm, broadcaster, fmo, modulation, antennaCode, slew, requestId }` (colonne `ADM`, `BRC`, `FMO`, `MOD`, `ANT`, `SLW`, `REQ#`); mappatura definitiva dopo HFCC-DEP-01 |
| `remarks`                  | string opz.        |                                                                                                                                                                                    |
| `raw`                      | string             | Riga originale                                                                                                                                                                     |

Indici composti: `[season+frequencyHz]`. La query "in onda ora" filtra per frequenza/indice e poi in memoria per minuto/giorno (A26: 9 593 righe EiBi, 3 388 record HFCC: entro NFR-PERF-05).

### `signal_types` (v3, M7)

`id`, `name` (IDX), `aliases: string[]` (IDX `*aliases`), `category` (IDX), `modulation`, `bandwidthHz?: { min?, max? }`, `frequencyRanges: Array<{ minHz, maxHz }>`, `description` (testo redatto in proprio), `externalUrl?`, `media?: Array<{ url, kind, license }>`, `origin: 'bundled' \| 'user'`, `createdAt`, `updatedAt`. Le voci `bundled` provengono da un JSON versionato nel repository e vengono sincronizzate da migrazione/seed; non entrano nel backup.

### `satellites` (v4, M8)

`id`, `noradId` (IDX univoco `&noradId`), `name` (IDX), `alternateNames: string[]`, `satnogsId?`, `status: 'alive' \| 'dead' \| 'reentered' \| 'unknown'` (IDX), `statusSource?`, `notes?`, `createdAt`, `updatedAt`.

### `orbital_elements` (v4, M8)

`id`, `satelliteId` (IDX), `noradId` (IDX), `epoch` (iso, IDX), `format: 'tle' \| 'omm'`, `tleLine1?`, `tleLine2?`, `omm?` (oggetto OMM validato), `sourceKey`, `importJobId?`, `fetchedAt`. Si conserva l'ultimo set per satellite (più eventualmente il precedente); i vecchi vengono eliminati nella stessa transazione.

### `satellite_transmitters` (v4, M8)

`id`, `satelliteId` (IDX), `noradId` (IDX), `externalUuid` (UUID SatNOGS, IDX univoco), `description`, `type`, `uplinkLowHz?`, `uplinkHighHz?`, `downlinkLowHz?`, `downlinkHighHz?`, `mode?`, `uplinkMode?`, `baud?`, `invert`, `status: 'active' \| 'inactive' \| 'invalid'`, `alive: boolean`, `sourceUpdatedAt?`, `importJobId`, `raw`.

### `satellite_passes` (v4, M8) — cache derivata

`id`, `satelliteId` (IDX), `stationProfileId`, `elementsId`, `aos` (IDX), `tca`, `los`, `maxElevationDeg`, `aosAzimuthDeg`, `losAzimuthDeg`, `computedAt`. Invalidata quando cambiano elementi o profilo; mai inclusa nel backup.

### `resource_categories` (v5, M9)

`id`, `name`, `parentId?` (IDX), `path` (IDX, es. `Hobbies/Ham Radio`), `sortOrder`, `origin: 'raindrop' \| 'user'`, `createdAt`, `updatedAt`.

### `resources` (v5, M9)

`id`, `url`, `normalizedUrl` (IDX, duplicati), `title` (IDX), `description?`, `categoryId?` (IDX), `tags: string[]` (IDX `*tags`), `isFavorite: 0 \| 1` (IDX), `addedAt?` (da `ADD_DATE`, epoch → ISO), `sourceModifiedAt?` (`LAST_MODIFIED`), `coverUrl?` (non caricata automaticamente), `origin: 'raindrop' \| 'user'`, `importJobId?`, `createdAt`, `updatedAt`.

### `dx_spots` (v6, M10) — effimera

`id`, `externalId?` (IDX univoco per fonte: `[sourceKey+externalId]`), `sourceKey`, `dxCallsign` (IDX), `spotterCallsign`, `frequencyHz` (IDX), `band` (IDX), `mode?`, `comment?`, `spottedAt` (IDX), `fetchedAt`, `dxCountry?`. Pulizia automatica dei record con `fetchedAt` > 24 h.

### `repeaters` (v7, M11)

`id`, `callsign` (IDX), `name?`, `outputHz` (IDX), `inputHz?`, `offsetHz?` (derivato, con segno), `mode` (IDX: `'FM' \| 'DMR' \| 'DSTAR' \| 'C4FM' \| 'NXDN' \| 'TETRA' \| 'P25' \| 'MULTI' \| 'OTHER'`), `ctcssTxDeciHz?`, `ctcssRxDeciHz?`, `dcsCode?`, `dmrColorCode?`, `dmrTalkgroups?`, `lat?`, `lon?`, `locator?` (IDX), `qth?`, `region?`, `country?`, `status: 'active' \| 'inactive' \| 'unknown'`, `origin: 'user' \| 'csv-import'`, `sourceNote?`, `notes?`, `createdAt`, `updatedAt`. La ricerca per distanza calcola in memoria (cataloghi personali: centinaia/migliaia di voci).

### `aprs_bookmarks` (v7, M11)

`id`, `callsign` (IDX), `ssid?`, `label?`, `notes?`, `createdAt`, `updatedAt`.

### `space_weather` (v8, M12) — cache

`id`, `sourceKey`, `metric` (`'sfi' \| 'kp' \| 'a' \| 'xray' \| 'solarWindSpeed' \| …`), `kind: 'observed' \| 'forecast'`, `timeTag` (iso, IDX), `value`, `unit`, `fetchedAt`. Indice composto `[metric+timeTag]`. Conservazione: 30 giorni.

---

## 5. Definizione Dexie (versione 1, implementata)

Schema della **versione 1** implementato in `src/infrastructure/db/schema.ts` (`SCHEMA_V1`, oggetto congelato), identico a questa dichiarazione. `tests/integration/db/migrations.spec.ts` confronta `SCHEMA_V1` con questo testo e `tests/integration/db/app-database.spec.ts` verifica lo schema fisico creato in IndexedDB (versione nativa 10, cioè v1 × 10, chiavi, indici semplici, composti e univoci).

```ts
db.version(1).stores({
  station_profiles: "id, kind, callsign, isDefault",
  qso_logs:
    "id, stationProfileId, callsign, datetimeOn, band, mode, dxcc, importJobId, " +
    "[band+mode], [callsign+datetimeOn], [stationProfileId+datetimeOn]",
  swl_receptions:
    "id, stationProfileId, category, datetimeStart, frequencyHz, stationName, country, language, " +
    "[category+datetimeStart]",
  reception_details: "id, &receptionId",
  qsl_records: "id, channel, status, [subjectType+subjectId], [channel+status]",
  attachments: "id, sha256, [ownerType+ownerId]",
  settings: "key",
  data_sources: "key",
  import_jobs: "id, kind, status, startedAt",
});
```

Solo i campi indicizzati compaiono nella stringa; gli altri sono memorizzati ma non dichiarati (comportamento standard Dexie).

Accesso alle tabelle: `AppDatabase` (`src/infrastructure/db/app-database.ts`) con `EntityTable<T, 'id'>` (`'key'` per `settings` e `data_sources`), dove `T` è il tipo dello schema Zod dell'entità. Solo il codice di infrastructure lo usa; il resto dell'app dipende dalle porte ([ADR-0014](../adr/0014-repositories-unit-of-work-and-persistence-errors.md)).

---

## 6. Integrità referenziale (applicativa)

IndexedDB non ha chiavi esterne: l'integrità è garantita dai repository e coperta da test di integrazione (`tests/integration/db/referential-integrity.spec.ts` e test per repository). Ogni operazione esegue controlli e scritture in un'unica transazione Dexie, con l'ambito di tabelle dichiarato in `src/infrastructure/db/integrity.ts` (`SCOPES`); i controlli precedono qualsiasi scrittura.

| Operazione                                         | Regola                                                                                                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Elimina `qso_logs`                                 | Cascata su `qsl_records` (`subjectType='qso'`) e `attachments` (`ownerType='qso'`), stessa transazione.                                                             |
| Elimina `swl_receptions`                           | Cascata su `reception_details`, `qsl_records` (`swl`), `attachments`.                                                                                               |
| Elimina `qsl_records`                              | Cascata su `attachments` (`qsl`).                                                                                                                                   |
| Elimina `station_profiles`                         | **Bloccata** se referenziato da QSO/ricezioni (proposta di riassegnazione). Non si può eliminare l'ultimo profilo.                                                  |
| Elimina dataset (`import_jobs` di tipo palinsesto) | Cascata su `broadcast_schedules`; i riferimenti `swl_receptions.scheduleId` restano ma diventano "orfani tollerati" (la ricezione conserva i propri dati testuali). |
| Elimina `satellites`                               | Cascata su `orbital_elements`, `satellite_transmitters`, `satellite_passes`; `swl_receptions.satelliteId` → orfano tollerato.                                       |
| Elimina `resource_categories`                      | Figli e risorse spostati nella categoria padre (o radice).                                                                                                          |
| Verifica orfani                                    | Funzione diagnostica in Impostazioni (FR-SET-04) che segnala e, su conferma, ripulisce gli orfani non tollerati.                                                    |

Regole di scrittura implementate in M2 (oltre alle cancellazioni):

| Tabella             | Regola                                                                                                                                                                                                                                                                                                                 | Errore                                                                                                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `station_profiles`  | Con almeno un profilo, esattamente uno ha `isDefault: 1`: il primo diventa predefinito; un nuovo predefinito (`create` con `isDefault: 1` o `setDefault`) azzera il precedente; eliminando il predefinito si promuove il profilo più vecchio. `update` non modifica `isDefault`.                                       | —                                                                                                                                                                                          |
| `station_profiles`  | Eliminazione bloccata se referenziato da `qso_logs` o `swl_receptions`, o se è l'ultimo profilo.                                                                                                                                                                                                                       | `conflict/referenced` (`station-profile.referenced`), `conflict/invariant` (`station-profile.last`)                                                                                        |
| `qso_logs`          | `stationProfileId` deve esistere (in creazione e quando cambia).                                                                                                                                                                                                                                                       | `conflict/missing-reference` (`qso.station-profile-missing`)                                                                                                                               |
| `swl_receptions`    | `stationProfileId` deve esistere. `stationId`, `scheduleId`, `satelliteId` puntano a tabelle delle versioni successive: non verificati (orfani tollerati).                                                                                                                                                             | `conflict/missing-reference` (`swl.station-profile-missing`)                                                                                                                               |
| `reception_details` | Scritti con la ricezione (aggregato). `category` uguale a quella della ricezione; cambiando categoria a una ricezione con dettagli servono nuovi dettagli (o `null`) nello stesso aggiornamento.                                                                                                                       | `conflict/invariant` (`reception-details.category-mismatch`)                                                                                                                               |
| `qsl_records`       | Il soggetto (`qso_logs` o `swl_receptions`, secondo `subjectType`) deve esistere; al più un record per soggetto e canale; il soggetto non cambia dopo la creazione.                                                                                                                                                    | `conflict/missing-reference` (`qsl-record.subject-missing`), `conflict/duplicate` (`qsl-record.channel-taken`)                                                                             |
| `attachments`       | Il proprietario deve esistere; `ownerType: 'resource'` rifiutato fino alla v5 (M9); stesso `sha256` sullo stesso proprietario rifiutato; contenuti uguali su proprietari diversi restano righe distinte ([ADR-0009](../adr/0009-attachments-in-indexeddb.md)); dimensione entro il limite configurato (default 20 MB). | `conflict/missing-reference` (`attachment.owner-missing`, `attachment.owner-type-unavailable`), `conflict/duplicate` (`attachment.same-content`), `invalid-input` (`attachment.too-large`) |

Ogni scrittura passa prima dallo schema dell'entità (`persistence.invalid-input` con l'elenco delle issue). Le operazioni concorrenti sono serializzate da IndexedDB: i test verificano che `setDefault`, creazioni di QSL sullo stesso canale e caricamenti dello stesso allegato in parallelo lascino uno stato coerente, e che una cancellazione concorrente con la creazione di una QSL non lasci orfani.

---

## 7. Migrazioni

- Ogni modifica di schema = `db.version(n + 1).stores({...}).upgrade(tx => …)`; le versioni precedenti restano nel codice invariate ([ADR-0006](../adr/0006-dexie-naming-and-migrations.md)).
- Le migrazioni di dati sono funzioni pure `migrateVnToVn1(record)` riutilizzate anche dal **restore** di backup vecchi.
- Test obbligatori per ogni migrazione: database popolato alla versione `n` con `fake-indexeddb` → apertura alla `n+1` → verifica di dati e indici.
- Registro migrazioni in questo documento (§ 7.1 _Storico versioni_).
- Gestione `versionchange`/`blocked`: se un'altra scheda tiene aperto il DB vecchio, l'app chiude la connessione e chiede il ricaricamento.

Implementazione (M2, [ADR-0014](../adr/0014-repositories-unit-of-work-and-persistence-errors.md)):

| Elemento                    | Dove / come                                                                                                                                                                                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Versioni di schema          | `SCHEMA_VERSIONS` in `src/infrastructure/db/schema.ts`: per ogni versione la dichiarazione `stores()` e la migrazione dei dati dalla precedente. `applySchemaVersions` rifiuta versioni non consecutive o migrazioni che non portano alla versione dichiarata. |
| Trasformazioni dei dati     | `RecordMigration` (funzioni pure per tabella, `null` = elimina il record) in `src/infrastructure/db/migrations/record-migration.ts`, senza dipendenze da Dexie. `migrateTables` le applica in sequenza a un insieme di record (restore, Blocco C).             |
| Upgrade Dexie               | `toDexieUpgrade` applica la stessa `RecordMigration` dentro la transazione di upgrade: un errore annulla l'intero upgrade e il database resta alla versione precedente con i suoi dati (testato).                                                              |
| Migrazione dei backup       | Separata dall'upgrade: riusa solo le funzioni pure tramite la porta `BackupGateway.migrate` (Blocco C). Le modifiche di soli indici non toccano i backup.                                                                                                      |
| Idempotenza                 | Le trasformazioni devono essere idempotenti (un record già migrato resta invariato); Dexie esegue ogni upgrade una sola volta per versione.                                                                                                                    |
| Versione più recente        | Il database con versione installata superiore a quella dell'app non viene aperto (`persistence.unavailable/newer-version`), a differenza del comportamento predefinito di Dexie 4.                                                                             |
| `versionchange` / `blocked` | `AppDatabase` chiude la connessione senza riapertura automatica e notifica `version-change`, oppure notifica `blocked` (porta `DatabaseLifecycle`). Avviso in UI: Blocco D.                                                                                    |
| Test                        | `tests/integration/db/migrations.spec.ts` con una v2 **sintetica** definita solo nel test: upgrade da v1 popolato, trasformazione, nuovo indice, rollback di un upgrade fallito. Nessuna v2 reale prima di M5.                                                 |

### 7.1 Storico versioni

| Versione | Milestone | Tabelle                                                                                                                                        | Migrazione dei dati | Stato                                                                                                                       |
| -------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1        | M2        | `station_profiles`, `qso_logs`, `swl_receptions`, `reception_details`, `qsl_records`, `attachments`, `settings`, `data_sources`, `import_jobs` | — (prima versione)  | Implementata; diventa immutabile con il deploy di produzione di M2 ([ADR-0006](../adr/0006-dexie-naming-and-migrations.md)) |
| 2        | M5        | + `stations`, `frequencies`, `broadcast_schedules`                                                                                             | da definire         | Pianificata                                                                                                                 |

---

## 8. Flusso di import (comune a tutti i formati)

```mermaid
flowchart LR
  F[File utente] --> L{Limiti<br/>dimensione/tipo}
  L -->|ok| P[Parse<br/>worker se grande]
  L -->|ko| E[Errore, nessuna scrittura]
  P --> V[Validazione Zod<br/>+ normalizzazione]
  V --> D[Rilevazione duplicati<br/>vs DB]
  D --> A[Anteprima e report]
  A -->|annulla| X[import_jobs: cancelled]
  A -->|conferma| C[Transazione unica:<br/>dati + import_jobs]
  C -->|errore| R[Rollback<br/>import_jobs: failed]
```

| Formato       | Limite file (proposta)    | Parser                                                                                                                                                                                                                   |
| ------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ADIF `.adi`   | 50 MB                     | Tokenizzatore `<FIELD:len[:type]>` con gestione `<EOH>`/`<EOR>`, lunghezza in byte UTF-8                                                                                                                                 |
| EiBi CSV      | 10 MB                     | CSV `;`, prima riga header, codifica da verificare (Latin-1 vs UTF-8) in M5                                                                                                                                              |
| HFCC `allx2`  | 20 MB (ZIP) / 50 MB (TXT) | Larghezza fissa con riga-righello; ZIP _deflate_ (verificato) decompresso con `DecompressionStream('deflate-raw')` + directory centrale, oppure dipendenza leggera con ADR ([ADR-0012](../adr/0012-hfcc-in-v1-scope.md)) |
| TLE / OMM     | 10 MB                     | Checksum TLE verificato; OMM JSON validato con Zod                                                                                                                                                                       |
| SatNOGS JSON  | 20 MB                     | Validazione Zod dei campi usati                                                                                                                                                                                          |
| Raindrop HTML | 10 MB                     | `DOMParser`                                                                                                                                                                                                              |
| CSV generico  | 10 MB                     | Parser CSV con mapping colonne                                                                                                                                                                                           |
| Backup JSON   | 100 MB (limite operativo) | Lettura progressiva con validazione per record (§ 9, [ADR-0015](../adr/0015-backup-format-and-atomic-restore.md)); 500 MB resta un obiettivo, non supportato in v1                                                       |

---

### 8.1 Pipeline generica (M2, Blocco C)

Implementata in `src/shared/application/create-import-pipeline.ts` (contratto in `import-pipeline.ts`); i formati reali arrivano con le milestone (ADIF M3, EiBi/HFCC M5, TLE/OMM/SatNOGS M8, Raindrop M9).

| Elemento                 | Contratto                                                                                                                                                                                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ImportFormat<T>`        | `matches(file, head)` (identificazione da nome e primi 4 KB), `maxBytes`, `encoding`, `parse(text)` (record con posizione o `ignored` con codice), `normalize(data)` (core domain + Zod, issue `{ field, code }`).                                       |
| `ImportTarget<T>`        | Fornito dal modulo proprietario: `identity` (duplicati nel file), `match` (solo letture: `new`, `duplicate`, `conflict` con `existingId`), `write(value, decision)` (`insert` o `replace`) nell'unità.                                                   |
| `preview(file, formats)` | Limite di dimensione, SHA-256 del file, lettura (UTF-8 stretto), parsing, validazione, duplicati nel file e nel database, job precedenti con lo stesso hash (`previousImports`). Nessuna scrittura, interrompibile con `AbortSignal`.                    |
| `commit(preview)`        | Una `UnitOfWork`: ripete `match` (anteprima superata → `import.preview-stale`), scrive il job `committed` e i record con `importJobId`. Errore come `Result` o eccezione → rollback e job `failed` scritto da solo; politica conflitti `skip`/`replace`. |
| `cancel(preview)`        | Solo un job `cancelled`.                                                                                                                                                                                                                                 |

Conteggi del job (schema v1 fisso): `duplicates` = ripetuti nel file + uguali al database + in conflitto; `skipped` = validi o ignorati non scritti, quindi `inserted + updated + skipped = valid + ignored`. Codici: `import.file-empty`, `import.file-too-large`, `import.file-unreadable`, `import.encoding-invalid`, `import.format-unknown`, `import.format-invalid`, `import.preview-stale`, `import.duplicate-in-file`, `operation.aborted`, più i `persistence.*`.

## 9. Backup e restore

Implementazione M2 (Blocco C) e decisioni in [ADR-0015](../adr/0015-backup-format-and-atomic-restore.md). Codice: formato e casi d'uso in `src/modules/settings-backup/` (dominio `backup-manifest.ts`, application `backup-service.ts`, `restore-planner.ts`, infrastructure `json-backup-codec.ts`), lato database `src/infrastructure/db/dexie-backup-gateway.ts` (porta `BackupGateway`). Il codice di backup è caricato a richiesta (`AppContainer.loadBackupService()`), fuori dal chunk iniziale.

### 9.1 Formato v1

Un unico oggetto JSON, codifica UTF-8 senza BOM. I membri della radice hanno un **ordine fisso**, parte del formato: intestazione (con `format` per primo), `counts`, `tables`, `integrity` per ultimo.

```jsonc
{
  "format": "ham-radio-toolbox-backup",
  "backupFormatVersion": 1, // versione del contenitore
  "schemaVersion": 1, // versione dello schema Dexie al momento dell'export
  "appVersion": "0.2.0",
  "backupId": "8e0c…", // UUID v4 del backup
  "exportedAt": "2026-10-17T13:21:00Z",
  "includesAttachments": true,
  "counts": {
    "station_profiles": 1,
    "qso_logs": 1234 /* … ogni tabella del file */,
  },
  "tables": {
    "station_profiles": [
      { "callsign": "IZ1ABC", "createdAt": "…", "id": "…" /* … */ },
    ],
    "qso_logs": [/* un record per riga */],
    "attachments": [
      { "createdAt": "…", "dataBase64": "…", "fileName": "…" /* … */ },
    ],
  },
  "integrity": {
    "algorithm": "SHA-256",
    "tables": { "station_profiles": "9f2c…", "qso_logs": "…" /* … */ },
  },
}
```

| Regola            | Dettaglio                                                                                                                                                                                                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tabelle           | Tutte quelle della [§ 2](#2-mappa-entità--tabelle) marcate ✅ per la versione dello schema (v1: le 9 tabelle), nell'ordine di `TABLE_NAMES`, anche vuote. `attachments` presente **solo** se `includesAttachments: true`.                                                                 |
| Record            | Validati con lo schema dell'entità prima dell'export (un record non valido blocca il backup: `backup.source-invalid`). JSON canonico: chiavi in ordine lessicografico, nessuno spazio, un record per riga; record ordinati per chiave primaria. Stessi dati → stesso testo delle tabelle. |
| Allegati          | Metadati della tabella `attachments` più `dataBase64` (RFC 4648, alfabeto standard, con padding, canonico) al posto del `Blob`. Inclusi solo su scelta esplicita ([ADR-0009](../adr/0009-attachments-in-indexeddb.md)); +33 % di dimensione.                                              |
| `counts`          | Numero di record di ogni tabella del file; deve coincidere con i record letti.                                                                                                                                                                                                            |
| `integrity`       | SHA-256 dei byte UTF-8 dell'array di ogni tabella esattamente come scritto, da `[` a `]`. Rileva corruzione e troncamento; **non** è una firma: chi modifica il file può ricalcolarlo.                                                                                                    |
| Campi sconosciuti | Rifiutati alla radice (`backup.unknown-field`), nei record (schemi `strictObject`) e nel manifest.                                                                                                                                                                                        |
| Nome del file     | `hrt-backup-YYYYMMDD-HHMMZ.json` (UTC, da `exportedAt`).                                                                                                                                                                                                                                  |
| Fixture           | `tests/fixtures/backup/v1-basic.json`: sintetica, deve restare ripristinabile da ogni versione futura dell'app. Esclusa da Prettier e da conversioni di fine riga (`.gitattributes`).                                                                                                     |

Rispetto alla bozza di M0 (stesso contenitore e stessi nomi): `counts` precede `tables`, si aggiungono `backupId` e `integrity`, l'ordine dei membri è fissato. Il formato non è ancora stato rilasciato, quindi `backupFormatVersion` resta 1.

### 9.2 Restore

| Fase                   | Cosa avviene                                                                                                                                                                                                                                                                                                       | Scritture |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| 1. Limiti              | File vuoto → `backup.empty`; oltre il limite operativo → `backup.too-large` (prima di leggere).                                                                                                                                                                                                                    | —         |
| 2. Identificazione     | Lettura in streaming con decodifica UTF-8 stretta; radice oggetto con `format` per primo e valore corretto, altrimenti `backup.not-a-backup`.                                                                                                                                                                      | —         |
| 3. Manifest e versioni | `backupFormatVersion` diverso da 1 → `backup.format-version-unsupported`; manifest validato con Zod; `schemaVersion` più recente → `backup.schema-newer` ("aggiorna l'app"); passi di migrazione mancanti → `backup.migration-unavailable`; tabelle dichiarate coerenti con lo schema e con `includesAttachments`. | —         |
| 4. Record              | Ogni record: `JSON.parse` singolo, migrazioni pure `vN → vN+1` record per record (`null` = scartato), schema dell'entità; allegati decodificati, dimensione entro il limite, SHA-256 confrontato. Errori per tabella/indice/campo con codici stabili (primi 500).                                                  | —         |
| 5. Integrità           | Conteggi per tabella (`backup.count-mismatch`), tabelle mancanti (`backup.table-missing`), checksum (`backup.checksum-mismatch`), membro `integrity` assente (`backup.integrity-missing`).                                                                                                                         | —         |
| 6. Riferimenti         | Chiavi duplicate, un solo profilo predefinito, riferimenti interni al backup e regole di unicità di § 6 (stessi codici dei repository). Con errori il backup non è ripristinabile (`backup.has-errors`).                                                                                                           | —         |
| 7. Anteprima           | Lettura dello stato locale e piano: per ogni tabella inseriti, aggiornati, eliminati, invariati, scartati, più i conflitti.                                                                                                                                                                                        | —         |
| 8. Conferma            | `commitRestore(preview)`: esplicita, oppure `cancelRestore` (job `cancelled`).                                                                                                                                                                                                                                     | —         |
| 9. Commit              | Una `UnitOfWork` su tutte le tabelle: rilettura dello stato locale e ricalcolo del piano (diverso → `backup.preview-stale`), svuotamento/eliminazioni/scritture, **verifica dei conteggi dentro la transazione** (`backup.verification-failed`), job `committed` (`kind: 'backup'`).                               | Atomiche  |
| 10. Esito              | Effetti per tabella e conteggi verificati. Un fallimento annulla tutto e scrive un job `failed` da solo.                                                                                                                                                                                                           | Job       |

Modalità:

- **Sostituisci** (default): le tabelle del backup vengono svuotate e riempite **nella stessa transazione**, mai prima. Senza allegati nel backup, gli allegati locali il cui proprietario esiste ancora dopo il restore restano; gli altri (sarebbero orfani) vengono eliminati.
- **Unisci**: upsert per chiave, nulla di locale viene eliminato tranne i dettagli di una ricezione presa dal backup (ricezione e dettagli sono un aggregato). Il record del backup sostituisce quello locale solo se ha `updatedAt` più recente; per `attachments` (immutabili), `data_sources` e `import_jobs` vince il locale. Il profilo predefinito locale resta l'unico predefinito. Record che violerebbero un'unicità (QSL per soggetto e canale, allegato con lo stesso contenuto sullo stesso proprietario, soggetto QSL cambiato) vengono scartati e riportati come conflitti, con gli allegati di una QSL scartata.

I record ripristinati restano identici a quelli esportati (anche `origin` e `importJobId`): il round-trip è identico (NFR-REL-04). Il job del restore registra in `options` `mode`, `backupId`, `backupExportedAt`, `backupSchemaVersion`, `backupAppVersion`, `includesAttachments`, `deleted`, `conflicts`; `fileSha256` non è calcolato (servirebbe un secondo hash completo del file), il backup si riconosce dal `backupId`.

### 9.3 Compatibilità

| Caso                          | Comportamento                                                                                                                                                                 |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backup di schema precedente   | Migrato in memoria record per record con le stesse funzioni pure dell'upgrade Dexie (§ 7), poi validato.                                                                      |
| Backup di schema più recente  | Rifiutato (`backup.schema-newer`), nessuna lettura dei record.                                                                                                                |
| `backupFormatVersion` diverso | Rifiutato (`backup.format-version-unsupported`). Un nuovo contenitore (es. ZIP, M13) avrà un lettore proprio.                                                                 |
| Nuove tabelle (v2+)           | `BackupGateway.tablesOf(schemaVersion)` dice quali tabelle aspettarsi; quelle assenti in un backup vecchio restano vuote.                                                     |
| Fixture                       | `tests/fixtures/backup/v1-basic.json` si ripristina a ogni versione (test obbligatorio); il confronto byte per byte con il writer vale finché il formato è v1 e lo schema v1. |

### 9.4 Limiti operativi e memoria

| Elemento                          | Limite (configurabile)                             | Motivo                                                                                  |
| --------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| File di backup (export e restore) | 100 MB (`DEFAULT_MAX_BACKUP_BYTES`)                | Il restore tiene in memoria tutti i record validati fino al commit (transazione unica). |
| Record                            | 1 MiB di testo; allegati: base64 di 20 MB + 64 KiB | Nessun record può far crescere la memoria senza limite durante la lettura.              |
| Membri dell'intestazione          | 64 KiB                                             | Idem.                                                                                   |
| Errori riportati                  | 500 (poi `errorsTruncated`)                        | Come `import_jobs.errors`.                                                              |

**MB e MiB.** Il limite è `100 × 1024 × 1024` byte, cioè **100 MiB = 104 857 600 byte ≈ 104,9 MB** decimali; in questo documento "100 MB" indica questo valore, l'interfaccia mostra le dimensioni in unità binarie (KiB, MiB, GiB). Le misure oltre il limite di [ADR-0015](../adr/0015-backup-format-and-atomic-restore.md) (fino a 420 MB) sono state fatte alzando il limite nell'harness di test e non sono una capacità supportata; su Android nessuna misura è ancora disponibile (checklist in [ROADMAP § 7.2](../roadmap/ROADMAP.md#72-collaudo-su-tablet-android-checklist)).

Prima di generare un backup con allegati si stima la dimensione (somma di `sizeBytes` × 4/3) e si rifiuta subito un backup oltre il limite (`backup.export-too-large`, con il suggerimento di escludere gli allegati); durante la scrittura il limite è ricontrollato. Misure e motivazione del limite in [ADR-0015](../adr/0015-backup-format-and-atomic-restore.md); il supporto oltre il limite (fino ai 500 MB di § 8) richiede il restore con staging proposto per M13.

### 9.5 Procedure di recupero

| Situazione                                            | Stato dei dati                                                                                                        | Cosa fare                                                                         |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| File non valido, corrotto o troncato                  | Nessuna scrittura (fasi 1–6).                                                                                         | Usare un'altra copia del backup; il codice d'errore indica tabella e motivo.      |
| Restore fallito durante il commit (quota, errore)     | Transazione annullata: dati locali invariati, job `failed` con il codice.                                             | Liberare spazio o ripetere; la quota si verifica in Impostazioni (Blocco D).      |
| App o scheda chiusa durante il commit                 | IndexedDB annulla la transazione: dati locali invariati (verificato su Chromium, `tests/e2e/backup-browser.spec.ts`). | Ripetere il restore.                                                              |
| Anteprima superata (dati cambiati in un'altra scheda) | Nessuna scrittura (`backup.preview-stale`).                                                                           | Ripetere l'anteprima.                                                             |
| Interruzione volontaria (`AbortSignal`)               | Ammessa solo fuori dalle transazioni: nessuna scrittura.                                                              | —                                                                                 |
| Backup oltre il limite                                | Nessuna scrittura.                                                                                                    | Backup senza allegati; oltre 100 MB anche senza allegati: residuo (staging, M13). |

Nessuna risorsa temporanea persistente: export e restore non usano tabelle o database di appoggio; in caso di errore si rilasciano i riferimenti alle parti di `Blob` e allo stream del file.

---

## 10. Quota e persistenza

- All'avvio si legge solo lo stato con `navigator.storage.persisted()`; `navigator.storage.persist()` si richiede **soltanto** con il pulsante esplicito in Impostazioni ([ADR-0016](../adr/0016-persistent-preferences-startup-and-tabs.md); diverge dal testo di NFR-REL-03, da allineare); esito, diniego o assenza dell'API mostrati in Impostazioni (FR-SET-03).
- `navigator.storage.estimate()` per mostrare uso e quota; avviso oltre l'80 % (`QUOTA_WARNING_RATIO`). Uso e quota sono **stime del browser**: la quota non garantisce che lo spazio sia davvero libero sul dispositivo, e l'interfaccia lo dice.
- In caso di `QuotaExceededError` la transazione fallisce senza dati parziali; l'utente viene invitato a liberare spazio (cache, allegati, dataset). Implementato in M2: `persistence.quota-exceeded`, con rollback verificato da test su quota simulata; messaggio in UI dal Blocco D.
- Implementazione (Blocco D): porta `StorageInfo` → `createNavigatorStorageInfo` (`src/infrastructure/system/`), casi d'uso `StorageService` nel modulo `settings-backup`; un metodo assente o che solleva un'eccezione vale "il browser non lo indica".
- Indisponibilità dell'archivio (apertura fallita, `versionchange`, guasto durante una scrittura): avviso nella shell (`src/app/persistence/`), la navigazione resta disponibile e le modifiche restano in memoria con l'indicazione che potrebbero non essere salvate.

### 10.1 Verifiche da eseguire su browser reale

I test di integrazione usano `fake-indexeddb` (implementazione in memoria della specifica IndexedDB) in Node. Non sostituiscono il collaudo su Chrome per Android, che resta da eseguire (Blocco D e M13):

| #   | Verifica                                                                                                                                                                                   | Perché fake-indexeddb non basta                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| 1   | Quota esaurita reale (allegati grandi fino al riempimento) con rollback e messaggio                                                                                                        | La quota è simulata facendo fallire una richiesta; nei browser l'errore può arrivare anche al commit                        |
| 2   | Persistenza dopo chiusura dell'app installata, riavvio del tablet e pulizia della cache di sistema; effetto di `navigator.storage.persist()`                                               | Il database di test vive in memoria per la durata del test                                                                  |
| 3   | Allegati audio/immagini da 10–20 MB: scrittura, lettura, memoria usata                                                                                                                     | In Node i Blob sono clonati in memoria; nei browser sono su disco                                                           |
| 4   | Due schede con versioni diverse dell'app: `versionchange` e `blocked` con l'avviso del Blocco D (✅ Chromium desktop, `tests/e2e/settings.spec.ts`; ☐ tablet)                              | Gli eventi sono simulati con due connessioni nello stesso processo                                                          |
| 5   | Tempi di transazione con molti record (es. 10 000 QSO in un'unità), interfaccia reattiva                                                                                                   | Prestazioni e chiusura automatica delle transazioni dipendono dal motore del browser                                        |
| 6   | Navigazione privata / storage bloccato: errore `persistence.unavailable` mostrato in modo comprensibile (✅ Chromium desktop con apertura bloccata; ☐ tablet)                              | Il caso è simulato con una factory IndexedDB che rifiuta l'apertura                                                         |
| 7   | Backup e restore fino al limite operativo (100 MB, con soli record e con allegati): tempi, reattività dell'interfaccia, memoria e _blob storage                                            | Misurati su Chromium desktop ([ADR-0015](../adr/0015-backup-format-and-atomic-restore.md)); un tablet ha meno memoria e CPU |
| 8   | Download del backup (nome, Web Share) e scelta del file da ripristinare dal file system Android (✅ download e scelta del file in Chromium desktop; ☐ Android, Web Share non implementato) | Interfaccia del Blocco D                                                                                                    |

---

## 11. Differenze e precisazioni emerse nell'implementazione (M2, Blocchi B e C)

Nessuna tabella, colonna o relazione è stata aggiunta rispetto a § 3 e § 5 (nemmeno nei Blocchi C e D: lo schema v1 è invariato). Le voci seguenti chiariscono punti ambigui o rinviano regole alla milestone che le usa.

| #     | Punto                                                                                                                                 | Scelta in M2                                                                                                                                                                              |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DB-1  | § 1 dice che ogni entità utente ha `createdAt` e `updatedAt`; la tabella `attachments` (§ 3) elenca solo `createdAt`.                 | Prevale § 3: gli allegati sono immutabili (un nuovo file è una nuova riga), quindi niente `updatedAt`.                                                                                    |
| DB-2  | `qsl_records.subjectType` usa `'swl'`, `attachments.ownerType` usa `'swl_reception'` per la stessa entità.                            | Valori mantenuti come documentati (fanno parte del formato di backup); la corrispondenza è in `integrity.ts`.                                                                             |
| DB-3  | "Esattamente un profilo con `isDefault: 1`" non dice cosa accade a zero profili, al primo profilo e all'eliminazione del predefinito. | Vincolo valido quando esiste almeno un profilo; regole in § 6.                                                                                                                            |
| DB-4  | `reception_details.category` "deve coincidere con la ricezione": non è detto come si cambia la categoria.                             | Ricezione e dettagli formano un aggregato scritto in un'unica transazione; il cambio di categoria richiede nuovi dettagli (§ 6).                                                          |
| DB-5  | `attachments.ownerType: 'resource'` è nello schema v1, ma `resources` arriva con la v5.                                               | Valore accettato dallo schema, allegato rifiutato dal repository finché la tabella non esiste (M9).                                                                                       |
| DB-6  | `qso_logs.band` è "derivata" e `mode` è "enumerazione ADIF"; `swl_receptions.band` è derivata.                                        | In M2 si controlla solo il formato (`20m`, `70cm`, modo in maiuscolo). Derivazione dal band plan ed enumerazioni ADIF in M3 (BL-M3-01); banda SWL in M4.                                  |
| DB-7  | `lat`/`lon` "derivati dal locator se non forniti" (`station_profiles`, `qso_logs`).                                                   | Nessuna derivazione automatica in M2; lo schema richiede `lat` e `lon` insieme e `positionSource` solo con una posizione. Derivazione nei casi d'uso dei form (M3).                       |
| DB-8  | Campi opzionali "assenti, non `null`": una form produce stringhe vuote.                                                               | I campi di testo opzionali vuoti diventano assenti; i campi `undefined` vengono rimossi prima della scrittura (round-trip del backup identico).                                           |
| DB-9  | § 6 non prevede l'eliminazione di `import_jobs` diversi dai palinsesti.                                                               | Nessuna eliminazione dei job in v1 (storico per FR-SET-07); l'eliminazione di un dataset di palinsesto arriva con `broadcast_schedules` (M5).                                             |
| DB-10 | Dexie 4 apre un database con versione più recente di quella dichiarata.                                                               | L'app lo rifiuta (`newer-version`, § 7).                                                                                                                                                  |
| DB-11 | Le regole fra campi (es. `datetimeOff ≥ datetimeOn`) sono riportate da Zod solo se i singoli campi sono validi.                       | Comportamento accettato: i report di validazione (form, import) mostrano gli errori dei campi e poi quelli fra campi.                                                                     |
| DB-12 | La bozza di § 9.1 metteva `counts` dopo `tables` e non prevedeva identificativo né checksum.                                          | Formato v1 precisato ([ADR-0015](../adr/0015-backup-format-and-atomic-restore.md)): ordine fisso dei membri, `backupId`, `integrity` per tabella; stesso contenitore e stessi nomi.       |
| DB-13 | `qso_logs.origin` prevede `'restore'`.                                                                                                | Il restore non cambia i record (round-trip identico, NFR-REL-04): `'restore'` resta inutilizzato in v1.                                                                                   |
| DB-14 | `import_jobs.counts` ha campi fissi; anteprima e restore distinguono anche conflitti, ignorati ed eliminati.                          | Corrispondenza documentata in § 8.1 e § 9.2; eliminati e conflitti del restore nelle `options` del job.                                                                                   |
| DB-15 | `import_jobs.fileSha256` "rileva il re-import dello stesso file".                                                                     | Calcolato dalla pipeline di import; non per il restore (secondo hash completo di un file fino a 100 MB): il backup si riconosce dal `backupId` nelle `options`.                           |
| DB-16 | § 9.2 diceva "il record con `updatedAt` più recente vince" senza coprire tabelle senza `updatedAt`, aggregati e profilo predefinito.  | Regole complete di _unisci_ in § 9.2: vince il locale per `attachments`, `data_sources`, `import_jobs`; i dettagli seguono la ricezione; resta il predefinito locale; conflitti scartati. |
| DB-17 | § 8 proponeva 500 MB per il backup.                                                                                                   | Limite operativo verificato di 100 MB; oltre serve il restore con staging (M13, ADR-0015).                                                                                                |
| DB-18 | § 3 elencava le chiavi di `settings` (`'app'`, `'dashboard'`, `'units'`) senza il loro contenuto.                                     | Blocco D: `app` = `{ theme }`, `dashboard` = `{ favorites }` (tabella in § 3); `units` resta pianificata. Nessuna nuova colonna né tabella: schema v1 invariato.                          |
| DB-19 | "100 MB" senza unità precisa.                                                                                                         | 100 MiB (104 857 600 byte), § 9.4.                                                                                                                                                        |
