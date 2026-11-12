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

const P3_ICC = path.join(__dirname, 'icc', 'DisplayP3.icc');
const SRGB_ICC = path.join(__dirname, 'icc', 'sRGB.icc');

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 100 * 1024 * 1024 }
});

app.use(express.static(path.join(__dirname, 'public')));

// Main (1x) camera details for each model.
// maxLong = long side of the photo that model's camera saves by default.
// released = the day the phone went on sale (photos can't be older than this).
const IPHONE_PROFILES = {
  'iPhone 17 Pro': {
    model: 'iPhone 17 Pro', released: '2025-09-19',
    lensModel: 'iPhone 17 Pro back triple camera 6.765mm f/1.78',
    lensInfo: '2.220000029 8.999999759 1.78 2.8',
    fNumber: 1.78, focalLength: 6.765, focal35: 24, maxLong: 5712,
  },
  'iPhone 15 Pro': {
    model: 'iPhone 15 Pro', released: '2023-09-22',
    lensModel: 'iPhone 15 Pro back triple camera 6.765mm f/1.78',
    lensInfo: '2.220000029 8.999999759 1.78 2.8',
    fNumber: 1.78, focalLength: 6.765, focal35: 24, maxLong: 5712,
  },
  'iPhone 14 Pro': {
    model: 'iPhone 14 Pro', released: '2022-09-16',
    lensModel: 'iPhone 14 Pro back triple camera 6.86mm f/1.78',
    lensInfo: '2.220000029 8.999999759 1.78 2.8',
    fNumber: 1.78, focalLength: 6.86, focal35: 24, maxLong: 4032,
  },
  'iPhone 12 Pro': {
    model: 'iPhone 12 Pro', released: '2020-10-23',
    lensModel: 'iPhone 12 Pro back triple camera 4.2mm f/1.6',
    lensInfo: '1.539999962 6 1.6 2.4',
    fNumber: 1.6, focalLength: 4.2, focal35: 26, maxLong: 4032,
  },
  'iPhone 12 Pro Max': {
    model: 'iPhone 12 Pro Max', released: '2020-11-13',
    lensModel: 'iPhone 12 Pro Max back triple camera 5.1mm f/1.6',
    lensInfo: '1.539999962 7.5 1.6 2.4',
    fNumber: 1.6, focalLength: 5.1, focal35: 26, maxLong: 4032,
  },
};

// iOS releases (version, release date). The photo gets the newest version
// that had been out for at least IOS_UPDATE_LAG_DAYS before the photo date.
const IOS_RELEASES = [
  ['14.1', '2020-10-20'], ['14.2', '2020-11-05'],['14.2.1', '2020-11-19'], ['14.3', '2020-12-14'], ['14.4', '2021-01-26'],
  ['14.4.1', '2021-03-08'], ['14.4.2', '2021-03-26'], ['14.5', '2021-04-26'], ['14.5.1', '2021-05-03'],
  ['14.6', '2021-05-24'], ['14.7', '2021-07-19'], ['14.7.1', '2021-07-26'], ['14.8', '2021-09-13'],
  ['15.0', '2021-09-20'], ['15.0.1', '2021-10-01'], ['15.0.2', '2021-10-11'], ['15.1', '2021-10-25'],
  ['15.1.1', '2021-11-17'], ['15.2', '2021-12-13'], ['15.2.1', '2022-01-12'], ['15.3', '2022-01-26'],
  ['15.3.1', '2022-02-10'], ['15.4', '2022-03-14'], ['15.4.1', '2022-03-31'], ['15.5', '2022-05-16'],
  ['15.6', '2022-07-20'], ['15.6.1', '2022-08-17'], ['16.0', '2022-09-12'], ['16.0.2', '2022-09-22'],
  ['16.0.3', '2022-10-10'], ['16.1', '2022-10-24'], ['16.1.1', '2022-11-09'], ['16.1.2', '2022-11-30'],
  ['16.2', '2022-12-13'], ['16.3', '2023-01-23'], ['16.3.1', '2023-02-13'], ['16.4', '2023-03-27'],
  ['16.4.1', '2023-04-07'], ['16.5', '2023-05-18'], ['16.5.1', '2023-06-21'], ['16.6', '2023-07-24'],
  ['16.6.1', '2023-09-07'], ['17.0', '2023-09-18'], ['17.0.2', '2023-09-21'], ['17.0.3', '2023-10-04'],
  ['17.1', '2023-10-25'], ['17.1.1', '2023-11-07'], ['17.1.2', '2023-11-30'], ['17.2', '2023-12-11'],
  ['17.2.1', '2023-12-19'], ['17.3', '2024-01-22'], ['17.3.1', '2024-02-08'], ['17.4', '2024-03-05'],
  ['17.4.1', '2024-03-21'], ['17.5', '2024-05-13'], ['17.5.1', '2024-05-20'], ['17.6', '2024-07-29'],
  ['17.6.1', '2024-08-07'], ['18.0', '2024-09-16'], ['18.0.1', '2024-10-03'], ['18.1', '2024-10-28'],
  ['18.1.1', '2024-11-19'], ['18.2', '2024-12-11'], ['18.2.1', '2025-01-06'], ['18.3', '2025-01-27'],
  ['18.3.1', '2025-02-10'], ['18.3.2', '2025-03-11'], ['18.4', '2025-03-31'], ['18.4.1', '2025-04-16'],
  ['18.5', '2025-05-12'], ['18.6', '2025-07-29'], ['18.6.2', '2025-08-20'], ['26.0', '2025-09-15'],
  ['26.0.1', '2025-09-29'], ['26.1', '2025-11-03'], ['26.2', '2025-12-12'], ['26.2.1', '2026-01-26'],
  ['26.3', '2026-02-11'], ['26.3.1', '2026-03-04'], ['26.4', '2026-03-24'], ['26.4.1', '2026-04-08'],
  ['26.4.2', '2026-04-22'], ['26.5', '2026-05-11'], ['26.6', '2026-07-27'], ['26.7.1', '2026-09-28'],
].map(([v, d]) => [v, Date.parse(d + 'T00:00:00Z')]);
const IOS_UPDATE_LAG_DAYS = 7;

