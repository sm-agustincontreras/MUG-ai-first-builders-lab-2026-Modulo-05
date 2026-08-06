# SAST Report — FIX-001 (Logout no redirige a /login)

| Field | Value |
|-------|-------|
| Date | 2026-08-06 |
| Ticket | FIX-001 |
| Scope | frontend/src/App.tsx, frontend/src/App.spec.tsx — cierre de CODE |
| Result | **PASSED** |

## Secrets, Injection, XSS
✅ Sin secretos hardcodeados, sin `eval()`/`dangerouslySetInnerHTML`/`innerHTML` en los archivos
tocados. El cambio es puramente de routing (JSX), sin input de usuario nuevo.

## Dependencias (F-SAST-13/16)
✅ `git diff main...HEAD` sobre ambos `package.json`/`package-lock.json`: vacío. Sin dependencias
nuevas — el árbol es idéntico al de `main`, cuyo riesgo ya está documentado y aceptado en
`docs/adr/adr-001-riesgo-aceptado-dependencias-npm-audit-feat-001.md`. No requiere re-evaluación.

## Otras categorías
N/A — el cambio no introduce autenticación/autorización nueva (reutiliza `ProtectedRoute` sin
modificar), no maneja datos sensibles nuevos, no agrega logging, no toca CSRF/CORS/crypto.

## Suppressions
0 — nada que suprimir.

---

**Total: 0 hallazgos**
**Next:** commit de este reporte, luego transición a VERIFY.
