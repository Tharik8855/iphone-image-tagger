const express = require('express');
const multer = require('multer');
const { exiftool } = require('exiftool-vendored');
const tzLookup = require('@photostructure/tz-lookup');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

const app = express();
const PORT = process.env.PORT || 3000;
// Time zone used when no GPS is given
const DEFAULT_TZ = process.env.DEFAULT_TZ || 'Europe/Dublin';

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 100 * 1024 * 1024 }
});

app.use(express.static(path.join(__dirname, 'public')));

// Main (1x) camera details for each model.
// maxLong = long side of the photo that model's camera saves by default.
const IPHONE_PROFILES = {
  'iPhone 17 Pro': {
    model: 'iPhone 17 Pro', software: '26.1',
    lensModel: 'iPhone 17 Pro back triple camera 6.765mm f/1.78',
    lensInfo: '2.220000029 8.999999759 1.78 2.8',
    fNumber: 1.78, focalLength: 6.765, focal35: 24, maxLong: 5712,
  },
  'iPhone 15 Pro': {
    model: 'iPhone 15 Pro', software: '17.4.1',
    lensModel: 'iPhone 15 Pro back triple camera 6.765mm f/1.78',
    lensInfo: '2.220000029 8.999999759 1.78 2.8',
    fNumber: 1.78, focalLength: 6.765, focal35: 24, maxLong: 5712,
  },
  'iPhone 14 Pro': {
    model: 'iPhone 14 Pro', software: '17.4.1',
    lensModel: 'iPhone 14 Pro back triple camera 6.86mm f/1.78',
    lensInfo: '2.220000029 8.999999759 1.78 2.8',
    fNumber: 1.78, focalLength: 6.86, focal35: 24, maxLong: 4032,
  },
  'iPhone 12 Pro Max': {
    model: 'iPhone 12 Pro Max', software: '16.7.2',
    lensModel: 'iPhone 12 Pro Max back triple camera 5.1mm f/1.6',
    lensInfo: '1.539999962 7.5 1.6 2.4',
    fNumber: 1.6, focalLength: 5.1, focal35: 26, maxLong: 4032,
  },
};

const EXT_MAP = {
  'heic': { ext: '.heic', mime: 'image/heic' },
  'jpeg': { ext: '.jpg',  mime: 'image/jpeg' },
  'png':  { ext: '.png',  mime: 'image/png'  },
  'webp': { ext: '.webp', mime: 'image/webp' },
  'tiff': { ext: '.tiff', mime: 'image/tiff' },
};

const TYPE_FOR_FORMAT = { heic: 'HEIC', jpeg: 'JPEG', png: 'PNG', webp: 'WEBP', tiff: 'TIFF' };

function tmpFile(ext) {
  return path.join(os.tmpdir(), `work_${crypto.randomUUID()}${ext}`);
}

// Converts to the chosen format, turns the photo upright and shrinks it
// to the chosen model's photo size. Copies as-is when nothing needs changing.
async function convertImage(src, dest, format, maxLong) {
  const info = await exiftool.read(src);
  const type = String(info.FileType || '').toUpperCase();
  const isHeif = type === 'HEIC' || type === 'HEIF';
  const sameType = type === TYPE_FOR_FORMAT[format] || (format === 'heic' && isHeif);
  const orient = Number(info.Orientation) || 1;
  const w = Number(info.ImageWidth) || 0;
  const h = Number(info.ImageHeight) || 0;
  const tooBig = Math.max(w, h) > maxLong;

  // HEIC rotation lives in the image itself (not the EXIF tag), so a HEIC copy stays upright
  if (sameType && !tooBig && (orient === 1 || isHeif)) {
    fs.copyFileSync(src, dest);
    return;
  }

  let input = src;
  let tmpInput = null;
  if (isHeif) {
    // HEIC decoding already applies the rotation; drop the EXIF tag so it isn't rotated twice
    tmpInput = tmpFile(path.extname(src) || '.heic');
    fs.copyFileSync(src, tmpInput);
    await exiftool.write(tmpInput, {}, ['-Orientation=', '-overwrite_original']);
    input = tmpInput;
  }
  try {
    await execFileAsync('convert', [
      `${input}[0]`, '-auto-orient',
      '-resize', `${maxLong}x${maxLong}>`,
      '-quality', '95', dest,
    ]);
  } finally {
    cleanup(tmpInput);
  }
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

// ---- time zone helpers ----
// "Wall" times are the clock time at the photo's location, stored as if UTC.

// "2026-07-04 14:30" -> wall ms, or null
function parseWall(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(s || '').trim());
  if (!m) return null;
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  return Number.isFinite(ms) ? ms : null;
}

