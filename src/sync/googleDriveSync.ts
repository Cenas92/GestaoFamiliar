const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const GAPI_SCRIPT_URL = 'https://apis.google.com/js/api.js';
// Full `drive` scope is required so both spouses in Testing mode can read/update shared files
// created by the other partner inside the shared folder (`drive.file` isolates files per creator).
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

const TOKEN_STORAGE_KEY = 'gf_google_token_cache_v2';
const REFRESH_TOKEN_STORAGE_KEY = 'gf_google_refresh_token_v1';
const CLIENT_SECRET_STORAGE_KEY = 'gf_google_client_secret';
const ACCOUNT_HINT_STORAGE_KEY = 'gf_google_account_hint_v1';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

export const STATE_FILE_NAME = 'family_state.json';
export const ATTACHMENTS_FOLDER_NAME = 'attachments';
export const BACKUPS_FOLDER_NAME = 'backups';

interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope?: string;
  error?: string;
}

interface CodeResponse {
  code?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

export interface ConnectedGoogleAccount {
  email: string;
  displayName?: string;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            login_hint?: string;
            prompt?: string;
            callback: (resp: TokenResponse) => void;
            error_callback?: (err: { type: string; message?: string }) => void;
          }) => {
            requestAccessToken: (opts?: { prompt?: string; hint?: string }) => void;
          };
          initCodeClient?: (config: {
            client_id: string;
            scope: string;
            ux_mode?: 'popup' | 'redirect';
            select_account?: boolean;
            login_hint?: string;
            include_granted_scopes?: boolean;
            callback: (resp: CodeResponse) => void;
            error_callback?: (err: { type: string; message?: string }) => void;
          }) => {
            requestCode: () => void;
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
  setCallback: (
    cb: (data: { action: string; docs?: Array<{ id: string; name: string }> }) => void,
  ) => GooglePickerBuilder;
  build: () => { setVisible: (visible: boolean) => void };
}

let cachedAccessToken: string | null = null;
let cachedTokenExpiresAt = 0;
let activeRefreshPromise: Promise<string> | null = null;

export function sanitizeGoogleClientId(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\s+/g, '');
}

export function getStoredGoogleClientSecret(): string {
  try {
    return (localStorage.getItem(CLIENT_SECRET_STORAGE_KEY) ?? '').trim();
  } catch {
    return '';
  }
}

