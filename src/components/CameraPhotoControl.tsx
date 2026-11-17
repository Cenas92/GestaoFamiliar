import { useState, type ChangeEvent } from 'react';
import { Camera, ImagePlus, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { saveImageAttachment } from '../utils/attachmentStorage';
import { AttachmentImage } from './AttachmentPreview';

interface CameraPhotoControlProps {
  attachmentId: string | null;
  alt: string;
  onChange: (attachmentId: string | null) => void;
  allowRemove?: boolean;
}

export function CameraPhotoControl({
  attachmentId,
  alt,
  onChange,
  allowRemove = true,
}: CameraPhotoControlProps) {
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setBusy(true);
    try {
      const saved = await saveImageAttachment(file);
      onChange(saved.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      {attachmentId && (
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            aria-label={expanded ? 'Reduzir foto do produto' : 'Ampliar foto do produto'}
            className="block w-full text-left"
          >
            <AttachmentImage
              attachmentId={attachmentId}
              alt={alt}
              fit="contain"
              className={`w-full transition-all ${expanded ? 'max-h-96' : 'max-h-44'}`}
            />
            <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-lg bg-slate-900/70 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-xs">
              {expanded ? (
                <>
                  <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
                  Reduzir
                </>
              ) : (
                <>
                  <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
                  Ampliar
                </>
              )}
            </span>
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-teal-800">
          <Camera className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{busy ? 'A processar...' : attachmentId ? 'Nova foto' : 'Câmara'}</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            disabled={busy}
            aria-label={attachmentId ? 'Tirar nova foto com câmara' : 'Tirar foto com câmara'}
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        <label className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50">
          <ImagePlus className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          <span>Galeria</span>
          <input
            type="file"
            accept="image/*"
            disabled={busy}
            aria-label="Escolher foto da galeria"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        {attachmentId && allowRemove && (
          <button
            type="button"
            onClick={() => {
              setExpanded(false);
              onChange(null);
            }}
            aria-label="Remover foto"
            className="ml-auto inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Remover foto</span>
          </button>
        )}
      </div>
    </div>
  );
}
