# 0001 — Registrare le decisioni architetturali

- **Stato**: Accettato
- **Data**: 2026-10-17
- **Milestone**: M0

## Contesto

`CLAUDE.md` richiede un ADR per ogni decisione architetturale rilevante e per ogni cambio di stack o perimetro. Il progetto è sviluppato in modo incrementale per 14 milestone: senza traccia scritta le motivazioni si perdono.

## Decisione

Usiamo Architecture Decision Records in `docs/adr/`, un file per decisione, nome `NNNN-titolo-in-kebab-case.md`, struttura di [`0000-template.md`](0000-template.md) (contesto, decisione, alternative, conseguenze). Stati: _Proposto_, _Accettato_, _Respinto_, _Sostituito_. Un ADR accettato non si modifica nel merito: si sostituisce con un nuovo ADR. L'indice è in [`README.md`](README.md).

## Alternative considerate

| Alternativa                                  | Pro                   | Contro                                                                  |
| -------------------------------------------- | --------------------- | ----------------------------------------------------------------------- |
| Decisioni solo nei documenti di architettura | Meno file             | Si perde la storia e la motivazione delle scelte                        |
| Issue/PR GitHub                              | Discussione integrata | Il repository non è ancora su GitHub; dipendenza da un servizio esterno |

## Conseguenze

Ogni PR che introduce una scelta rilevante (dipendenza runtime, convenzione dati, fonte esterna, hosting) include l'ADR relativo. I documenti in `docs/architecture/` rimandano agli ADR invece di duplicarne le motivazioni.
