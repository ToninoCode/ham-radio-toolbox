// @ts-check
import path from "node:path";

/**
 * Local ESLint rule (BL-M1-16, ADR-0004): a relative import may not leave the
 * boundary of the importing file, i.e. its feature module
 * (`src/modules/<name>`) or its top-level area (`src/app`, `src/shared`,
 * `src/core`, `src/infrastructure`).
 *
 * Crossing a boundary therefore requires the `@/` alias, where the
 * `no-restricted-imports` layer rules apply (public API `@/modules/<name>`,
 * no infrastructure from domain…). Without this rule `../../../other-module/…`
 * would bypass them, because those rules only see the import string.
 *
 * Targets outside `src/` (e.g. `tests/support` from a spec file) are out of
 * scope.
 */

/**
 * @param {string} srcDir
 * @param {string} file absolute path
 * @returns {string | undefined} boundary id, or undefined outside src/
 */
function boundaryOf(srcDir, file) {
  const relative = path.relative(srcDir, file);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return undefined;
  const [area, name] = relative.split(path.sep);
  if (area === "modules" && name) return `modules/${name}`;
  return area;
}

/** @type {import("eslint").Rule.RuleModule} */
export const noCrossBoundaryRelativeImport = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow relative imports that leave the module or area of the importing file",
    },
    schema: [],
    messages: {
      crossBoundary:
        "Relative import from '{{from}}' into '{{to}}': use the '@/' alias so that the layer rules apply (another module only through '@/modules/<name>').",
    },
  },
  create(context) {
    const srcDir = path.join(context.cwd, "src");
    const from = boundaryOf(srcDir, context.filename);
    if (!from) return {};
    const dir = path.dirname(context.filename);

    /** @param {import("estree").Node | null | undefined} source */
    function check(source) {
      if (
        !source ||
        source.type !== "Literal" ||
        typeof source.value !== "string" ||
        !source.value.startsWith(".")
      ) {
        return;
      }
      const to = boundaryOf(srcDir, path.resolve(dir, source.value));
      if (to && to !== from) {
        context.report({
          node: source,
          messageId: "crossBoundary",
          data: { from, to },
        });
      }
    }

    return {
      ImportDeclaration: (node) => check(node.source),
      ExportAllDeclaration: (node) => check(node.source),
      ExportNamedDeclaration: (node) => check(node.source),
      ImportExpression: (node) => check(node.source),
    };
  },
};

export default {
  meta: { name: "hrt-architecture" },
  rules: { "no-cross-boundary-relative-import": noCrossBoundaryRelativeImport },
};
