# Google Sheets integration setup

TalentHub uses a Google Service Account to create one Google Spreadsheet per project, update its creator rows, share it with the brand, and email the stored link.

## Google Cloud preparation

1. Create or select a Google Cloud project.
2. Enable **Google Sheets API** and **Google Drive API**.
3. Create a Service Account under **IAM & Admin > Service Accounts**.
4. Create a JSON key for that Service Account. Keep this JSON outside the repository.
5. Recommended for Google Workspace: create a folder in a Shared Drive and grant the Service Account email **Content manager** access. Copy the folder ID from its URL.

## Environment variables

Add these values to `.env` locally and to the deployment environment:

```dotenv
GOOGLE_SERVICE_ACCOUNT_EMAIL="talenthub-sheets@your-project.iam.gserviceaccount.com"
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_FOLDER_ID="shared-drive-folder-id"
GOOGLE_SHEETS_BRAND_ROLE="writer"
```

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: `client_email` from the downloaded JSON key.
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`: `private_key` from the JSON key. Preserve line breaks as `\n`.
- `GOOGLE_DRIVE_FOLDER_ID`: optional, but strongly recommended. It can point to a Shared Drive folder accessible by the Service Account.
- `GOOGLE_SHEETS_BRAND_ROLE`: `writer` allows the brand to edit; use `reader` for view-only access.

Existing SMTP variables are still required because TalentHub sends its own branded email containing the Google Sheet link.

## Personal Google Drive (OAuth)

A Service Account has no personal Drive storage quota. If `GOOGLE_DRIVE_FOLDER_ID` points to a normal **My Drive** folder instead of a Google Workspace **Shared Drive**, authenticate as the human Google account that owns the folder:

```dotenv
GOOGLE_OAUTH_CLIENT_ID="your-oauth-client-id.apps.googleusercontent.com"
GOOGLE_OAUTH_CLIENT_SECRET="your-oauth-client-secret"
GOOGLE_OAUTH_REFRESH_TOKEN="your-offline-refresh-token"
```

When all three OAuth variables are present, TalentHub uses OAuth instead of the Service Account. Request the `drive` and `spreadsheets` scopes and offline access when generating the refresh token. The authenticated Google user then owns the generated spreadsheets and their normal Drive quota is used.

## Database migration

Apply the migration before using the integration:

```bash
npx prisma migrate deploy
npx prisma generate
```

The project stores `prj_sheetid`, `prj_sheeturl`, and the latest synchronization time. Repeated sends update the same spreadsheet instead of creating duplicates.
