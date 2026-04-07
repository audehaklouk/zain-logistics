/**
 * S3 file storage service.
 * When AWS credentials are configured (AWS_ACCESS_KEY_ID + S3_BUCKET), all uploads
 * go to S3 and downloads return pre-signed URLs.
 * When not configured, falls back to local disk so dev/demo mode still works.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ─────────────────────────────────────────────────────────────
const S3_BUCKET  = process.env.S3_BUCKET;
const AWS_REGION = process.env.AWS_REGION || 'eu-central-1';

export function isS3Configured() {
  return !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && S3_BUCKET);
}

let _s3;
function getS3() {
  if (!_s3) {
    _s3 = new S3Client({
      region: AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return _s3;
}

// ── Local disk fallback ────────────────────────────────────────────────
const isVercel    = !!process.env.VERCEL;
const LOCAL_DIR   = isVercel
  ? '/tmp/uploads'
  : path.join(__dirname, '..', '..', 'uploads');

if (!fs.existsSync(LOCAL_DIR)) fs.mkdirSync(LOCAL_DIR, { recursive: true });

// ── Upload ─────────────────────────────────────────────────────────────
/**
 * Upload a file buffer.
 * @param {Buffer} buffer
 * @param {string} key   — S3 key / local filename (e.g. "documents/1/1234567890.pdf")
 * @param {string} mimeType
 * @returns {Promise<string>} the stored key (same value, used for later lookup)
 */
export async function uploadFile(buffer, key, mimeType) {
  if (isS3Configured()) {
    await getS3().send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }));
    return key;
  }

  // Local disk fallback — flatten slashes to underscores for the filename
  const localName = key.replace(/\//g, '_');
  fs.writeFileSync(path.join(LOCAL_DIR, localName), buffer);
  return localName;
}

// ── Pre-signed download URL (S3) or local path signal ─────────────────
/**
 * Returns a URL string for S3 or a special "local:{filename}" string for disk.
 * Routes interpret "local:{filename}" to call res.download().
 */
export async function getDownloadUrl(storedKey, originalName, expiresInSeconds = 300) {
  if (isS3Configured()) {
    const url = await getSignedUrl(
      getS3(),
      new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: storedKey,
        ResponseContentDisposition: `attachment; filename="${encodeURIComponent(originalName)}"`,
      }),
      { expiresIn: expiresInSeconds }
    );
    return { type: 's3', url };
  }

  return { type: 'local', path: path.join(LOCAL_DIR, storedKey), name: originalName };
}

// ── Delete ─────────────────────────────────────────────────────────────
export async function deleteFile(storedKey) {
  if (isS3Configured()) {
    try {
      await getS3().send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: storedKey }));
    } catch (err) {
      console.error('[s3] delete error:', err.message);
    }
    return;
  }

  const localPath = path.join(LOCAL_DIR, storedKey);
  if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
}

// ── Build S3 key ───────────────────────────────────────────────────────
export function buildKey(folder, subId, filename) {
  const ext  = path.extname(filename);
  const base = path.basename(filename, ext).replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${folder}/${subId}/${Date.now()}_${base}${ext}`;
}