// Picks the iOS version for a photo date (wall-clock ms) and phone
function iosFor(wallMs, profile) {
  const cutoff = wallMs - IOS_UPDATE_LAG_DAYS * 86400000;
  const released = Date.parse(profile.released + 'T00:00:00Z');
  let pick = null;
  for (const [v, d] of IOS_RELEASES) {
    if (d <= cutoff) pick = v;
  }
  // Brand-new phones ship with the version that was current on launch day
  if (!pick || Date.parse(profile.released) > cutoff) {
    for (const [v, d] of IOS_RELEASES) if (d <= released) pick = v;
  }
  return pick;
}

const FORMAT_FOR_TYPE = { JPEG: 'jpeg', HEIC: 'heic', HEIF: 'heic', PNG: 'png', WEBP: 'webp', TIFF: 'tiff' };

const EXT_MAP = {
  'heic': { ext: '.heic', mime: 'image/heic' },
  'jpeg': { ext: '.jpg',  mime: 'image/jpeg' },
  'png':  { ext: '.png',  mime: 'image/png'  },
  'webp': { ext: '.webp', mime: 'image/webp' },
  'tiff': { ext: '.tiff', mime: 'image/tiff' },
};

function tmpFile(ext) {
  return path.join(os.tmpdir(), `work_${crypto.randomUUID()}${ext}`);
}

let heifEncAvailable = null;
async function hasHeifEnc() {
  if (process.env.DISABLE_HEIF_ENC) return false;
  if (heifEncAvailable === null) {
    try { await execFileAsync('heif-enc', ['--version']); heifEncAvailable = true; }
    catch (e) { heifEncAvailable = !!(e && e.code !== 'ENOENT' && e.code !== 127); }
  }
  return heifEncAvailable;
}

// ImageMagick needs LittleCMS (lcms) to convert colours properly
let lcmsAvailable = null;
async function hasLcms() {
  if (lcmsAvailable === null) {
    try {
      const { stdout } = await execFileAsync('convert', ['-version']);
      lcmsAvailable = /\blcms\b/i.test(stdout);
    } catch { lcmsAvailable = false; }
  }
  return lcmsAvailable;
}

