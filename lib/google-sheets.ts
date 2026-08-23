import { createSign } from 'node:crypto';
import { prisma } from '@/lib/prisma';

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
let cachedToken: { value: string; expiresAt: number } | null = null;

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

function googleOAuthError(result: GoogleTokenResponse) {
  const detail = result.error_description ?? result.error ?? 'Google OAuth refresh failed';
  if (result.error === 'invalid_grant' || /expired|revoked/i.test(detail)) {
    return new Error(
      'Google OAuth authorization has expired or was revoked. Reconnect the Google account, replace GOOGLE_OAUTH_REFRESH_TOKEN in .env, then restart the application. Ensure the OAuth consent screen is In production (or Internal) so the refresh token does not expire after 7 days.',
    );
  }
  return new Error(`Google OAuth authentication failed: ${detail}`);
}

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString('base64url');
}

function googleCredentials() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
  if (!email || !privateKey) {
    throw new Error('Google Sheets service account is not configured');
  }
  return { email, privateKey };
}

export function isGoogleSheetsConfigured() {
  const oauthConfigured = process.env.GOOGLE_OAUTH_CLIENT_ID
    && process.env.GOOGLE_OAUTH_CLIENT_SECRET
    && process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  const serviceAccountConfigured = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  return Boolean(oauthConfigured || serviceAccountConfigured);
}

async function accessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const oauthClientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const oauthClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const oauthRefreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim();
  if (oauthClientId && oauthClientSecret && oauthRefreshToken) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: oauthClientId,
        client_secret: oauthClientSecret,
        refresh_token: oauthRefreshToken,
        grant_type: 'refresh_token',
      }),
    });
    const result = await response.json() as GoogleTokenResponse;
    if (!response.ok || !result.access_token) throw googleOAuthError(result);
    cachedToken = { value: result.access_token, expiresAt: Date.now() + (result.expires_in ?? 3600) * 1000 };
    return cachedToken.value;
  }

  const credentials = googleCredentials();
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({
    iss: credentials.email,
    scope: `${SHEETS_SCOPE} ${DRIVE_SCOPE}`,
    aud: 'https://oauth2.googleapis.com/token',
    iat: issuedAt,
    exp: issuedAt + 3600,
  }));
  const unsigned = `${header}.${claims}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${signer.sign(credentials.privateKey, 'base64url')}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const result = await response.json() as { access_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !result.access_token) throw new Error(result.error_description ?? 'Google authentication failed');
  cachedToken = { value: result.access_token, expiresAt: Date.now() + (result.expires_in ?? 3600) * 1000 };
  return cachedToken.value;
}

async function googleRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
  });
  const result = await response.json().catch(() => ({})) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(result.error?.message ?? `Google API request failed (${response.status})`);
  return result;
}

async function createSpreadsheet(name: string) {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
  if (folderId) {
    try {
      const file = await googleRequest<{ id: string; webViewLink?: string }>(
        'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,webViewLink',
        { method: 'POST', body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.spreadsheet', parents: [folderId] }) },
      );
      return { id: file.id, url: file.webViewLink ?? `https://docs.google.com/spreadsheets/d/${file.id}/edit` };
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (/storage quota|service account.*quota|insufficient.*quota/i.test(message)) {
        throw new Error(
          'Google Service Accounts have no personal Drive storage quota. Use a real Shared Drive folder or configure GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_OAUTH_REFRESH_TOKEN.',
        );
      }
      if (!/insufficient permissions.*parent|not found.*file|file not found/i.test(message)) throw error;
      console.warn(
        `Google Drive folder ${folderId} is not writable by ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL}. Falling back to the Service Account drive.`,
      );
    }
  }
  try {
    const sheet = await googleRequest<{ spreadsheetId: string; spreadsheetUrl: string }>(
      'https://sheets.googleapis.com/v4/spreadsheets',
      { method: 'POST', body: JSON.stringify({ properties: { title: name, locale: 'en_US', timeZone: 'Asia/Jakarta' } }) },
    );
    return { id: sheet.spreadsheetId, url: sheet.spreadsheetUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google Spreadsheet creation failed';
    if (/storage quota|service account.*quota|insufficient.*quota/i.test(message)) {
      throw new Error(
        `The Service Account cannot create files outside a Shared Drive. Share folder ${folderId ?? '(not configured)'} with ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL} as Content Manager.`,
      );
    }
    throw error;
  }
}

