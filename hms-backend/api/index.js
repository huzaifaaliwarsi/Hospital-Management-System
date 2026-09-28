// Vercel serverless entry point — plain JS on purpose (no `@/` path aliases).
// `vercel-build` (prisma generate && tsc && tsc-alias) compiles src/**/*.ts
// into dist/**/*.js and rewrites every `@/` import there to a real relative
// path. Importing raw TypeScript here (e.g. `require('../src/app')`) would
// carry unresolved `@/config/env`-style imports into the deployed function,
// which crashes at runtime with "Cannot find module '@/config/env'" — Node
// has no idea what `@/` means without a build step. Requiring the compiled
// dist/app.js instead means every alias is already a plain relative path by
// the time this function runs.
const { createApp } = require('../dist/app');

module.exports = createApp();
