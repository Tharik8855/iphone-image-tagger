const express = require('express');
const multer = require('multer');
const { exiftool } = require('exiftool-vendored');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 100 * 1024 * 1024 }
});

app.use(express.static(path.join(__dirname, 'public')));

const IPHONE_PROFILES = {
  'iPhone 17 Pro':     { model: 'iPhone 17 Pro',     software: '18.4.1', lensMake: 'Apple', lensModel: 'iPhone 17 Pro back triple camera 6.765mm f/1.78' },
  'iPhone 15 Pro':     { model: 'iPhone 15 Pro',     software: '17.4.1', lensMake: 'Apple', lensModel: 'iPhone 15 Pro back triple camera 6.765mm f/1.78' },
  'iPhone 14 Pro':     { model: 'iPhone 14 Pro',     software: '17.4.1', lensMake: 'Apple', lensModel: 'iPhone 14 Pro back triple camera 6.86mm f/1.78' },
  'iPhone 12 Pro Max': { model: 'iPhone 12 Pro Max', software: '16.7.2', lensMake: 'Apple', lensModel: 'iPhone 12 Pro Max back triple camera 5.1mm f/1.6' },
};

const EXT_MAP = {
  'heic': { ext: '.heic', mime: 'image/heic' },
  'jpeg': { ext: '.jpg',  mime: 'image/jpeg' },
  'png':  { ext: '.png',  mime: 'image/png'  },
  'webp': { ext: '.webp', mime: 'image/webp' },
  'tiff': { ext: '.tiff', mime: 'image/tiff' },
};

async function detectType(file) {
  const t = await exiftool.read(file, ['-FileType']);
  return String(t.FileType || '').toUpperCase();
}

const TYPE_FOR_FORMAT = { heic: 'HEIC', jpeg: 'JPEG', png: 'PNG', webp: 'WEBP', tiff: 'TIFF' };

async function convertImage(src, dest, format) {
  const actual = await detectType(src);
  if (actual === TYPE_FOR_FORMAT[format] || (format === 'heic' && actual === 'HEIF')) {
    fs.copyFileSync(src, dest);
    return;
  }
  await execFileAsync('convert', [`${src}[0]`, '-auto-orient', '-quality', '95', dest]);
}

function cleanup(...files) {
  for (const f of files) {
    try { if (f && fs.existsSync(f)) fs.unlinkSync(f); } catch {}
  }
}

