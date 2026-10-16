import { Router, text, type Request } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { AppError, ValidationError } from '@/shared/errors/AppError';
import { asyncHandler } from '@/shared/asyncHandler';
import { devicesService } from './devices.service';
import { punchIngestSchema } from './devices.schemas';
import { localParts } from './deviceTime';

const router = Router();
router.use(rateLimit({ windowMs: 60000, limit: 300, standardHeaders: false, legacyHeaders: false, validate: { xForwardedForHeader: false }, message: 'ERROR: Too many requests; retry later' }));
// ADMS sends tab-separated application/push or text/plain, not JSON.
router.use(text({ type: () => true, limit: '1mb' }));
router.use((_req, res, next) => { res.type('text/plain'); res.setHeader('Cache-Control', 'no-store'); next(); });

export function deviceCredentials(req: Request) {
  const authorization = req.get('authorization');
  return { secret: authorization?.startsWith('Bearer ') ? authorization.slice(7) : req.get('x-device-secret'), ip: req.ip };
}
async function terminal(req: Request) {
  const serial = z.string().regex(/^[A-Za-z0-9_-]{3,80}$/).parse(req.query.SN);
  return devicesService.authenticateDevice(serial, deviceCredentials(req), 'HTTP_ADMS');
}

router.get(['/cdata', '/cdata.aspx'], asyncHandler(async (req, res) => {
  const device = await terminal(req);
  if (req.query.Encrypt && req.query.Encrypt !== '0') throw new ValidationError('Encrypted proprietary PUSH is not supported; use a compatible gateway');
  await devicesService.heartbeat(device);
  const local = localParts(new Date(), device.timezone);
  const offset = Math.round((Date.parse(local.date + 'T' + local.time + 'Z') - Date.now()) / 60000);
  // Advertise attendance only; no templates, photographs or remote enrollment commands.
  res.send([
    'GET OPTION FROM: ' + device.deviceSerial,
    'ATTLOGStamp=None', 'OPERLOGStamp=9999', 'ErrorDelay=30', 'Delay=30',
    'TransTimes=00:00;14:05', 'TransInterval=1', 'TransFlag=TransData AttLog',
    'Realtime=1', 'Encrypt=None', 'ServerVer=2.2.14', 'PushProtVer=2.2.14', 'PushOptionsFlag=0', 'TimeZone=' + (offset % 60 === 0 ? offset / 60 : offset),
  ].join('\n') + '\n');
}));

router.post(['/cdata', '/cdata.aspx'], asyncHandler(async (req, res) => {
  const device = await terminal(req);
  const table = z.string().max(40).parse(req.query.table);
  if (table !== 'ATTLOG') {
    // Some firmware sends startup metadata regardless of TransFlag. No attendance is present in these tables.
    if (['OPERLOG', 'USERINFO', 'options'].includes(table)) { await devicesService.heartbeat(device); res.send('OK'); return; }
    throw new ValidationError('Unsupported ADMS table; only ATTLOG attendance is imported');
  }
  if (typeof req.body !== 'string') throw new ValidationError('Expected plain-text attendance records');
  const lines = req.body.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
  const state: Record<string, 'CHECK_IN' | 'CHECK_OUT' | 'BREAK_OUT' | 'BREAK_IN' | 'AUTO'> = { '0': 'CHECK_IN', '1': 'CHECK_OUT', '2': 'BREAK_OUT', '3': 'BREAK_IN', '4': 'CHECK_IN', '5': 'CHECK_OUT', '255': 'AUTO' };
  const verification: Record<string, 'FINGERPRINT' | 'FACE' | 'CARD' | 'PASSWORD' | 'OTHER'> = { '0': 'PASSWORD', '1': 'FINGERPRINT', '2': 'CARD', '3': 'PASSWORD', '4': 'CARD', '15': 'FACE' };
  const input = punchIngestSchema.parse({
    deviceSerial: device.deviceSerial,
    events: lines.map((line, i) => {
      const parts = line.split('\t');
      if (parts.length < 2) throw new ValidationError('Invalid ATTLOG record at line ' + (i + 1));
      const status = parts[2]?.trim() || '255';
      if (!state[status]) throw new ValidationError('Unsupported attendance status at line ' + (i + 1) + '; configure terminal IN/OUT status codes');
      return { enrollNumber: parts[0]?.trim(), punchTime: parts[1]?.trim(),
        punchType: state[status], verificationType: verification[parts[3]?.trim() ?? ''] ?? 'OTHER',
        rawRecord: line, deviceStatus: status, deviceVerify: parts[3]?.trim() };
    }),
  });
  await devicesService.ingestPunches(input, device);
  res.send('OK: ' + lines.length);
}));

router.get(['/getrequest', '/getrequest.aspx', '/ping', '/ping.aspx'], asyncHandler(async (req, res) => {
  await devicesService.heartbeat(await terminal(req));
  res.send('OK');
}));
router.all(['/devicecmd', '/devicecmd.aspx'], asyncHandler(async (req, res) => {
  await devicesService.heartbeat(await terminal(req));
  res.send('OK');
}));
router.use((error: unknown, _req: Request, res: import('express').Response, _next: import('express').NextFunction) => {
  res.status(error instanceof AppError ? error.statusCode : error instanceof z.ZodError ? 400 : 500)
    .type('text/plain').send(error instanceof AppError ? error.message : 'ERROR: Invalid request or temporary processing failure');
});
export default router;

