import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Swords, Skull, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChallengeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetName: string;
  onConfirm: (stakeAmount: number, duelType: "normal" | "fatalite") => void;
}

const STAKES = [
  { amount: 50, label: "50 likes", icon: Heart, color: "text-primary" },
  { amount: 100, label: "100 likes", icon: Heart, color: "text-primary" },
  { amount: 500, label: "500 likes", icon: Heart, color: "text-primary" },
];

const ChallengeDialog = ({ open, onOpenChange, targetName, onConfirm }: ChallengeDialogProps) => {
  const [selected, setSelected] = useState<{ amount: number; type: "normal" | "fatalite" } | null>(null);

  const handleConfirm = () => {
    if (!selected) return;
    onConfirm(selected.amount, selected.type);
    setSelected(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-cinzel text-primary flex items-center gap-2">
            <Swords className="w-5 h-5" /> Desafiar {targetName}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Escolha a aposta do duelo. Duração: 7 dias.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground font-medium">Aposta Normal:</p>
          <div className="grid grid-cols-3 gap-2">
            {STAKES.map((s) => (
              <button
                key={s.amount}
                onClick={() => setSelected({ amount: s.amount, type: "normal" })}
                className={cn(
                  "flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-sm font-medium",
                  selected?.amount === s.amount && selected?.type === "normal"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/30 text-foreground hover:border-primary/50"
                )}
              >
                <s.icon className="w-5 h-5" />
                {s.label}
              </button>
            ))}
          </div>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center"><span className="bg-card px-2 text-xs text-muted-foreground">OU</span></div>
          </div>

          <button
            onClick={() => setSelected({ amount: 0, type: "fatalite" })}
            className={cn(
              "w-full flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all font-bold",
              selected?.type === "fatalite"
                ? "border-destructive bg-destructive/10 text-destructive"
                : "border-destructive/30 bg-muted/30 text-destructive/70 hover:border-destructive/60"
            )}
          >
            <Skull className="w-6 h-6" />
            FATALITÉ — Tudo ou Nada
          </button>
          <p className="text-[10px] text-destructive/60 text-center">
            Perdedor vai a 0 likes e é eliminado por 3 dias!
          </p>

          <Button
            onClick={handleConfirm}
            disabled={!selected}
            className="w-full bg-primary text-primary-foreground font-bold"
          >
            <Swords className="w-4 h-4 mr-2" />
            {selected?.type === "fatalite" ? "DESAFIAR FATALITÉ ☠️" : `Desafiar ${selected?.amount || ""} likes ⚔️`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChallengeDialog;
