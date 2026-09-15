/**
 * A module-resolution hook for the node:test harness: lets the tests import
 * the app's TypeScript sources directly (node strips the types itself;
 * this only resolves the extensionless specifiers the TS pipeline allows
 * to their `.ts` files). Development tooling only — never shipped.
 */
export async function resolve(specifier, context, next) {
  if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) {
    try {
      return await next(`${specifier}.ts`, context);
    } catch (error) {
      // fall through: it may genuinely be a directory-less .js or a miss
    }
  }
  return next(specifier, context);
}
