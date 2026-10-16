import { createApp } from './app';

const app = createApp();

export default app;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = app;
  (module.exports as any).default = app;
}
