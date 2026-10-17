# 0005 — Convenzioni dei dati persistiti

- **Stato**: Accettato
- **Data**: 2026-10-17
- **Milestone**: M0

## Contesto

`CLAUDE.md` fissa: UUID v4, frequenze in Hz interi, date UTC ISO 8601, WGS84 decimale, locator e nominativi normalizzati, Zod per ogni entità. Durante M0 sono emersi casi limite: toni CTCSS decimali (88,5 Hz), frequenze EiBi/DX Summit in kHz con decimali, orari di palinsesto senza data, chiavi di catalogo non UUID.

## Decisione

1. **ID**: UUID v4 (`crypto.randomUUID()`) per tutte le entità. Eccezioni: `settings.key` e `data_sources.key` (chiavi di catalogo stabili, non generate).
2. **Frequenze**: `number` intero in Hz, suffisso `Hz` nel nome del campo. Le sorgenti in kHz/MHz si convertono con arrotondamento all'intero più vicino al confine (parser/form). Conversioni di visualizzazione solo in presentation.
3. **Toni sub-audio (CTCSS)**: intero in **decimi di Hz**, suffisso `DeciHz` (88,5 Hz → `885`). Motivo: mantenere interi esatti senza violare la convenzione Hz per le frequenze RF.
4. **Date/ore**: stringa ISO 8601 UTC con `Z`, al secondo. Date pure `YYYY-MM-DD`. Orari ricorrenti (palinsesti) in **minuti dalla mezzanotte UTC**.
5. **Coordinate**: `lat`/`lon` WGS84 decimali; locator Maidenhead normalizzato (`JN45dl`).
6. **Nominativi**: maiuscolo, senza spazi, validati.
7. **Validazione**: schema Zod per ogni entità persistita, applicato in ingresso (form, import, restore, rete) prima della scrittura.
8. **Flag indicizzati**: `0 | 1` invece di `boolean` (IndexedDB non indicizza booleani).

## Alternative considerate

| Alternativa                        | Pro                | Contro                                                                             |
| ---------------------------------- | ------------------ | ---------------------------------------------------------------------------------- |
| Frequenze in kHz `number` decimale | Leggibile          | Errori di virgola mobile, confronti fragili                                        |
| `BigInt` in Hz                     | Nessun limite      | Non serializzabile in JSON; non indicizzabile in IndexedDB                         |
| Date come `Date` o epoch ms        | Confronti numerici | `Date` serializza in modo ambiguo nei backup; epoch illeggibile nei dati esportati |
| CTCSS in Hz decimale               | Naturale           | Eccezione silenziosa alla regola degli interi                                      |

## Conseguenze

Dati esportati leggibili e ordinabili; confronti esatti. Ogni parser deve documentare la conversione di unità e fuso. I campi derivati (es. `band`) si ricalcolano quando cambia la frequenza.
