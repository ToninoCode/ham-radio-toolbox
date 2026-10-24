# 0013 — Core domain: tipi branded, `Result` e schemi di validazione

- **Stato**: Accettato (2026-10-24, approvazione del Blocco A di M2)
- **Data**: 2026-10-17
- **Milestone**: M2

## Contesto

BL-M2-01…04 introducono il domain condiviso in `src/core/` (frequenza, locator, tempo, nominativi, rapporti, validazione), usato da tutti i moduli da M3 in poi. Vincoli: domain puro senza Vue, Dexie, `fetch` o API del browser (ADR-0004); convenzioni dei dati di ADR-0005; errori con `code` stabile tradotti in presentation (ARCHITECTURE § 5.5); stringhe UI solo dal catalogo i18n (ADR-0008). ARCHITECTURE § 4 prevede `shared/types` per i tipi comuni (`Result`, `Brand`).

Rischi da evitare: frequenze in kHz passate dove servono Hz; date locali o nominativi non normalizzati arrivati al database; regole duplicate fra funzioni di dominio e schemi Zod.

## Decisione

1. **Tipi branded** (`Brand<T, B>` in `src/shared/types`) per i valori con un'invariante di normalizzazione: `FrequencyHz`, `UtcDateTime`, `UtcDate`, `Callsign`, `Locator`. Costo nullo a runtime. Si creano solo con le funzioni di parsing del core o con gli schemi Zod.
2. **Esiti attesi come `Result<T, E>`** (`ok`/`err` in `src/shared/types`), con errori `{ code }` dai codici stabili (`frequency.negative`, `callsign.invalid-format`, `sinpo.out-of-range`…). Le eccezioni restano per gli errori di programmazione: dati del band plan incoerenti, argomenti fuori dominio di funzioni interne.
3. **Una regola, un posto.** Gli schemi di `src/core/validation` avvolgono le funzioni di dominio (`domainSchema`), non ne riscrivono le regole. Gli schemi **normalizzano**: accettano le rappresentazioni prodotte da utenti e file e restituiscono quella canonica. Sui valori già canonici sono idempotenti, quindi lo stesso schema serve per form, import e restore.
4. **Messaggi**: un'issue Zod di dominio porta il codice in `message` e in `params.code`; `issueCode()` lo restituisce anche per gli errori strutturali (`zod.invalid_type`). Nessun testo UI nel core.
5. **Band plan come dati**: i limiti IARU R1 stanno in un file di dati (`iaru-region1.ts`) con fonti e data di verifica. La logica (`createBandPlan`) li valida all'avvio. Il riconoscimento della banda non implica un permesso di trasmissione.
6. **Geodesia sferica**: haversine con il raggio medio IUGG (6371,0088 km) per distanza e azimut. L'errore rispetto all'ellissoide WGS84 è sotto lo 0,5 %, inferiore all'incertezza di un locator a 6 caratteri.

## Alternative considerate

| Alternativa                                     | Pro                           | Contro                                                                                         |
| ----------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `number`/`string` semplici                      | Nessuna conversione esplicita | Nessuna protezione da kHz al posto di Hz o da nominativi non normalizzati                      |
| Classi value object (`new Frequency(…)`)        | Incapsulamento                | Non serializzabili così come sono in IndexedDB e JSON: servirebbe un mapping (contro ADR-0006) |
| `.brand()` di Zod come unica fonte dei tipi     | Meno codice                   | Il core dipenderebbe da Zod anche per i tipi di base; brand diversi fra schema e funzioni      |
| Schemi Zod con regole proprie (regex, `refine`) | Schemi autonomi               | Regole duplicate e divergenti fra funzioni e schemi                                            |
| Formula di Vincenty / Karney sull'ellissoide    | Precisione millimetrica       | Complessità e casi non convergenti (antipodi) per un guadagno irrilevante                      |
| Eccezioni per gli errori di validazione         | Codice più breve              | Flusso di controllo implicito; errori attesi non tipizzati                                     |

## Conseguenze

- I moduli costruiscono gli schemi delle entità componendo quelli di `core/validation`; `z.infer` fornisce tipi già branded.
- Codice di test e fixture deve passare dagli schemi o da cast espliciti per creare valori branded.
- Il catalogo i18n dovrà coprire i codici di errore del core quando la prima form li mostrerà (M3).
- Il domain può importare `@/shared/types`, oltre a `@/core/*` e `zod` (ARCHITECTURE § 3, aggiornata). Le regole ESLint lo consentono già e lo verificano in `tests/integration/eslint-layer-rules.spec.ts`.
