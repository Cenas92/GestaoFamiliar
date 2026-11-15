const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.78;

export async function prepareAttachmentBlob(
  file: File,
): Promise<{ blob: Blob; mimeType: string; fileName: string }> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return {
      blob: file,
      mimeType: file.type || 'application/octet-stream',
      fileName: file.name,
    };
  }

  const image = await loadImageFromFile(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { blob: file, mimeType: file.type, fileName: file.name };
  }

  ctx.drawImage(image, 0, 0, width, height);

  const outputType = 'image/webp';
  const compressed = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, outputType, JPEG_QUALITY),
  );

  if (!compressed) {
    return { blob: file, mimeType: file.type, fileName: file.name };
  }

  const finalBlob = compressed.size < file.size ? compressed : file;
  const finalMime = finalBlob === compressed ? outputType : file.type;
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const ext = finalMime === 'image/webp' ? 'webp' : file.name.split('.').pop() || 'jpg';

  return {
    blob: finalBlob,
    mimeType: finalMime,
    fileName: `${baseName}.${ext}`,
  };
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}
