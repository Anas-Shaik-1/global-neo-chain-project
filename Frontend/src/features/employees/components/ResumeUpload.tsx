import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useUploadResume } from "../api/hooks";

interface Props {
  userId: string;
  currentUrl?: string | null;
}

export function ResumeUpload({ userId, currentUrl }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const upload = useUploadResume(userId);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    upload.mutate(file, {
      onError: (err) => setError((err as Error).message ?? "Upload failed"),
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <input
          ref={ref}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={onPick}
          aria-label="Resume PDF picker"
        />
        <Button type="button" variant="outline" onClick={() => ref.current?.click()} disabled={upload.isPending}>
          {upload.isPending ? "Uploading…" : currentUrl ? "Replace resume" : "Upload resume"}
        </Button>
        {currentUrl && (
          <a href={currentUrl} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
            View current PDF
          </a>
        )}
      </div>
      {error && <div className="text-sm text-destructive" role="alert">{error}</div>}
    </div>
  );
}
