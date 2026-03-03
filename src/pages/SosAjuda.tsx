import { useState } from "react";
import { useSosRequests, useReplySos, useCreateSos } from "@/hooks/useSos";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAuth } from "@/contexts/AuthContext";
import AppHeader from "@/components/AppHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { LifeBuoy, Send, CheckCircle, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";

const SosAjuda = () => {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { data: requests = [], isLoading } = useSosRequests();
  const createSos = useCreateSos();
  const replySos = useReplySos();

  const [message, setMessage] = useState("");
  const [replyMap, setReplyMap] = useState<Record<string, string>>({});

  const handleSend = async () => {
    if (!message.trim()) return;
    await createSos.mutateAsync({ message: message.trim() });
    setMessage("");
  };

  const handleReply = async (id: string) => {
    const reply = replyMap[id]?.trim();
    if (!reply) return;
    await replySos.mutateAsync({ id, reply });
    setReplyMap((prev) => ({ ...prev, [id]: "" }));
  };

  const myRequests = requests.filter((r) => r.user_id === user?.id);
  const displayRequests = isAdmin ? requests : myRequests;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="font-cinzel text-2xl text-primary flex items-center justify-center gap-2">
            <LifeBuoy className="w-7 h-7" /> SOS Ajuda
          </h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Gerencie pedidos de ajuda dos jogadores" : "Envie um pedido de ajuda ao admin"}
          </p>
        </div>

        {/* Form for non-admin users */}
        {!isAdmin && (
          <Card className="bg-card border-border">
            <CardContent className="p-4 space-y-3">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Descreva seu problema..."
                className="min-h-[80px] bg-input border-border"
                maxLength={1000}
              />
              <Button
                onClick={handleSend}
                disabled={!message.trim() || createSos.isPending}
                className="w-full"
              >
                {createSos.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                Enviar SOS
              </Button>
            </CardContent>
          </Card>
        )}

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : displayRequests.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <LifeBuoy className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>Nenhum pedido de ajuda.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayRequests.map((r) => (
              <Card key={r.id} className="bg-card border-border">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8 border border-accent">
                      <AvatarImage src={r.profile?.avatar_url || ""} />
                      <AvatarFallback className="bg-secondary text-xs">
                        {r.profile?.name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{r.profile?.name || "Usuário"}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    {r.status === "respondido" ? (
                      <span className="flex items-center gap-1 text-xs text-green-500">
                        <CheckCircle className="w-3 h-3" /> Respondido
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-yellow-500">
                        <Clock className="w-3 h-3" /> Pendente
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-foreground">{r.message}</p>

                  {r.media_urls.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto">
                      {r.media_urls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                          className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-border">
                          <img src={url} alt="" className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}

                  {r.admin_reply && (
                    <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                      <p className="text-xs font-medium text-primary mb-1">Resposta do Admin:</p>
                      <p className="text-sm text-foreground">{r.admin_reply}</p>
                    </div>
                  )}

                  {isAdmin && r.status === "pendente" && (
                    <div className="flex gap-2">
                      <Textarea
                        value={replyMap[r.id] || ""}
                        onChange={(e) => setReplyMap((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        placeholder="Responder..."
                        className="min-h-[40px] text-sm bg-input border-border"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleReply(r.id)}
                        disabled={!replyMap[r.id]?.trim() || replySos.isPending}
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default SosAjuda;
