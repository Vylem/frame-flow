import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({ region: process.env.AWS_REGION });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.API_KEY;
  if (apiKey && req.headers['x-api-key'] !== apiKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { jobId } = req.query;
  if (!jobId || typeof jobId !== 'string') return res.status(400).json({ error: 'Missing jobId' });

  try {
    const command = new GetObjectCommand({
      Bucket: process.env.OUTPUT_BUCKET,
      Key: `reframed/${jobId}.mp4`,
      ResponseContentDisposition: `attachment; filename="reframed-${jobId}.mp4"`,
    });

    const downloadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

    return res.status(200).json({ downloadUrl });
  } catch (err) {
    console.error('download error:', err);
    return res.status(500).json({ error: 'Failed to generate download URL' });
  }
}
