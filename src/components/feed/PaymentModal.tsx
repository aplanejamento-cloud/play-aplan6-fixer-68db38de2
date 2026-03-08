import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Crown, UserPen } from "lucide-react";

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PaymentModal = ({ open, onOpenChange }: PaymentModalProps) => {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-cinzel text-xl text-center text-foreground flex items-center justify-center gap-2">
            <Crown className="w-6 h-6 text-primary" />
            Complete seu perfil
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground pt-3">
            Complete seus dados para concorrer aos prêmios maiores destinados aos finalistas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 mt-4">
          <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 text-center">
            <p className="font-cinzel text-3xl font-bold text-primary">R$ 100</p>
            <p className="text-xs text-muted-foreground mt-1">Taxa de inscrição para finalistas</p>
          </div>

          <Button
            onClick={() => {
              onOpenChange(false);
              navigate("/profile/" + "edit");
            }}
            className="w-full bg-primary text-primary-foreground font-cinzel text-lg"
          >
            <UserPen className="w-5 h-5 mr-2" />
            EDITAR MEU PERFIL
          </Button>

          <button
            onClick={() => onOpenChange(false)}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            Agora não
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentModal;