// UTC offset in minutes for a time zone at a real moment
function offsetMinutes(tz, instantMs) {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
    .formatToParts(new Date(instantMs))
    .find(p => p.type === 'timeZoneName');
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(part ? part.value : '');
  if (!m) return 0;
  const v = (+m[2]) * 60 + (+m[3]);
  return m[1] === '-' ? -v : v;
}

// Offset for a local clock time (handles summer time)
function wallOffset(tz, wallMs) {
  const first = offsetMinutes(tz, wallMs);
  return offsetMinutes(tz, wallMs - first * 60000);
}

function fmtOffset(min) {
  const sign = min < 0 ? '-' : '+';
  const a = Math.abs(min);
  return `${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

function zoneFor(lat, lon) {
  if (lat !== null && lon !== null) {
    try { return tzLookup(lat, lon); } catch {}
  }
  return DEFAULT_TZ;
}

function validCoord(v, limit) {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const n = parseFloat(v);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

app.post('/process', upload.single('image'), async (req, res) => {
  const inputPath = req.file?.path;
  if (!inputPath) return res.status(400).json({ error: 'No image uploaded.' });

  const { model, alt, filename, date, format } = req.body;
  const profile = IPHONE_PROFILES[model];
  if (!profile) {
    cleanup(inputPath);
    return res.status(400).json({ error: 'Invalid iPhone model.' });
  }

  const formatKey = EXT_MAP[format] ? format : 'jpeg';
  const fmt = EXT_MAP[formatKey];
  const workPath = tmpFile(fmt.ext);
  const outputName = (filename || 'output').replace(/[^a-zA-Z0-9_\-]/g, '_') + fmt.ext;

  try {
    await convertImage(inputPath, workPath, formatKey, profile.maxLong);

    // Step 1: strip all metadata incl. XMP, but keep the colour profile so colours don't shift
    await exiftool.write(workPath, {}, ['-all=', '--ICC_Profile:all', '-overwrite_original']);

    const after = await exiftool.read(workPath);
    const outW = Number(after.ImageWidth) || undefined;
    const outH = Number(after.ImageHeight) || undefined;
    const isP3 = /p3/i.test(String(after.ProfileDescription || ''));

    // Step 2: location + time zone
    const latN = validCoord(req.body.lat, 90);
    const lonN = validCoord(req.body.lon, 180);
    const hasGPS = latN !== null && lonN !== null;
    const tz = zoneFor(hasGPS ? latN : null, hasGPS ? lonN : null);

    // Step 3: dates — the time you enter is the clock time at the photo's location.
    // Blank = the current time there.
    const baseWall = parseWall(date) ?? (Date.now() + offsetMinutes(tz, Date.now()) * 60000);
    const secOffset = Math.floor(Math.random() * 59) + 1;
    const wall = new Date(baseWall + secOffset * 1000);
    const offMin = wallOffset(tz, wall.getTime());
    const tzOffset = fmtOffset(offMin);
    const utc = new Date(wall.getTime() - offMin * 60000);

    const pad = n => String(n).padStart(2, '0');
    const exifDate = `${wall.getUTCFullYear()}:${pad(wall.getUTCMonth() + 1)}:${pad(wall.getUTCDate())} ${pad(wall.getUTCHours())}:${pad(wall.getUTCMinutes())}:${pad(wall.getUTCSeconds())}`;
    const subSec = String(Math.floor(Math.random() * 999)).padStart(3, '0');

    // Step 4: exposure — your values win, blanks fall back to auto
    const auto = autoExposure(wall.getUTCHours());
    const iso = parseNum(req.body.iso) ?? auto.iso;
    const exposureTime = parseShutter(req.body.shutter) ?? auto.shutter;
    const userBrightness = parseNum(req.body.brightness);
    const brightness = userBrightness !== null
      ? userBrightness
      : parseFloat((auto.brightness + (Math.random() * 0.3 - 0.15)).toFixed(4));
    const bias = parseNum(req.body.bias) ?? 0;

    const tags = {
      Make: 'Apple',
      Model: profile.model,
      Software: profile.software,
      HostComputer: profile.model,
      LensMake: 'Apple',
      LensModel: profile.lensModel,
      LensInfo: profile.lensInfo,
      DateTimeOriginal: exifDate,
      CreateDate: exifDate,
      ModifyDate: exifDate,
      SubSecTimeOriginal: subSec,
      SubSecTimeDigitized: subSec,
      OffsetTime: tzOffset,
      OffsetTimeOriginal: tzOffset,
      OffsetTimeDigitized: tzOffset,
      FNumber: profile.fNumber,
      ApertureValue: profile.fNumber,
      FocalLength: profile.focalLength,
      FocalLengthIn35mmFormat: profile.focal35,
      ExposureProgram: 'Program AE',
      ISO: Math.round(iso),
      ExposureTime: exposureTime,
      ShutterSpeedValue: exposureTime,
      BrightnessValue: brightness,
      ExposureBiasValue: bias,
      ExifVersion: '0232',
      MeteringMode: 'Multi-segment',
      Flash: 'Off, Did not fire',
      ColorSpace: isP3 ? 'Uncalibrated' : 'sRGB',
      SceneCaptureType: 'Standard',
      WhiteBalance: 'Auto',
      ExposureMode: 'Auto',
      SensingMethod: 'One-chip color area',
      SceneType: 'Directly photographed',
      'XMP-xmp:CreatorTool': profile.software,
      'XMP-xmp:CreateDate': `${exifDate}${tzOffset}`,
      'XMP-xmp:ModifyDate': `${exifDate}${tzOffset}`,
      'XMP-photoshop:DateCreated': `${exifDate}${tzOffset}`,
    };
    if (outW && outH) {
      tags.ExifImageWidth = outW;
      tags.ExifImageHeight = outH;
    }

    if (hasGPS) {
      const altN = parseFloat(alt);
      tags.GPSLatitude = Math.abs(latN);
      tags.GPSLatitudeRef = latN >= 0 ? 'N' : 'S';
      tags.GPSLongitude = Math.abs(lonN);
      tags.GPSLongitudeRef = lonN >= 0 ? 'E' : 'W';
      tags.GPSAltitude = Math.abs(Number.isFinite(altN) ? altN : 10);
      tags.GPSAltitudeRef = Number.isFinite(altN) && altN < 0 ? 1 : 0;
      tags.GPSSpeed = parseFloat((Math.random() * 1.5).toFixed(2));
      tags.GPSSpeedRef = 'K';
      tags.GPSImgDirection = parseFloat((Math.random() * 360).toFixed(2));
      tags.GPSImgDirectionRef = 'T';
      tags.GPSDateStamp = `${utc.getUTCFullYear()}:${pad(utc.getUTCMonth() + 1)}:${pad(utc.getUTCDate())}`;
      tags.GPSTimeStamp = `${pad(utc.getUTCHours())}:${pad(utc.getUTCMinutes())}:${pad(utc.getUTCSeconds())}`;
    }

    await exiftool.write(workPath, tags, ['-XMP-x:XMPToolkit=', '-overwrite_original']);

    res.setHeader('Content-Disposition', `attachment; filename="${outputName}"`);
    res.setHeader('Content-Type', fmt.mime);
    // 'close' fires on success and when the phone disconnects, so temp files never pile up
    res.on('close', () => cleanup(inputPath, workPath));
    const stream = fs.createReadStream(workPath);
    stream.on('error', () => res.destroy());
    stream.pipe(res);

  } catch (err) {
    cleanup(inputPath, workPath);
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

process.on('SIGTERM', () => {
  exiftool.end().finally(() => process.exit(0));
});
app.listen(PORT, () => console.log(`iPhone Image Tagger running on port ${PORT}`));