export function setStoredGoogleClientSecret(rawSecret: string): void {
  const clean = rawSecret.trim();
  try {
    if (clean) {
      localStorage.setItem(CLIENT_SECRET_STORAGE_KEY, clean);
    } else {
      localStorage.removeItem(CLIENT_SECRET_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota errors
  }
}

function loadStoredRefreshToken(clientId?: string): { refreshToken: string; clientId: string } | null {
  try {
    const raw = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { refreshToken?: string; clientId?: string };
    if (!parsed.refreshToken) return null;
    if (clientId && parsed.clientId && parsed.clientId !== sanitizeGoogleClientId(clientId)) {
      return null;
    }
    return {
      refreshToken: parsed.refreshToken,
      clientId: parsed.clientId ?? '',
    };
  } catch {
    return null;
  }
}

function persistRefreshToken(refreshToken: string, clientId: string): void {
  try {
    localStorage.setItem(
      REFRESH_TOKEN_STORAGE_KEY,
      JSON.stringify({
        refreshToken,
        clientId: sanitizeGoogleClientId(clientId),
        updatedAt: Date.now(),
      }),
    );
  } catch {
    // Ignore storage quota errors
  }
}

function clearStoredRefreshToken(): void {
  try {
    localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function hasPersistentGoogleSession(clientId?: string): boolean {
  const secret = getStoredGoogleClientSecret();
  if (!secret) return false;
  return loadStoredRefreshToken(clientId) !== null;
}

export function getConnectedGoogleAccount(): ConnectedGoogleAccount | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_HINT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { email?: string; displayName?: string };
    if (!parsed.email) return null;
    return { email: parsed.email, displayName: parsed.displayName };
  } catch {
    return null;
  }
}

function persistConnectedGoogleAccount(account: ConnectedGoogleAccount): void {
  try {
    localStorage.setItem(ACCOUNT_HINT_STORAGE_KEY, JSON.stringify(account));
  } catch {
    // Ignore storage quota errors
  }
}

function clearConnectedGoogleAccount(): void {
  try {
    localStorage.removeItem(ACCOUNT_HINT_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

function loadCachedTokenFromStorage(): { token: string; expiresAt: number } | null {
  if (cachedAccessToken && Date.now() < cachedTokenExpiresAt - 60_000) {
    return { token: cachedAccessToken, expiresAt: cachedTokenExpiresAt };
  }
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string; expiresAt?: number; scope?: string };
    if (
      parsed.token &&
      parsed.expiresAt &&
      parsed.scope === DRIVE_SCOPE &&
      Date.now() < parsed.expiresAt - 60_000
    ) {
      cachedAccessToken = parsed.token;
      cachedTokenExpiresAt = parsed.expiresAt;
      return { token: parsed.token, expiresAt: parsed.expiresAt };
    }
  } catch {
    // Ignore storage parse errors
  }
  return null;
}

function persistToken(token: string, expiresInSeconds: number): void {
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  cachedAccessToken = token;
  cachedTokenExpiresAt = expiresAt;
  try {
    localStorage.setItem(
      TOKEN_STORAGE_KEY,
      JSON.stringify({ token, expiresAt, scope: DRIVE_SCOPE }),
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function hasValidCachedGoogleToken(): boolean {
  return loadCachedTokenFromStorage() !== null;
}

export function getCachedGoogleTokenExpiresAt(): number {
  return loadCachedTokenFromStorage()?.expiresAt ?? 0;
}

function clearCachedAccessTokenOnly(): void {
  cachedAccessToken = null;
  cachedTokenExpiresAt = 0;
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

async function fetchAndCacheGoogleAccountInfo(token: string): Promise<ConnectedGoogleAccount | null> {
  try {
    const resp = await fetch(`${DRIVE_API_BASE}/about?fields=user(emailAddress,displayName)`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as {
      user?: { emailAddress?: string; displayName?: string };
    };
    const email = data.user?.emailAddress?.trim();
    if (!email) return null;
    const info: ConnectedGoogleAccount = {
      email,
      displayName: data.user?.displayName?.trim() || undefined,
    };
    persistConnectedGoogleAccount(info);
    return info;
  } catch {
    return null;
  }
}

function ensureAccountHintPopulated(token: string): void {
  if (!getConnectedGoogleAccount()) {
    void fetchAndCacheGoogleAccountInfo(token);
  }
}

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
    script.onerror = () =>
      reject(new Error(`Não foi possível carregar o script da Google (${src}).`));
    document.head.appendChild(script);
  });
}

export function preloadGoogleScripts(): void {
  if (typeof window === 'undefined' || !navigator.onLine) return;
  void loadExternalScript(GIS_SCRIPT_URL).catch(() => {});
}

export class GoogleAuthRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleAuthRequiredError';
  }
}

interface OAuthTokenEndpointSuccess {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

async function refreshAccessTokenWithGoogle(
  cleanClientId: string,
  cleanClientSecret: string,
  refreshToken: string,
): Promise<string> {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = (async () => {
    const resp = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: cleanClientId,
        client_secret: cleanClientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = (await resp.json().catch(() => ({}))) as OAuthTokenEndpointSuccess;
    if (!resp.ok || !data.access_token) {
      if (
        data.error === 'invalid_grant' ||
        data.error === 'unauthorized_client' ||
        data.error === 'invalid_client'
      ) {
        clearStoredRefreshToken();
        throw new GoogleAuthRequiredError(
          'A autorização permanente Google expirou ou foi revogada. Toca em Sincronizar para renovar.',
        );
      }
      throw new Error(data.error_description || data.error || `Erro ao renovar sessão Google (${resp.status}).`);
    }

    persistToken(data.access_token, data.expires_in ?? 3600);
    if (data.refresh_token) {
      persistRefreshToken(data.refresh_token, cleanClientId);
    }
    ensureAccountHintPopulated(data.access_token);
    return data.access_token;
  })().finally(() => {
    activeRefreshPromise = null;
  });

  return activeRefreshPromise;
}

async function exchangeAuthCodeWithGoogle(
  cleanClientId: string,
  cleanClientSecret: string,
  code: string,
): Promise<string> {
  const resp = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: cleanClientId,
      client_secret: cleanClientSecret,
      redirect_uri: 'postmessage',
      grant_type: 'authorization_code',
    }),
  });

  const data = (await resp.json().catch(() => ({}))) as OAuthTokenEndpointSuccess;
  if (!resp.ok || !data.access_token) {
    throw new GoogleAuthRequiredError(
      data.error_description ||
        data.error ||
        `Falha ao obter sessão permanente Google (${resp.status}). Verifica o Client Secret nas Definições.`,
    );
  }

  if (data.scope && !data.scope.split(/\s+/).includes(DRIVE_SCOPE)) {
    throw new GoogleAuthRequiredError(
      'Falta marcar a caixa de permissão do Google Drive no ecrã da Google. Toca em Sincronizar e ativa a seleção do Drive.',
    );
  }

  persistToken(data.access_token, data.expires_in ?? 3600);
  if (data.refresh_token) {
    persistRefreshToken(data.refresh_token, cleanClientId);
  }
  await fetchAndCacheGoogleAccountInfo(data.access_token);
  return data.access_token;
}

