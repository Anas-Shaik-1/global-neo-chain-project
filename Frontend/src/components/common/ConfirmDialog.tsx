import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Visual treatment of the confirm button. Use "destructive" for irreversible actions. */
  tone?: "default" | "destructive";
  onConfirm: () => void | Promise<void>;
  /** Disable the confirm button (e.g. while a mutation is pending). */
  isPending?: boolean;
}

/**
 * Thin wrapper around shadcn's AlertDialog that gives the codebase one
 * consistent shape for "are you sure?" prompts. Use it for irreversible or
 * audit-relevant actions: payslip generation, admin attendance edit, etc.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
  isPending = false,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription asChild>
              <div className="text-sm leading-relaxed text-muted-foreground">
                {description}
              </div>
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(e) => {
              // Prevent the dialog from auto-closing before the async confirm
              // resolves; the caller decides when to call onOpenChange(false).
              e.preventDefault();
              void onConfirm();
            }}
            className={cn(
              tone === "destructive" &&
                "bg-destructive text-destructive-foreground hover:bg-destructive/90",
            )}
          >
            {isPending ? "Working…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
