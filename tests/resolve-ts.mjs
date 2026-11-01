const SRC = new URL("../src/", import.meta.url);
const HAS_EXTENSION = /\.[cm]?[jt]sx?$|\.json$/;

export async function resolve(specifier, context, next) {
  const target = specifier.startsWith("@/") ? new URL(specifier.slice(2), SRC).href : specifier;
  const relative = /^(\.{1,2}\/|\/|file:)/.test(target);
  if (!relative || HAS_EXTENSION.test(target)) return next(target, context);
  for (const suffix of [".ts", "/index.ts", ".js"]) {
    try {
      return await next(target + suffix, context);
    } catch (error) {
      if (error?.code !== "ERR_MODULE_NOT_FOUND") throw error;
    }
  }
  return next(target, context);
}
