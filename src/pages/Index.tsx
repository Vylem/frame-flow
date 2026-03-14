import { useState, useCallback, useRef } from "react";
import { Upload, FileVideo, ArrowRight, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { getUploadUrl, uploadToS3 } from "@/lib/api";

const MAX_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

const Index = () => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleFile = useCallback((f: File | null) => {
    setError(null);
    if (!f) return;
    if (f.type !== "video/mp4") {
      setError("Only MP4 files are supported");
      return;
    }
    if (f.size > MAX_SIZE) {
      setError("File must be under 2GB");
      return;
    }
    setFile(f);
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { uploadUrl, jobId } = await getUploadUrl();
      await uploadToS3(uploadUrl, file, setProgress);
      navigate(`/status/${jobId}`);
    } catch {
      setError("Upload failed. Please try again.");
      setUploading(false);
      setProgress(0);
    }
  };

  const clearFile = () => {
    setFile(null);
    setProgress(0);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <main className="min-h-svh bg-background text-foreground flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xl space-y-8">
        <header className="space-y-2 text-center">
          <h1 className="text-4xl font-semibold tracking-tight">Reframer</h1>
          <p className="text-muted-foreground">Reframe your videos for vertical screens</p>
        </header>

        <div className="bg-card rounded-2xl p-4 card-shadow">
          {!file ? (
            <label
              className={`group relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
                isDragging
                  ? "border-primary/60 bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-primary/5"
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFile(e.dataTransfer.files?.[0] || null);
              }}
            >
              <Upload className="w-10 h-10 mb-4 text-muted-foreground group-hover:text-primary transition-colors duration-200" />
              <p className="text-sm font-medium">Click or drag video to upload</p>
              <p className="text-xs text-muted-foreground mt-2">Max 2GB · MP4 only</p>
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                accept="video/mp4"
                onChange={(e) => handleFile(e.target.files?.[0] || null)}
              />
            </label>
          ) : (
            <div className="space-y-6 p-4">
              <div className="flex items-center gap-4 p-4 bg-surface-elevated rounded-lg">
                <FileVideo className="text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground font-mono tabular-nums">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                {!uploading && (
                  <button onClick={clearFile} className="text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {uploading ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono tabular-nums">
                    <span className="text-muted-foreground">Uploading…</span>
                    <span className="text-foreground">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-1 bg-secondary" />
                </div>
              ) : (
                <button
                  onClick={handleUpload}
                  className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 glow-button hover:-translate-y-px"
                >
                  Start reframing <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive-foreground text-center mt-4 px-4">{error}</p>
          )}
        </div>
      </div>
    </main>
  );
};

export default Index;
