# 0008 — Approccio all'internazionalizzazione

- **Stato**: Proposto (da decidere all'avvio di M1)
- **Data**: 2026-10-17
- **Milestone**: M1

## Contesto

`CLAUDE.md` impone stringhe UI in italiano tramite un sistema i18n, mai hardcoded, ma lo stack non include una libreria i18n. In v1 c'è una sola lingua (italiano); l'inglese è un'evoluzione possibile (NFR-I18N-03). Vincoli: leggerezza, tree-shaking, CSP senza `unsafe-eval`, TypeScript strict.

## Decisione (proposta)

Catalogo **tipizzato interno** in `src/shared/i18n/`:

- `it.ts` esporta un oggetto `as const` con i messaggi annidati per modulo; il tipo delle chiavi è derivato dal catalogo, quindi una chiave inesistente è un errore di compilazione.
- `t(key, params?)` con interpolazione `{name}` e pluralizzazione tramite `Intl.PluralRules`.
- Formattazione con `Intl.NumberFormat` / `Intl.DateTimeFormat` (locale `it-IT`, `timeZone: 'UTC'` per i log).
- Composable `useI18n()` per i componenti; un futuro `en.ts` deve soddisfare lo stesso tipo.

## Alternative considerate

| Alternativa                                                  | Pro                                  | Contro                                                                                                                                                                          |
| ------------------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vue-i18n` (+ `@intlify/unplugin-vue-i18n` per precompilare) | Standard de facto, funzioni complete | Dipendenza runtime aggiuntiva (decine di KB), compilatore di messaggi che richiede precompilazione per evitare `eval` con CSP stretta, tipizzazione delle chiavi da configurare |
| Stringhe hardcoded                                           | Nessun costo                         | Vietato da `CLAUDE.md`                                                                                                                                                          |

## Conseguenze

Zero dipendenze e chiavi verificate dal compilatore. Funzioni avanzate (formati ICU complessi, cambio lingua a caldo con lazy loading) andranno scritte se servissero; in tal caso si rivaluta `vue-i18n` con un nuovo ADR.
