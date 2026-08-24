import { google } from "googleapis";
import { Readable } from "stream";

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

let driveClient: ReturnType<typeof google.drive> | null = null;

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Google Drive credentials not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN"
    );
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

export function getDriveClient() {
  if (!driveClient) {
    const auth = getOAuth2Client();
    driveClient = google.drive({ version: "v3", auth });
  }
  return driveClient;
}

const ROOT_FOLDER_NAME = "WeddingPhotoSystem";

async function findOrCreateFolder(
  name: string,
  parentId?: string
): Promise<string> {
  const drive = getDriveClient();

  const query = parentId
    ? `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
    : `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const existing = await drive.files.list({
    q: query,
    fields: "files(id, name)",
    spaces: "drive",
  });

  if (existing.data.files && existing.data.files.length > 0) {
    return existing.data.files[0].id!;
  }

  const metadata: { name: string; mimeType: string; parents?: string[] } = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };

  if (parentId) {
    metadata.parents = [parentId];
  }

  const folder = await drive.files.create({
    requestBody: metadata,
    fields: "id",
  });

  return folder.data.id!;
}

export async function createWeddingDriveFolders(weddingCode: string): Promise<{
  rootFolderId: string;
  originalsFolderId: string;
  thumbnailsFolderId: string;
}> {
  const rootSystemId = await findOrCreateFolder(ROOT_FOLDER_NAME);
  const weddingFolderId = await findOrCreateFolder(weddingCode, rootSystemId);
  const originalsFolderId = await findOrCreateFolder(
    "Originals",
    weddingFolderId
  );
  const thumbnailsFolderId = await findOrCreateFolder(
    "Thumbnails",
    weddingFolderId
  );

  return { rootFolderId: weddingFolderId, originalsFolderId, thumbnailsFolderId };
}

export async function getWeddingDriveFolders(weddingCode: string): Promise<{
  originalsFolderId: string;
  thumbnailsFolderId: string;
} | null> {
  const drive = getDriveClient();

  const rootQuery = `name='${ROOT_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const rootResult = await drive.files.list({
    q: rootQuery,
    fields: "files(id)",
  });

  if (!rootResult.data.files?.length) return null;
  const rootId = rootResult.data.files[0].id!;

  const weddingQuery = `name='${weddingCode}' and '${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const weddingResult = await drive.files.list({
    q: weddingQuery,
    fields: "files(id)",
  });

  if (!weddingResult.data.files?.length) return null;
  const weddingId = weddingResult.data.files[0].id!;

  const originalsFolderId = await findOrCreateFolder("Originals", weddingId);
  const thumbnailsFolderId = await findOrCreateFolder("Thumbnails", weddingId);

  return { originalsFolderId, thumbnailsFolderId };
}

export async function uploadFileToDrive(
  fileName: string,
  mimeType: string,
  buffer: Buffer,
  parentFolderId: string
): Promise<string> {
  const drive = getDriveClient();

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [parentFolderId],
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: "id",
  });

  return response.data.id!;
}

export async function downloadFileFromDrive(fileId: string): Promise<Buffer> {
  const drive = getDriveClient();

  const response = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );

  return Buffer.from(response.data as ArrayBuffer);
}

export async function getFileStreamFromDrive(
  fileId: string
): Promise<{ stream: Readable; mimeType: string }> {
  const drive = getDriveClient();

  const meta = await drive.files.get({
    fileId,
    fields: "mimeType, name",
  });

  const response = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "stream" }
  );

  return {
    stream: response.data as unknown as Readable,
    mimeType: meta.data.mimeType || "application/octet-stream",
  };
}

export async function checkDriveConnection(): Promise<boolean> {
  try {
    const drive = getDriveClient();
    await drive.files.list({ pageSize: 1, fields: "files(id)" });
    return true;
  } catch {
    return false;
  }
}
