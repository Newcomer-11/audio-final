const express = require('express');
const multer = require('multer');
const session = require('express-session');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Config ──────────────────────────────────────────────────────────────────
const ADMIN_PASSWORD   = process.env.ADMIN_PASSWORD  || 'admin123';
const SUPABASE_URL     = process.env.SUPABASE_URL;    // https://xxx.supabase.co
const SUPABASE_KEY     = process.env.SUPABASE_KEY;    // service_role key
const SUPABASE_BUCKET  = process.env.SUPABASE_BUCKET || 'podcasts';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('⚠️  Thiếu SUPABASE_URL hoặc SUPABASE_KEY — xem file .env.example');
}

// ─── Supabase client ─────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'seccast-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// ─── Multer (memory — upload thẳng lên Supabase) ─────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowed = /audio\/(mpeg|mp4|ogg|wav|webm|flac|aac|x-m4a)|video\/mp4/;
    allowed.test(file.mimetype) ? cb(null, true) : cb(new Error('Chỉ chấp nhận file audio!'));
  },
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB (free tier Supabase)
});

// ─── Auth middleware ──────────────────────────────────────────────────────────
const requireAuth = (req, res, next) => {
  if (req.session.isAdmin) return next();
  res.redirect('/admin/login');
};

// ─── Helper ───────────────────────────────────────────────────────────────────
function makeFilename(originalName) {
  const safe = originalName.replace(/[^a-zA-Z0-9._\-\u00C0-\u024F\u1E00-\u1EFF ]/g, '_');
  return `${Date.now()}_${safe}`;
}

// ─── Routes: Public ───────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Lấy danh sách podcast từ Supabase Storage
app.get('/api/tracks', async (req, res) => {
  try {
    const { data, error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .list('', { sortBy: { column: 'created_at', order: 'desc' } });

    if (error) throw error;

    const tracks = (data || [])
      .filter(f => /\.(mp3|wav|ogg|flac|aac|m4a|webm)$/i.test(f.name))
      .map(f => {
        const { data: urlData } = supabase.storage
          .from(SUPABASE_BUCKET)
          .getPublicUrl(f.name);
        const displayName = f.name.replace(/^\d+_/, '').replace(/\.[^.]+$/, '');
        return {
          filename: f.name,
          displayName,
          size: f.metadata?.size || 0,
          uploadedAt: f.created_at,
          url: urlData.publicUrl
        };
      });

    res.json({ tracks });
  } catch (err) {
    console.error('Supabase list error:', err);
    res.status(500).json({ error: 'Không thể lấy danh sách file: ' + err.message });
  }
});

// ─── Routes: Admin ────────────────────────────────────────────────────────────
app.get('/admin/login', (req, res) => {
  if (req.session.isAdmin) return res.redirect('/admin');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Sai mật khẩu!' });
  }
});

app.post('/admin/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/admin', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Upload lên Supabase Storage
app.post('/admin/upload', requireAuth, (req, res) => {
  upload.single('audio')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Không có file nào được upload' });

    try {
      const filename = makeFilename(req.file.originalname);

      const { error } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .upload(filename, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false
        });

      if (error) throw error;

      res.json({ success: true, message: `Upload thành công: ${req.file.originalname}`, filename });
    } catch (e) {
      console.error('Supabase upload error:', e);
      res.status(500).json({ error: 'Upload thất bại: ' + e.message });
    }
  });
});

// Xóa file khỏi Supabase Storage
app.delete('/admin/tracks/:filename', requireAuth, async (req, res) => {
  const filename = decodeURIComponent(req.params.filename);
  try {
    const { error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .remove([filename]);

    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    console.error('Supabase delete error:', e);
    res.status(500).json({ error: 'Xóa file thất bại: ' + e.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🎵 SEC//CAST running at http://localhost:${PORT}`);
  console.log(`🔑 Admin password: ${ADMIN_PASSWORD}`);
  console.log(`🗄️  Supabase bucket: ${SUPABASE_BUCKET}`);
});
