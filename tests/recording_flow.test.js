import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { App } from '../src/js/app.js';
import { CloudManager } from '../src/js/cloud.js'; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

beforeEach(() => {
    document.documentElement.innerHTML = html;
    
    vi.stubGlobal('lucide', {
        createIcons: vi.fn()
    });

    vi.spyOn(CloudManager.gdrive, 'isConnected').mockReturnValue(false);
    vi.spyOn(CloudManager.gdrive, 'login').mockImplementation(() => {});
    vi.spyOn(CloudManager.gdrive, 'logout').mockResolvedValue();
    vi.spyOn(CloudManager.gdrive, 'uploadVideo').mockResolvedValue();
    vi.spyOn(CloudManager, 'init').mockResolvedValue();
    vi.spyOn(CloudManager, 'handleAuthCallback').mockResolvedValue(false);

    vi.stubGlobal('navigator', {
        ...navigator,
        mediaDevices: {
            getUserMedia: vi.fn().mockResolvedValue({
                getAudioTracks: () => [{ stop: vi.fn() }],
                getVideoTracks: () => [{ stop: vi.fn() }],
                getTracks: () => [{ stop: vi.fn() }]
            })
        },
        storage: { persist: vi.fn().mockResolvedValue(true) },
        serviceWorker: {
            register: vi.fn().mockResolvedValue({ update: vi.fn(), addEventListener: vi.fn() }),
            addEventListener: vi.fn()
        }
    });

    HTMLCanvasElement.prototype.getContext = function() {
        return {
            drawImage: vi.fn(), save: vi.fn(), scale: vi.fn(), restore: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(), fillText: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(), createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() })
        };
    };
    HTMLCanvasElement.prototype.captureStream = function() {
        return { addTrack: vi.fn(), getTracks: () => [] };
    };

    vi.stubGlobal('MediaRecorder', class {
        static isTypeSupported() { return true; }
        constructor() { this.state = 'inactive'; }
        start() { this.state = 'recording'; }
        stop() { 
            this.state = 'inactive';
            if (this.onstop) this.onstop();
        }
    });

    window.alert = vi.fn();
    window.confirm = vi.fn().mockReturnValue(true);
    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:test-url');
    window.URL.revokeObjectURL = vi.fn();
    
    // Stub URL for standard download
    window.showDirectoryPicker = vi.fn().mockRejectedValue(new Error('No user gesture'));
});

describe('Recording Flow Bug', () => {
    let app;

    beforeEach(async () => {
        app = new App();
        // REMOVED manual questions injection to test real flow
        await new Promise(resolve => setTimeout(resolve, 50)); 
    });

    it('should transition to next question or dashboard when recording is stopped', async () => {
        // Start session
        document.getElementById('start-session-btn').click();
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Start recording
        document.getElementById('record-btn').click();
        expect(app.mediaRecorder.state).toBe('recording');
        
        // Stop recording
        document.getElementById('stop-btn').click();
        
        // Let async saveCurrentRecording finish
        await new Promise(resolve => setTimeout(resolve, 50));

        // Wait, app.currentQuestionIndex should be 1 now
        expect(app.currentQuestionIndex).toBe(1);
        expect(document.getElementById('current-question-text').textContent).not.toBe('');
    });
});