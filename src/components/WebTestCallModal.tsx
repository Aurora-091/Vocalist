import { useEffect } from "react";
import { Phone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WebTestPanel } from "@/components/WebTestPanel";

type WebTestCallModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  agentName: string;
  onGoFix?: (notes: string) => void;
};

export function WebTestCallModal({
  open,
  onOpenChange,
  agentId,
  agentName,
  onGoFix,
}: WebTestCallModalProps) {
  // Reset panel state on close is handled inside WebTestPanel via key prop
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Test conversation
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Talk to <span className="font-medium text-foreground">{agentName}</span> in your browser
          </p>
        </DialogHeader>
        <WebTestPanel
          key={open ? "open" : "closed"}
          agentId={agentId}
          agentName={agentName}
          onGoFix={onGoFix ? (notes) => { onOpenChange(false); onGoFix(notes); } : undefined}
        />
      </DialogContent>
    </Dialog>
  );
}