function sheetValues(project: Awaited<ReturnType<typeof loadProject>>) {
  const header = ['No.', 'Influencer Name', 'Username', 'Followers', 'Total Post', 'ER (%)', 'Avg. View',
    'Avg. Brand View', 'CPV All', 'CPV Brand', 'SOW', 'Platform', 'Qty', 'Rate Card', 'Total'];
  return [
    [`Project: ${project.prj_nama} (${project.prj_kode})`],
    [`Brand: ${project.mst_brand.brd_nama ?? '-'}`],
    [`PIC: ${project.creaby} | Created: ${project.creadate.toLocaleDateString('en-GB')}`],
    header,
    ...project.dtl_project.map((detail, index) => {
      const creator = detail.mst_creators;
      return [index + 1, creator.name, creator.username, creator.followers ?? 0, creator.total_post ?? 0,
        Number(creator.engagement_rate ?? 0), creator.average_view ?? 0, creator.average_view_brand ?? 0,
        creator.average_view ? Number(detail.drf_markup_price ?? 0) / creator.average_view : 0,
        creator.average_view_brand ? Number(detail.drf_markup_price ?? 0) / creator.average_view_brand : 0,
        detail.mst_sow?.sow_nama ?? '-',
        creator.social_media, detail.drf_qty,
        Number(detail.drf_markup_price ?? 0),
        Number(detail.drf_markup_price ?? 0) * Number(detail.drf_qty ?? 0)];
    }),
  ];
}

async function loadProject(projectId: number) {
  const project = await prisma.trs_project.findUnique({
    where: { prj_id: projectId },
    include: { mst_brand: true, dtl_project: { include: { mst_creators: true, mst_sow: true }, orderBy: { drf_id: 'asc' } } },
  });
  if (!project) throw new Error('Project was not found');
  return project;
}

async function shareWithBrand(spreadsheetId: string, email: string) {
  const role = process.env.GOOGLE_SHEETS_BRAND_ROLE === 'reader' ? 'reader' : 'writer';
  const result = await googleRequest<{
    permissions?: Array<{ id: string; emailAddress?: string; role?: string; type?: string }>;
  }>(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(spreadsheetId)}/permissions?supportsAllDrives=true&fields=permissions(id,emailAddress,role,type)`,
  );
  const existing = result.permissions?.find(
    (permission) => permission.type === 'user' && permission.emailAddress?.toLowerCase() === email.toLowerCase(),
  );

  if (existing) {
    if (existing.role !== role) {
      await googleRequest(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(spreadsheetId)}/permissions/${encodeURIComponent(existing.id)}?supportsAllDrives=true`,
        { method: 'PATCH', body: JSON.stringify({ role }) },
      );
    }
    return;
  }

  await googleRequest(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(spreadsheetId)}/permissions?supportsAllDrives=true&sendNotificationEmail=false`,
    { method: 'POST', body: JSON.stringify({ type: 'user', role, emailAddress: email }) },
  );
}

export async function syncProjectSpreadsheet(projectId: number, shareWithBrandEmail = false) {
  const project = await loadProject(projectId);
  const name = `${project.prj_kode} - ${project.prj_nama} Creator List`;
  const created = !project.prj_sheetid;
  const spreadsheet = created
    ? await createSpreadsheet(name)
    : { id: project.prj_sheetid!, url: project.prj_sheeturl ?? `https://docs.google.com/spreadsheets/d/${project.prj_sheetid}/edit` };

  if (!created) {
    await googleRequest(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet.id}/values/${encodeURIComponent('Creators!A:O')}:clear`, {
      method: 'POST', body: '{}',
    }).catch(async () => googleRequest(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet.id}/values/${encodeURIComponent('A:O')}:clear`, { method: 'POST', body: '{}' }));
  }
  await googleRequest(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet.id}/values/A1?valueInputOption=USER_ENTERED`,
    { method: 'PUT', body: JSON.stringify({ range: 'A1', majorDimension: 'ROWS', values: sheetValues(project) }) },
  );
  if (created) {
    await googleRequest(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet.id}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ requests: [
        { updateSheetProperties: { properties: { sheetId: 0, title: 'Creators', gridProperties: { frozenRowCount: 4 } }, fields: 'title,gridProperties.frozenRowCount' } },
        { mergeCells: { range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 15 }, mergeType: 'MERGE_ALL' } },
        { mergeCells: { range: { sheetId: 0, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 15 }, mergeType: 'MERGE_ALL' } },
        { mergeCells: { range: { sheetId: 0, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 15 }, mergeType: 'MERGE_ALL' } },
        { repeatCell: { range: { sheetId: 0, startRowIndex: 0, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 15 }, cell: { userEnteredFormat: { horizontalAlignment: 'CENTER', textFormat: { bold: true } } }, fields: 'userEnteredFormat(horizontalAlignment,textFormat)' } },
        { repeatCell: { range: { sheetId: 0, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: 15 }, cell: { userEnteredFormat: { backgroundColor: { red: .31, green: .51, blue: .74 }, textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }, horizontalAlignment: 'CENTER' } }, fields: 'userEnteredFormat' } },
        { autoResizeDimensions: { dimensions: { sheetId: 0, dimension: 'COLUMNS', startIndex: 0, endIndex: 15 } } },
      ] }),
    });
  }
  const brandEmail = project.mst_brand.brd_email?.trim();
  if (shareWithBrandEmail && brandEmail) await shareWithBrand(spreadsheet.id, brandEmail);
  await prisma.trs_project.update({
    where: { prj_id: projectId },
    data: { prj_sheetid: spreadsheet.id, prj_sheeturl: spreadsheet.url, prj_sheet_sync: new Date() },
  });
  return { spreadsheetId: spreadsheet.id, spreadsheetUrl: spreadsheet.url, email: brandEmail };
}
