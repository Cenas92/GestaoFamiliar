const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const GAPI_SCRIPT_URL = 'https://apis.google.com/js/api.js';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

export const STATE_FILE_NAME = 'family_state.json';
export const ATTACHMENTS_FOLDER_NAME = 'attachments';
export const BACKUPS_FOLDER_NAME = 'backups';

interface TokenResponse {
  access_token: string;
  expires_in: number;
  error?: string;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: TokenResponse) => void;
            error_callback?: (err: { type: string; message?: string }) => void;
          }) => {
            requestAccessToken: (opts?: { prompt?: string }) => void;
          };
          revoke?: (token: string, done: () => void) => void;
        };
      };
      picker?: {
        PickerBuilder: new () => GooglePickerBuilder;
        ViewId: { FOLDERS: string };
        DocsView: new (viewId: string) => GoogleDocsView;
        Action: { PICKED: string; CANCEL: string };
      };
    };
    gapi?: {
      load: (api: string, callback: () => void) => void;
    };
  }
}

interface GoogleDocsView {
  setIncludeFolders: (include: boolean) => GoogleDocsView;
  setSelectFolderEnabled: (enable: boolean) => GoogleDocsView;
  setMimeTypes: (mimes: string) => GoogleDocsView;
}

interface GooglePickerBuilder {
  addView: (view: GoogleDocsView) => GooglePickerBuilder;
  setOAuthToken: (token: string) => GooglePickerBuilder;
  setDeveloperKey: (key: string) => GooglePickerBuilder;
  setTitle: (title: string) => GooglePickerBuilder;
  setCallback: (cb: (data: { action: string; docs?: Array<{ id: string; name: string }> }) => void) => GooglePickerBuilder;
  build: () => { setVisible: (visible: boolean) => void };
}

let cachedAccessToken: string | null = null;
let cachedTokenExpiresAt = 0;

function loadExternalScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!navigator.onLine) {
      reject(new Error('Sem ligação à internet para contactar o Google Drive.'));
      return;
    }
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (existing?.dataset.loaded === 'true') {
      resolve();
      return;
    }
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Falha ao carregar ${src}`)), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error(`Não foi possível carregar o script da Google (${src}).`));
    document.head.appendChild(script);
  });
}

export async function ensureGoogleAccessToken(
  clientId: string,
  interactive = true,
): Promise<string> {
  if (!clientId.trim()) {
    throw new Error('Configura primeiro o Google OAuth Client ID nas Definições.');
  }

  if (cachedAccessToken && Date.now() < cachedTokenExpiresAt - 30_000) {
    return cachedAccessToken;
  }

  await loadExternalScript(GIS_SCRIPT_URL);

  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) {
    throw new Error('Google Identity Services indisponível neste browser.');
  }

  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId.trim(),
      scope: DRIVE_SCOPE,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error ?? 'Autorização Google cancelada.'));
          return;
        }
        cachedAccessToken = resp.access_token;
        cachedTokenExpiresAt = Date.now() + resp.expires_in * 1000;
        resolve(resp.access_token);
      },
      error_callback: (err) => {
        reject(new Error(err.message ?? `Erro de autenticação Google (${err.type}).`));
      },
    });

    client.requestAccessToken({ prompt: interactive ? '' : 'none' });
  });
}

export function clearCachedGoogleToken(): void {
  if (cachedAccessToken && window.google?.accounts?.oauth2?.revoke) {
    window.google.accounts.oauth2.revoke(cachedAccessToken, () => {});
  }
  cachedAccessToken = null;
  cachedTokenExpiresAt = 0;
}

async function driveFetch(url: string, token: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);
  const resp = await fetch(url, { ...init, headers });
  if (resp.status === 401) {
    cachedAccessToken = null;
    cachedTokenExpiresAt = 0;
    throw new Error('Sessão Google expirada. Clica novamente em Sincronizar para renovar.');
  }
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Erro Google Drive (${resp.status}): ${body.slice(0, 200)}`);
  }
  return resp;
}

export interface DriveFileMeta {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
}

export async function listDriveChildren(
  token: string,
  folderId: string,
  nameFilter?: string,
): Promise<DriveFileMeta[]> {
  const qParts = [`'${folderId}' in parents`, 'trashed = false'];
  if (nameFilter) {
    const escaped = nameFilter.replace(/'/g, "\\'");
    qParts.push(`name = '${escaped}'`);
  }
  const url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(
    qParts.join(' and '),
  )}&fields=files(id,name,mimeType,modifiedTime)&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const resp = await driveFetch(url, token);
  const data = (await resp.json()) as { files?: DriveFileMeta[] };
  return data.files ?? [];
}

