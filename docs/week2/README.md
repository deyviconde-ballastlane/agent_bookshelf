# Week 2: flujo multi-agente, costo antes y después

**Tarea:** auditar la API JSON contra la regla 5 del CLAUDE.md (los errores son 400/404/409, nunca 500), probar cada hallazgo con un test que falle y arreglar los confirmados.

**Flujo:** `/audit-fix` (`.claude/skills/audit-fix/`) encadena cuatro subagentes genéricos de `.claude/agents/` en un pipeline:

```
auditor  →  test-writer  →  fixer  →  test-runner
(lee)       (prueba)        (arregla)  (verifica)
```

**Palanca:** el modelo de cada subagente. Nada más cambió entre las corridas: mismo commit base, mismo comando, mismo modelo de sesión (Opus 5.5) y auto mode activado en ambas.

```
/audit-fix "CLAUDE.md rule 5: API errors use 400/404/409, never 500" src/routes/api.ts
```

| | Corrida A | Corrida B |
|---|---|---|
| Modelo de los subagentes | heredan (Opus 5.5) | Sonnet 5.5, test-runner en Haiku 5.5 |
| Commit de los agentes | `811b2d5` | `bd0e787` |
| Rama / commit del output | `week2-run-a` / `736f36f` | `week2-run-b` / `2f32ac2` |
| **Costo total (/usage)** | **$2.17** | **$0.93** (−57%) |
| Duración API / reloj | 7m 36s / 7m 35s | 2m 53s / 3m 17s |
| Cambios de código | +148 / −4 | +97 / −6 |
| Caché del main | 9 requests, 93% desde caché, sin misses | 11 requests, 94% desde caché, sin misses |
| Hallazgos confirmados y arreglados | 15 / 15 | 12 / 12 |
| Suite completa al final | 29 en verde | 26 en verde |

## /usage tal como salió

Screenshots: [corrida A](usage-run-a.png), [corrida B](usage-run-b.png).

```
Corrida A
claude-haiku-5-5:  13.7k input, 911 output, 0 cache read, 0 cache write ($0.0018)
claude-opus-5-5:   2.5k input, 46.2k output, 1.7m cache read, 156.4k cache write ($2.17)

Corrida B
claude-haiku-5-5:  3.6k input, 1.1k output, 4.9k cache read, 7.1k cache write ($0.0019)
claude-opus-5-5:   1.0k input, 8.4k output, 711.1k cache read, 35.6k cache write ($0.60)
claude-sonnet-5-5: 32 input, 14.4k output, 170.5k cache read, 65.7k cache write ($0.3256)
```

En la corrida A, la línea de Haiku son llamadas internas de Claude Code, no un agente nuestro.

## Costo por agente, sacado de los logs de sesión

`python3 docs/week2/cost_by_agent.py ~/.claude/projects/<proyecto>/<sesión>.jsonl` calcula el precio de cada request con los precios de lista de la week 2. Los totales quedan a menos de 5% de lo que dice /usage.

| Agente | A: modelo | A: requests | A: costo | B: modelo | B: requests | B: costo |
|---|---|---|---|---|---|---|
| orquestador (main) | Opus | 9 | $0.61 | Opus | 11 | $0.56 |
| auditor | Opus | 12 | $0.50 | Sonnet | 4 | $0.11 |
| test-writer | Opus | 11 | $0.36 | Sonnet | 5 | $0.08 |
| fixer | Opus | 14 | $0.55 | Sonnet | 6 | $0.14 |
| test-runner | Opus | 2 | $0.05 | Haiku | 2 | $0.00 |
| **subagentes** | | | **$1.46** | | | **$0.33** (−77%) |
| **total** | | | **$2.08** | | | **$0.89** |

El orquestador casi no cambió, que era lo esperado: la palanca solo tocó a los subagentes. El ahorro viene de dos lados: menor precio por token y menos requests, porque los agentes en Sonnet exploraron menos.

## ¿Se mantuvo la calidad?

No del todo.

- **Cobertura:** el auditor de la B encontró 12 problemas y el de la A, 15. La B juntó dos hallazgos de la A en un solo test y nunca detectó "username es un objeto" ni "id de estante no numérico".
- **Prueba cruzada:** los 15 tests de la A, corridos contra el código de la B, dan **14 en verde y 1 en rojo**: `#14 POST /api/shelves/abc/books` no devuelve 400. Un bug real sobrevivió a la corrida B.
- **Tests más flojos:** tres tests de la B aceptan dos códigos de estado (`201 o 400`, `404 o 400`), mientras que los de la A exigen uno solo.

La corrida B es 57% más barata y el doble de rápida, pero se le escapa un bug real y escribe tests más flojos. El set de evals de la semana 3 debería medir justo esta diferencia.