// ---- exposure helpers ----
function parseNum(v) {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

// "1/120", "0.5", "2" -> seconds, or null
function parseShutter(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (s.includes('/')) {
    const [a, b] = s.split('/').map(parseFloat);
    if (Number.isFinite(a) && Number.isFinite(b) && b !== 0 && a > 0) return a / b;
    return null;
  }
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Time-of-day defaults for any exposure field left blank
function autoExposure(hour) {
  const r = Math.random();
  if (hour >= 20 || hour < 6) {
    return { iso: 1600 + Math.floor(r * 1600), brightness: -(2 + r * 2), shutter: 1 / 15 };
  } else if (hour < 9 || hour >= 17) {
    return { iso: 100 + Math.floor(r * 300), brightness: 3.5 + r * 1.5, shutter: 1 / 60 };
  }
  return { iso: 50 + Math.floor(r * 50), brightness: 6 + r * 2, shutter: 1 / 120 };
}

app.post('/process', upload.single('image'), async (req, res) => {
  const inputPath = req.file?.path;
  if (!inputPath) return res.status(400).json({ error: 'No image uploaded.' });

  const { model, lat, lon, alt, filename, date, format } = req.body;
  const profile = IPHONE_PROFILES[model];
  if (!profile) {
    cleanup(inputPath);
    return res.status(400).json({ error: 'Invalid iPhone model.' });
  }

  const fmt = EXT_MAP[format] || EXT_MAP['jpeg'];
  const tmpDir = os.tmpdir();
  const workPath = path.join(tmpDir, `work_${Date.now()}${fmt.ext}`);
  const outputName = (filename || 'output').replace(/[^a-zA-Z0-9_\-]/g, '_') + fmt.ext;

  try {
    const formatKey = EXT_MAP[format] ? format : 'jpeg';
    await convertImage(inputPath, workPath, formatKey);

    // Step 1: strip ALL metadata incl. XMP
    await exiftool.write(workPath, {}, ['-all=', '-XMP:all=', '-overwrite_original']);

    // Step 2: dates
    const dt = date ? new Date(date.replace(' ', 'T')) : new Date();
    const when = isNaN(dt.getTime()) ? new Date() : dt;
    const pad = n => String(n).padStart(2, '0');
    const exifDate = `${when.getFullYear()}:${pad(when.getMonth()+1)}:${pad(when.getDate())} ${pad(when.getHours())}:${pad(when.getMinutes())}:${pad(when.getSeconds())}`;
    const subSec = String(Math.floor(Math.random() * 999)).padStart(3, '0');

    // Step 3: exposure - your values win, blanks fall back to auto
    const auto = autoExposure(when.getHours());
    const iso = parseNum(req.body.iso) ?? auto.iso;
    const exposureTime = parseShutter(req.body.shutter) ?? auto.shutter;
    const brightness = parseNum(req.body.brightness) ?? auto.brightness;
    const bias = parseNum(req.body.bias) ?? 0;

    const tags = {
      Make: 'Apple',
      Model: profile.model,
      Software: profile.software,
      LensMake: profile.lensMake,
      LensModel: profile.lensModel,
      DateTimeOriginal: exifDate,
      CreateDate: exifDate,
      ModifyDate: exifDate,
      DateTimeDigitized: exifDate,
      SubSecTime: subSec,
      SubSecTimeOriginal: subSec,
      SubSecTimeDigitized: subSec,
      OffsetTime: '+00:00',
      OffsetTimeOriginal: '+00:00',
      OffsetTimeDigitized: '+00:00',
      HostComputer: profile.model,
      FNumber: 1.78,
      ApertureValue: 1.78,
      ExposureProgram: 'Program AE',
      ISO: Math.round(iso),
      ExposureTime: exposureTime,
      ShutterSpeedValue: exposureTime,
      BrightnessValue: parseFloat(brightness.toFixed(4)),
      ExposureBiasValue: bias,
      ExifVersion: '0232',
      MeteringMode: 'Multi-segment',
      Flash: 'Off, Did not fire',
      FocalLength: '6.8 mm',
      ColorSpace: 65535,
      FocalLengthIn35mmFormat: '26 mm',
      SceneCaptureType: 'Standard',
      WhiteBalance: 'Auto',
      ExposureMode: 'Auto',
      SensingMethod: 'One-chip color area',
      SceneType: 'Directly photographed',
    };

    if (lat && lon) {
      const latN = parseFloat(lat);
      const lonN = parseFloat(lon);
      const altN = parseFloat(alt) || 10;
      tags.GPSLatitude = Math.abs(latN);
      tags.GPSLatitudeRef = latN >= 0 ? 'N' : 'S';
      tags.GPSLongitude = Math.abs(lonN);
      tags.GPSLongitudeRef = lonN >= 0 ? 'E' : 'W';
      tags.GPSAltitude = altN;
      tags.GPSAltitudeRef = 0;
      tags.GPSSpeed = parseFloat((Math.random() * 1.5).toFixed(2));
      tags.GPSSpeedRef = 'K';
      tags.GPSImgDirection = parseFloat((Math.random() * 360).toFixed(2));
      tags.GPSImgDirectionRef = 'T';
    }

    await exiftool.write(workPath, tags, ['-XMP-x:XMPToolkit=', '-overwrite_original']);

    res.setHeader('Content-Disposition', `attachment; filename="${outputName}"`);
    res.setHeader('Content-Type', fmt.mime);
    const stream = fs.createReadStream(workPath);
    stream.pipe(res);
    stream.on('end', () => cleanup(inputPath, workPath));
    stream.on('error', () => cleanup(inputPath, workPath));

  } catch (err) {
    cleanup(inputPath, workPath);
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

process.on('exit', () => exiftool.end());
app.listen(PORT, () => console.log(`iPhone Image Tagger running on port ${PORT}`));
