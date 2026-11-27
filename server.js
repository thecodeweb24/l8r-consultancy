import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { postgresSql } from './lib/postgres-sql.js';
import { getDatabaseUrl } from './lib/database-config.js';
import express from 'express';
import helmet from 'helmet';
import nodemailer from 'nodemailer';
import multer from 'multer';

const root = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(process.env.DATA_DIR || (process.env.VERCEL ? '/tmp/l8r-data' : path.join(root, 'data')));
fs.mkdirSync(dataDir, { recursive: true });
const { Pool } = pg;
const pool = new Pool({
  connectionString: getDatabaseUrl(),
  ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED === 'true' },
  max: Number(process.env.PGPOOL_MAX || (process.env.VERCEL ? 1 : 10)),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000
});
pool.on('error', (error) => console.error('Unexpected PostgreSQL pool error:', error.message));

const statement = (sql) => ({
  async get(...values) {
    const result = await pool.query(postgresSql(sql), values);
    return result.rows[0];
  },
  async all(...values) {
    const result = await pool.query(postgresSql(sql), values);
    return result.rows;
  },
  async run(...values) {
    const result = await pool.query(postgresSql(sql), values);
    return { changes: result.rowCount };
  }
});

const defaultSettings = {
  owner: 'Moksh Patel',
  phone: '+91 7567490201',
  email: 'l8rconsultancy@gmail.com',
  tagline: 'PLAN • ADVISE • GROW',
  hero_title: 'YOUR VISION.\nOUR STRATEGY.\nYOUR GROWTH.',
  hero_body: 'Strategic guidance, professional solutions and business-focused support designed to help individuals and organizations move forward.',
  about_heading: 'More than consultancy. A partner in your progress.',
  about_body: 'L8R CONSULTANCY brings strategic clarity and practical perspective to the decisions that shape your future.',
  industries: '[]',
  privacy_text: 'Add your approved privacy policy before publishing this website.',
  terms_text: 'Add your approved terms and conditions before publishing this website.',
  site_url: ''
};
const schemaState = await pool.query("SELECT to_regclass('public.users') AS users");
if (!schemaState.rows[0].users) {
  throw new Error('Supabase schema is not installed. Run migrations/001_initial_schema.sql in the Supabase SQL Editor.');
}
const companySchema = await pool.query("SELECT to_regclass('public.client_companies') AS client_companies");
if (!companySchema.rows[0].client_companies) {
  throw new Error('Client company management is not installed. Run migrations/003_client_companies.sql in the Supabase SQL Editor.');
}
if (process.env.VERCEL) {
  const uploadSchema = await pool.query("SELECT to_regclass('public.project_uploads') AS project_uploads");
  if (!uploadSchema.rows[0].project_uploads) {
    throw new Error('Vercel image storage is not configured. Run migrations/002_vercel_uploads.sql in the Supabase SQL Editor.');
  }
}
for (const [key, value] of Object.entries(defaultSettings)) {
  await statement('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

const app = express();
const api = express.Router();
const production = process.env.NODE_ENV === 'production';
app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === 'true' || process.env.VERCEL ? 1 : false);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, hsts: production }));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));

const id = (prefix) => `${prefix}-${crypto.randomUUID()}`;
const tokenDigest = (token) => crypto.createHash('sha256').update(token).digest('hex');
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const leadStatuses = new Set(['NEW ENQUIRY', 'CONTACTED', 'QUALIFIED', 'CONSULTATION SCHEDULED', 'PROPOSAL SENT', 'CONVERTED', 'LOST', 'NURTURE']);
const sessionCookie = 'l8r_session';
const slugify = (value) => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100);
const escapeHtml = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

async function canonicalOrigin(req) {
  const configured = process.env.SITE_URL || (await settingsObject()).site_url;
  if (configured) {
    try { return new URL(configured).origin; } catch { console.error('SITE_URL is not a valid absolute URL.'); }
  }
  return `${req.protocol}://${req.get('host')}`;
}

async function seoPage({ title, description, canonical, body, structuredData = null, noindex = false, image = '' }) {
  const settings = await settingsObject();
  const jsonLd = structuredData ? `<script type="application/ld+json">${JSON.stringify(structuredData).replaceAll('<', '\\u003c')}</script>` : '';
  const socialImage = image ? `${canonicalOriginFromCanonical(canonical)}${image}` : `${canonicalOriginFromCanonical(canonical)}/logo.png`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#063b35"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${escapeHtml(canonical)}"><meta property="og:type" content="website"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:image" content="${escapeHtml(socialImage)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${escapeHtml(socialImage)}">${noindex ? '<meta name="robots" content="noindex,nofollow">' : ''}${jsonLd}<style>
    *{box-sizing:border-box}body{margin:0;background:#faf8f2;color:#202522;font:16px/1.7 system-ui,sans-serif}header,main,footer{max-width:1180px;margin:auto;padding:28px 6%}header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e4e3dc}header img{width:160px}header a,footer a{color:#063b35}main{min-height:70vh;padding-top:7vh;padding-bottom:8vh}main>p:first-child{color:#a5884e;font-size:12px;letter-spacing:.2em;text-transform:uppercase}h1{max-width:900px;color:#063b35;font-size:clamp(42px,8vw,82px);line-height:1.04;letter-spacing:-.05em}h2{margin-top:42px;color:#063b35;font-size:25px}p,dd{max-width:780px;color:#5e6964}figure{margin:40px 0}figure img{max-width:100%;max-height:560px;object-fit:cover}a.button{display:inline-block;margin-top:24px;padding:13px 20px;background:#c5a064;color:#092b27;text-decoration:none;letter-spacing:.1em;font-size:12px}footer{border-top:1px solid #e4e3dc;color:#75807b;font-size:13px}
    </style></head><body><header><a href="/"><img src="/logo.png" alt="L8R Consultancy"></a><a href="/#contact">REQUEST A CONSULTATION</a></header><main>${body}<a class="button" href="/#contact">LET'S CONNECT</a></main><footer><p>L8R CONSULTANCY · PLAN • ADVISE • GROW</p><a href="mailto:${escapeHtml(settings.email || 'l8rconsultancy@gmail.com')}">${escapeHtml(settings.email || 'l8rconsultancy@gmail.com')}</a></footer></body></html>`;
}
function canonicalOriginFromCanonical(url) {
  try { return new URL(url).origin; } catch { return ''; }
}

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: process.env.VERCEL ? 512 * 1024 : 8 * 1024 * 1024, files: 6 },
  fileFilter: (_req, file, callback) => {
    if (!['image/jpeg','image/png','image/webp'].includes(file.mimetype)) return callback(new Error('Use JPG, PNG or WebP images only.'));
    callback(null, true);
  }
}).fields([{ name: 'cover', maxCount: 1 }, { name: 'gallery', maxCount: 5 }]);

function acceptedImageExtension(buffer) {
  if (buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return '.png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return '.jpg';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return '.webp';
  return null;
}

async function saveProjectImage(file, slug) {
  if (!file) return '';
  const extension = acceptedImageExtension(file.buffer);
  if (!extension) throw new Error('Uploaded file is not a valid JPG, PNG or WebP image.');
  const filename = `${slug}-${crypto.randomUUID()}${extension}`;
  if (process.env.VERCEL) {
    const contentType = extension === '.png' ? 'image/png' : extension === '.jpg' ? 'image/jpeg' : 'image/webp';
    await statement('INSERT INTO project_uploads (filename, content_type, image_data) VALUES (?, ?, ?)')
      .run(filename, contentType, file.buffer);
    return `/uploads/${filename}`;
  }
  const directory = path.join(dataDir, 'uploads');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, filename), file.buffer, { flag: 'wx' });
  return `/uploads/${filename}`;
}

