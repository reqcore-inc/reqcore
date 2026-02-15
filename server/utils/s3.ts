import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// ─────────────────────────────────────────────
// S3-compatible client for MinIO document storage
// ─────────────────────────────────────────────

/**
 * S3-compatible client configured for MinIO.
 * Uses `forcePathStyle: true` which is required for MinIO.
 * Credentials come from validated env vars — never hardcoded.
 */
export const s3Client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
  forcePathStyle: true,
})

/** The configured bucket name from env */
export const S3_BUCKET = env.S3_BUCKET

/**
 * Upload a file to S3/MinIO.
 *
 * @param key - Server-generated storage key (e.g. `{orgId}/{candidateId}/{docId}.pdf`)
 * @param body - File content as Buffer or Uint8Array
 * @param contentType - Validated MIME type of the file
 */
export async function uploadToS3(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  )
}

/**
 * Delete a file from S3/MinIO.
 * Silently succeeds if the object doesn't exist (S3 convention).
 *
 * @param key - The storage key of the object to delete
 */
export async function deleteFromS3(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    }),
  )
}

/**
 * Generate a short-lived presigned URL for downloading or previewing a file.
 * The URL is valid for the specified duration and requires no auth to access.
 *
 * @param key - The storage key of the object
 * @param expiresIn - URL validity in seconds (default: 300 = 5 minutes)
 * @param filename - Optional original filename for the Content-Disposition header
 * @param contentType - Optional MIME type to set as Content-Type on the response
 * @param disposition - 'attachment' forces download (default, secure), 'inline' allows browser rendering (use only for trusted types like PDF)
 * @returns A presigned GET URL
 */
export async function getPresignedDownloadUrl(
  key: string,
  expiresIn: number = 300,
  filename?: string,
  contentType?: string,
  disposition: 'attachment' | 'inline' = 'attachment',
): Promise<string> {
  const dispositionValue = filename
    ? `${disposition}; filename="${encodeURIComponent(filename)}"`
    : disposition

  return getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ResponseContentDisposition: dispositionValue,
      ...(contentType && { ResponseContentType: contentType }),
    }),
    { expiresIn },
  )
}

/**
 * Check if the configured bucket exists.
 * @returns true if the bucket exists and is accessible
 */
export async function bucketExists(): Promise<boolean> {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: S3_BUCKET }))
    return true
  } catch {
    return false
  }
}

/**
 * Create the configured bucket if it doesn't exist, then enforce a
 * private-only access policy. Idempotent — safe to call repeatedly.
 *
 * Security: Explicitly denies all anonymous access even if someone
 * manually changes the policy via the MinIO console.
 */
export async function ensureBucketExists(): Promise<void> {
  if (!(await bucketExists())) {
    await s3Client.send(new CreateBucketCommand({ Bucket: S3_BUCKET }))
  }

  // Always enforce private policy (idempotent)
  await enforcePrivateBucketPolicy()
}

/**
 * Set an explicit deny-all-anonymous-access policy on the bucket.
 * Prevents accidental data exposure if the bucket policy is modified
 * via the MinIO console or other tools.
 */
async function enforcePrivateBucketPolicy(): Promise<void> {
  const policy = JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'DenyAnonymousAccess',
        Effect: 'Deny',
        Principal: '*',
        Action: ['s3:GetObject', 's3:ListBucket', 's3:PutObject', 's3:DeleteObject'],
        Resource: [
          `arn:aws:s3:::${S3_BUCKET}`,
          `arn:aws:s3:::${S3_BUCKET}/*`,
        ],
        Condition: {
          StringEquals: {
            'aws:PrincipalType': 'Anonymous',
          },
        },
      },
    ],
  })

  await s3Client.send(
    new PutBucketPolicyCommand({ Bucket: S3_BUCKET, Policy: policy }),
  )
}
