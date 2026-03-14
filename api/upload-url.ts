import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { checkAuth } from './_lib/auth';

const s3 = new S3Client({ region: process.env.AWS_REGION });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!checkAuth(req, res)) return;

  try {
    const { contentType, quality } = (req.body ?? {}) as { contentType?: string; quality?: string };
    const isQuicktime = contentType === 'video/quicktime';
    const mimeType = isQuicktime ? 'video/quicktime' : 'video/mp4';
    const ext = isQuicktime ? 'mov' : 'mp4';
    const resolvedQuality = ['low', 'medium', 'high'].includes(quality ?? '') ? quality! : 'medium';

    const jobId = randomUUID();
    const key = `${resolvedQuality}/${jobId}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: process.env.INPUT_BUCKET,
      Key: key,
      ContentType: mimeType,
    });

    // 5-minute expiry — short window limits upload-URL abuse
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

    return res.status(200).json({ uploadUrl, jobId, key });
  } catch (err) {
    console.error('upload-url error:', err);
    return res.status(500).json({ error: 'Failed to generate upload URL' });
  }
}
