import { describe, it, expect, beforeEach } from 'vitest';
import { StorageManager } from '../src/js/storage.js';

let dbCounter = 0;
// We monkeypatch DB_NAME for testing to isolate tests
describe('StorageManager', () => {
    beforeEach(() => {
        dbCounter++;
        // Monkey patch openDB to use unique DB per test
        StorageManager.openDB = () => {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open('TestDB_' + dbCounter, 1);
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
    });

    it('should save and retrieve a setting correctly', async () => {
        await StorageManager.setSetting('theme', 'dark');
        const value = await StorageManager.getSetting('theme', 'light');
        expect(value).toBe('dark');
    });

    it('should return default value if setting does not exist', async () => {
        const value = await StorageManager.getSetting('unknown_key', 'default_value');
        expect(value).toBe('default_value');
    });

    it('should save, retrieve, and delete a video recording', async () => {
        const recording = {
            id: 'rec_123',
            timestamp: new Date().toISOString(),
            questionId: 'q1',
            questionText: 'Test question?',
            category: 'General',
            packKey: 'adult',
            blob: new Blob(['fake video data'], { type: 'video/mp4' }),
            duration: 10,
            mimeType: 'video/mp4'
        };

        // Save
        await StorageManager.saveRecording(recording);
        
        // Retrieve
        const recordings = await StorageManager.getAllRecordings();
        expect(recordings.length).toBe(1);
        expect(recordings[0].id).toBe('rec_123');
        expect(recordings[0].questionText).toBe('Test question?');

        // Delete
        await StorageManager.deleteRecording('rec_123');
        const recordingsAfterDelete = await StorageManager.getAllRecordings();
        expect(recordingsAfterDelete.length).toBe(0);
    });
});
