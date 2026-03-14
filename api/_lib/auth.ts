import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Check x-api-key header against API_KEY env var.
 * Returns true if auth passes (or if API_KEY is not configured).
 * Returns false and writes a 401 response if auth fails.
 */
export function checkAuth(req: VercelRequest, res: VercelResponse): boolean {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return true; // not configured — allow through

  if (req.headers['x-api-key'] !== apiKey) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}
