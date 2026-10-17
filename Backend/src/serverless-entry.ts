import { createApp } from './app';

let app: any;
let bootError: any = null;

try {
  app = createApp();
} catch (err: any) {
  bootError = err;
  // eslint-disable-next-line no-console
  console.error('[Serverless Boot Error]:', err);
}

const serverlessHandler = (req: any, res: any) => {
  const origin = req.headers?.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id, *');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (bootError) {
    return res.status(500).json({
      error: {
        code: 'SERVERLESS_BOOT_ERROR',
        message: bootError.message,
        stack: bootError.stack,
      },
    });
  }

  return app(req, res);
};

export = serverlessHandler;