async function removeProjectImage(location) {
  const filename = path.basename(location || '');
  if (!/^[a-z0-9-]+\.(?:png|jpg|webp)$/i.test(filename)) return;
  if (process.env.VERCEL) {
    await statement('DELETE FROM project_uploads WHERE filename = ?').run(filename);
    return;
  }
  fs.rmSync(path.join(dataDir, 'uploads', filename), { force: true });
}

async function removeProjectImages(locations) {
  await Promise.all(locations.map(removeProjectImage));
}

function fail(res, status, message) {
  return res.status(status).json({ error: message });
}

function string(value, max, label, { required = false } = {}) {
  if (typeof value !== 'string') throw new Error(`${label} must be text.`);
  const clean = value.trim();
  if (required && !clean) throw new Error(`${label} is required.`);
  if (clean.length > max) throw new Error(`${label} must be ${max} characters or fewer.`);
  return clean;
}

function checkOrigin(req, res, next) {
  const origin = req.get('origin');
  if (origin) {
    let parsed;
    try { parsed = new URL(origin); } catch { return fail(res, 403, 'Invalid request origin.'); }
    if (parsed.host !== req.get('host')) return fail(res, 403, 'Cross-origin request rejected.');
  }
  next();
}

const rates = new Map();
function rateLimit({ windowMs, max, key }) {
  return (req, res, next) => {
    const now = Date.now();
    const bucketKey = `${key}:${req.ip}`;
    const old = rates.get(bucketKey);
    const bucket = old && old.resetAt > now ? old : { count: 0, resetAt: now + windowMs };
    bucket.count += 1;
    rates.set(bucketKey, bucket);
    if (rates.size > 20000) {
      for (const [k, item] of rates) if (item.resetAt <= now) rates.delete(k);
    }
    if (bucket.count > max) {
      res.set('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      return fail(res, 429, 'Too many requests. Please try again later.');
    }
    next();
  };
}

async function requireAuth(req, res, next) {
  const token = (req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${sessionCookie}=`))?.slice(sessionCookie.length + 1);
  if (!token) return fail(res, 401, 'Please sign in.');
  const session = await statement(`SELECT u.id, u.name, u.email, u.role
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > datetime('now') AND u.active = 1`).get(tokenDigest(decodeURIComponent(token)));
  if (!session) return fail(res, 401, 'Your session has expired. Please sign in again.');
  req.user = session;
  next();
}

function allowRoles(...roles) {
  return (req, res, next) => roles.includes(req.user.role) ? next() : fail(res, 403, 'You do not have permission for this action.');
}

async function audit(userId, action, entity, entityId = '') {
  await statement('INSERT INTO audit_logs (id, user_id, action, entity, entity_id) VALUES (?, ?, ?, ?, ?)')
    .run(id('audit'), userId, action, entity, entityId);
}

async function settingsObject() {
  return Object.fromEntries((await statement('SELECT key, value FROM settings').all()).map(({ key, value }) => [key, value]));
}

function visibleLeadFilter(user, alias = 'l') {
  return user.role === 'STAFF' ? { clause: ` AND ${alias}.assigned_to = ?`, params: [user.id] } : { clause: '', params: [] };
}

async function sendEnquiryNotification(lead) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, MAIL_FROM, ADMIN_NOTIFICATION_EMAIL } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD || !ADMIN_NOTIFICATION_EMAIL) return false;
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: Number(SMTP_PORT || 587) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD }
  });
  await transport.sendMail({
    from: MAIL_FROM || SMTP_USER,
    to: ADMIN_NOTIFICATION_EMAIL,
    subject: `New L8R enquiry ${lead.id}`,
    text: `${lead.full_name} (${lead.email}, ${lead.phone}) requested ${lead.service}.\n\n${lead.description}`
  });
  return true;
}

api.use(checkOrigin);
api.get('/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true, database: 'postgres' });
});
api.get('/public/site', async (_req, res) => {
  const settings = await settingsObject();
  let industries;
  try { industries = JSON.parse(settings.industries || '[]'); } catch { industries = []; }
  res.json({
    settings,
    industries: Array.isArray(industries) ? industries : [],
    services: (await statement(`SELECT id,title,description,slug,who_for,problems,process,faqs,seo_title,meta_description
      FROM services WHERE published = 1 ORDER BY sort_order, created_at`).all()).map((service) => ({ ...service, slug: service.slug || slugify(service.title) })),
    articles: (await statement(`SELECT id,title,category,excerpt,body,created_at,slug,seo_title,meta_description
      FROM articles WHERE published = 1 ORDER BY created_at DESC LIMIT 12`).all()).map((article) => ({ ...article, slug: article.slug || slugify(article.title) })),
    testimonials: await statement('SELECT id, client_name, company, quote FROM testimonials WHERE published = 1 ORDER BY created_at DESC').all(),
    companies: await statement(`SELECT id,name,logo_url,website_url
      FROM client_companies WHERE published = 1 ORDER BY sort_order, name`).all(),
    caseStudies: await statement('SELECT id,title,industry,overview,challenge,solution,results FROM case_studies WHERE published = 1 ORDER BY created_at DESC LIMIT 12').all(),
    projects: await statement(`SELECT id,title,slug,category,client_name,overview,challenge,solution,results,start_date,completion_date,cover_image,image_alt,gallery_json,featured,seo_title,meta_description
      FROM projects WHERE publication_status = 'PUBLISHED' ORDER BY featured DESC, created_at DESC LIMIT 30`).all()
  });
});

api.get('/public/services/:slug', async (req, res) => {
  const service = await statement(`SELECT * FROM services WHERE published = 1 AND (slug = ? OR (slug = '' AND title = ?))`)
    .get(req.params.slug, req.params.slug);
  if (!service) return fail(res, 404, 'Service not found.');
  res.json({ ...service, slug: service.slug || slugify(service.title) });
});
api.get('/public/projects/:slug', async (req, res) => {
  const project = await statement("SELECT * FROM projects WHERE publication_status = 'PUBLISHED' AND slug = ?").get(req.params.slug);
  if (!project) return fail(res, 404, 'Project not found.');
  res.json(project);
});
api.get('/public/articles/:slug', async (req, res) => {
  const article = await statement("SELECT * FROM articles WHERE published = 1 AND slug = ?").get(req.params.slug);
  if (!article) return fail(res, 404, 'Article not found.');
  res.json(article);
});

api.post('/public/enquiries', rateLimit({ windowMs: 60 * 60 * 1000, max: 8, key: 'enquiry' }), async (req, res, next) => {
  try {
    const body = req.body || {};
    const lead = {
      id: id('L8R'),
      full_name: string(body.name, 120, 'Full name', { required: true }),
      phone: string(body.phone, 40, 'Phone number', { required: true }),
      email: string(body.email, 254, 'Email address', { required: true }).toLowerCase(),
      company: string(body.company || '', 160, 'Company name'),
      service: string(body.service || '', 160, 'Service'),
      description: string(body.message, 5000, 'Requirement description', { required: true }),
      preferred_contact: string(body.preferredContact || '', 30, 'Preferred contact method'),
      source: 'Website',
      consent: body.consent === true ? 1 : 0
    };
    if (!emailPattern.test(lead.email)) return fail(res, 400, 'Enter a valid email address.');
    if (body.consent !== true) return fail(res, 400, 'Consent is required to submit this enquiry.');
    await statement(`INSERT INTO leads (id, full_name, phone, email, company, service, description, source, preferred_contact, consent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(lead.id, lead.full_name, lead.phone, lead.email, lead.company, lead.service, lead.description, lead.source, lead.preferred_contact, lead.consent);
    let notificationSent = false;
    try { notificationSent = await sendEnquiryNotification(lead); }
    catch (error) { console.error('Enquiry notification failed:', error.message); }
    res.status(201).json({ id: lead.id, notificationSent });
  } catch (error) {
    if (!error.code) return fail(res, 400, error.message);
    next(error);
  }
});

api.post('/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 8, key: 'login' }), async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const user = await statement('SELECT * FROM users WHERE email = ? AND active = 1').get(email);
  const hash = user ? crypto.scryptSync(password, user.password_salt, 64) : crypto.scryptSync(password, 'invalid-user-salt', 64);
  const valid = user ? crypto.timingSafeEqual(hash, Buffer.from(user.password_hash, 'hex')) : false;
  if (!valid) return fail(res, 401, 'Email or password is incorrect.');
  const token = crypto.randomBytes(32).toString('base64url');
  await statement("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
  await statement("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', '+8 hours'))").run(tokenDigest(token), user.id);
  res.setHeader('Set-Cookie', `${sessionCookie}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${production ? '; Secure' : ''}`);
  await audit(user.id, 'LOGIN', 'session');
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

api.post('/auth/logout', requireAuth, async (req, res) => {
  const token = (req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${sessionCookie}=`))?.slice(sessionCookie.length + 1);
  if (token) await statement('DELETE FROM sessions WHERE token_hash = ?').run(tokenDigest(decodeURIComponent(token)));
  res.setHeader('Set-Cookie', `${sessionCookie}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${production ? '; Secure' : ''}`);
  await audit(req.user.id, 'LOGOUT', 'session');
  res.status(204).end();
});
api.get('/auth/me', async (req, res) => {
  const token = (req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${sessionCookie}=`))?.slice(sessionCookie.length + 1);
  if (!token) return res.json({ authenticated: false });
  const session = await statement(`SELECT u.id, u.name, u.email, u.role
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > datetime('now') AND u.active = 1`).get(tokenDigest(decodeURIComponent(token)));
  if (!session) return res.json({ authenticated: false });
  res.json(session);
});

api.use('/crm', requireAuth);
api.get('/crm/overview', async (req, res) => {
  const filter = visibleLeadFilter(req.user);
  const count = async (where, params = []) => Number((await statement(`SELECT COUNT(*) AS n FROM leads l WHERE 1=1 ${filter.clause} ${where}`).get(...filter.params, ...params)).n);
  const [total, newLeads, active, converted, due] = await Promise.all([
    count(''),
    count("AND l.status = 'NEW ENQUIRY'"),
    count("AND l.status IN ('CONTACTED','QUALIFIED','CONSULTATION SCHEDULED','PROPOSAL SENT')"),
    count("AND l.status = 'CONVERTED'"),
    count("AND l.follow_up_at != '' AND date(l.follow_up_at) <= date('now') AND l.status NOT IN ('CONVERTED','LOST')")
  ]);
  const monthlyRows = await statement(`SELECT strftime('%Y-%m', l.created_at) AS month, COUNT(*) AS total FROM leads l
    WHERE l.created_at::timestamp >= datetime('now', '-5 months') ${filter.clause} GROUP BY month ORDER BY month`).all(...filter.params);
  const monthly = monthlyRows.map((row) => ({ ...row, total: Number(row.total) }));
  const recent = await statement(`SELECT l.id,l.full_name,l.email,l.phone,l.company,l.service,l.description,l.source,l.status,l.assigned_to,l.follow_up_at,l.created_at,l.updated_at
    FROM leads l WHERE 1=1 ${filter.clause} ORDER BY l.created_at DESC LIMIT 8`).all(...filter.params);
  res.json({ total, newLeads, active, converted, due, conversionRate: total ? Math.round((converted / total) * 1000) / 10 : 0, monthly, recent });
});

api.get('/crm/leads/export.csv', async (req, res) => {
  const filter = visibleLeadFilter(req.user);
  const leads = await statement(`SELECT l.id,l.full_name,l.email,l.phone,l.company,l.service,l.description,l.source,l.status,l.follow_up_at,l.created_at
    FROM leads l WHERE 1=1 ${filter.clause} ORDER BY l.created_at DESC`).all(...filter.params);
  const fields = ['id','full_name','email','phone','company','service','description','source','status','follow_up_at','created_at'];
  const csvValue = (value) => {
    let safe = String(value ?? '');
    if (/^[=+\-@]/.test(safe)) safe = `'${safe}`;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="l8r-leads.csv"');
  res.send([fields.join(','), ...leads.map((lead) => fields.map((field) => csvValue(lead[field])).join(','))].join('\r\n'));
});

api.get('/crm/leads', async (req, res) => {
  const filter = visibleLeadFilter(req.user);
  const query = typeof req.query.q === 'string' ? `%${req.query.q.trim().slice(0, 100)}%` : '%%';
  const status = typeof req.query.status === 'string' && leadStatuses.has(req.query.status) ? req.query.status : '';
  const followUps = req.query.followUps === 'true';
  let clauses = ' AND (l.full_name LIKE ? OR l.email LIKE ? OR l.phone LIKE ? OR l.company LIKE ? OR l.id LIKE ?)';
  const params = [...filter.params, query, query, query, query, query];
  if (status) { clauses += ' AND l.status = ?'; params.push(status); }
  if (followUps) clauses += " AND l.follow_up_at != '' AND date(l.follow_up_at) <= date('now') AND l.status NOT IN ('CONVERTED','LOST')";
  if (req.query.clients === 'true') clauses += " AND l.status = 'CONVERTED'";
  const leads = await statement(`SELECT l.*, u.name AS assigned_name FROM leads l LEFT JOIN users u ON u.id = l.assigned_to
    WHERE 1=1 ${filter.clause}${clauses} ORDER BY l.created_at DESC LIMIT 500`).all(...params);
  res.json(leads);
});

api.post('/crm/leads', async (req, res) => {
  try {
    const body = req.body || {};
    const lead = {
      id: id('L8R'),
      full_name: string(body.full_name, 120, 'Full name', { required: true }),
      phone: string(body.phone, 40, 'Phone number', { required: true }),
      email: string(body.email, 254, 'Email address', { required: true }).toLowerCase(),
      company: string(body.company || '', 160, 'Company'),
      service: string(body.service || '', 160, 'Service'),
      description: string(body.description || '', 5000, 'Description'),
      source: string(body.source || 'CRM', 80, 'Source'),
      status: body.status || 'NEW ENQUIRY',
      assigned_to: req.user.role === 'STAFF' ? req.user.id : (body.assigned_to || null),
      follow_up_at: string(body.follow_up_at || '', 40, 'Follow-up date')
    };
    if (!emailPattern.test(lead.email)) return fail(res, 400, 'Enter a valid email address.');
    if (!leadStatuses.has(lead.status)) return fail(res, 400, 'Choose a valid lead status.');
    if (lead.assigned_to && !await statement('SELECT id FROM users WHERE id = ? AND active = 1').get(lead.assigned_to)) return fail(res, 400, 'Assigned team member does not exist.');
    await statement(`INSERT INTO leads (id,full_name,phone,email,company,service,description,source,status,assigned_to,follow_up_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(lead.id, lead.full_name, lead.phone, lead.email, lead.company, lead.service, lead.description, lead.source, lead.status, lead.assigned_to, lead.follow_up_at);
    await audit(req.user.id, 'CREATE', 'lead', lead.id);
    res.status(201).json({ id: lead.id });
  } catch (error) { fail(res, 400, error.message); }
});

api.patch('/crm/leads/:id', async (req, res) => {
  const filter = visibleLeadFilter(req.user);
  const lead = await statement(`SELECT * FROM leads l WHERE l.id = ? ${filter.clause}`).get(req.params.id, ...filter.params);
  if (!lead) return fail(res, 404, 'Lead not found.');
  const body = req.body || {};
  const changes = {};
  const editable = { full_name: 120, phone: 40, email: 254, company: 160, service: 160, description: 5000, source: 80, preferred_contact: 30, follow_up_at: 40 };
  try {
    for (const [key, max] of Object.entries(editable)) if (body[key] !== undefined) changes[key] = string(body[key], max, key);
    if (body.email !== undefined) {
      changes.email = changes.email.toLowerCase();
      if (!emailPattern.test(changes.email)) return fail(res, 400, 'Enter a valid email address.');
    }
    if (body.status !== undefined) {
      if (!leadStatuses.has(body.status)) return fail(res, 400, 'Choose a valid lead status.');
      changes.status = body.status;
    }
    if (req.user.role !== 'STAFF' && body.assigned_to !== undefined) {
      if (body.assigned_to && !await statement('SELECT id FROM users WHERE id = ? AND active = 1').get(body.assigned_to)) return fail(res, 400, 'Assigned team member does not exist.');
      changes.assigned_to = body.assigned_to || null;
    }
    const keys = Object.keys(changes);
    if (keys.length) {
      const sql = keys.map((key) => `${key} = ?`).join(', ');
      await statement(`UPDATE leads SET ${sql}, updated_at = datetime('now') WHERE id = ?`).run(...keys.map((key) => changes[key]), req.params.id);
      await audit(req.user.id, 'UPDATE', 'lead', req.params.id);
    }
    res.json(await statement('SELECT l.*, u.name AS assigned_name FROM leads l LEFT JOIN users u ON u.id = l.assigned_to WHERE l.id = ?').get(req.params.id));
  } catch (error) { fail(res, 400, error.message); }
});

api.get('/crm/leads/:id/notes', async (req, res) => {
  const filter = visibleLeadFilter(req.user);
  if (!await statement(`SELECT id FROM leads l WHERE l.id = ? ${filter.clause}`).get(req.params.id, ...filter.params)) return fail(res, 404, 'Lead not found.');
  res.json(await statement(`SELECT n.id,n.note,n.created_at,u.name AS author FROM lead_notes n
    LEFT JOIN users u ON u.id = n.user_id WHERE n.lead_id = ? ORDER BY n.created_at DESC`).all(req.params.id));
});
api.post('/crm/leads/:id/notes', async (req, res) => {
  const filter = visibleLeadFilter(req.user);
  if (!await statement(`SELECT id FROM leads l WHERE l.id = ? ${filter.clause}`).get(req.params.id, ...filter.params)) return fail(res, 404, 'Lead not found.');
  try {
    const note = string(req.body?.note, 4000, 'Note', { required: true });
    await statement('INSERT INTO lead_notes (id,lead_id,user_id,note) VALUES (?,?,?,?)').run(id('note'), req.params.id, req.user.id, note);
    await audit(req.user.id, 'ADD_NOTE', 'lead', req.params.id);
    res.status(201).json({ ok: true });
  } catch (error) { fail(res, 400, error.message); }
});

function resourceConfig(resource) {
  const configs = {
    services: { table: 'services', fields: {
      title: 160, description: 3000, published: 'bool', sort_order: 'int', slug: 100,
      who_for: 2000, problems: 3000, process: 3000, faqs: 4000,
      seo_title: 70, meta_description: 170, focus_keyword: 100, canonical_url: 500
    }, required: ['title'] },
    articles: { table: 'articles', fields: {
      title: 200, slug: 100, category: 100, excerpt: 500, body: 10000, published: 'bool',
      seo_title: 70, meta_description: 170, focus_keyword: 100, canonical_url: 500
    }, required: ['title'] },
    testimonials: { table: 'testimonials', fields: { client_name: 120, company: 160, quote: 3000, published: 'bool' }, required: ['client_name','quote'] },
    case_studies: { table: 'case_studies', fields: { title: 200, industry: 120, overview: 3000, challenge: 3000, solution: 3000, results: 3000, published: 'bool' }, required: ['title'] },
    appointments: { table: 'appointments', fields: { lead_id: 100, title: 160, client_name: 120, email: 254, phone: 40, starts_at: 40, status: 30, notes: 3000 }, required: ['title','client_name','starts_at'] },
    companies: { table: 'client_companies', fields: {
      name: 160, logo_url: 500, website_url: 500, published: 'bool', sort_order: 'int'
    }, required: ['name'], orderBy: 'sort_order, name', updatedAt: true }
  };
  return configs[resource];
}

function validateCompanyUrls(values) {
  for (const field of ['logo_url', 'website_url']) {
    const value = values[field];
    if (!value) continue;
    let url;
    try { url = new URL(value); } catch { throw new Error(`${field === 'logo_url' ? 'Logo' : 'Website'} URL must be a valid HTTPS URL.`); }
    if (url.protocol !== 'https:' || url.username || url.password) {
      throw new Error(`${field === 'logo_url' ? 'Logo' : 'Website'} URL must use HTTPS and cannot contain credentials.`);
    }
  }
}
const projectConfig = {
  table: 'projects',
  fields: {
    title: 200, slug: 100, category: 120, client_name: 160,
    overview: 4000, challenge: 3000, solution: 3000, results: 3000,
    start_date: 20, completion_date: 20, cover_image: 500, image_alt: 300,
    gallery_json: 4000, publication_status: 20, featured: 'bool',
    seo_title: 70, meta_description: 170, focus_keyword: 100, canonical_url: 500
  },
  required: ['title']
};
const jsonList = (raw, label, maxItems = 5) => {
  let list;
  try { list = JSON.parse(raw || '[]'); } catch { throw new Error(`${label} must be a valid list.`); }
  if (!Array.isArray(list) || list.length > maxItems || list.some((item) => typeof item !== 'string' || item.length > 500)) throw new Error(`${label} must contain up to ${maxItems} valid items.`);
  return list;
};

async function projectImageUrls(req) {
  const existingCover = typeof req.body.cover_image === 'string' ? req.body.cover_image : '';
  let gallery = jsonList(req.body.gallery_json, 'Gallery');
  const newCoverFile = req.files?.cover?.[0];
  const galleryFiles = req.files?.gallery || [];
  const saved = [];
  try {
    let cover = existingCover;
    if (newCoverFile) {
      cover = await saveProjectImage(newCoverFile, slugify(req.body.slug || req.body.title) || 'project');
      saved.push(cover);
    }
    for (const file of galleryFiles) {
      const location = await saveProjectImage(file, slugify(req.body.slug || req.body.title) || 'project');
      gallery.push(location);
      saved.push(location);
    }
    if (gallery.length > 5) throw new Error('A project can have up to five gallery images.');
    return { cover, gallery: JSON.stringify(gallery), saved };
  } catch (error) {
    await removeProjectImages(saved);
    throw error;
  }
}

function runProjectUpload(req, res, next, action) {
  imageUpload(req, res, async (error) => {
    if (error) return fail(res, 400, error.message);
    try { await action(); } catch (actionError) {
      if (actionError.code === '23505') return fail(res, 409, 'A record with that URL slug already exists.');
      if (actionError.code) return next(actionError);
      return fail(res, 400, actionError.message);
    }
  });
}

function validateProjectStatus(values, currentStatus = 'DRAFT') {
  if (values.publication_status && !['DRAFT','PUBLISHED','ARCHIVED'].includes(values.publication_status)) throw new Error('Project status must be DRAFT, PUBLISHED or ARCHIVED.');
  const status = values.publication_status || currentStatus;
  if (status === 'PUBLISHED') {
    if (!(values.overview || '').trim()) throw new Error('Add a project overview before publishing.');
    if (!(values.meta_description || '').trim()) throw new Error('Add an SEO description before publishing.');
    if (!(values.image_alt || '').trim() && values.cover_image) throw new Error('Add alt text for the cover image before publishing.');
  }
}

async function uniqueServiceSlug(title, preferred, currentId = '') {
  const base = slugify(preferred || title);
  if (!base) throw new Error('Service title must produce a valid URL slug.');
  const existing = await statement('SELECT id FROM services WHERE slug = ? AND id != ?').get(base, currentId);
  return existing ? `${base}-${crypto.randomUUID().slice(0, 8)}` : base;
}
async function uniqueArticleSlug(title, preferred, currentId = '') {
  const base = slugify(preferred || title);
  if (!base) throw new Error('Article title must produce a valid URL slug.');
  const existing = await statement('SELECT id FROM articles WHERE slug = ? AND id != ?').get(base, currentId);
  return existing ? `${base}-${crypto.randomUUID().slice(0, 8)}` : base;
}
async function validateArticleSlug(title, preferred, currentId = '') {
  const base = slugify(preferred || title);
  if (!base) throw new Error('Article title must produce a valid URL slug.');
  const existing = await statement('SELECT id FROM articles WHERE slug = ? AND id != ?').get(base, currentId);
  if (existing) throw new Error('An article already uses that URL slug.');
  return base;
}
function validatePublishedService(service) {
  if (service.published && (!service.description.trim() || !service.meta_description.trim())) {
    throw new Error('Add a service description and SEO description before publishing.');
  }
}
function validatePublishedArticle(article) {
  if (article.published && (!(article.body || '').trim() || !(article.meta_description || '').trim())) {
    throw new Error('Add the article body and an SEO description before publishing.');
  }
}
for (const service of await statement("SELECT id,title FROM services WHERE published = 1 AND slug = ''").all()) {
  await statement('UPDATE services SET slug = ? WHERE id = ?').run(await uniqueServiceSlug(service.title, '', service.id), service.id);
}
for (const article of await statement("SELECT id,title FROM articles WHERE published = 1 AND slug = ''").all()) {
  await statement('UPDATE articles SET slug = ? WHERE id = ?').run(await uniqueArticleSlug(article.title, '', article.id), article.id);
}

api.get('/crm/projects', async (req, res) => {
  if (req.user.role === 'STAFF') return fail(res, 403, 'You do not have permission to manage projects.');
  res.json(await statement('SELECT * FROM projects ORDER BY updated_at DESC').all());
});
api.post('/crm/projects', async (req, res, next) => {
  if (req.user.role === 'STAFF') return fail(res, 403, 'You do not have permission to manage projects.');
  runProjectUpload(req, res, next, async () => {
    const values = parseResourceBody(req.body, projectConfig);
    values.slug = slugify(values.slug || values.title);
    if (!values.slug) throw new Error('Project title must produce a valid URL slug.');
    values.cover_image = (req.files?.cover?.[0] || req.body.cover_image) ? 'image-provided' : '';
    values.gallery_json = req.body.gallery_json || '[]';
    validateProjectStatus(values);
    const images = await projectImageUrls(req);
    values.cover_image = images.cover;
    values.gallery_json = images.gallery;
    const projectId = id('project');
    const columns = ['id', ...Object.keys(values)];
    try {
      await statement(`INSERT INTO projects (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`)
        .run(projectId, ...Object.values(values));
    } catch (error) {
      await removeProjectImages(images.saved);
      if (error.code === '23505') return fail(res, 409, 'A project already uses this URL slug.');
      throw error;
    }
    await audit(req.user.id, values.publication_status === 'PUBLISHED' ? 'PUBLISH' : 'CREATE', 'project', projectId);
    res.status(201).json(await statement('SELECT * FROM projects WHERE id = ?').get(projectId));
  });
});
api.patch('/crm/projects/:id', async (req, res, next) => {
  if (req.user.role === 'STAFF') return fail(res, 403, 'You do not have permission to manage projects.');
  runProjectUpload(req, res, next, async () => {
    const current = await statement('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!current) return fail(res, 404, 'Project not found.');
    const values = parseResourceBody(req.body, projectConfig, true);
    if (values.title !== undefined || values.slug !== undefined) values.slug = slugify(values.slug || values.title || current.title);
    validateProjectStatus({
      ...current,
      ...values,
      cover_image: req.files?.cover?.[0] ? 'image-provided' : (values.cover_image ?? current.cover_image),
      image_alt: values.image_alt ?? current.image_alt
    });
    const images = await projectImageUrls(req);
    if (req.files?.cover?.[0]) values.cover_image = images.cover;
    else if (req.body.cover_image !== undefined) values.cover_image = req.body.cover_image;
    if ((req.files?.gallery || []).length || req.body.gallery_json !== undefined) values.gallery_json = images.gallery;
    const keys = Object.keys(values);
    if (!keys.length) return fail(res, 400, 'No changes were provided.');
    try {
      await statement(`UPDATE projects SET ${keys.map((key) => `${key} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`)
        .run(...keys.map((key) => values[key]), req.params.id);
    } catch (error) {
      await removeProjectImages(images.saved);
      if (error.code === '23505') return fail(res, 409, 'A project already uses this URL slug.');
      throw error;
    }
    const action = values.publication_status === 'PUBLISHED' && current.publication_status !== 'PUBLISHED'
      ? 'PUBLISH' : values.publication_status && values.publication_status !== 'PUBLISHED' ? 'UNPUBLISH' : 'UPDATE';
    await audit(req.user.id, action, 'project', req.params.id);
    res.json(await statement('SELECT * FROM projects WHERE id = ?').get(req.params.id));
  });
});
api.delete('/crm/projects/:id', async (req, res) => {
  if (req.user.role === 'STAFF') return fail(res, 403, 'You do not have permission to manage projects.');
  const project = await statement('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return fail(res, 404, 'Project not found.');
  const images = [project.cover_image, ...jsonList(project.gallery_json, 'Gallery')];
  await statement('DELETE FROM projects WHERE id = ?').run(req.params.id);
  await removeProjectImages(images);
  await audit(req.user.id, 'DELETE', 'project', req.params.id);
  res.status(204).end();
});

function parseResourceBody(body, config, partial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Provide valid form data.');
  const result = {};
  for (const [key, max] of Object.entries(config.fields)) {
    if (body[key] === undefined) continue;
    if (max === 'bool') result[key] =
      body[key] === true || body[key] === 1 || body[key] === '1' || body[key] === 'true' || body[key] === 'on' ? 1 :
        body[key] === false || body[key] === 0 || body[key] === '0' || body[key] === 'false' || body[key] === 'off' ? 0 :
          (() => { throw new Error(`${key} must be a boolean.`); })();
    else if (max === 'int') {
      const value = Number(body[key]);
      if (!Number.isInteger(value) || value < 0 || value > 10000) throw new Error(`${key} must be a whole number between 0 and 10000.`);
      result[key] = value;
    } else result[key] = string(body[key], max, key, { required: !partial && config.required.includes(key) });
  }
  if (!partial) for (const key of config.required) if (!result[key]) throw new Error(`${key} is required.`);
  if (result.email && !emailPattern.test(result.email)) throw new Error('Enter a valid email address.');
  return result;
}

api.get('/crm/:resource', async (req, res, next) => {
  const { resource } = req.params;
  if (resource === 'settings' || resource === 'audit') return next();
  if (resource === 'team') {
    if (req.user.role === 'STAFF') return fail(res, 403, 'You do not have permission to view the team.');
    return res.json(await statement('SELECT id,name,email,role,active,created_at FROM users ORDER BY name').all());
  }
  const config = resourceConfig(resource);
  if (!config || resource === 'appointments' && req.user.role === 'STAFF') return fail(res, 404, 'Resource not found.');
  if (['services','articles','testimonials','companies'].includes(resource) && req.user.role === 'STAFF') return fail(res, 403, 'You do not have permission to manage website content.');
  const rows = await statement(`SELECT * FROM ${config.table} ORDER BY ${config.orderBy || 'created_at DESC'}`).all();
  res.json(rows);
});

api.post('/crm/:resource', async (req, res, next) => {
  const { resource } = req.params;
  if (resource === 'team') return next();
  const config = resourceConfig(resource);
  if (!config || resource === 'appointments' && req.user.role === 'STAFF') return fail(res, 404, 'Resource not found.');
  if (['services','articles','testimonials','companies'].includes(resource) && req.user.role === 'STAFF') return fail(res, 403, 'You do not have permission to manage website content.');
  try {
    const values = parseResourceBody(req.body, config);
    if (resource === 'companies') validateCompanyUrls(values);
    if (resource === 'services') {
      values.slug = await uniqueServiceSlug(values.title, values.slug);
      if (values.published && !values.meta_description) values.meta_description = values.description.slice(0, 165);
      validatePublishedService(values);
    }
    if (resource === 'articles') {
      values.slug = await uniqueArticleSlug(values.title, values.slug);
      if (values.published && !values.meta_description) values.meta_description = (values.excerpt || values.body).slice(0, 165);
      validatePublishedArticle(values);
    }
    const recordId = resource === 'companies' ? id('company') : id(resource.slice(0, -1));
    const fields = Object.keys(values);
    const columns = ['id', ...fields];
    await statement(`INSERT INTO ${config.table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`)
      .run(recordId, ...fields.map((field) => values[field]));
    await audit(req.user.id, 'CREATE', resource, recordId);
    return res.status(201).json(await statement(`SELECT * FROM ${config.table} WHERE id = ?`).get(recordId));
  } catch (error) {
    if (error.code === '23505') return fail(res, 409, 'A record with that URL slug or unique value already exists.');
    if (error.code) return next(error);
    return fail(res, 400, error.message);
  }
});

api.patch('/crm/:resource/:id', async (req, res, next) => {
  const { resource } = req.params;
  if (resource === 'team') return next();
  const config = resourceConfig(resource);
  if (!config || resource === 'appointments' && req.user.role === 'STAFF') return fail(res, 404, 'Resource not found.');
  if (['services','articles','testimonials','companies'].includes(resource) && req.user.role === 'STAFF') return fail(res, 403, 'You do not have permission to manage website content.');
  try {
    const values = parseResourceBody(req.body, config, true);
    if (resource === 'companies') {
      const current = await statement('SELECT * FROM client_companies WHERE id = ?').get(req.params.id);
      if (!current) return fail(res, 404, 'Company not found.');
      validateCompanyUrls({ ...current, ...values });
    }
    if (resource === 'services' && (values.title !== undefined || values.slug !== undefined)) {
      const current = await statement('SELECT title,slug FROM services WHERE id = ?').get(req.params.id);
      if (!current) return fail(res, 404, 'Record not found.');
      values.slug = await uniqueServiceSlug(values.title || current.title, values.slug || current.slug, req.params.id);
    }
    if (resource === 'articles' && (values.title !== undefined || values.slug !== undefined)) {
      const current = await statement('SELECT title,slug FROM articles WHERE id = ?').get(req.params.id);
      if (!current) return fail(res, 404, 'Record not found.');
      values.slug = await validateArticleSlug(values.title || current.title, values.slug || current.slug, req.params.id);
    }
    if (resource === 'services' && values.published && !values.meta_description) {
      const current = await statement('SELECT description FROM services WHERE id = ?').get(req.params.id);
      values.meta_description = (values.description || current?.description || '').slice(0, 165);
    }
    const fields = Object.keys(values);
    if (!fields.length) return fail(res, 400, 'No changes were provided.');
    if (resource === 'services') {
      const current = await statement('SELECT * FROM services WHERE id = ?').get(req.params.id);
      validatePublishedService({ ...current, ...values });
    }
    if (resource === 'articles') {
      const current = await statement('SELECT * FROM articles WHERE id = ?').get(req.params.id);
      if (values.published && !values.meta_description) values.meta_description = (values.excerpt || current?.excerpt || values.body || current?.body || '').slice(0, 165);
      validatePublishedArticle({ ...current, ...values });
    }
    const updatedAt = config.updatedAt ? ", updated_at = datetime('now')" : '';
    const result = await statement(`UPDATE ${config.table} SET ${fields.map((field) => `${field} = ?`).join(', ')}${updatedAt} WHERE id = ?`).run(...fields.map((field) => values[field]), req.params.id);
    if (!result.changes) return fail(res, 404, 'Record not found.');
    await audit(req.user.id, 'UPDATE', resource, req.params.id);
    res.json(await statement(`SELECT * FROM ${config.table} WHERE id = ?`).get(req.params.id));
  } catch (error) { fail(res, 400, error.message); }
});

api.delete('/crm/:resource/:id', async (req, res) => {
  const { resource } = req.params;
  const config = resourceConfig(resource);
  if (!config || resource === 'appointments' && req.user.role === 'STAFF') return fail(res, 404, 'Resource not found.');
  if (['services','articles','testimonials','companies'].includes(resource) && req.user.role === 'STAFF') return fail(res, 403, 'You do not have permission to manage website content.');
  const result = await statement(`DELETE FROM ${config.table} WHERE id = ?`).run(req.params.id);
  if (!result.changes) return fail(res, 404, 'Record not found.');
  await audit(req.user.id, 'DELETE', resource, req.params.id);
  res.status(204).end();
});

api.get('/crm/settings', allowRoles('SUPER_ADMIN','ADMIN'), async (_req, res) => res.json(await settingsObject()));
api.patch('/crm/settings', allowRoles('SUPER_ADMIN','ADMIN'), async (req, res) => {
  const allowed = new Set(Object.keys(defaultSettings));
  try {
    const entries = Object.entries(req.body || {});
    for (const [key, value] of entries) {
      if (!allowed.has(key) || typeof value !== 'string' || value.length > 5000) return fail(res, 400, `Invalid setting: ${key}`);
      if (key === 'industries') {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed) || parsed.length > 30 || parsed.some((item) => typeof item !== 'string' || item.length > 120)) return fail(res, 400, 'Industries must be a list of up to 30 names.');
      }
      await statement("INSERT INTO settings (key,value,updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')").run(key, value);
    }
    await audit(req.user.id, 'UPDATE', 'settings');
    res.json(await settingsObject());
  } catch (error) { fail(res, 400, `Invalid setting data: ${error.message}`); }
});

api.post('/crm/team', allowRoles('SUPER_ADMIN','ADMIN'), async (req, res) => {
  try {
    const name = string(req.body?.name, 120, 'Name', { required: true });
    const email = string(req.body?.email, 254, 'Email address', { required: true }).toLowerCase();
    const password = string(req.body?.password, 200, 'Password', { required: true });
    const role = req.body?.role;
    if (!emailPattern.test(email)) return fail(res, 400, 'Enter a valid email address.');
    if (password.length < 12) return fail(res, 400, 'Password must be at least 12 characters.');
    if (!['ADMIN','STAFF'].includes(role)) return fail(res, 400, 'Choose ADMIN or STAFF role.');
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    const userId = id('user');
    await statement('INSERT INTO users (id,name,email,role,password_salt,password_hash) VALUES (?,?,?,?,?,?)').run(userId, name, email, role, salt, hash);
    await audit(req.user.id, 'CREATE', 'user', userId);
    res.status(201).json({ id: userId, name, email, role });
  } catch (error) {
    if (error.code === '23505') return fail(res, 409, 'An account already uses this email.');
    fail(res, 400, error.message);
  }
});
api.patch('/crm/team/:id', allowRoles('SUPER_ADMIN','ADMIN'), async (req, res) => {
  const user = await statement('SELECT id,role FROM users WHERE id = ?').get(req.params.id);
  if (!user) return fail(res, 404, 'Team member not found.');
  if (user.role === 'SUPER_ADMIN') return fail(res, 403, 'The super admin account cannot be changed here.');
  const changes = {};
  try {
    if (req.body?.name !== undefined) changes.name = string(req.body.name, 120, 'Name', { required: true });
    if (req.body?.email !== undefined) {
      changes.email = string(req.body.email, 254, 'Email address', { required: true }).toLowerCase();
      if (!emailPattern.test(changes.email)) return fail(res, 400, 'Enter a valid email address.');
    }
    if (req.body?.role !== undefined) {
      if (!['ADMIN','STAFF'].includes(req.body.role)) return fail(res, 400, 'Choose ADMIN or STAFF role.');
      if (req.user.role !== 'SUPER_ADMIN' && req.body.role === 'ADMIN') return fail(res, 403, 'Only the super admin can grant admin access.');
      changes.role = req.body.role;
    }
    if (req.body?.active !== undefined) {
      if (![true, false, 1, 0].includes(req.body.active)) return fail(res, 400, 'Active must be true or false.');
      changes.active = req.body.active === true || req.body.active === 1 ? 1 : 0;
    }
    if (req.body?.password) {
      const password = string(req.body.password, 200, 'Password', { required: true });
      if (password.length < 12) return fail(res, 400, 'Password must be at least 12 characters.');
      changes.password_salt = crypto.randomBytes(16).toString('hex');
      changes.password_hash = crypto.scryptSync(password, changes.password_salt, 64).toString('hex');
    }
    const fields = Object.keys(changes);
    if (!fields.length) return fail(res, 400, 'No changes were provided.');
    await statement(`UPDATE users SET ${fields.map((field) => `${field} = ?`).join(', ')} WHERE id = ?`)
      .run(...fields.map((field) => changes[field]), req.params.id);
  } catch (error) {
    if (error.code === '23505') return fail(res, 409, 'An account already uses this email.');
    return fail(res, 400, error.message);
  }
  if (changes.active === 0 || changes.password_hash) await statement('DELETE FROM sessions WHERE user_id = ?').run(req.params.id);
  await audit(req.user.id, 'UPDATE', 'user', req.params.id);
  res.json({ ok: true });
});
api.post('/crm/password', requireAuth, async (req, res) => {
  const current = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const next = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  if (next.length < 12) return fail(res, 400, 'New password must be at least 12 characters.');
  const user = await statement('SELECT password_salt,password_hash FROM users WHERE id = ?').get(req.user.id);
  const actual = crypto.scryptSync(current, user.password_salt, 64);
  if (!crypto.timingSafeEqual(actual, Buffer.from(user.password_hash, 'hex'))) return fail(res, 401, 'Current password is incorrect.');
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(next, salt, 64).toString('hex');
  await statement('UPDATE users SET password_salt = ?,password_hash = ? WHERE id = ?').run(salt, hash, req.user.id);
  await statement('DELETE FROM sessions WHERE user_id = ?').run(req.user.id);
  await audit(req.user.id, 'CHANGE_PASSWORD', 'user', req.user.id);
  res.setHeader('Set-Cookie', `${sessionCookie}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${production ? '; Secure' : ''}`);
  res.status(204).end();
});
api.get('/crm/audit', allowRoles('SUPER_ADMIN','ADMIN'), async (_req, res) => {
  res.json(await statement(`SELECT a.id,a.action,a.entity,a.entity_id,a.created_at,u.name AS user_name
    FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC LIMIT 200`).all());
});

app.use('/api', api);
app.get('/uploads/:filename', async (req, res) => {
  const filename = req.params.filename;
  if (!/^[a-z0-9-]+\.(?:png|jpg|webp)$/i.test(filename)) return res.status(404).end();
  const publicPath = `/uploads/${filename}`;
  const published = (await statement("SELECT cover_image,gallery_json FROM projects WHERE publication_status = 'PUBLISHED'").all())
    .some((project) => {
      if (project.cover_image === publicPath) return true;
      try { return jsonList(project.gallery_json, 'Gallery').includes(publicPath); } catch { return false; }
    });
  if (!published) return res.status(404).end();
  const file = path.join(dataDir, 'uploads', filename);
  let content;
  let contentType = path.extname(filename);
  if (process.env.VERCEL) {
    const image = await statement('SELECT content_type,image_data FROM project_uploads WHERE filename = ?').get(filename);
    if (!image) return res.status(404).end();
    content = image.image_data;
    contentType = image.content_type;
  } else {
    if (!fs.existsSync(file)) return res.status(404).end();
    content = fs.readFileSync(file);
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', production ? 'public, max-age=2592000, immutable' : 'no-store');
  res.type(contentType).send(content);
});

function xmlEscape(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}
app.get('/robots.txt', async (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${await canonicalOrigin(req)}/sitemap.xml\n`);
});
app.get('/sitemap.xml', async (req, res) => {
  const origin = await canonicalOrigin(req);
  const serviceSlugs = (await statement("SELECT title,slug FROM services WHERE published = 1").all()).map((service) => service.slug || slugify(service.title));
  const projectSlugs = await statement("SELECT slug,updated_at FROM projects WHERE publication_status = 'PUBLISHED'").all();
  const urls = [
    { loc: `${origin}/`, changefreq: 'weekly', priority: '1.0' },
    ...serviceSlugs.map((slug) => ({ loc: `${origin}/services/${encodeURIComponent(slug)}`, changefreq: 'monthly', priority: '0.8' })),
    ...projectSlugs.map((project) => ({ loc: `${origin}/projects/${encodeURIComponent(project.slug)}`, lastmod: project.updated_at, changefreq: 'monthly', priority: '0.7' })),
    ...(await statement("SELECT title,slug,created_at FROM articles WHERE published = 1").all()).map((article) => ({ loc: `${origin}/insights/${encodeURIComponent(article.slug || slugify(article.title))}`, lastmod: article.created_at, changefreq: 'monthly', priority: '0.6' }))
  ];
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<url><loc>${xmlEscape(url.loc)}</loc>${url.lastmod ? `<lastmod>${xmlEscape(new Date(`${url.lastmod.replace(' ', 'T')}Z`).toISOString().slice(0, 10))}</lastmod>` : ''}<changefreq>${url.changefreq}</changefreq><priority>${url.priority}</priority></url>`).join('')}</urlset>`);
});

app.get('/services/:slug', async (req, res) => {
  const service = await statement("SELECT * FROM services WHERE published = 1 AND slug = ?").get(req.params.slug);
  if (!service) return res.status(404).send(await seoPage({ title: 'Service not found | L8R Consultancy', description: 'This service page is not available.', canonical: `${await canonicalOrigin(req)}/services/${encodeURIComponent(req.params.slug)}`, noindex: true, body: '<p>NOT FOUND</p><h1>This service is not available.</h1><p>It may have been unpublished or moved.</p><a href="/">Return to L8R Consultancy</a>' }));
  let faqs = [];
  try { faqs = JSON.parse(service.faqs || '[]'); } catch { faqs = []; }
  const canonical = service.canonical_url || `${await canonicalOrigin(req)}/services/${encodeURIComponent(service.slug)}`;
  const title = service.seo_title || `${service.title} | L8R Consultancy`;
  const description = service.meta_description || service.description.slice(0, 165);
  const body = `<p>OUR SERVICES</p><h1>${escapeHtml(service.title)}</h1><p>${escapeHtml(service.description)}</p>${service.who_for ? `<h2>Who this service is for</h2><p>${escapeHtml(service.who_for)}</p>` : ''}${service.problems ? `<h2>Problems we address</h2><p>${escapeHtml(service.problems)}</p>` : ''}${service.process ? `<h2>Our process</h2><p>${escapeHtml(service.process)}</p>` : ''}${faqs.map((faq) => `<h2>${escapeHtml(faq.question || 'Frequently asked question')}</h2><p>${escapeHtml(faq.answer || '')}</p>`).join('')}`;
  const settings = await settingsObject();
  const structuredData = { '@context': 'https://schema.org', '@type': 'Service', name: service.title, description, provider: { '@type': 'Organization', name: 'L8R Consultancy', email: settings.email, telephone: settings.phone }, url: canonical };
  res.send(await seoPage({ title, description, canonical, body, structuredData }));
});
app.get('/insights/:slug', async (req, res) => {
  const article = await statement("SELECT * FROM articles WHERE published = 1 AND slug = ?").get(req.params.slug);
  const canonical = `${await canonicalOrigin(req)}/insights/${encodeURIComponent(req.params.slug)}`;
  if (!article) return res.status(404).send(await seoPage({ title: 'Article not found | L8R Consultancy', description: 'This article is not available.', canonical, noindex: true, body: '<p>L8R INSIGHTS</p><h1>This article is not available.</h1><a href="/#insights">Return to insights</a>' }));
  const title = article.seo_title || `${article.title} | L8R Consultancy`;
  const description = article.meta_description || article.excerpt.slice(0, 165);
  const articleCanonical = article.canonical_url || canonical;
  const body = `<p>INSIGHTS / ${escapeHtml(article.category || 'PERSPECTIVE')}</p><nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/#insights">Insights</a> / ${escapeHtml(article.title)}</nav><h1>${escapeHtml(article.title)}</h1>${article.excerpt ? `<p>${escapeHtml(article.excerpt)}</p>` : ''}<article class="article-body">${escapeHtml(article.body)}</article>`;
  const structuredData = { '@context': 'https://schema.org', '@type': 'Article', headline: article.title, description, datePublished: article.created_at, author: { '@type': 'Organization', name: 'L8R Consultancy' }, publisher: { '@type': 'Organization', name: 'L8R Consultancy' }, mainEntityOfPage: articleCanonical };
  res.send(await seoPage({ title, description, canonical: articleCanonical, body, structuredData }));
});
app.get('/projects/:slug', async (req, res) => {
  const project = await statement("SELECT * FROM projects WHERE publication_status = 'PUBLISHED' AND slug = ?").get(req.params.slug);
  const canonical = `${await canonicalOrigin(req)}/projects/${encodeURIComponent(req.params.slug)}`;
  if (!project) return res.status(404).send(await seoPage({ title: 'Project not found | L8R Consultancy', description: 'This project is not available.', canonical, noindex: true, body: '<p>PORTFOLIO</p><h1>This project is not available.</h1><p>It may have been unpublished or moved.</p><a href="/#work">Return to portfolio</a>' }));
  let gallery = [];
  try { gallery = JSON.parse(project.gallery_json || '[]'); } catch { gallery = []; }
  const title = project.seo_title || `${project.title} | L8R Consultancy`;
  const description = project.meta_description || project.overview.slice(0, 165);
  const image = project.cover_image ? `<figure><img src="${escapeHtml(project.cover_image)}" alt="${escapeHtml(project.image_alt)}" loading="eager" fetchpriority="high"></figure>` : '';
  const galleryHtml = gallery.map((url, index) => `<figure><img src="${escapeHtml(url)}" alt="${escapeHtml(project.image_alt || `${project.title} project image ${index + 1}`)}" loading="lazy"></figure>`).join('');
  const body = `<p>PROJECT / ${escapeHtml(project.category || 'PORTFOLIO')}</p><nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/#work">Projects</a> / ${escapeHtml(project.title)}</nav><h1>${escapeHtml(project.title)}</h1>${project.client_name ? `<p>Client: ${escapeHtml(project.client_name)}</p>` : ''}${image}<p>${escapeHtml(project.overview)}</p>${project.challenge ? `<h2>Challenge</h2><p>${escapeHtml(project.challenge)}</p>` : ''}${project.solution ? `<h2>Approach & solution</h2><p>${escapeHtml(project.solution)}</p>` : ''}${project.results ? `<h2>Verified results</h2><p>${escapeHtml(project.results)}</p>` : ''}${galleryHtml}`;
  const structuredData = { '@context': 'https://schema.org', '@type': 'CreativeWork', name: project.title, description, url: project.canonical_url || canonical, ...(project.cover_image ? { image: `${await canonicalOrigin(req)}${project.cover_image}` } : {}), ...(project.completion_date ? { datePublished: project.completion_date } : {}) };
  res.send(await seoPage({ title, description, canonical: project.canonical_url || canonical, body, structuredData, image: project.cover_image }));
});
app.get('/', async (req, res) => {
  const origin = await canonicalOrigin(req);
  const settings = await settingsObject();
  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'L8R Consultancy',
    url: `${origin}/`,
    logo: `${origin}/logo.png`,
    email: settings.email,
    telephone: settings.phone
  };
  const website = { '@context': 'https://schema.org', '@type': 'WebSite', name: 'L8R Consultancy', url: `${origin}/` };
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const additions = `<link rel="canonical" href="${escapeHtml(`${origin}/`)}"><script type="application/ld+json">${JSON.stringify(organization).replaceAll('<','\\u003c')}</script><script type="application/ld+json">${JSON.stringify(website).replaceAll('<','\\u003c')}</script>`;
  res.type('html').send(html.replace('</head>', `${additions}</head>`));
});
app.use(async (req, res, next) => {
  if (req.path === '/crm' || req.path.startsWith('/crm/') || req.path === '/login' || req.path.startsWith('/admin')) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
});
app.use(async (req, res, next) => {
  if (req.path === '/crm' || req.path === '/crm/' || req.path === '/login' || req.path === '/') return next();
  if (req.path.startsWith('/@vite/') || req.path.includes('.')) return next();
  const origin = await canonicalOrigin(req);
  res.status(404).send(await seoPage({ title: 'Page not found | L8R Consultancy', description: 'The page you requested could not be found.', canonical: `${origin}${req.path}`, noindex: true, body: '<p>404 / NOT FOUND</p><h1>This page is not available.</h1><p>Return to the L8R Consultancy homepage to continue.</p>' }));
});
app.use((error, _req, res, _next) => {
  console.error('Request failed:', error);
  if (!res.headersSent) {
    if (error?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body must be valid JSON.' });
    if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });
    res.status(500).json({ error: 'An unexpected server error occurred.' });
  }
});

if (production) {
  app.use(express.static(path.join(root, 'dist'), { index: false, maxAge: '1d' }));
  app.use(async (_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));
}

export { app };

if (!process.env.VERCEL) {
  if (!production) {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(express.static(path.join(root, 'dist'), { index: false, maxAge: '1d' }));
    app.use(vite.middlewares);
  }
  const port = Number(process.env.PORT || 5173);
  app.listen(port, '0.0.0.0', () => console.log(`L8R app listening at http://localhost:${port}`));
}
