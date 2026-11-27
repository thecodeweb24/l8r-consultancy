# L8R Consultancy

Responsive React website and authenticated CRM for L8R Consultancy. The Express API uses Supabase-hosted PostgreSQL; it does not fall back to SQLite.

## Requirements

- Node.js 24 or newer.
- npm.
- A Supabase project and PostgreSQL connection URI.

## Supabase setup

1. Create a Supabase project. In **Project Settings → Database → Connect**, copy a server-side PostgreSQL connection URI. Use the direct connection or session pooler for the app; do not use a browser key or expose a service-role key.
2. In the Supabase Dashboard, open **SQL Editor → New query**. Open `migrations/001_initial_schema.sql` in this repository, copy its full contents into the SQL Editor, and run it. This creates the tables and indexes the app requires. The app deliberately does not attempt to create or alter the database schema on startup.
3. Run `migrations/003_client_companies.sql` in the same SQL Editor to enable the CRM-managed company list and public client strip.
4. If an existing database already has any of these tables, review the migration and existing schema before running it. The checked-in migration is designed for fresh projects and is safe to re-run for tables and indexes it created; it does not import data from an old local SQLite file.
5. Configure the local environment and provision the initial CRM super-admin as described below.

```powershell
npm install
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
```

Set `DATABASE_URL`, `ADMIN_EMAIL`, and a unique `ADMIN_PASSWORD` (at least 12 characters) in `.env.local`. You may instead use `.env`; `.env.local` is loaded after `.env` and overrides it, while variables already set in the process environment remain available. Never commit either file. The scripts load these files automatically.

Create the initial private CRM account and start the development server:

```powershell
npm run admin:create
npm run dev
```

Open `http://localhost:5173` for the public site and `http://localhost:5173/#crm` for the CRM sign-in page. There is no public registration. CRM credentials come only from the secure account provisioning process.

The API uses a server-side PostgreSQL connection pool and requires `DATABASE_URL`; startup fails with a clear error if it is missing or the schema has not been installed. Supabase SSL is enabled by default. `PGSSL=disable` is intended only for local, non-production PostgreSQL. `PGSSL_REJECT_UNAUTHORIZED=true` enables normal certificate verification when the runtime trusts the database certificate.

## Database and backups

PostgreSQL schema is in `migrations/001_initial_schema.sql`; application queries are parameterized and account passwords are stored as scrypt hashes. The application does not automatically copy existing records from a SQLite database. The legacy SQLite file, if present, is not read or used.

Install PostgreSQL client tools (including `pg_dump`) and use a direct or session-pooled Supabase connection to create a logical PostgreSQL dump plus a copy of local uploaded images:

```powershell
npm run db:backup
```

Backups are written to timestamped directories in `data/backups/`, with a custom-format `postgres.dump` and an `uploads/` folder when local images exist. This is a PostgreSQL logical export, not an SQLite backup. Configure and test off-host backup retention before production use. Supabase's own database backups are separately managed in the Supabase project.

## Vercel deployment

The project includes `vercel.json` and a Node.js serverless entry point. All requests are routed through the Express app so the CRM API, server-rendered SEO routes, sitemap, and static Vite build continue to work. Vercel's `VERCEL` environment flag selects serverless-safe settings.

1. Deploy this project to Vercel from its dashboard or CLI. The build command is `npm run build`; the static output is `dist/`.
2. Before deploying, run `npm run admin:create` locally to provision the CRM account in Supabase. The admin password is needed only for this one-time command; do not add it to Vercel environment variables.
3. In Vercel **Project Settings → Environment Variables**, set `DATABASE_URL`, `SITE_URL`, `TRUST_PROXY=true`, and `PGPOOL_MAX=1`. Use the production URL for `SITE_URL`. Add SMTP variables only if enquiry email notifications are required. Never add `.env.local` or credentials to Git.
4. Before the first deployment, run `migrations/002_vercel_uploads.sql` and `migrations/003_client_companies.sql` in the same Supabase SQL Editor. Vercel's filesystem is temporary, so the former migration stores project image bytes in PostgreSQL; the latter enables company management. The server refuses to start if either required table is missing.
5. Deploy and verify `/api/health` reports `{"ok":true,"database":"postgres"}`, then sign in at `/#crm`.

Vercel's serverless request payload limit is lower than the local upload limit, so project images are limited to 512 KB each on Vercel (up to one cover plus five gallery images per request). Locally, uploads remain on disk and support files up to 8 MB each. Database backups include image bytes stored by Vercel; do not rely on the function's `/tmp` directory for persistent files.

If Vercel returns `FUNCTION_INVOCATION_FAILED` for `/api/health` or `/sitemap.xml`, check that `DATABASE_URL` is set for the deployed Vercel environment and that the required SQL migrations have run, then redeploy. `public/robots.txt` is deliberately static so crawler access to robots rules does not depend on the database function; update its sitemap URL if the production domain changes.

## Email notifications

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`, and `ADMIN_NOTIFICATION_EMAIL` in `.env.local` or `.env` to enable server-side notifications for public enquiries. Enquiries are stored even when SMTP is not configured; notification delivery is not claimed in that case.

## Website and CRM

- Public enquiries are validated, rate limited, consent-gated, and stored as lead records.
- Admins can search/filter leads, update pipeline stages, assign staff, schedule follow-ups, add internal notes, export authorized records, and manage appointments.
- Admins can manage published services, client companies, image-backed projects, insights, testimonials, homepage/contact copy, policy text, and editable industry lists. New content is unpublished until explicitly approved.
- Project cover and gallery images remain private until the project is published. Project pages have clean `/projects/<slug>` URLs; published service pages use `/services/<slug>`. The sitemap is dynamically generated from published pages.
- Set `SITE_URL` to the canonical production HTTPS origin in `.env.local` or `.env`. `/robots.txt` and `/sitemap.xml` are served by the app; CRM URLs send `X-Robots-Tag: noindex`.
- Dashboard counts and charts use stored records; no example customers, testimonials, or performance numbers are seeded.
- Staff accounts are restricted to assigned leads and the permitted lead workflow.
- Password changes are available after login. Forgotten-password resets are intentionally not exposed without a verified mail identity flow; use a secure server-side recovery procedure.

## Build and production

```powershell
npm run build
$env:NODE_ENV = "production"
npm start
```

Production deployment must terminate HTTPS at a trusted proxy, set `TRUST_PROXY=true` only when that proxy is configured, keep `.env*` and `data/` out of public/static paths, and mount persistent storage for `data/uploads/`. Configure Supabase network access for the app host. The session cookie is marked `Secure` in production.

The business must approve its actual service portfolio, industries, policy wording, testimonials, and published articles before launch. The bundled policy defaults are reminders to add approved legal text, not legal advice. Google Analytics, Search Console verification, Google Business Profile, Apple Business Connect, and WhatsApp Business API are not configured until the owner supplies authorized credentials and deployment requirements. Project image upload is supported (JPG, PNG, WebP; up to 8 MB each).
