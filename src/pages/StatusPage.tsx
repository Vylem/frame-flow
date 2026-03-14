import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { CheckCircle2, Circle, Loader2, Download, AlertCircle, ArrowLeft } from "lucide-react";
import { getJobStatus, getDownloadUrl } from "@/lib/api";

const STEPS = [
  { name: "Analyzing", desc: "Detecting subjects and motion…" },
  { name: "Planning", desc: "Computing the optimal crop path…" },
  { name: "Rendering", desc: "Encoding 9:16 portrait output…" },
];

type StepStatus = "complete" | "active" | "pending";

const StatusPage = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<{ status: string; currentStep: string; startedAt?: string } | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    const poll = setInterval(async () => {
      try {
        const json = await getJobStatus(jobId);
        setData(json);
        if (json.status === "succeeded" || json.status === "failed") clearInterval(poll);
      } catch {
        // silently retry
      }
    }, 5000);

    // immediate first call
    getJobStatus(jobId).then(setData).catch(() => {});

    return () => clearInterval(poll);
  }, [jobId]);

  const getStepStatus = useCallback((stepName: string): StepStatus => {
    if (!data) return "pending";
    if (data.status === "succeeded") return "complete";
    if (data.status === "failed") return "pending";
    const currentIndex = STEPS.findIndex((s) => s.name === data.currentStep);
    const stepIndex = STEPS.findIndex((s) => s.name === stepName);
    if (stepIndex < currentIndex) return "complete";
    if (stepIndex === currentIndex) return "active";
    return "pending";
  }, [data]);

  const handleDownload = async () => {
    if (!jobId) return;
    setDownloading(true);
    try {
      const { downloadUrl } = await getDownloadUrl(jobId);
      window.location.href = downloadUrl;
    } catch {
      // handle error
    } finally {
      setDownloading(false);
    }
  };

  return (
    <main className="min-h-svh bg-background text-foreground flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-10">
        <header className="text-center space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Reframing</h1>
          <p className="text-sm text-muted-foreground">Your video is being processed</p>
        </header>

        <div className="space-y-0">
          {STEPS.map((step, i) => {
            const status = getStepStatus(step.name);
            return (
              <div key={step.name} className="flex items-start gap-4 relative">
                {i !== STEPS.length - 1 && (
                  <div
                    className={`absolute left-[11px] top-8 w-[2px] h-10 transition-colors duration-200 ${
                      status === "complete" ? "bg-primary/40" : "bg-secondary"
                    }`}
                  />
                )}
                <div className="mt-1 shrink-0">
                  {status === "complete" ? (
                    <CheckCircle2 className="w-6 h-6 text-primary" />
                  ) : status === "active" ? (
                    <Loader2 className="w-6 h-6 text-primary animate-spin animate-pulse-subtle" />
                  ) : (
                    <Circle className="w-6 h-6 text-secondary" />
                  )}
                </div>
                <div className="pb-8">
                  <p className={`font-medium transition-colors duration-200 ${status === "pending" ? "text-muted-foreground/50" : "text-foreground"}`}>
                    {step.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {data?.status === "succeeded" && (
          <div className="space-y-3">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="w-full py-4 bg-foreground text-background rounded-xl font-semibold hover:opacity-90 transition-all duration-200 flex items-center justify-center gap-2 hover:-translate-y-px glow-button"
            >
              <Download className="w-5 h-5" />
              {downloading ? "Preparing…" : "Download Result"}
            </button>
            <button
              onClick={() => navigate("/")}
              className="w-full py-3 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Reframe another video
            </button>
          </div>
        )}

        {data?.status === "failed" && (
          <div className="space-y-4">
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center gap-3 text-destructive-foreground">
              <AlertCircle className="shrink-0 w-5 h-5" />
              <p className="text-sm">Reframing failed. Please try a different video.</p>
            </div>
            <button
              onClick={() => navigate("/")}
              className="w-full py-3 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Try again
            </button>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground font-mono tabular-nums">
          Job ID: {jobId} · Usually takes 2–5× video duration
        </p>
      </div>
    </main>
  );
};

export default StatusPage;
