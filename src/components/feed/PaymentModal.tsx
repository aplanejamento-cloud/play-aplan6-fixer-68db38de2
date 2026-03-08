import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Crown, Loader2, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PaymentModal = ({ open, onOpenChange }: PaymentModalProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState<{ qr_code: string; qr_code_base64: string; compra_id: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [polling, setPolling] = useState(false);

  const handleGerarPix = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-pix-payment", {
        body: { tipo: "premium", valor: 100, likes: 1000, usuario_id: user.id },
      });
      if (error) throw error;
      setPixData(data);
      startPolling(data.compra_id);
    } catch (e: any) {
      toast.error("Erro ao gerar PIX: " + (e.message || "tente novamente"));
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (compraId: string) => {
    setPolling(true);
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("compras_pix")
        .select("status")
        .eq("id", compraId)
        .single();
      if (data?.status === "aprovado") {
        clearInterval(interval);
        setPolling(false);
        toast.success("✅ PIX detectado! +1000 likes + Cadastro ativo!");
        setPixData(null);
        onOpenChange(false);
      }
    }, 5000);
    // Stop polling after 10 minutes
    setTimeout(() => {
      clearInterval(interval);
      setPolling(false);
    }, 600000);
  };

  const handleCopy = () => {
    if (pixData?.qr_code) {
      navigator.clipboard.writeText(pixData.qr_code);
      setCopied(true);
      toast.success("PIX copiado!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setPixData(null);
      setPolling(false);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-cinzel text-xl text-center text-foreground flex items-center justify-center gap-2">
            <Crown className="w-6 h-6 text-primary" />
            Atualizar Cadastro
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground pt-3">
            Ative seu cadastro de finalista via PIX automático. Receba +1000 likes!
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 mt-4">
          <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 text-center">
            <p className="font-cinzel text-3xl font-bold text-primary">R$ 100</p>
            <p className="text-xs text-muted-foreground mt-1">Taxa de inscrição para finalistas</p>
          </div>

          {!pixData ? (
            <Button
              onClick={handleGerarPix}
              disabled={loading}
              className="w-full bg-primary text-primary-foreground font-cinzel text-lg"
            >
              {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Crown className="w-5 h-5 mr-2" />}
              {loading ? "Gerando PIX..." : "GERAR QR CODE PIX"}
            </Button>
          ) : (
            <div className="w-full space-y-3">
              {pixData.qr_code_base64 && (
                <div className="flex justify-center">
                  <img
                    src={`data:image/png;base64,${pixData.qr_code_base64}`}
                    alt="QR Code PIX"
                    className="w-48 h-48 rounded-lg border border-border"
                  />
                </div>
              )}

              <Button onClick={handleCopy} variant="outline" className="w-full text-sm">
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? "Copiado!" : "Copiar código PIX"}
              </Button>

              {polling && (
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Detectando pagamento...
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => handleClose(false)}
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