function requestCodeAndExchangeWithLoadedGis(
  cleanClientId: string,
  cleanClientSecret: string,
  loginHint?: string,
  forceAccountSelect = false,
): Promise<string> {
  const initCodeClient = window.google?.accounts?.oauth2?.initCodeClient;
  if (!initCodeClient) {
    return requestTokenWithLoadedGis(cleanClientId, true, loginHint);
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(
        new GoogleAuthRequiredError(
          'O login Google demorou demasiado ou o pop-up foi bloqueado. Permite pop-ups e tenta novamente.',
        ),
      );
    }, 60_000);

    const finishResolve = (token: string) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(token);
    };

    const finishReject = (err: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      reject(err);
    };

    const client = initCodeClient({
      client_id: cleanClientId,
      scope: DRIVE_SCOPE,
      ux_mode: 'popup',
      select_account: forceAccountSelect || !loginHint,
      ...(loginHint && !forceAccountSelect ? { login_hint: loginHint } : {}),
      callback: (resp) => {
        if (resp.error || !resp.code) {
          finishReject(
            new GoogleAuthRequiredError(resp.error_description ?? resp.error ?? 'Autorização Google cancelada.'),
          );
          return;
        }
        if (resp.scope && !resp.scope.split(/\s+/).includes(DRIVE_SCOPE)) {
          finishReject(
            new GoogleAuthRequiredError(
              'Falta marcar a caixa de permissão do Google Drive no ecrã da Google. Toca em Sincronizar e ativa a seleção do Drive.',
            ),
          );
          return;
        }
        exchangeAuthCodeWithGoogle(cleanClientId, cleanClientSecret, resp.code)
          .then(finishResolve)
          .catch((err) => finishReject(err instanceof Error ? err : new Error('Erro na troca de token Google.')));
      },
      error_callback: (err) => {
        finishReject(
          new GoogleAuthRequiredError(
            err.message ?? `Autenticação Google (${err.type}). Verifica se os pop-ups estão ativos.`,
          ),
        );
      },
    });

    client.requestCode();
  });
}

function requestTokenWithLoadedGis(
  cleanClientId: string,
  interactive: boolean,
  loginHint?: string,
): Promise<string> {
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) {
    return Promise.reject(new Error('Google Identity Services indisponível neste browser.'));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const timeoutMs = interactive ? 45_000 : 5_000;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(
        interactive
          ? new GoogleAuthRequiredError(
              'O login Google demorou demasiado ou o pop-up foi bloqueado. Permite pop-ups e tenta novamente.',
            )
          : new GoogleAuthRequiredError('Sessão Google expirada. Toca em Sincronizar para renovar.'),
      );
    }, timeoutMs);

    const finishResolve = (token: string) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(token);
    };

    const finishReject = (err: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      reject(err);
    };

    const client = oauth2.initTokenClient({
      client_id: cleanClientId,
      scope: DRIVE_SCOPE,
      ...(loginHint ? { login_hint: loginHint } : {}),
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          finishReject(
            new GoogleAuthRequiredError(resp.error ?? 'Autorização Google cancelada.'),
          );
          return;
        }
        if (resp.scope && !resp.scope.split(/\s+/).includes(DRIVE_SCOPE)) {
          finishReject(
            new GoogleAuthRequiredError(
              'Falta marcar a caixa de permissão do Google Drive no ecrã da Google. Toca em Sincronizar e ativa a seleção do Drive.',
            ),
          );
          return;
        }
        persistToken(resp.access_token, resp.expires_in);
        ensureAccountHintPopulated(resp.access_token);
        finishResolve(resp.access_token);
      },
      error_callback: (err) => {
        finishReject(
          new GoogleAuthRequiredError(
            err.message ?? `Autenticação Google (${err.type}). Verifica se os pop-ups estão ativos.`,
          ),
        );
      },
    });

    // Trigger synchronously when possible to preserve mobile browser user gesture
    client.requestAccessToken({
      prompt: interactive ? '' : 'none',
      ...(loginHint ? { hint: loginHint } : {}),
    });
  });
}

