import { useEffect, useState } from 'react';
import { FileText, ImageOff } from 'lucide-react';
import { db } from '../db/database';
import type { AttachmentRecord } from '../types/domain';

interface AttachmentImageProps {
  attachmentId: string | null;
  alt: string;
  className?: string;
  fit?: 'cover' | 'contain';
}

export function AttachmentImage({
  attachmentId,
  alt,
  className = '',
  fit = 'cover',
}: AttachmentImageProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [record, setRecord] = useState<AttachmentRecord | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    if (!attachmentId) {
      setUrl(null);
      setRecord(null);
      return;
    }

    db.attachments.get(attachmentId).then((rec) => {
      if (!active || !rec || rec.deletedAt) return;
      setRecord(rec);
      if (rec.mimeType.startsWith('image/')) {
        objectUrl = URL.createObjectURL(rec.blob);
        setUrl(objectUrl);
      }
    });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachmentId]);

  if (!attachmentId || !record) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-100 text-slate-300 ${className}`}
      >
        <ImageOff className="h-6 w-6" />
      </div>
    );
  }

  if (!url) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 text-slate-500 ${className}`}>
        <FileText className="h-6 w-6" />
      </div>
    );
  }

  const fitClass = fit === 'contain' ? 'object-contain' : 'object-cover';
  return <img src={url} alt={alt} className={`${fitClass} ${className}`} />;
}

interface AttachmentDownloadButtonProps {
  attachmentId: string | null;
  label?: string;
}

export function AttachmentDocumentLink({
  attachmentId,
  label = 'Abrir anexo da receita',
}: AttachmentDownloadButtonProps) {
  const [record, setRecord] = useState<AttachmentRecord | null>(null);

  useEffect(() => {
    let active = true;
    if (!attachmentId) {
      setRecord(null);
      return;
    }
    db.attachments.get(attachmentId).then((rec) => {
      if (active && rec && !rec.deletedAt) setRecord(rec);
    });
    return () => {
      active = false;
    };
  }, [attachmentId]);

  if (!attachmentId || !record) return null;

  const handleOpen = () => {
    const objectUrl = URL.createObjectURL(record.blob);
    window.open(objectUrl, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  };

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
    >
      <FileText className="h-4 w-4 text-teal-700" />
      {label}: {record.fileName}
    </button>
  );
}
