import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const MAX_PDF_SIZE = 20 * 1024 * 1024; // 20MB

const EbookUploadForm = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== "application/pdf") {
      toast.error("Apenas arquivos PDF são permitidos!");
      return;
    }
    if (f.size > MAX_PDF_SIZE) {
      toast.error("PDF muito grande! Máximo: 20MB");
      return;
    }
    setFile(f);
  };

  const handleSubmit = async () => {
    if (!file || !titulo.trim()) {
      toast.error("Preencha o título e selecione um PDF!");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("ebooks")
        .upload(path, file, { upsert: false });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("ebooks").getPublicUrl(path);

      const { error: insertErr } = await supabase.from("ebooks").insert({
        titulo: titulo.trim(),
        pdf_url: urlData.publicUrl,
        user_id: user.id,
      });
      if (insertErr) throw insertErr;

      toast.success("📚 Ebook publicado com sucesso!");
      setTitulo("");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["ebooks"] });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao publicar ebook");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Publicar Ebook (PDF)</h3>
      </div>

      <Input
        placeholder="Título do ebook..."
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        maxLength={100}
      />

      {file ? (
        <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
          <FileText className="w-4 h-4 text-primary" />
          <span className="text-xs text-foreground truncate flex-1">{file.name}</span>
          <button onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = ""; }}>
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      ) : (
        <Button
          variant="outline"
          className="w-full border-dashed border-primary/30 text-primary"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="w-4 h-4 mr-2" />
          Selecionar PDF
        </Button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      <Button
        onClick={handleSubmit}
        disabled={uploading || !file || !titulo.trim()}
        className="w-full"
      >
        {uploading ? "Enviando..." : "📚 Publicar Ebook"}
      </Button>
    </div>
  );
};

export default EbookUploadForm;
