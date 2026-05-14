import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.R2_BUCKET_NAME!

/** Keys ─────────────────────────────────────────────────── */
export const keys = {
  photo:          (sessionId: string, stage: 'pre' | 'during', fileName: string) =>
                    `sessions/${sessionId}/photos/${stage}/${fileName}`,
  recording:      (sessionId: string) => `sessions/${sessionId}/recording.mp4`,
  recordingAdmin: (sessionId: string) => `sessions/${sessionId}/recording_admin.mp4`,
}

/** Presigned upload URL — used client-side for photo uploads */
export async function getUploadUrl(key: string, contentType: string, expiresIn = 300) {
  const cmd = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType })
  return getSignedUrl(r2, cmd, { expiresIn })
}

/** Presigned download URL — sent to customer/expert for recording access */
export async function getDownloadUrl(key: string, expiresIn = 3600) {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key })
  return getSignedUrl(r2, cmd, { expiresIn })
}

/** Delete an object — called by cron for expired free recordings */
export async function deleteObject(key: string) {
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}

/** Stream a recording from Daily.co URL into R2, returns size in bytes */
export async function storeRecordingFromUrl(url: string, key: string): Promise<number> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch recording: ${response.statusText}`)
  const buffer = await response.arrayBuffer()
  await r2.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: Buffer.from(buffer),
    ContentType: 'video/mp4',
  }))
  return buffer.byteLength
}

/** Per-session recording price based on duration */
export function recordingPrice(durationMinutes: number): number {
  const tiers = [
    { max: 15,  price: 1.99 },
    { max: 30,  price: 2.99 },
    { max: 45,  price: 3.99 },
    { max: 60,  price: 4.99 },
    { max: 75,  price: 5.99 },
    { max: 90,  price: 6.99 },
    { max: 105, price: 7.99 },
    { max: Infinity, price: 8.99 },
  ]
  return tiers.find(t => durationMinutes <= t.max)!.price
}

/** Storage limits by subscription tier in bytes */
export const STORAGE_LIMITS = {
  free:      0,              // No persistent storage on free
  basic:     10 * 1024 ** 3, // 10 GB
  pro:       50 * 1024 ** 3, // 50 GB
  unlimited: -1,             // No limit
} as const
