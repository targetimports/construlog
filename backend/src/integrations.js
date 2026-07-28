import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { nanoid } from 'nanoid';
import { requireAuth } from './middleware.js';
import { invokeLLM, extractData } from './llm.js';
import { sendEmail } from './email.js';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/data/uploads';
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const safeBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
    cb(null, `${Date.now()}-${nanoid(8)}-${safeBase}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

const router = Router();
export const filesRouter = Router();

// Serve os arquivos enviados. Público para leitura (URLs não-adivinháveis).
filesRouter.get('/:filename', (req, res) => {
  const filename = path.basename(req.params.filename); // evita path traversal
  const fullPath = path.join(UPLOAD_DIR, filename);
  if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'not_found' });
  res.sendFile(fullPath);
});

// base44.integrations.Core.UploadFile({ file })
router.post('/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no_file' });
  res.json({
    file_url: `/api/files/${encodeURIComponent(req.file.filename)}`,
    file_name: req.file.originalname,
    size: req.file.size,
    mime: req.file.mimetype,
  });
});

// base44.integrations.Core.SendEmail({ to, subject, body, from }) — usa o helper compartilhado.
router.post('/email', requireAuth, async (req, res) => {
  const { to, subject, body, from, cc, bcc, reply_to } = req.body || {};
  const result = await sendEmail({ to, subject, body, from, cc, bcc, reply_to });
  if (result.ok) return res.json({ ok: true, id: result.id, stubbed: result.stubbed });
  const status = result.error === 'to_and_subject_required' ? 400 : 502;
  return res.status(status).json({ error: result.error });
});

// base44.integrations.Core.InvokeLLM({ prompt, response_json_schema, file_urls, ... })
router.post('/invoke-llm', requireAuth, async (req, res, next) => {
  try {
    res.json(await invokeLLM(req.body || {}));
  } catch (err) { next(err); }
});

// base44.integrations.Core.ExtractDataFromUploadedFile({ file_url, json_schema })
router.post('/extract-data', requireAuth, async (req, res, next) => {
  try {
    res.json(await extractData(req.body || {}));
  } catch (err) { next(err); }
});

export default router;
