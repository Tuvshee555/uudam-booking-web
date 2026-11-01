// Lets tests import TypeScript modules the way the app does: the "@/" alias
// and extensionless relative imports. Node strips the types itself; this only
// resolves the paths. Usage: node --import ./tests/register-ts.mjs --test …
import { register } from "node:module";

register("./resolve-ts.mjs", import.meta.url);
