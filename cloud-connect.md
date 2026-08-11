# VideoLog Cloud Connection Guide

Since VideoLog is a Local-First application with no backend server, it must connect directly to Google Drive and Dropbox from your browser using **OAuth 2.0 for Single Page Applications (SPA)**.

To do this safely, you need to create "Developer Applications" on both platforms. This will generate **Client IDs** that we will safely embed in the app.

Here is the step-by-step guide to generating these IDs.

---

## 1. Google Drive ☁️

For Google Drive, we will request the `drive.file` scope. This is highly secure because it **only allows VideoLog to see and modify files and folders it created itself**. It cannot read the rest of the user's Google Drive.

### Steps:
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click **Select a project** (top left) and click **New Project**. Name it `VideoLog` and create it.
3. Once created, make sure the project is selected.
4. Go to **APIs & Services > Library**.
5. Search for **Google Drive API** and click **Enable**.
6. Go to **APIs & Services > OAuth consent screen**.
    * Choose **External** and click Create.
    * App name: `VideoLog`.
    * User support email: (Your email).
    * Developer contact info: (Your email).
    * Save and Continue.
    * On the **Scopes** screen, you don't necessarily need to add them here, but we will use `https://www.googleapis.com/auth/drive.file` in the code. Save and Continue.
    * Add yourself as a **Test User** (you can publish the app later so anyone can use it without warnings).
7. Go to **APIs & Services > Credentials**.
    * Click **Create Credentials > OAuth client ID**.
    * Application type: **Web application**.
    * Name: `VideoLog Web Client`.
    * **Authorized JavaScript origins**: Add `https://misterbenj34.github.io` (and `http://localhost:5173` or whatever local port you use for testing).
    * **Authorized redirect URIs**: Add `https://misterbenj34.github.io/videolog/` (and your local equivalent, e.g., `http://localhost:5173/`).
    * Click **Create**.
8. **Copy your Client ID**. (It looks like `123456789-abcde...apps.googleusercontent.com`). *You do not need the Client Secret.*

---

## 2. Dropbox 📦

For Dropbox, the most secure and elegant way is to request an **App Folder**. This automatically creates a dedicated folder at `/Apps/VideoLog/` in the user's Dropbox. The app is physically locked into this folder and cannot access anything else.

### Steps:
1. Go to the [Dropbox App Console](https://www.dropbox.com/developers/apps).
2. Click **Create app**.
3. Choose **Scoped access**.
4. Choose **App folder** (Access to a single folder created specifically for your app).
5. Name your app: `VideoLog Time Capsule` (or similar, names must be globally unique across all of Dropbox).
6. Click **Create app**.
7. You will be redirected to the App's settings page.
8. Go to the **Permissions** tab.
    * Check `files.content.write` (required to upload files).
    * Check `files.content.read` (required to check if the folder exists).
    * Click **Submit** at the bottom to save permissions.
9. Go back to the **Settings** tab.
10. In the **OAuth 2** section, look for **Redirect URIs**.
    * Add `https://misterbenj34.github.io/videolog/`
    * Add your local testing URL (e.g., `http://localhost:5173/`).
11. **Copy your App key** (This is the Client ID). *You do not need the App secret.*

---

## What's Next?

Once you have both the **Google Client ID** and the **Dropbox App Key**, paste them in the chat. We will then inject them into the new `cloud.js` adapter and build the 3rd tab in the UI!