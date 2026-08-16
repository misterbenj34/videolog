import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageManager } from '../src/js/storage.js';
import { CloudManager } from '../src/js/cloud.js';

let dbCounter = 0;

describe('CloudManager / GoogleDriveAdapter', () => {
    beforeEach(() => {
        dbCounter++;
        // Isolate IndexedDB per test, same pattern as storage.test.js
        StorageManager.openDB = () => {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open('CloudTestDB_' + dbCounter, 1);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result);
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains('recordings')) {
                        db.createObjectStore('recordings', { keyPath: 'id' });
                    }
                    if (!db.objectStoreNames.contains('settings')) {
                        db.createObjectStore('settings', { keyPath: 'key' });
                    }
                };
            });
        };

        // Reset adapter in-memory state between tests
        CloudManager.gdrive.token = null;
        CloudManager.gdrive.tokenExpiresAt = null;

        vi.stubGlobal('fetch', vi.fn());
    });

    describe('isConnected / isTokenExpired', () => {
        it('should report not connected when there is no token', () => {
            expect(CloudManager.gdrive.isConnected()).toBe(false);
            expect(CloudManager.gdrive.isTokenExpired()).toBe(false);
        });

        it('should report connected once a token is set', () => {
            CloudManager.gdrive.token = 'fake-token';
            expect(CloudManager.gdrive.isConnected()).toBe(true);
        });

        it('should not report expired when expiry is in the future', () => {
            CloudManager.gdrive.token = 'fake-token';
            CloudManager.gdrive.tokenExpiresAt = Date.now() + 60000;
            expect(CloudManager.gdrive.isTokenExpired()).toBe(false);
        });

        it('should report expired when expiry is in the past', () => {
            CloudManager.gdrive.token = 'fake-token';
            CloudManager.gdrive.tokenExpiresAt = Date.now() - 1000;
            expect(CloudManager.gdrive.isTokenExpired()).toBe(true);
        });

        it('should conservatively report not expired when no expiry was ever captured (legacy token)', () => {
            CloudManager.gdrive.token = 'fake-token';
            CloudManager.gdrive.tokenExpiresAt = null;
            expect(CloudManager.gdrive.isTokenExpired()).toBe(false);
        });
    });

    describe('handleCallback', () => {
        it('should extract and persist the access token and its computed expiry', async () => {
            const before = Date.now();
            const handled = await CloudManager.gdrive.handleCallback('#access_token=abc123&expires_in=3600&token_type=Bearer');
            const after = Date.now();

            expect(handled).toBe(true);
            expect(CloudManager.gdrive.token).toBe('abc123');
            expect(CloudManager.gdrive.tokenExpiresAt).toBeGreaterThanOrEqual(before + 3600 * 1000);
            expect(CloudManager.gdrive.tokenExpiresAt).toBeLessThanOrEqual(after + 3600 * 1000);

            const savedToken = await StorageManager.getSetting('gdrive_token', null);
            expect(savedToken).toBe('abc123');
        });

        it('should return false when the hash has no access_token', async () => {
            const handled = await CloudManager.gdrive.handleCallback('#error=access_denied');
            expect(handled).toBe(false);
            expect(CloudManager.gdrive.token).toBeNull();
        });

        it('should default to a 1 hour expiry if expires_in is missing', async () => {
            const before = Date.now();
            await CloudManager.gdrive.handleCallback('#access_token=xyz');
            expect(CloudManager.gdrive.tokenExpiresAt).toBeGreaterThanOrEqual(before + 3600 * 1000 - 100);
        });
    });

    describe('logout', () => {
        it('should clear the token, expiry and cached folder id', async () => {
            CloudManager.gdrive.token = 'fake-token';
            CloudManager.gdrive.tokenExpiresAt = Date.now() + 60000;
            await StorageManager.setSetting('gdrive_folder_id', 'folder123');

            await CloudManager.gdrive.logout();

            expect(CloudManager.gdrive.token).toBeNull();
            expect(CloudManager.gdrive.tokenExpiresAt).toBeNull();
            expect(await StorageManager.getSetting('gdrive_token', null)).toBeNull();
            expect(await StorageManager.getSetting('gdrive_folder_id', null)).toBeNull();
        });
    });

    describe('getFolderId', () => {
        beforeEach(() => {
            CloudManager.gdrive.token = 'fake-token';
            CloudManager.gdrive.tokenExpiresAt = Date.now() + 60000;
        });

        it('should throw Unauthorized and log out without calling fetch if the token is already expired', async () => {
            CloudManager.gdrive.tokenExpiresAt = Date.now() - 1000;
            await expect(CloudManager.gdrive.getFolderId()).rejects.toThrow('Unauthorized');
            expect(fetch).not.toHaveBeenCalled();
            expect(CloudManager.gdrive.token).toBeNull();
        });

        it('should return the cached folder id without hitting the network', async () => {
            await StorageManager.setSetting('gdrive_folder_id', 'cached_folder_id');
            const id = await CloudManager.gdrive.getFolderId();
            expect(id).toBe('cached_folder_id');
            expect(fetch).not.toHaveBeenCalled();
        });

        it('should find and cache an existing VideoLog folder', async () => {
            fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ files: [{ id: 'existing_folder_id' }] })
            });

            const id = await CloudManager.gdrive.getFolderId();
            expect(id).toBe('existing_folder_id');
            expect(await StorageManager.getSetting('gdrive_folder_id', null)).toBe('existing_folder_id');
        });

        it('should create a new VideoLog folder when none exists', async () => {
            fetch
                .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ files: [] }) })
                .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 'new_folder_id' }) });

            const id = await CloudManager.gdrive.getFolderId();
            expect(id).toBe('new_folder_id');
            expect(fetch).toHaveBeenCalledTimes(2);
            expect(await StorageManager.getSetting('gdrive_folder_id', null)).toBe('new_folder_id');
        });

        it('should logout and throw Unauthorized if the search request returns 401', async () => {
            fetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });
            await expect(CloudManager.gdrive.getFolderId()).rejects.toThrow('Unauthorized');
            expect(CloudManager.gdrive.token).toBeNull();
        });

        it('should throw a descriptive error if the search request fails for a non-auth reason', async () => {
            fetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
            await expect(CloudManager.gdrive.getFolderId()).rejects.toThrow(/500/);
        });

        it('should throw if the folder-creation request fails', async () => {
            fetch
                .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ files: [] }) })
                .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });

            await expect(CloudManager.gdrive.getFolderId()).rejects.toThrow(/Failed to create VideoLog folder/);
        });

        it('should logout and throw Unauthorized if folder creation returns 401', async () => {
            fetch
                .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ files: [] }) })
                .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });

            await expect(CloudManager.gdrive.getFolderId()).rejects.toThrow('Unauthorized');
            expect(CloudManager.gdrive.token).toBeNull();
        });
    });

    describe('uploadVideo', () => {
        const fakeRecording = {
            fileName: 'Videolog - Test - General - 20260101.mp4',
            mimeType: 'video/mp4',
            blob: new Blob(['fake video bytes'], { type: 'video/mp4' })
        };

        beforeEach(() => {
            CloudManager.gdrive.token = 'fake-token';
            CloudManager.gdrive.tokenExpiresAt = Date.now() + 60000;
        });

        it('should throw immediately if not connected', async () => {
            CloudManager.gdrive.token = null;
            await expect(CloudManager.gdrive.uploadVideo(fakeRecording)).rejects.toThrow('Not connected to Google Drive');
        });

        it('should perform the two-step resumable upload and succeed', async () => {
            fetch
                // getFolderId: search
                .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ files: [{ id: 'folder_id' }] }) })
                // init resumable upload
                .mockResolvedValueOnce({ ok: true, status: 200, headers: { get: () => 'https://upload.example.com/session123' } })
                // PUT the actual bytes
                .mockResolvedValueOnce({ ok: true, status: 200 });

            const result = await CloudManager.gdrive.uploadVideo(fakeRecording);
            expect(result).toBe(true);
            expect(fetch).toHaveBeenCalledTimes(3);

            // Verify the PUT request went to the resumable session URL with the blob as body
            const putCall = fetch.mock.calls[2];
            expect(putCall[0]).toBe('https://upload.example.com/session123');
            expect(putCall[1].method).toBe('PUT');
            expect(putCall[1].body).toBe(fakeRecording.blob);
        });

        it('should throw if the init request fails to return a Location header', async () => {
            fetch
                .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ files: [{ id: 'folder_id' }] }) })
                .mockResolvedValueOnce({ ok: true, status: 200, headers: { get: () => null } });

            await expect(CloudManager.gdrive.uploadVideo(fakeRecording)).rejects.toThrow('Failed to obtain upload URL');
        });

        it('should logout and throw Unauthorized if the init request returns 401', async () => {
            fetch
                .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ files: [{ id: 'folder_id' }] }) })
                .mockResolvedValueOnce({ ok: false, status: 401 });

            await expect(CloudManager.gdrive.uploadVideo(fakeRecording)).rejects.toThrow('Unauthorized');
            expect(CloudManager.gdrive.token).toBeNull();
        });

        it('should throw a descriptive error if the final PUT upload fails', async () => {
            fetch
                .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ files: [{ id: 'folder_id' }] }) })
                .mockResolvedValueOnce({ ok: true, status: 200, headers: { get: () => 'https://upload.example.com/session123' } })
                .mockResolvedValueOnce({ ok: false, status: 500 });

            await expect(CloudManager.gdrive.uploadVideo(fakeRecording)).rejects.toThrow(/Upload failed with status 500/);
        });
    });

    describe('CloudManager.handleAuthCallback', () => {
        it('should delegate to the gdrive adapter when the hash contains an access_token', async () => {
            const handled = await CloudManager.handleAuthCallback('#access_token=abc&expires_in=3600');
            expect(handled).toBe(true);
            expect(CloudManager.gdrive.token).toBe('abc');
        });

        it('should return false for an empty or irrelevant hash', async () => {
            expect(await CloudManager.handleAuthCallback('')).toBe(false);
            expect(await CloudManager.handleAuthCallback('#some_other_param=1')).toBe(false);
        });
    });

    describe('popup login (page stays unchanged)', () => {
        it('should open an OAuth popup and NOT navigate the main page', () => {
            const openSpy = vi.fn(() => ({}));
            vi.stubGlobal('open', openSpy);
            const loc = { href: 'http://localhost/' };
            vi.stubGlobal('location', loc);

            CloudManager.gdrive.login();

            expect(openSpy).toHaveBeenCalledTimes(1);
            const [url] = openSpy.mock.calls[0];
            expect(url).toContain('accounts.google.com/o/oauth2/v2/auth');
            expect(url).toContain('client_id=');
            // The page must NOT have been redirected away.
            expect(loc.href).toBe('http://localhost/');
            vi.unstubAllGlobals();
        });

        it('should fall back to in-page navigation if the popup is blocked', () => {
            const openSpy = vi.fn(() => null); // popup blocked
            vi.stubGlobal('open', openSpy);
            const loc = { href: 'http://localhost/' };
            vi.stubGlobal('location', loc);

            CloudManager.gdrive.login();

            expect(loc.href).toContain('accounts.google.com');
            vi.unstubAllGlobals();
        });

        it('should store the token and expiry via receiveToken', async () => {
            await CloudManager.gdrive.receiveToken('tok123', 3600);
            expect(CloudManager.gdrive.token).toBe('tok123');
            expect(CloudManager.gdrive.tokenExpiresAt).toBeGreaterThan(Date.now());
            expect(await StorageManager.getSetting('gdrive_token', null)).toBe('tok123');
        });
    });
});
