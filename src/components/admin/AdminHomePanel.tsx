import { useState, useRef, useEffect } from "react";
import { useHomeConfig, SecondaryPrize, Sponsor } from "@/hooks/useHomeConfig";
import RichTextEditor from "@/components/feed/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Upload, Trash2, Save, Loader2, LogOut, Settings, ChevronDown, ChevronUp, FileVideo, FileImage, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useSosPendingCount } from "@/hooks/useSos";
import { useNavigate } from "react-router-dom";

const AdminHomePanel = () => {
  const { config, updateConfig, uploadHomeMedia } = useHomeConfig();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { data: sosPending = 0 } = useSosPendingCount();
  const [expanded, setExpanded] = useState(false);
  const [prizeValue, setPrizeValue] = useState("");
  const [prizeEnabled, setPrizeEnabled] = useState(true);
  const [promoText, setPromoText] = useState("");
  const [promoText2, setPromoText2] = useState("");
  const [uploadingVideo, setUploadingVideo] = useState<string | null>(null);
  const [uploadingPrize, setUploadingPrize] = useState(false);
  const [uploadingSponsor, setUploadingSponsor] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Record<string, string>>({});

  const loopRef = useRef<HTMLInputElement>(null);
  const rulesRef = useRef<HTMLInputElement>(null);
  const prizeVideoRef = useRef<HTMLInputElement>(null);
  const secondaryRef = useRef<HTMLInputElement>(null);
  const sponsorRef = useRef<HTMLInputElement>(null);

  // FIX: useEffect instead of useState to sync config
  useEffect(() => {
    if (config) {
      setPrizeValue(config.prize_value);
      setPrizeEnabled(config.prize_enabled);
      setPromoText(config.promo_text);
      setPromoText2(config.promo_text_2);
    }
  }, [config]);

  const getRef = (type: string) => {
    if (type === "loop") return loopRef;
    if (type === "rules") return rulesRef;
    return prizeVideoRef;
  };

  const handleVideoUpload = async (file: File, type: "loop" | "rules" | "prize") => {
    if (file.size > 100 * 1024 * 1024) { toast.error("Vídeo muito grande! Máximo: 100MB"); return; }
    setSelectedFiles(prev => ({ ...prev, [type]: file.name }));
    setUploadingVideo(type);
    toast.info(`Enviando ${file.name}...`);
    try {
      const url = await uploadHomeMedia(file, "videos");
      if (url) {
        const key = type === "loop" ? "video_loop_url" : type === "rules" ? "video_rules_url" : "video_prize_url";
        await updateConfig.mutateAsync({ [key]: url });
        toast.success(`✅ Vídeo ${type} enviado com sucesso!`);
        setSelectedFiles(prev => { const n = { ...prev }; delete n[type]; return n; });
      } else {
        toast.error(`❌ Falha ao enviar vídeo ${type}`);
      }
    } catch (err) {
      console.error("Upload error:", err);
      toast.error(`❌ Erro no upload: ${err instanceof Error ? err.message : "desconhecido"}`);
    }
    setUploadingVideo(null);
  };

  const handleSecondaryPrizeUpload = async (files: FileList) => {
    setUploadingPrize(true);
    toast.info(`Enviando ${files.length} arquivo(s)...`);
    try {
      const currentPrizes: SecondaryPrize[] = config?.secondary_prizes || [];
      const newPrizes = [...currentPrizes];
      for (const file of Array.from(files)) {
        const isVideo = file.type.startsWith("video/");
        const isImage = file.type.startsWith("image/");
        if (!isVideo && !isImage) continue;
        const url = await uploadHomeMedia(file, "prizes");
        if (url) newPrizes.push({ id: crypto.randomUUID(), url, type: isVideo ? "video" : "image" });
      }
      await updateConfig.mutateAsync({ secondary_prizes: newPrizes as unknown as SecondaryPrize[] });
      toast.success("✅ Prêmios secundários atualizados!");
    } catch (err) {
      toast.error("❌ Erro ao enviar prêmios");
    }
    setUploadingPrize(false);
  };

  const handleSponsorUpload = async (files: FileList) => {
    setUploadingSponsor(true);
    toast.info(`Enviando ${files.length} logo(s)...`);
    try {
      const currentSponsors: Sponsor[] = config?.sponsors || [];
      const newSponsors = [...currentSponsors];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const url = await uploadHomeMedia(file, "sponsors");
        if (url) newSponsors.push({ id: crypto.randomUUID(), url });
      }
      await updateConfig.mutateAsync({ sponsors: newSponsors as unknown as Sponsor[] });
      toast.success("✅ Patrocinadores atualizados!");
    } catch (err) {
      toast.error("❌ Erro ao enviar patrocinadores");
    }
    setUploadingSponsor(false);
  };

  const removePrize = async (id: string) => {
    const updated = (config?.secondary_prizes || []).filter((p) => p.id !== id);
    await updateConfig.mutateAsync({ secondary_prizes: updated as unknown as SecondaryPrize[] });
  };

  const removeSponsor = async (id: string) => {
    const updated = (config?.sponsors || []).filter((s) => s.id !== id);
    await updateConfig.mutateAsync({ sponsors: updated as unknown as Sponsor[] });
  };

  const savePrizeAndPromo = async () => {
    await updateConfig.mutateAsync({ prize_value: prizeValue, prize_enabled: prizeEnabled, promo_text: promoText, promo_text_2: promoText2 });
  };

  const handleExitAdmin = async () => {
    await signOut();
  };

  if (!config) return null;

  return (
    <Card className="border-primary/50 bg-card/80 backdrop-blur-sm">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          <span className="font-cinzel text-primary font-bold">Painel Admin</span>
        </div>
        {expanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-6">

          {/* SOS Badge */}
          {sosPending > 0 && (
            <Button variant="destructive" onClick={() => navigate('/sos-ajuda')} className="w-full animate-pulse">
              🚨 {sosPending} SOS pendente{sosPending > 1 ? 's' : ''}
            </Button>
          )}

          {/* Exit Admin Button */}
          <Button variant="destructive" onClick={handleExitAdmin} className="w-full">
            <LogOut className="h-4 w-4 mr-2" /> Sair do Admin
          </Button>

          {/* Videos - 3 distinct with separate refs */}
          <section className="space-y-3">
            <h3 className="font-montserrat text-sm font-semibold text-foreground">📹 Vídeos da Home</h3>
            <div className="grid grid-cols-1 gap-3">
              {(["loop", "rules", "prize"] as const).map((type) => {
                const url = type === "loop" ? config.video_loop_url : type === "rules" ? config.video_rules_url : config.video_prize_url;
                const label = type === "loop" ? "🔄 Loop Auto (Topo)" : type === "rules" ? "📜 Regras" : "🏆 Prêmio";
                const ref = getRef(type);
                const selectedFile = selectedFiles[type];
                return (
                  <div key={type} className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border">
                    <p className="text-xs font-medium text-foreground">{label}</p>
                    {url && <video src={url} controls className="w-full rounded-lg aspect-video object-cover" />}
                    
                    {/* Selected file indicator */}
                    {selectedFile && (
                      <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 rounded-md px-2 py-1">
                        <FileVideo className="h-3 w-3" />
                        <span className="truncate">{selectedFile}</span>
                        {uploadingVideo === type && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
                      </div>
                    )}

                    <input 
                      ref={ref} 
                      type="file" 
                      accept="video/*" 
                      className="hidden" 
                      onChange={(e) => { 
                        const f = e.target.files?.[0]; 
                        if (f) handleVideoUpload(f, type);
                        // Reset input so same file can be selected again
                        if (e.target) e.target.value = "";
                      }} 
                    />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" disabled={uploadingVideo === type} onClick={() => ref.current?.click()}>
                        {uploadingVideo === type ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                        {url ? "Substituir" : "Enviar"}
                      </Button>
                      {url && (
                        <Button variant="destructive" size="sm" onClick={async () => {
                          const key = type === "loop" ? "video_loop_url" : type === "rules" ? "video_rules_url" : "video_prize_url";
                          await updateConfig.mutateAsync({ [key]: null });
                          toast.success("Vídeo removido!");
                        }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Prize */}
          <section className="space-y-3">
            <h3 className="font-montserrat text-sm font-semibold text-foreground">🏆 Prêmio Principal</h3>
            <div className="flex items-center gap-3">
              <Input value={prizeValue} onChange={(e) => setPrizeValue(e.target.value)} className="flex-1" placeholder="R$50.000" />
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Ativo</span>
                <Switch checked={prizeEnabled} onCheckedChange={setPrizeEnabled} />
              </div>
            </div>
          </section>

          {/* Sponsors */}
          <section className="space-y-3">
            <h3 className="font-montserrat text-sm font-semibold text-foreground">🤝 Patrocinadores</h3>
            {config.sponsors.length > 0 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {config.sponsors.map((sponsor) => (
                  <div key={sponsor.id} className="relative flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-border group">
                    <img src={sponsor.url} alt="Patrocinador" className="w-full h-full object-contain bg-muted" />
                    <button onClick={() => removeSponsor(sponsor.id)} className="absolute top-1 right-1 bg-destructive/80 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="h-3 w-3 text-destructive-foreground" /></button>
                  </div>
                ))}
              </div>
            )}
            <input ref={sponsorRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { 
              if (e.target.files?.length) handleSponsorUpload(e.target.files);
              if (e.target) e.target.value = "";
            }} />
            <Button variant="outline" size="sm" disabled={uploadingSponsor} onClick={() => sponsorRef.current?.click()}>
              {uploadingSponsor ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              Adicionar Patrocinadores
            </Button>
          </section>

          {/* Secondary Prizes */}
          <section className="space-y-3">
            <h3 className="font-montserrat text-sm font-semibold text-foreground">🎁 Prêmios Secundários</h3>
            {config.secondary_prizes.length > 0 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {config.secondary_prizes.map((prize) => (
                  <div key={prize.id} className="relative flex-shrink-0 w-32 h-32 rounded-lg overflow-hidden border border-border group">
                    {prize.type === "video" ? <video src={prize.url} className="w-full h-full object-cover" muted /> : <img src={prize.url} alt="Prêmio" className="w-full h-full object-cover" />}
                    <button onClick={() => removePrize(prize.id)} className="absolute top-1 right-1 bg-destructive/80 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="h-3 w-3 text-destructive-foreground" /></button>
                  </div>
                ))}
              </div>
            )}
            <input ref={secondaryRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => { 
              if (e.target.files?.length) handleSecondaryPrizeUpload(e.target.files);
              if (e.target) e.target.value = "";
            }} />
            <Button variant="outline" size="sm" disabled={uploadingPrize} onClick={() => secondaryRef.current?.click()}>
              {uploadingPrize ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              Adicionar Fotos/Vídeos
            </Button>
          </section>

          {/* Promo Text 1 */}
          <section className="space-y-3">
            <h3 className="font-montserrat text-sm font-semibold text-foreground">✏️ Texto 1 (após Top 10 / prêmios)</h3>
            <RichTextEditor content={promoText} onChange={setPromoText} />
          </section>

          {/* Promo Text 2 */}
          <section className="space-y-3">
            <h3 className="font-montserrat text-sm font-semibold text-foreground">✏️ Texto 2 (final da página)</h3>
            <RichTextEditor content={promoText2} onChange={setPromoText2} />
          </section>

          {/* Save */}
          <Button onClick={savePrizeAndPromo} disabled={updateConfig.isPending} className="w-full">
            {updateConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Configurações
          </Button>
        </div>
      )}
    </Card>
  );
};

export default AdminHomePanel;
