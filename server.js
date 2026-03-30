/*
  Kaizen Studio India — Backend Server
  ======================================
  Routes:
    GET  /api/slots          → get current slot count for the month
    POST /api/apply          → submit application (saves to JSON + sends email)
    GET  /api/applications   → admin: list all submissions (protected by ADMIN_KEY)
    DELETE /api/applications/:id → admin: delete a submission
*/

require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const nodemailer = require('nodemailer');
const fs        = require('fs');
const path      = require('path');
const crypto    = require('crypto');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*',   // tighten in production
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
}));
app.use(express.json());

// ── File-based persistence ───────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE  = path.join(DATA_DIR, 'applications.json');
const SLOT_FILE = path.join(DATA_DIR, 'slots.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE))   fs.writeFileSync(DB_FILE, JSON.stringify([]));
if (!fs.existsSync(SLOT_FILE)) fs.writeFileSync(SLOT_FILE, JSON.stringify({ month: currentMonth(), count: 0 }));

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}`;
}

function readApplications() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch (e) { return []; }
}

function writeApplications(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function readSlots() {
  try {
    const obj = JSON.parse(fs.readFileSync(SLOT_FILE, 'utf8'));
    if (obj.month !== currentMonth()) {
      const fresh = { month: currentMonth(), count: 0 };
      fs.writeFileSync(SLOT_FILE, JSON.stringify(fresh, null, 2));
      return fresh;
    }
    return obj;
  } catch (e) {
    return { month: currentMonth(), count: 0 };
  }
}

function incrementSlot() {
  const slots = readSlots();
  const TOTAL = parseInt(process.env.TOTAL_SLOTS || '20', 10);
  if (slots.count >= TOTAL) return slots; // already full
  slots.count += 1;
  fs.writeFileSync(SLOT_FILE, JSON.stringify(slots, null, 2));
  return slots;
}

// ── Email transporter ────────────────────────────────────────────────────────
function createTransporter() {
  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,   // use an App Password for Gmail
    },
  });
}

async function sendOwnerEmail(application) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('[EMAIL] Skipped — EMAIL_USER / EMAIL_PASS not set in .env');
    return;
  }

  const transporter = createTransporter();
  const { name, company, phone, selectedType, department,
          services, flagPackage, flagPrice, needs, submittedAt } = application;

  const servicesSummary = selectedType === 'flag'
    ? `Flagship Package: ${flagPackage}\nPrice: ${flagPrice}`
    : `Department: ${department?.toUpperCase()}\nServices: ${(services || []).join(', ') || 'Not specified'}`;

  const ownerMailOptions = {
    from: `"Kaizen Studio Website" <${process.env.EMAIL_USER}>`,
    to: process.env.OWNER_EMAIL || 'ganeshhariharan.s8@gmail.com',
    subject: `New Client Application: ${company} — Kaizen Studio India`,
    text: [
      'New application received via kaizenstudio.india',
      '',
      '--- APPLICANT DETAILS ---',
      `Name: ${name}`,
      `Company / Brand: ${company}`,
      `Phone / WhatsApp: ${phone}`,
      `Submitted: ${submittedAt}`,
      '',
      '--- SERVICE SELECTION ---',
      servicesSummary,
      '',
      needs ? `--- ADDITIONAL NOTES ---\n${needs}\n` : '',
      '---',
      'Sent via Kaizen Studio India website',
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #eee;padding:32px">
        <h2 style="color:#e0001a;margin:0 0 24px">New Client Application</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:8px 0;color:#888;width:160px">Name</td><td style="padding:8px 0;font-weight:600">${name}</td></tr>
          <tr><td style="padding:8px 0;color:#888">Company / Brand</td><td style="padding:8px 0;font-weight:600">${company}</td></tr>
          <tr><td style="padding:8px 0;color:#888">Phone / WhatsApp</td><td style="padding:8px 0">${phone}</td></tr>
          <tr><td style="padding:8px 0;color:#888">Submitted</td><td style="padding:8px 0">${submittedAt}</td></tr>
        </table>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0"/>
        <h3 style="color:#0f0f0d;margin:0 0 12px">Service Selection</h3>
        ${selectedType === 'flag'
          ? `<p><strong>Flagship Package:</strong> ${flagPackage}<br><strong>Price:</strong> ${flagPrice}</p>`
          : `<p><strong>Department:</strong> ${department?.toUpperCase()}<br><strong>Services:</strong> ${(services || []).join(', ') || 'Not specified'}</p>`
        }
        ${needs ? `<hr style="border:none;border-top:1px solid #eee;margin:20px 0"/><h3 style="margin:0 0 8px">Additional Notes</h3><p style="color:#444">${needs}</p>` : ''}
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0"/>
        <p style="font-size:12px;color:#aaa">Kaizen Studio India · kaizenstudio.india</p>
      </div>
    `,
  };

  await transporter.sendMail(ownerMailOptions);
  console.log(`[EMAIL] Owner notified for application from ${company}`);

  // Optional: auto-reply to the applicant
  if (phone && phone.includes('@')) {  // only if an email was given
    const replyOptions = {
      from: `"Kaizen Studio India" <${process.env.EMAIL_USER}>`,
      to: phone,
      subject: 'We received your application — Kaizen Studio India',
      text: `Hi ${name},\n\nWe've received your application for ${company}.\nOur team will get back to you within 2 hours.\n\n— Kaizen Studio India`,
    };
    await transporter.sendMail(replyOptions).catch(console.warn);
  }
}

