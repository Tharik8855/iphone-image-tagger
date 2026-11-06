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

// Real file type of the upload (ignores the filename), e.g. 'PNG', 'JPEG', 'HEIC'
async function detectType(file) {
  const t = await exiftool.read(file, ['-FileType']);
  return String(t.FileType || '').toUpperCase();
}

const TYPE_FOR_FORMAT = { heic: 'HEIC', jpeg: 'JPEG', png: 'PNG', webp: 'WEBP', tiff: 'TIFF' };

// Convert the upload into the requested format (skipped if it already matches).
async function convertImage(src, dest, format) {
  const actual = await detectType(src);
  if (actual === TYPE_FOR_FORMAT[format] || (format === 'heic' && actual === 'HEIF')) {
    fs.copyFileSync(src, dest);
    return;
  }
  // [0] = first frame only; -auto-orient bakes rotation in before EXIF is wiped
  await execFileAsync('convert', [`${src}[0]`, '-auto-orient', '-quality', '95', dest]);
}

function cleanup(...files) {
  for (const f of files) {
    try { if (f && fs.existsSync(f)) fs.unlinkSync(f); } catch {}
  }
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
    // Convert to the chosen format first (no-op if the upload already matches)
    const formatKey = EXT_MAP[format] ? format : 'jpeg';
    await convertImage(inputPath, workPath, formatKey);

    // Step 1: Strip ALL existing metadata (simple -all= only, no tagsfromfile)
    await exiftool.write(workPath, {}, ['-all=', '-overwrite_original']);

    // Step 2: Build date string in EXIF format YYYY:MM:DD HH:MM:SS
    const exifDate = (() => {
      const d = date ? new Date(date.replace(' ', 'T')) : new Date();
      const pad = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}:${pad(d.getMonth()+1)}:${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    })();

    // Step 3: Write fresh iPhone EXIF tags
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
      HostComputer: profile.model,
      FNumber: 1.78,
      ExposureProgram: 'Program AE',
      ISO: 50,
      ExifVersion: '0232',
      ShutterSpeedValue: '1/120',
      ApertureValue: 1.78,
      BrightnessValue: 7,
      ExposureBiasValue: 0,
      MeteringMode: 'Multi-segment',
      Flash: 'Off, Did not fire',
      FocalLength: '6.8 mm',
      ColorSpace: 1,
      FocalLengthIn35mmFormat: '26 mm',
      SceneCaptureType: 'Standard',
      WhiteBalance: 'Auto',
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
    }

    await exiftool.write(workPath, tags, ['-overwrite_original']);

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
