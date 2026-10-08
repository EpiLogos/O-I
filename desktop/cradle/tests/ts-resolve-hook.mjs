/**
 * A module-resolution hook for the node:test harness: lets the tests import
 * the app's TypeScript sources directly (node strips the types itself;
 * this resolves the extensionless specifiers and emitted `.js` spellings
 * accepted by the production TS pipeline). Development tooling only.
 */
export async function resolve(specifier, context, next) {
  if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) {
    try {
      return await next(`${specifier}.ts`, context);
    } catch (error) {
      // fall through: it may genuinely be a directory-less .js or a miss
    }
  }
  try {
    return await next(specifier, context);
  } catch (error) {
    // Preserve real JavaScript when present. Source-only modules use the
    // emitted spelling in production and their TypeScript source in tests.
    if (specifier.startsWith('.') && specifier.endsWith('.js')) {
      return next(`${specifier.slice(0, -3)}.ts`, context);
    }
    throw error;
  }
}
