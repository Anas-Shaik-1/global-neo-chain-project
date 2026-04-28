import { useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useUploadAvatar } from "../api/hooks";

interface Props {
  userId: string;
  currentUrl?: string | null;
  fallback: string;
}

export function AvatarUpload({ userId, currentUrl, fallback }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const upload = useUploadAvatar(userId);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    upload.mutate(file, {
      onError: (err) => setError((err as Error).message ?? "Upload failed"),
    });
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-24 w-24">
        {currentUrl ? <AvatarImage src={currentUrl} alt="avatar" /> : null}
        <AvatarFallback className="text-2xl">{fallback}</AvatarFallback>
      </Avatar>
      <div className="space-y-2">
        <input
          ref={ref}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPick}
          aria-label="Avatar file picker"
        />
        <Button type="button" variant="outline" onClick={() => ref.current?.click()} disabled={upload.isPending}>
          {upload.isPending ? "Uploading…" : "Change photo"}
        </Button>
        {error && <div className="text-sm text-destructive" role="alert">{error}</div>}
      </div>
    </div>
  );
}
