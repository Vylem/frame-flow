const API_BASE = import.meta.env.VITE_API_BASE || '';
const API_KEY  = import.meta.env.VITE_API_KEY  || '';

function authHeaders(): Record<string, string> {
  return API_KEY ? { 'x-api-key': API_KEY } : {};
}

export async function getUploadUrl(file: File, quality: string): Promise<{ uploadUrl: string; jobId: string; key: string }> {
  const res = await fetch(`${API_BASE}/api/upload-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ contentType: file.type, quality }),
  });
  if (!res.ok) throw new Error('Failed to get upload URL');
  return res.json();
}

export async function getJobStatus(jobId: string): Promise<{
  status: string;
  currentStep: string;
  startedAt?: string;
}> {
  const res = await fetch(`${API_BASE}/api/status/${jobId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to get status');
  return res.json();
}

export async function getDownloadUrl(jobId: string): Promise<{ downloadUrl: string }> {
  const res = await fetch(`${API_BASE}/api/download/${jobId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to get download URL');
  return res.json();
}

export function uploadToS3(
  url: string,
  file: File,
  quality: string,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status < 400 ? resolve() : reject(new Error('Upload failed')));
    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.send(file);
  });
}
