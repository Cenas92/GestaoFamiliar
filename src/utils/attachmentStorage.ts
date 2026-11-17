import { db } from '../db/database';
import type { AttachmentRecord } from '../types/domain';
import { createId, nowIso } from './id';
import { prepareAttachmentBlob } from './imageCompression';

export interface SavedImageAttachment {
  id: string;
  fileName: string;
  sizeBytes: number;
}

/**
 * Compresses an image file when helpful and persists it in the synced attachments table.
 */
export async function saveImageAttachment(file: File): Promise<SavedImageAttachment> {
  const prepared = await prepareAttachmentBlob(file);
  const id = createId();
  const record: AttachmentRecord = {
    id,
    fileName: prepared.fileName,
    mimeType: prepared.mimeType,
    sizeBytes: prepared.blob.size,
    blob: prepared.blob,
    driveFileId: null,
    uploadedToDrive: false,
    updatedAt: nowIso(),
    deletedAt: null,
  };
  await db.attachments.put(record);
  return {
    id,
    fileName: prepared.fileName,
    sizeBytes: prepared.blob.size,
  };
}

/**
 * Tombstones an attachment when no active recipe or shopping item references it anymore.
 */
export async function softDeleteAttachmentIfUnused(
  attachmentId: string | null | undefined,
  options?: { excludeShoppingId?: string; excludeRecipeId?: string },
): Promise<void> {
  if (!attachmentId) return;
  const rec = await db.attachments.get(attachmentId);
  if (!rec || rec.deletedAt) return;

  const [shoppingRefs, recipeRefs] = await Promise.all([
    db.shoppingItems.toArray(),
    db.recipes.toArray(),
  ]);

  const usedInShopping = shoppingRefs.some(
    (s) =>
      !s.deletedAt &&
      s.id !== options?.excludeShoppingId &&
      s.photoAttachmentId === attachmentId,
  );
  if (usedInShopping) return;

  const usedInRecipes = recipeRefs.some(
    (r) =>
      !r.deletedAt &&
      r.id !== options?.excludeRecipeId &&
      (r.photoAttachmentId === attachmentId || r.docAttachmentId === attachmentId),
  );
  if (usedInRecipes) return;

  const now = nowIso();
  await db.attachments.put({
    ...rec,
    deletedAt: now,
    updatedAt: now,
  });
}
