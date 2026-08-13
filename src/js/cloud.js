import { StorageManager } from './storage.js';

const G_CLIENT_ID = '55592301156-b9pu43spvt29q4l9g6bnf9qaareao6pf.apps.googleusercontent.com';
const G_SCOPE = 'https://www.googleapis.com/auth/drive.file';

class GoogleDriveAdapter {
    constructor() {
        this.token = null;
    }

    async init() {
        this.token = await StorageManager.getSetting('gdrive_token', null);
    }

    isConnected() {
        return !!this.token;
    }

    login() {
        // Compute base redirect URI ensuring no trailing hash or search queries
        let redirectUri = window.location.origin + window.location.pathname;
        if (!redirectUri.endsWith('/')) redirectUri += '/';
        
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${G_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(G_SCOPE)}&include_granted_scopes=true`;
        window.location.href = authUrl;
    }

    async logout() {
        this.token = null;
        await StorageManager.setSetting('gdrive_token', null);
        await StorageManager.setSetting('gdrive_folder_id', null);
    }

    async handleCallback(hash) {
        const params = new URLSearchParams(hash.substring(1));
        if (params.has('access_token')) {
            this.token = params.get('access_token');
            await StorageManager.setSetting('gdrive_token', this.token);
            return true;
        }
        return false;
    }

    async getFolderId() {
        // First check cache
        let folderId = await StorageManager.getSetting('gdrive_folder_id', null);
        if (folderId) return folderId;

        // Search for 'VideoLog' folder created by this app
        const query = encodeURIComponent("name='VideoLog' and mimeType='application/vnd.google-apps.folder' and trashed=false");
        const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        
        if (res.status === 401) { 
            await this.logout(); 
            throw new Error('Unauthorized'); 
        }
        
        const data = await res.json();
        if (data.files && data.files.length > 0) {
            folderId = data.files[0].id;
            await StorageManager.setSetting('gdrive_folder_id', folderId);
            return folderId;
        }

        // Folder doesn't exist, create it
        const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${this.token}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ 
                name: 'VideoLog', 
                mimeType: 'application/vnd.google-apps.folder' 
            })
        });
        
        const createData = await createRes.json();
        folderId = createData.id;
        await StorageManager.setSetting('gdrive_folder_id', folderId);
        return folderId;
    }

    async uploadVideo(recordingObj, onProgress = null) {
        if (!this.token) throw new Error('Not connected to Google Drive');
        const folderId = await this.getFolderId();

        // 1. Initialize resumable upload protocol
        const metadata = {
            name: recordingObj.fileName,
            parents: [folderId]
        };

        const initRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json',
                'X-Upload-Content-Type': recordingObj.mimeType,
                'X-Upload-Content-Length': recordingObj.blob.size
            },
            body: JSON.stringify(metadata)
        });

        if (initRes.status === 401) { 
            await this.logout(); 
            throw new Error('Unauthorized'); 
        }

        const uploadUrl = initRes.headers.get('Location');
        if (!uploadUrl) throw new Error('Failed to obtain upload URL');

        // 2. Upload the binary data (Blob)
        // Note: For files > 256MB this should be chunked, but standard webcams ~5mins are safe in one PUT
        const uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Length': recordingObj.blob.size
            },
            body: recordingObj.blob
        });

        if (!uploadRes.ok) {
            throw new Error(`Upload failed with status ${uploadRes.status}`);
        }
        
        return true;
    }
}

export const CloudManager = {
    gdrive: new GoogleDriveAdapter(),
    
    async init() {
        await this.gdrive.init();
    },
    
    async handleAuthCallback(hash) {
        if (hash && hash.includes('access_token=')) {
            return await this.gdrive.handleCallback(hash);
        }
        return false;
    }
};