// ── Routes ───────────────────────────────────────────────────────────────────

// GET /api/slots
app.get('/api/slots', (req, res) => {
  const slots = readSlots();
  const TOTAL = parseInt(process.env.TOTAL_SLOTS || '20', 10);
  res.json({
    taken:    slots.count,
    total:    TOTAL,
    remaining: Math.max(TOTAL - slots.count, 0),
    month:    slots.month,
  });
});

// POST /api/apply
app.post('/api/apply', async (req, res) => {
  const { name, company, phone, selectedType, department,
          services, flagPackage, flagPrice, flagDesc, needs } = req.body;

  // ── Validation ──────────────────────────────────────────────────────────
  const errors = [];
  if (!name?.trim())    errors.push('name is required');
  if (!company?.trim()) errors.push('company is required');
  if (!phone?.trim())   errors.push('phone is required');
  if (!selectedType)    errors.push('selectedType (dept | flag) is required');
  if (selectedType === 'dept' && !department) errors.push('department is required');
  if (selectedType === 'flag' && !flagPackage) errors.push('flagPackage is required');

  if (errors.length) return res.status(400).json({ ok: false, errors });

  // ── Slot check ──────────────────────────────────────────────────────────
  const TOTAL = parseInt(process.env.TOTAL_SLOTS || '20', 10);
  const currentSlots = readSlots();
  if (currentSlots.count >= TOTAL) {
    return res.status(409).json({ ok: false, error: 'All slots for this month are taken.' });
  }

  // ── Save application ────────────────────────────────────────────────────
  const application = {
    id:           crypto.randomUUID(),
    name:         name.trim(),
    company:      company.trim(),
    phone:        phone.trim(),
    selectedType,
    department:   department || null,
    services:     services   || [],
    flagPackage:  flagPackage || null,
    flagPrice:    flagPrice   || null,
    flagDesc:     flagDesc    || null,
    needs:        needs       || '',
    submittedAt:  new Date().toISOString(),
    status:       'new',
  };

  const apps = readApplications();
  apps.push(application);
  writeApplications(apps);

  // ── Increment slot ──────────────────────────────────────────────────────
  const updatedSlots = incrementSlot();

  // ── Send email (non-blocking) ───────────────────────────────────────────
  sendOwnerEmail(application).catch(err =>
    console.error('[EMAIL ERROR]', err.message)
  );

  res.json({
    ok:      true,
    message: 'Application received. We\'ll get back to you within 2 hours.',
    id:      application.id,
    slots:   {
      taken:     updatedSlots.count,
      total:     TOTAL,
      remaining: Math.max(TOTAL - updatedSlots.count, 0),
    },
  });
});

// GET /api/applications   (admin only)
app.get('/api/applications', (req, res) => {
  const key = req.headers['x-admin-key'] || req.query.key;
  if (key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  const apps = readApplications();
  res.json({ ok: true, count: apps.length, applications: apps });
});

// DELETE /api/applications/:id  (admin only)
app.delete('/api/applications/:id', (req, res) => {
  const key = req.headers['x-admin-key'] || req.query.key;
  if (key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  let apps = readApplications();
  const before = apps.length;
  apps = apps.filter(a => a.id !== req.params.id);
  if (apps.length === before) return res.status(404).json({ ok: false, error: 'Not found' });
  writeApplications(apps);
  res.json({ ok: true, message: 'Deleted' });
});

// PATCH /api/applications/:id/status  (admin only)
app.patch('/api/applications/:id/status', (req, res) => {
  const key = req.headers['x-admin-key'] || req.query.key;
  if (key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  const { status } = req.body;
  const allowed = ['new', 'contacted', 'onboarded', 'rejected'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ ok: false, error: `status must be one of: ${allowed.join(', ')}` });
  }
  const apps = readApplications();
  const app_ = apps.find(a => a.id === req.params.id);
  if (!app_) return res.status(404).json({ ok: false, error: 'Not found' });
  app_.status = status;
  writeApplications(apps);
  res.json({ ok: true, application: app_ });
});

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── Serve static files (website + admin panel) ───────────────────────────────
app.use(express.static(path.join(__dirname)));
// After starting:
//   http://localhost:3000/kaizen_final.html  → website
//   http://localhost:3000/admin.html         → admin dashboard

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  Kaizen Studio Backend running on http://localhost:${PORT}`);
  console.log(`  Data stored in: ${DATA_DIR}`);
  console.log(`  Admin key:      ${process.env.ADMIN_KEY ? '✓ set' : '⚠ not set (ADMIN_KEY in .env)'}`);
  console.log(`  Email:          ${process.env.EMAIL_USER ? '✓ set' : '⚠ not set (EMAIL_USER / EMAIL_PASS in .env)'}\n`);
});
