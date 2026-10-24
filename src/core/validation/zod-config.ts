import { z } from "zod";

/*
 * Zod 4 compiles object parsers with `new Function` when the page allows
 * eval, and probes that ability when the first object schema is built. The
 * app's Content Security Policy forbids eval (ARCHITECTURE.md § 11): the
 * probe would be reported as a CSP violation, and the compiled parser could
 * not run anyway. `jitless` skips both; parsing results are the same.
 *
 * Must run before any object schema is constructed: schemas.ts imports this
 * module first, and every entity schema depends on schemas.ts.
 */
z.config({ jitless: true });
