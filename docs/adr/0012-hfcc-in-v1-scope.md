# 0012 — HFCC nel perimetro della v1 con dipendenze esplicite

- **Stato**: Accettato (approvato dal maintainer il 2026-10-17, chiusura M0)
- **Data**: 2026-10-17
- **Milestone**: M0 (decisione) · M5 (attuazione)

## Contesto

`PROJECT.md` cita gli import EiBi e HFCC (MOD-04) e la Definition of Done (§ 12, criterio 5) parla di "frequency importers" al plurale. Nella prima stesura di M0, FR-FRQ-02 (HFCC) era _Should_ e la M5 ne ammetteva il rinvio. Questo era incoerente con la DoD. Il maintainer ha deciso di mantenere HFCC nell'obiettivo della v1.

Fatti verificati il 2026-10-17 (dettaglio in `SOURCES.md` § 3.2):

- Il sito è servito solo in HTTP e non ha CORS, quindi è possibile soltanto l'import manuale.
- Il pacchetto `a26allx2.zip` è uno ZIP _deflate_ con `A26all00.TXT` a larghezza fissa (3 388 record, UTF-8) e sei tabelle di riferimento.
- Il formato è descritto da un documento ITU richiamato da HFCC.
- Non è stato individuato un testo di licenza formale.

## Decisione

1. FR-FRQ-02 diventa **Must**. La DoD richiede che entrambi gli importer superino i test.
2. L'implementazione è subordinata a tre dipendenze esplicite (`REQUIREMENTS.md` § 4.4.1):
   - HFCC-DEP-01: formato;
   - HFCC-DEP-02: licenza/termini;
   - HFCC-DEP-03: fattibilità ZIP.

   Le tre dipendenze si verificano con il task BL-M5-07, prima di scrivere il parser.

3. Finché i termini non sono chiariti, nel repository entrano solo fixture **sintetiche** conformi al formato; nessun estratto reale.
4. Se una dipendenza risultasse **bloccante** (termini che vietano l'uso, formato non ricostruibile), la rimozione o la riduzione di FR-FRQ-02 è una **variazione di perimetro**: richiede un nuovo ADR che sostituisce questo e l'approvazione del maintainer. Non è ammesso un rinvio silenzioso.
5. Per la decompressione si preferisce l'API nativa `DecompressionStream('deflate-raw')`. Una dipendenza ZIP richiede un proprio ADR. Il fallback è l'import del `.TXT` già estratto.

## Alternative considerate

| Alternativa                           | Pro                | Contro                                                                               |
| ------------------------------------- | ------------------ | ------------------------------------------------------------------------------------ |
| HFCC _Should_, rinviabile             | Meno rischio su M5 | Incoerente con la DoD; decisione respinta dal maintainer                             |
| Solo EiBi (che già include dati HFCC) | Una sola fonte     | Perde i dati coordinati ufficiali (potenza, azimut, sito) e contraddice `PROJECT.md` |

## Conseguenze

- In M5 si aggiunge il task di verifica BL-M5-07 (2 h); BL-M5-05 (parser HFCC) passa a _Must_.
- M5 ha un rischio maggiore: la riserva di pianificazione assegnata a M5 lo copre (`ROADMAP.md` § 2).
- `SOURCES.md`, `DATABASE.md` (campi HFCC di `broadcast_schedules`) e `ROADMAP.md` sono allineati a questa decisione.
