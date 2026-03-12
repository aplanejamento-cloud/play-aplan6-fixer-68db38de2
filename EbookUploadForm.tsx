import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Upload, X, ImageIcon, Loader2, Hourglass } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useMediaUpload } from "@/hooks/useMediaUpload";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MAX_PDF_SIZE = 20 * 1024 * 1024; // 20MB

const CATEGORIES = [
  "Ação", "Aventura", "Romance", "Ficção Científica", "Fantasia", 
  "Terror", "Suspense", "Autoajuda", "Negócios", "Educação", "Outros"
];

const EbookUploadForm = () => {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const { upload: uploadMedia } = useMediaUpload();
  
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [capa, setCapa] = useState<File | null>(null);
  const [capaPreview, setCapaPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const capaRef = useRef<HTMLInputElement>(null);

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

  const handleCapaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setCapa(f);
    setCapaPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async () => {
    if (!file || !titulo.trim() || !categoria) {
      toast.error("Preencha o título, categoria e selecione um PDF!");
      return;
    }

    setUploading(true);
    try {
      // 1. Upload PDF
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("ebooks")
        .upload(path, file, { upsert: false });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from("ebooks").getPublicUrl(path);

      // 2. Upload Capa if exists
      let capaUrl = null;
      if (capa) {
        capaUrl = await uploadMedia(capa, "image");
      }

      // 3. Insert into ebooks table
      const { data: ebook, error: insertErr } = await supabase.from("ebooks").insert({
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        categoria,
        pdf_url: urlData.publicUrl,
        capa_url: capaUrl,
        user_id: user.id,
      }).select().single();
      if (insertErr) throw insertErr;

      // 4. Create a post in the feed
      await supabase.from("posts").insert({
        user_id: user.id,
        content: `📚 Publiquei um novo Ebook: **${titulo}**\n\n${descricao}`,
        image_url: capaUrl,
        categoria: "ebook",
        metadata: {
          ebook_id: ebook.id,
          pdf_url: urlData.publicUrl,
          titulo: titulo.trim(),
          categoria
        }
      });

      toast.success("📚 Ebook publicado com sucesso!");
      setTitulo("");
      setDescricao("");
      setCategoria("");
      setFile(null);
      setCapa(null);
      setCapaPreview(null);
      if (inputRef.current) inputRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["ebooks"] });
      qc.invalidateQueries({ queryKey: ["posts"] });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao publicar ebook");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Publicar Ebook (PDF)</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <Input
            placeholder="Título do ebook..."
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={100}
          />

          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a categoria" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Textarea 
            placeholder="Descrição curta..."
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="min-h-[80px]"
            maxLength={300}
          />
        </div>

        <div className="space-y-3">
          {/* Capa Upload */}
          <div 
            className="h-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors relative overflow-hidden bg-muted"
            onClick={() => capaRef.current?.click()}
          >
            {capaPreview ? (
              <img src={capaPreview} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <>
                <ImageIcon className="w-8 h-8 text-muted-foreground mb-1" />
                <p className="text-[10px] text-muted-foreground">Capa (Opcional)</p>
              </>
            )}
            <input ref={capaRef} type="file" accept="image/*" className="hidden" onChange={handleCapaChange} />
          </div>

          {/* PDF Upload */}
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
              className="w-full border-dashed border-primary/30 text-primary h-10"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              Selecionar PDF
            </Button>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      <Button
        onClick={handleSubmit}
        disabled={uploading || !file || !titulo.trim() || !categoria}
        className="w-full font-cinzel"
      >
        {uploading ? (
          <div className="flex items-center gap-2">
            <Hourglass className="w-4 h-4 animate-spin" />
            Enviando...
          </div>
        ) : (
          "📚 Publicar Ebook"
        )}
      </Button>
    </div>
  );
};

export default EbookUploadForm;