// Turns the photo upright, shrinks it to the model's photo size, converts colours
// to Display P3 (like iPhone photos) and saves in the chosen format.
// JPEG portrait photos are stored sideways with a rotate tag, the way iPhones save them.
// Returns { orientation } to write into the EXIF.
async function convertImage(src, dest, format, maxLong) {
  const info = await exiftool.read(src);
  const type = String(info.FileType || '').toUpperCase();
  const isHeif = type === 'HEIC' || type === 'HEIF';
  const hasIcc = !!info.ProfileDescription;

  let input = src;
  let tmpInput = null;
  if (isHeif) {
    // HEIC decoding already applies the rotation; drop the EXIF tag so it isn't rotated twice
    tmpInput = tmpFile('.heic');
    fs.copyFileSync(src, tmpInput);
    await exiftool.write(tmpInput, {}, ['-Orientation=', '-overwrite_original']);
    input = tmpInput;
  }

  const base = [`${input}[0]`, '-auto-orient', '-resize', `${maxLong}x${maxLong}>`];
  // No profile = treat as sRGB; then convert to Display P3.
  // Without lcms the colours can't be converted, so leave them as they are.
  let colour = [];
  if (await hasLcms()) {
    colour = hasIcc ? ['-profile', P3_ICC] : ['-profile', SRGB_ICC, '-profile', P3_ICC];
  }

  let orientation = 1;
  const tmpPng = tmpFile('.png');
  try {
    if (format === 'jpeg') {
      // Check if it's portrait after turning upright
      await execFileAsync('convert', [...base, ...colour, '-depth', '8', tmpPng]);
      const dims = await exiftool.read(tmpPng);
      const portrait = Number(dims.ImageHeight) > Number(dims.ImageWidth);
      const args = [tmpPng];
      if (portrait) { args.push('-rotate', '-90'); orientation = 6; }
      args.push('-sampling-factor', '4:2:0', '-quality', '92', dest);
      await execFileAsync('convert', args);
    } else if (format === 'heic') {
      await execFileAsync('convert', [...base, ...colour, '-depth', '8', tmpPng]);
      if (await hasHeifEnc()) {
        // heif-enc gives 8-bit HEIC with a built-in preview image, like an iPhone
        await execFileAsync('heif-enc', await heifEncArgs(tmpPng, dest));
      } else {
        await execFileAsync('convert', [tmpPng, '-quality', '90', dest]);
      }
      // Some HEIC encoders (e.g. older ImageMagick) drop the colour profile; put it back
      await ensureIcc(dest, tmpPng, colour.length > 0);
    } else {
      await execFileAsync('convert', [...base, ...colour, '-depth', '8', '-quality', '95', dest]);
    }
  } finally {
    cleanup(tmpInput, tmpPng);
  }
  return { orientation };
}

// heif-enc settings; the built-in preview must be smaller than the photo
async function heifEncArgs(pngPath, dest) {
  const d = await exiftool.read(pngPath);
  const longSide = Math.max(Number(d.ImageWidth) || 0, Number(d.ImageHeight) || 0);
  const args = ['-q', '90'];
  if (longSide > 320) args.push('-t', '320');
  return [...args, '-o', dest, pngPath];
}

// Makes sure an encoded file carries the colour profile its pixels are in
async function ensureIcc(file, pngWithProfile, convertedToP3) {
  const has = async () => !!(await exiftool.read(file)).ProfileDescription;
  if (await has()) return 'kept';
  try {
    await exiftool.write(file, {}, ['-tagsFromFile', pngWithProfile, '-ICC_Profile', '-overwrite_original']);
    if (await has()) return 'copied from png';
  } catch (e) { console.error('ICC copy failed:', e.message); }
  const icc = convertedToP3 ? P3_ICC : SRGB_ICC;
  try {
    await exiftool.write(file, {}, [`-ICC_Profile<=${icc}`, '-overwrite_original']);
    if (await has()) return 'written from file';
  } catch (e) { console.error('ICC write failed:', e.message); }
  return 'missing';
}

