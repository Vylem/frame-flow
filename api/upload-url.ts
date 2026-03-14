import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

const s3 = new S3Client({ region: process.env.AWS_REGION });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const jobId = randomUUID();
    const key = `${jobId}.mp4`;

    const command = new PutObjectCommand({
      Bucket: process.env.INPUT_BUCKET,
      Key: key,
      ContentType: 'video/mp4',
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

    return res.status(200).json({ uploadUrl, jobId, key });
  } catch (err) {
    console.error('upload-url error:', err);
    return res.status(500).json({ error: 'Failed to generate upload URL' });
  }
}