export async function ensureGoogleAccessToken(
  clientId: string,
  interactive = true,
  options?: { forceReauth?: boolean },
): Promise<string> {
  const cleanClientId = sanitizeGoogleClientId(clientId);
  if (!cleanClientId) {
    throw new Error('Configura primeiro o Google OAuth Client ID nas Definições.');
  }

  const forceReauth = Boolean(options?.forceReauth);
  if (!forceReauth) {
    const cached = loadCachedTokenFromStorage();
    if (cached) {
      ensureAccountHintPopulated(cached.token);
      return cached.token;
    }
  }

  const cleanClientSecret = getStoredGoogleClientSecret();
  const storedRefresh = loadStoredRefreshToken(cleanClientId);

  if (!forceReauth && cleanClientSecret && storedRefresh) {
    try {
      return await refreshAccessTokenWithGoogle(
        cleanClientId,
        cleanClientSecret,
        storedRefresh.refreshToken,
      );
    } catch (err) {
      if (!(err instanceof GoogleAuthRequiredError) || !interactive) {
        throw err;
      }
      // If permanent refresh token was revoked/expired and user tapped interactively, fall through to interactive auth
    }
  }

  const accountHint = getConnectedGoogleAccount()?.email;

  if (interactive && cleanClientSecret) {
    if (!window.google?.accounts?.oauth2) {
      await loadExternalScript(GIS_SCRIPT_URL);
    }
    if (window.google?.accounts?.oauth2?.initCodeClient) {
      return requestCodeAndExchangeWithLoadedGis(
        cleanClientId,
        cleanClientSecret,
        accountHint,
        forceReauth,
      );
    }
  }

  // Fast synchronous path if GIS script is already loaded (crucial for Android popup gesture)
  if (window.google?.accounts?.oauth2) {
    return requestTokenWithLoadedGis(cleanClientId, interactive, accountHint);
  }

  await loadExternalScript(GIS_SCRIPT_URL);
  return requestTokenWithLoadedGis(cleanClientId, interactive, accountHint);
}

export function clearCachedGoogleToken(): void {
  const token = cachedAccessToken;
  clearCachedAccessTokenOnly();
  clearStoredRefreshToken();
  clearConnectedGoogleAccount();
  if (token && window.google?.accounts?.oauth2?.revoke) {
    window.google.accounts.oauth2.revoke(token, () => {});
  }
}

async function driveFetch(url: string, token: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);
  const resp = await fetch(url, { ...init, headers, cache: 'no-store' });
  if (resp.status === 401) {
    // Only invalidate the 1h access_token so refresh_token & login_hint remain ready for auto-refresh
    clearCachedAccessTokenOnly();
    throw new GoogleAuthRequiredError(
      'Sessão Google expirada. Clica novamente em Sincronizar para renovar.',
    );
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
  createdTime?: string;
  size?: string;
  capabilities?: {
    canEdit?: boolean;
    canDelete?: boolean;
  };
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
  )}&orderBy=createdTime%20asc&pageSize=100&fields=files(id,name,mimeType,modifiedTime,createdTime,size,capabilities(canEdit,canDelete))&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const resp = await driveFetch(url, token);
  const data = (await resp.json()) as { files?: DriveFileMeta[] };
  return data.files ?? [];
}

export async function findOrCreateAppRootFolder(token: string): Promise<{ id: string; name: string }> {
  const q =
    "name = 'GestaoFamiliar' and mimeType = 'application/vnd.google-apps.folder' and trashed = false";
  const url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(
    q,
  )}&orderBy=createdTime%20asc&fields=files(id,name,shared,createdTime)&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const resp = await driveFetch(url, token);
  const data = (await resp.json()) as { files?: Array<{ id: string; name: string }> };
  if (data.files && data.files.length > 0) {
    // Prefer a folder that already contains a shared family_state.json if duplicates exist
    for (const candidate of data.files) {
      const existingState = await listDriveChildren(token, candidate.id, STATE_FILE_NAME).catch(
        () => [],
      );
      if (existingState.length > 0) {
        return { id: candidate.id, name: candidate.name };
      }
    }
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
    ? `${DRIVE_UPLOAD_BASE}/files/${params.existingFileId}?uploadType=multipart&fields=id&supportsAllDrives=true`
    : `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id&supportsAllDrives=true`;

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