// Small 160x120-style preview stored inside JPEG EXIF (iPhones include one)
async function makeExifThumbnail(jpegPath) {
  const thumb = tmpFile('.jpg');
  await execFileAsync('convert', [jpegPath, '-thumbnail', '160x160', '-strip', '-quality', '80', thumb]);
  return thumb;
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

// Open /diag on your phone to see what the server has installed
app.get('/diag', async (req, res) => {
  const out = { node: process.version, docker: fs.existsSync('/.dockerenv') };
  try { out.imagemagick = (await execFileAsync('convert', ['-version'])).stdout.split('\n').slice(0, 4).join(' | '); }
  catch (e) { out.imagemagick = 'missing: ' + e.message; }
  out.lcms = await hasLcms();
  out.heifEnc = await hasHeifEnc();
  try { out.exiftool = await exiftool.version(); } catch { out.exiftool = 'error'; }

  // Self-test: run a small test image through the HEIC steps and report the colour profile
  const t = {};
  const src = tmpFile('.png'), png = tmpFile('.png'), heic = tmpFile('.heic');
  try {
    await execFileAsync('convert', ['-size', '120x160', 'gradient:red-blue', src]);
    const colour = out.lcms ? ['-profile', SRGB_ICC, '-profile', P3_ICC] : [];
    await execFileAsync('convert', [src, ...colour, '-depth', '8', png]);
    t.pngProfile = (await exiftool.read(png)).ProfileDescription || 'none';
    if (out.heifEnc) await execFileAsync('heif-enc', await heifEncArgs(png, heic));
    else await execFileAsync('convert', [png, '-quality', '90', heic]);
    t.encoder = out.heifEnc ? 'heif-enc' : 'imagemagick';
    t.afterEncode = (await exiftool.read(heic)).ProfileDescription || 'none';
    t.fix = await ensureIcc(heic, png, colour.length > 0);
    await exiftool.write(heic, {}, ['-all=', '--ICC_Profile:all', '-overwrite_original']);
    t.afterStrip = (await exiftool.read(heic)).ProfileDescription || 'none';
  } catch (e) {
    t.error = e.message;
  } finally {
    cleanup(src, png, heic);
  }
  out.heicTest = t;
  res.json(out);
});

app.post('/process', upload.single('image'), async (req, res) => {
  const inputPath = req.file?.path;
  if (!inputPath) return res.status(400).json({ error: 'No image uploaded.' });

  const { model, alt, filename, date, format } = req.body;
  const profile = IPHONE_PROFILES[model];
  if (!profile) {
    cleanup(inputPath);
    return res.status(400).json({ error: 'Invalid iPhone model.' });
  }

  // Keep original pixels (default): only the metadata changes, the image data is untouched.
  // The output is then always the same format as the uploaded photo.
  const keepPixels = req.body.keepPixels !== '0';
  let formatKey = EXT_MAP[format] ? format : 'jpeg';
  let srcInfo = null;
  if (keepPixels) {
    srcInfo = await exiftool.read(inputPath).catch(() => ({}));
    const sameFormat = FORMAT_FOR_TYPE[String(srcInfo.FileType || '').toUpperCase()];
    if (!sameFormat) {
      cleanup(inputPath);
      return res.status(400).json({ error: 'Keep original pixels works with HEIC, JPG, PNG, WebP and TIFF photos.' });
    }
    formatKey = sameFormat;
  }
  const fmt = EXT_MAP[formatKey];
  const workPath = tmpFile(fmt.ext);
  // Batch mode asks for iPhone-style capital extensions (IMG_1234.HEIC)
  const outExt = req.body.upperExt === '1' ? fmt.ext.toUpperCase() : fmt.ext;
  const outputName = (filename || 'output').replace(/[^a-zA-Z0-9_\-]/g, '_') + outExt;
  let thumbPath = null;

  try {
    // Location + time zone
    const latN = validCoord(req.body.lat, 90);
    const lonN = validCoord(req.body.lon, 180);
    const hasGPS = latN !== null && lonN !== null;
    const tz = zoneFor(hasGPS ? latN : null, hasGPS ? lonN : null);

    // Dates — the time you enter is the clock time at the photo's location.
    // Blank = the current time there.
    const baseWall = parseWall(date) ?? (Date.now() + offsetMinutes(tz, Date.now()) * 60000);
    // Batch mode sends exact times (seconds already picked), so photos stay in order
    const secOffset = req.body.exactTime === '1' ? 0 : Math.floor(Math.random() * 59) + 1;
    const wall = new Date(baseWall + secOffset * 1000);

    if (wall.getTime() < Date.parse(profile.released + 'T00:00:00Z')) {
      cleanup(inputPath);
      return res.status(400).json({ error: `The ${profile.model} came out on ${profile.released}. Pick a date after that.` });
    }

    const offMin = wallOffset(tz, wall.getTime());
    const tzOffset = fmtOffset(offMin);
    const software = iosFor(wall.getTime(), profile);

    let orientation;
    if (keepPixels) {
      // Exact copy of the photo; keep its own rotation tag so it still shows the right way up
      fs.copyFileSync(inputPath, workPath);
      orientation = Number(srcInfo.Orientation) || 1;
    } else {
      ({ orientation } = await convertImage(inputPath, workPath, formatKey, profile.maxLong));
    }

    // Strip all metadata incl. XMP, but keep the colour profile
    await exiftool.write(workPath, {}, ['-all=', '--ICC_Profile:all', '-overwrite_original']);

    // Stored pixel size (JPEG portraits are stored sideways, like an iPhone)
    const after = await exiftool.read(workPath);
    const outW = Number(after.ImageWidth) || 0;
    const outH = Number(after.ImageHeight) || 0;
    const isP3 = /p3/i.test(String(after.ProfileDescription || ''));

    const pad = n => String(n).padStart(2, '0');
    const exifDate = `${wall.getUTCFullYear()}:${pad(wall.getUTCMonth() + 1)}:${pad(wall.getUTCDate())} ${pad(wall.getUTCHours())}:${pad(wall.getUTCMinutes())}:${pad(wall.getUTCSeconds())}`;
    const subSec = String(Math.floor(Math.random() * 999)).padStart(3, '0');

    // Exposure — your values win, blanks fall back to auto
    const auto = autoExposure(wall.getUTCHours());
    const iso = parseNum(req.body.iso) ?? auto.iso;
    const exposureTime = parseShutter(req.body.shutter) ?? auto.shutter;
    const userBrightness = parseNum(req.body.brightness);
    const brightness = userBrightness !== null
      ? userBrightness
      : parseFloat((auto.brightness + (Math.random() * 0.3 - 0.15)).toFixed(4));
    const bias = parseNum(req.body.bias) ?? 0;

    // Focus/metering area in the middle of the frame (sensor = landscape)
    const longSide = Math.max(outW, outH);
    const shortSide = Math.min(outW, outH);
    const subjectArea = longSide && shortSide
      ? `${Math.round(longSide / 2)} ${Math.round(shortSide / 2)} ${Math.round(longSide * 0.55)} ${Math.round(shortSide * 0.44)}`
      : undefined;

    const tags = {
      Make: 'Apple',
      Model: profile.model,
      'Orientation#': orientation,
      Software: software,
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
      'EXIF:Flash#': 16, // Off, Did not fire (number avoids the comma being split)
      ColorSpace: isP3 ? 'Uncalibrated' : 'sRGB',
      SceneCaptureType: 'Standard',
      WhiteBalance: 'Auto',
      ExposureMode: 'Auto',
      SensingMethod: 'One-chip color area',
      SceneType: 'Directly photographed',
      'XMP-xmp:CreatorTool': software,
      'XMP-xmp:CreateDate': `${exifDate}${tzOffset}`,
      'XMP-xmp:ModifyDate': `${exifDate}${tzOffset}`,
      'XMP-photoshop:DateCreated': `${exifDate}${tzOffset}`,
    };
    if (outW && outH) {
      tags.ExifImageWidth = outW;
      tags.ExifImageHeight = outH;
    }
    if (subjectArea) tags['SubjectArea'] = subjectArea;

    if (hasGPS) {
      // Move a few metres (3–20 m) from the entered point, like real GPS readings
      const dist = 3 + Math.random() * 17;
      const ang = Math.random() * 2 * Math.PI;
      const gLat = latN + (dist * Math.cos(ang)) / 111320;
      const gLon = lonN + (dist * Math.sin(ang)) / (111320 * Math.cos(latN * Math.PI / 180));
      // Altitude always has decimals
      const altIn = parseFloat(alt);
      const altN = parseFloat(((Number.isFinite(altIn) ? altIn : 10) + (Math.random() * 3 - 1.5)).toFixed(3));
      const heading = parseFloat((Math.random() * 360).toFixed(4));

      tags.GPSLatitude = Math.abs(gLat);
      tags.GPSLatitudeRef = gLat >= 0 ? 'N' : 'S';
      tags.GPSLongitude = Math.abs(gLon);
      tags.GPSLongitudeRef = gLon >= 0 ? 'E' : 'W';
      tags.GPSAltitude = Math.abs(altN);
      tags.GPSAltitudeRef = altN < 0 ? 1 : 0;
      tags.GPSSpeed = parseFloat((Math.random() * 1.2).toFixed(4));
      tags.GPSSpeedRef = 'K';
      tags.GPSImgDirection = heading;
      tags.GPSImgDirectionRef = 'T';
      tags.GPSDestBearing = heading;
      tags.GPSDestBearingRef = 'T';
      tags.GPSHPositioningError = parseFloat((3.5 + Math.random() * 11).toFixed(4));
    }

    const extraArgs = ['-XMP-x:XMPToolkit=', '-overwrite_original'];
    if (formatKey === 'jpeg') {
      thumbPath = await makeExifThumbnail(workPath);
      extraArgs.push(`-ThumbnailImage<=${thumbPath}`);
    }
    await exiftool.write(workPath, tags, extraArgs);
    cleanup(thumbPath);

    res.setHeader('Content-Disposition', `attachment; filename="${outputName}"`);
    res.setHeader('Content-Type', fmt.mime);
    // 'close' fires on success and when the phone disconnects, so temp files never pile up
    res.on('close', () => cleanup(inputPath, workPath));
    const stream = fs.createReadStream(workPath);
    stream.on('error', () => res.destroy());
    stream.pipe(res);

  } catch (err) {
    cleanup(inputPath, workPath, thumbPath);
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// =====================================================================
// ---- BATCH MODE ----
// Step 1: /analyze looks at each photo (light + any camera data it already has).
// Step 2: /plan gives every photo a time, file name, GPS spot and exposure.
// Step 3: the page sends each photo to /process with those values.
// =====================================================================

const BUCKETS = ['morning', 'day', 'evening', 'night'];
const HOUR = 3600000;
const DAY = 86400000;

// Brightness / colour of the photo, worked out on a small copy
async function imageStats(file) {
  const small = tmpFile('.png');
  try {
    await execFileAsync('convert', [`${file}[0]`, '-auto-orient', '-resize', '160x160', small]);
    const rgb = (await execFileAsync('convert', [small, '-format', '%[fx:mean.r] %[fx:mean.g] %[fx:mean.b]', 'info:'])).stdout;
    const [r, g, b] = rgb.trim().split(/\s+/).map(Number);
    const above = async pct => parseFloat((await execFileAsync('convert',
      [small, '-colorspace', 'Gray', '-threshold', pct, '-format', '%[fx:mean]', 'info:'])).stdout);
    const darkFrac = 1 - await above('15%');   // share of very dark pixels
    const brightFrac = await above('70%');     // share of bright pixels
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return { luma, warmth: r - b, darkFrac, brightFrac };
  } finally {
    cleanup(small);
  }
}

// Part of the day from how the photo looks
function classifyLight({ luma, warmth, darkFrac, brightFrac }) {
  if (luma < 0.17 || (darkFrac > 0.65 && brightFrac < 0.08)) return 'night';
  if (luma < 0.33 || (warmth > 0.07 && luma < 0.5)) return 'evening';
  return 'day';
}

// Part of the day from a clock hour (for photos that already have a time)
function bucketForHour(h) {
  if (h < 5) return 'night';
  if (h < 11) return 'morning';
  if (h < 17) return 'day';
  if (h < 20) return 'evening';
  return 'night';
}

// exiftool date object -> "YYYY-MM-DD HH:MM:SS"
function exifDateText(d) {
  if (!d || typeof d !== 'object' || !d.year) return null;
  const p = n => String(n || 0).padStart(2, '0');
  return `${d.year}-${p(d.month)}-${p(d.day)} ${p(d.hour)}:${p(d.minute)}:${p(d.second)}`;
}

// Scene brightness (APEX Bv) the photo's own camera recorded, if any
function photoBrightness(info) {
  const bv = Number(info.BrightnessValue);
  if (Number.isFinite(bv)) return bv;
  const iso = Number(info.ISO);
  const f = Number(info.FNumber);
  const t = parseShutter(info.ExposureTime);
  if (iso > 0 && f > 0 && t) return 2 * Math.log2(f) + Math.log2(1 / t) - Math.log2(iso / 3.125);
  return null;
}

app.post('/analyze', upload.single('image'), async (req, res) => {
  const inputPath = req.file?.path;
  if (!inputPath) return res.status(400).json({ error: 'No image uploaded.' });
  try {
    const info = await exiftool.read(inputPath).catch(() => ({}));
    const stats = await imageStats(inputPath);
    const photoTime = exifDateText(info.DateTimeOriginal) || exifDateText(info.CreateDate);
    const photoBv = photoBrightness(info);
    const lightBucket = classifyLight(stats);
    const bucket = photoTime ? bucketForHour(parseInt(photoTime.slice(11, 13), 10)) : lightBucket;
    res.json({
      bucket, lightBucket, photoTime,
      photoBv: photoBv === null ? null : parseFloat(photoBv.toFixed(4)),
      photoModel: info.Model || null,
      luma: parseFloat(stats.luma.toFixed(4)),
      warmth: parseFloat(stats.warmth.toFixed(4)),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not read this photo: ' + err.message });
  } finally {
    cleanup(inputPath);
  }
});

// Sunrise, solar noon and sunset (as clock times at the location) for a day
function sunTimes(lat, lon, dayWall, tz) {
  const rad = Math.PI / 180;
  const jDate = (dayWall + 12 * HOUR) / DAY + 2440587.5;
  const n = Math.round(jDate - 2451545.0);
  const jStar = n - lon / 360;
  const M = ((357.5291 + 0.98560028 * jStar) % 360 + 360) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const L = (M + C + 180 + 102.9372) % 360;
  const jTransit = 2451545.0 + jStar + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * L * rad);
  const sinD = Math.sin(L * rad) * Math.sin(23.4397 * rad);
  const cosD = Math.cos(Math.asin(sinD));
  const cosW = (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * sinD) / (Math.cos(lat * rad) * cosD);
  const toWall = j => {
    const inst = (j - 2440587.5) * DAY;
    return inst + offsetMinutes(tz, inst) * 60000;
  };
  const noon = toWall(jTransit);
  if (cosW <= -1 || cosW >= 1) return { noon, rise: null, set: null }; // sun never sets / rises
  const w = Math.acos(cosW) / rad;
  return { noon, rise: toWall(jTransit - w / 360), set: toWall(jTransit + w / 360) };
}

// Part of the day for a clock time, using that day's real sunrise/sunset
function bucketBySun(wall, sun) {
  if (!sun.rise) return bucketForHour(new Date(wall).getUTCHours());
  if (wall < sun.rise - 0.5 * HOUR) return 'night';
  if (wall < sun.rise + 3 * HOUR) return 'morning';
  if (wall < sun.set - 1.5 * HOUR) return 'day';
  if (wall < sun.set + 0.75 * HOUR) return 'evening';
  return 'night';
}

// Clock-time window for each part of the day, based on the real sun that day
function windowFor(bucket, sun, dayWall) {
  const at = h => dayWall + h * HOUR;
  let w;
  if (!sun.rise) {
    w = { morning: [at(8), at(10.5)], day: [at(11), at(15.5)], evening: [at(17.5), at(19.5)], night: [at(21), at(23.5)] }[bucket];
  } else {
    const { rise, set, noon } = sun;
    if (bucket === 'morning') w = [Math.max(rise + 0.6 * HOUR, at(6)), Math.min(rise + 3 * HOUR, noon - 0.5 * HOUR)];
    else if (bucket === 'day') w = [Math.max(noon - 2.5 * HOUR, rise + 2.5 * HOUR), Math.min(noon + 3.5 * HOUR, set - 2 * HOUR)];
    else if (bucket === 'evening') w = [set - 1.25 * HOUR, set + 0.25 * HOUR];
    else w = [Math.max(set + 1.25 * HOUR, at(19)), at(23.6)];
  }
  let [s, e] = w;
  if (e - s < 20 * 60000) { // window too small (far north, winter) — use 30 min around the middle
    const mid = Math.min((s + e) / 2, at(23.6));
    s = mid - 15 * 60000;
    e = mid + 15 * 60000;
  }
  return [s, e];
}

// Rough scene brightness (Bv) from how bright the photo looks, for its part of the day
function estimateBv(bucket, luma) {
  const lerp = (y, y0, y1, b0, b1) => b0 + Math.min(1, Math.max(0, (y - y0) / (y1 - y0))) * (b1 - b0);
  const jitter = Math.random() * 0.3 - 0.15;
  if (bucket === 'night') return lerp(luma, 0.03, 0.3, -3.8, -0.6) + jitter;
  if (bucket === 'evening') return lerp(luma, 0.1, 0.5, 0.2, 4.2) + jitter;
  if (bucket === 'morning') return lerp(luma, 0.25, 0.65, 4.0, 7.6) + jitter;
  return lerp(luma, 0.25, 0.7, 5.0, 8.8) + jitter;
}

// ISO + shutter the way an iPhone picks them: lowest ISO first, slow the shutter
// down to 1/60, then raise ISO, then 1/30, 1/15 for low light.
// Uses the real formula Av + Tv = Bv + Sv so all the numbers agree with each other.
function exposureFor(bv, fNumber) {
  const av = 2 * Math.log2(fNumber);
  const isoFor = t => 3.125 * Math.pow(2, av + Math.log2(1 / t) - bv);
  const tFor = iso => 1 / Math.pow(2, bv + Math.log2(iso / 3.125) - av);
  let iso = 32;
  let t = tFor(32);
  if (t > 1 / 60) {
    t = 1 / 60; iso = isoFor(t);
    if (iso > 640) {
      t = 1 / 30; iso = isoFor(t);
      if (iso > 1600) {
        t = 1 / 15; iso = isoFor(t);
        if (iso > 2500) { iso = 2500; t = Math.min(tFor(2500), 1 / 3); }
      }
    }
  }
  t = Math.max(t, 1 / 8000);
  // Real iPhone values are never neat (1/121, ISO 37)
  const den = Math.max(2, Math.round((1 / t) * (0.94 + Math.random() * 0.12)));
  iso = Math.max(32, Math.round(iso * (0.95 + Math.random() * 0.1)));
  let bvOut = av + Math.log2(den) - Math.log2(iso / 3.125);
  if (Math.abs(bvOut - Math.round(bvOut)) < 0.005) bvOut += 0.0137;
  return { iso, shutter: `1/${den}`, brightness: bvOut.toFixed(4) };
}

// Random point up to `radius` metres away (spread evenly over the circle)
function nearbyPoint(lat, lon, radius) {
  const r = radius * Math.sqrt(Math.random());
  const a = Math.random() * 2 * Math.PI;
  return [lat + (r * Math.cos(a)) / 111320, lon + (r * Math.sin(a)) / (111320 * Math.cos(lat * Math.PI / 180))];
}

function wallText(ms) {
  const d = new Date(ms);
  const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

function planBatch(b) {
  const profile = IPHONE_PROFILES[b.model];
  if (!profile) throw new Error('Invalid iPhone model.');
  const lat = validCoord(b.lat, 90);
  const lon = validCoord(b.lon, 180);
  if (lat === null || lon === null) throw new Error('Pick a location first (choose a state/city, or type latitude and longitude).');
  const items = Array.isArray(b.items) ? b.items : [];
  if (!items.length) throw new Error('Add some photos first.');
  if (items.length > 100) throw new Error('Up to 100 photos at a time.');

  const tz = zoneFor(lat, lon);
  const nowWall = Date.now() + offsetMinutes(tz, Date.now()) * 60000;
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(b.date || '').trim());
  const chosenDay = dm ? Date.UTC(+dm[1], +dm[2] - 1, +dm[3]) : null;
  const yesterday = Math.floor(nowWall / DAY) * DAY - DAY;
  const useOwn = b.useOwn !== false;

  const out = items.map((it, i) => ({
    i, it,
    bucket: BUCKETS.includes(it.bucket) ? it.bucket : 'day',
    // the photo's own data is used unless you changed its part of the day
    own: useOwn && !it.changed,
  }));

  // 1) Photos with their own time: that time (against the real sun) decides the part of the day.
  //    No date chosen = keep the photo's real date and time exactly.
  //    Date chosen = a new time in the same part of that day (so the light still matches).
  for (const o of out) {
    const own = o.own ? parseWall(o.it.photoTime) : null;
    if (own === null) continue;
    o.bucket = bucketBySun(own, sunTimes(lat, lon, Math.floor(own / DAY) * DAY, tz));
    o.sortKey = own % DAY;
    if (chosenDay === null) {
      o.wall = own;
      o.timeSource = 'photo';
    }
  }

  // 2) The rest get times inside their part of the day, a short while apart, in order
  const day = chosenDay ?? yesterday;
  const sun = sunTimes(lat, lon, day, tz);
  for (const bucket of BUCKETS) {
    const group = out
      .filter(o => o.wall === undefined && o.bucket === bucket)
      .sort((a, c) => (a.sortKey ?? DAY + a.i) - (c.sortKey ?? DAY + c.i));
    if (!group.length) continue;
    const [ws, we] = windowFor(bucket, sun, day);
    const gaps = group.map((_, k) => (k === 0 ? 0 : (40 + Math.random() * 320) * 1000)); // 40 s – 6 min
    const run = gaps.reduce((a, c) => a + c, 0);
    let t = ws + Math.random() * Math.max(0, we - ws - run);
    for (let k = 0; k < group.length; k++) {
      t += gaps[k];
      group[k].wall = Math.round(t / 1000) * 1000;
      group[k].timeSource = 'auto';
    }
  }

  // Checks
  const released = Date.parse(profile.released + 'T00:00:00Z');
  if (out.some(o => o.wall < released)) {
    throw new Error(`The ${profile.model} came out on ${profile.released}. Pick a date after that.`);
  }
  if (out.some(o => o.wall > nowWall - 60000)) {
    throw new Error('Some times would be in the future at that location. Pick an earlier date (or leave it blank for yesterday).');
  }

  // 3) File names in time order: IMG_1234, IMG_1235... (now and then one is skipped, like a deleted photo)
  let num = parseInt(b.startNum, 10);
  if (!(num >= 1 && num <= 9999)) num = 1000 + Math.floor(Math.random() * 7500);
  [...out].sort((a, c) => a.wall - c.wall).forEach(o => {
    o.filename = 'IMG_' + String(num).padStart(4, '0');
    num += Math.random() < 0.15 ? 2 : 1;
    if (num > 9999) num = 1;
  });

  // 4) GPS near the chosen spot + exposure for each photo
  const spread = Math.min(Math.max(parseFloat(b.spread) || 30, 5), 5000);
  const altIn = parseFloat(b.alt);
  const altBase = Number.isFinite(altIn) ? altIn : 10;

  return {
    tz,
    sun: sun.rise ? { sunrise: wallText(sun.rise).slice(11, 16), sunset: wallText(sun.set).slice(11, 16) } : null,
    items: out.map(o => {
      const [pLat, pLon] = nearbyPoint(lat, lon, spread);
      const photoBv = Number(o.it.photoBv);
      const bv = o.own && o.it.photoBv !== null && o.it.photoBv !== undefined && Number.isFinite(photoBv)
        ? photoBv
        : estimateBv(o.bucket, Number(o.it.luma) || 0.4);
      const exp = exposureFor(bv, profile.fNumber);
      return {
        bucket: o.bucket,
        timeSource: o.timeSource,
        exposureSource: bv === photoBv && o.own ? 'photo' : 'auto',
        date: wallText(o.wall),
        filename: o.filename,
        lat: pLat.toFixed(6),
        lon: pLon.toFixed(6),
        alt: (altBase + Math.random() * 4 - 2).toFixed(3),
        iso: exp.iso,
        shutter: exp.shutter,
        brightness: exp.brightness,
      };
    }),
  };
}

app.post('/plan', express.json({ limit: '1mb' }), (req, res) => {
  try {
    res.json(planBatch(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

process.on('SIGTERM', () => {
  exiftool.end().finally(() => process.exit(0));
});
app.listen(PORT, () => console.log(`iPhone Image Tagger running on port ${PORT}`));
