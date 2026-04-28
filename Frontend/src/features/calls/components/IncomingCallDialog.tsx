import { Phone, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCall } from "../CallProvider";

export function IncomingCallDialog() {
  const { state, peerInfo, accept, reject } = useCall();
  if (state !== "incoming-ringing" || !peerInfo) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-2xl">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <Phone className="h-10 w-10 animate-pulse text-primary" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Incoming call
            </div>
            <div className="font-display text-2xl font-semibold">
              {peerInfo.name}
            </div>
          </div>
          <div className="mt-2 flex w-full gap-3">
            <Button
              type="button"
              variant="destructive"
              className="flex-1 gap-2"
              onClick={reject}
            >
              <PhoneOff className="h-4 w-4" />
              Decline
            </Button>
            <Button
              type="button"
              className="flex-1 gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => {
                void accept();
              }}
            >
              <Phone className="h-4 w-4" />
              Accept
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
