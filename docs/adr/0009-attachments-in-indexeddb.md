# 0009 — Allegati come Blob in IndexedDB

- **Stato**: Proposto (da confermare in M2)
- **Data**: 2026-10-17
- **Milestone**: M2

## Contesto

Logbook HAM/SWL, QSL e Resource Manager prevedono allegati (foto, scansioni QSL, registrazioni audio, PDF). Nessun backend (ADR-0003). Le registrazioni audio possono pesare diversi MB; la quota dipende dal browser e dallo spazio libero.

## Decisione (proposta)

- Allegati salvati come `Blob` nella tabella `attachments`, con metadati (`mimeType`, `sizeBytes`, `sha256`, proprietario).
- Limite predefinito **20 MB per file**, configurabile; tipi MIME ammessi in lista bianca (immagini, audio, PDF, testo).
- Deduplicazione per `sha256`.
- I repository separano lettura dei metadati e del contenuto, per non caricare Blob nelle liste.
- Avviso quando l'uso stimato supera l'80 % della quota (`navigator.storage.estimate()`).
- Backup: allegati inclusi in base64 solo su scelta esplicita; formato ZIP rivalutato in M13.

## Alternative considerate

| Alternativa                                          | Pro                        | Contro                                                                                |
| ---------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------- |
| Origin Private File System (OPFS)                    | Prestazioni su file grandi | Due sistemi di storage da mantenere coerenti; transazioni non condivise con IndexedDB |
| Solo riferimento a file esterni (File System Access) | Nessun consumo di quota    | API non disponibile ovunque; i file possono sparire; offline non garantito            |
| Nessun allegato in v1                                | Semplicità                 | Contrario a PROJECT (MOD-02, MOD-03, MOD-07, MOD-09)                                  |

## Conseguenze

Allegati coperti dalle stesse transazioni dei record (cascate atomiche). Il backup con allegati può diventare grande: va comunicato in UI.