export async function findOrCreateAppRootFolder(token: string): Promise<{ id: string; name: string }> {
  const q =
    "name = 'GestaoFamiliar' and mimeType = 'application/vnd.google-apps.folder' and trashed = false";
  const url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(
    q,
  )}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const resp = await driveFetch(url, token);
  const data = (await resp.json()) as { files?: DriveFileMeta[] };
  if (data.files && data.files.length > 0) {
    return { id: data.files[0].id, name: data.files[0].name };
  }

  return createDriveFolder(token, 'GestaoFamiliar', null);
}

export async function createDriveFolder(
  token: string,
  name: string,
  parentId: string | null,
): Promise<{ id: string; name: string }> {
  const metadata: Record<string, unknown> = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) {
    metadata.parents = [parentId];
  }
  const resp = await driveFetch(`${DRIVE_API_BASE}/files?fields=id,name`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata),
  });
  return (await resp.json()) as { id: string; name: string };
}

export async function ensureSubfolder(
  token: string,
  parentId: string,
  folderName: string,
): Promise<string> {
  const children = await listDriveChildren(token, parentId, folderName);
  const existing = children.find((f) => f.mimeType === 'application/vnd.google-apps.folder');
  if (existing) return existing.id;
  const created = await createDriveFolder(token, folderName, parentId);
  return created.id;
}

export async function pickSharedFolderWithPicker(
  token: string,
  apiKey?: string,
): Promise<{ id: string; name: string } | null> {
  await loadExternalScript(GAPI_SCRIPT_URL);

  await new Promise<void>((resolve) => {
    window.gapi?.load('picker', () => resolve());
  });

  const pickerNs = window.google?.picker;
  if (!pickerNs) {
    throw new Error('Google Picker indisponível.');
  }

  return new Promise((resolve) => {
    const view = new pickerNs.DocsView(pickerNs.ViewId.FOLDERS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(true)
      .setMimeTypes('application/vnd.google-apps.folder');

    const builder = new pickerNs.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setTitle('Seleciona a pasta partilhada GestaoFamiliar');

    if (apiKey?.trim()) {
      builder.setDeveloperKey(apiKey.trim());
    }

    builder.setCallback((data) => {
      if (data.action === pickerNs.Action.PICKED && data.docs && data.docs[0]) {
        resolve({ id: data.docs[0].id, name: data.docs[0].name });
      } else if (data.action === pickerNs.Action.CANCEL) {
        resolve(null);
      }
    });

    builder.build().setVisible(true);
  });
}

export async function downloadDriveFileText(token: string, fileId: string): Promise<string> {
  const resp = await driveFetch(`${DRIVE_API_BASE}/files/${fileId}?alt=media`, token);
  return resp.text();
}

export async function downloadDriveFileBlob(token: string, fileId: string): Promise<Blob> {
  const resp = await driveFetch(`${DRIVE_API_BASE}/files/${fileId}?alt=media`, token);
  return resp.blob();
}

export async function uploadDriveFile(
  token: string,
  params: {
    folderId: string;
    fileName: string;
    mimeType: string;
    content: Blob | string;
    existingFileId?: string | null;
  },
): Promise<string> {
  const blob =
    typeof params.content === 'string'
      ? new Blob([params.content], { type: params.mimeType })
      : params.content;

  const boundary = `-------gestaofamiliar-${Date.now()}`;
  const metadata: Record<string, unknown> = {
    name: params.fileName,
    mimeType: params.mimeType,
  };
  if (!params.existingFileId) {
    metadata.parents = [params.folderId];
  }

  const multipartBody = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    JSON.stringify(metadata),
    `\r\n--${boundary}\r\nContent-Type: ${params.mimeType}\r\n\r\n`,
    blob,
    `\r\n--${boundary}--`,
  ]);

  const url = params.existingFileId
    ? `${DRIVE_UPLOAD_BASE}/files/${params.existingFileId}?uploadType=multipart&fields=id`
    : `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id`;

  const resp = await driveFetch(url, token, {
    method: params.existingFileId ? 'PATCH' : 'POST',
    headers: {
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  const data = (await resp.json()) as { id: string };
  return data.id;
}

export async function deleteDriveFile(token: string, fileId: string): Promise<void> {
  await driveFetch(`${DRIVE_API_BASE}/files/${fileId}`, token, {
    method: 'DELETE',
  });
}
