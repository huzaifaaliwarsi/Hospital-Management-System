// Vercel Serverless Function entry point
let handler;
let initError = null;

try {
  // Load precompiled serverless app
  const appModule = require('../dist/serverless.js');
  handler = appModule.default || appModule;
} catch (err) {
  initError = err;
  console.error('CRITICAL: Serverless initialization error:', err);
}

module.exports = (req, res) => {
  if (initError) {
    res.status(500).json({
      error: 'SERVERLESS_INIT_FAILED',
      message: initError.message,
      hint: 'Please ensure DATABASE_URL, JWT_ACCESS_SECRET, and JWT_REFRESH_SECRET are set in Vercel Environment Variables. Note: DATABASE_URL must be a live cloud database (e.g. Neon or Supabase), NOT localhost.',
    });
    return;
  }
  return handler(req, res);
};
