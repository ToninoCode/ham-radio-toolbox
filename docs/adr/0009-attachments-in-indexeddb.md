# 0009 — Allegati come Blob in IndexedDB

- **Stato**: Accettato con precisazioni (2026-10-17, avvio M2)
- **Data**: 2026-10-17
- **Milestone**: M2

## Contesto

Logbook HAM/SWL, QSL e Resource Manager prevedono allegati (foto, scansioni QSL, registrazioni audio, PDF). Nessun backend (ADR-0003). Le registrazioni audio possono pesare diversi MB; la quota dipende dal browser e dallo spazio libero.

Verifiche all'avvio di M2:

- Node 22, l'ambiente dei test di integrazione, clona i `Blob` nativi con `structuredClone` (verificato: dimensione e tipo MIME conservati). È il meccanismo con cui `fake-indexeddb` copia i valori.
- L'ambiente Vitest predefinito del progetto è `jsdom`, il cui `Blob` è una classe diversa da quella di Node. I test dei repository con allegati vanno quindi eseguiti con `// @vitest-environment node`, come già fanno i test delle regole ESLint.
- La deduplicazione "per `sha256`" della proposta è ambigua: se due proprietari condividono lo stesso contenuto, l'eliminazione a cascata di uno cancellerebbe il file dell'altro (DATABASE § 6).

## Decisione

- Allegati salvati come `Blob` nella tabella `attachments`, con metadati (`mimeType`, `sizeBytes`, `sha256`, proprietario `ownerType`/`ownerId`).
- Limite predefinito **20 MB per file**, configurabile; tipi MIME ammessi in lista bianca (immagini, audio, PDF, testo).
- **Deduplicazione limitata al proprietario**: lo stesso contenuto (`sha256`) non si allega due volte allo stesso record. Contenuti uguali su record diversi restano righe distinte, ognuna con il proprio `Blob`, e le cascate restano semplici. La deduplicazione globale (tabella dei contenuti con conteggio dei riferimenti) è esclusa dalla v1.
- L'hash SHA-256 si calcola in infrastructure (`crypto.subtle.digest`, porta `ContentHasher` o servizio file), mai nel domain.
- I repository separano lettura dei metadati e del contenuto: le liste restituiscono DTO senza `Blob`. Un'unica tabella basta: nei browser il `Blob` letto da IndexedDB è un riferimento, non una copia in memoria dei byte.
- Avviso quando l'uso stimato supera l'80 % della quota (`navigator.storage.estimate()`, porta `StorageInfo`).
- Backup: allegati inclusi in base64 solo su scelta esplicita; formato ZIP rivalutato in M13.

## Alternative considerate

| Alternativa                                          | Pro                         | Contro                                                                                |
| ---------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------- |
| Origin Private File System (OPFS)                    | Prestazioni su file grandi  | Due sistemi di storage da mantenere coerenti; transazioni non condivise con IndexedDB |
| Solo riferimento a file esterni (File System Access) | Nessun consumo di quota     | API non disponibile ovunque; i file possono sparire; offline non garantito            |
| Nessun allegato in v1                                | Semplicità                  | Contrario a PROJECT (MOD-02, MOD-03, MOD-07, MOD-09)                                  |
| Deduplicazione globale con tabella dei contenuti     | Risparmio di spazio massimo | Conteggio dei riferimenti da mantenere in ogni cascata e nel restore; più test        |

## Conseguenze

Allegati coperti dalle stesse transazioni dei record (cascate atomiche). Il backup con allegati può diventare grande: va comunicato in UI.

Questioni da risolvere nel Blocco C:

1. **Backup con allegati su tablet.** Il limite di 500 MB proposto in DATABASE § 8 non è compatibile con `JSON.parse` di un unico file in memoria su un tablet di fascia media. Per M2 serve un limite realistico (o un parsing per tabella) da misurare; lo ZIP resta in M13.
2. **Lista bianca dei tipi MIME**: elenco preciso e verifica del contenuto (non solo dell'estensione), da fissare con il primo modulo che usa gli allegati (M3/M4).
