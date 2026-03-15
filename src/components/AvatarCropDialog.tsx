import { useState, useRef, useCallback } from "react";
import ReactCrop, { type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface AvatarCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string;
  onCropComplete: (blob: Blob) => void;
}

function getCroppedImg(image: HTMLImageElement, crop: PixelCrop): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = crop.width * scaleX;
  canvas.height = crop.height * scaleY;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
      "image/jpeg",
      0.92
    );
  });
}

const AvatarCropDialog = ({ open, onOpenChange, imageSrc, onCropComplete }: AvatarCropDialogProps) => {
  const [crop, setCrop] = useState<Crop>({
    unit: "%",
    width: 80,
    height: 80,
    x: 10,
    y: 10,
  });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [saving, setSaving] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const handleSave = useCallback(async () => {
    if (!completedCrop || !imgRef.current) return;
    setSaving(true);
    try {
      const blob = await getCroppedImg(imgRef.current, completedCrop);
      onCropComplete(blob);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }, [completedCrop, onCropComplete]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border w-[90vw] max-w-[90vw] max-h-[90vh] flex flex-col p-4">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="font-cinzel text-foreground">Recortar Foto de Perfil</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 flex flex-col items-center gap-3 overflow-hidden">
          <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden w-full">
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={1}
              circularCrop
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Crop"
                style={{ maxHeight: "calc(90vh - 160px)", maxWidth: "100%", objectFit: "contain" }}
              />
            </ReactCrop>
          </div>
          <div className="flex gap-2 w-full flex-shrink-0">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button className="flex-1 bg-primary text-primary-foreground" onClick={handleSave} disabled={saving || !completedCrop}>
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AvatarCropDialog;
