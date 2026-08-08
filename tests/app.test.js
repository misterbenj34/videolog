import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { App } from '../src/js/app.js';

const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

// Mock browser APIs not available in JSDOM
beforeEach(() => {
    // DOM setup
    document.documentElement.innerHTML = html;

    // Reset mocks
    vi.stubGlobal('lucide', {
        createIcons: vi.fn()
    });

    vi.stubGlobal('navigator', {
        ...navigator,
        mediaDevices: {
            getUserMedia: vi.fn().mockResolvedValue({
                getAudioTracks: () => [{ stop: vi.fn() }],
                getVideoTracks: () => [{ stop: vi.fn() }],
                getTracks: () => [{ stop: vi.fn() }]
            })
        },
        storage: {
            persist: vi.fn().mockResolvedValue(true)
        },
        serviceWorker: {
            register: vi.fn().mockResolvedValue({
                update: vi.fn(),
                addEventListener: vi.fn()
            }),
            addEventListener: vi.fn()
        }
    });

    vi.stubGlobal('HTMLCanvasElement', class extends HTMLElement {
        captureStream() {
            return {
                addTrack: vi.fn(),
                getTracks: () => []
            };
        }
        getContext() {
            return {
                drawImage: vi.fn(),
                save: vi.fn(),
                scale: vi.fn(),
                restore: vi.fn(),
                fillRect: vi.fn(),
                strokeRect: vi.fn(),
                fillText: vi.fn(),
                beginPath: vi.fn(),
                arc: vi.fn(),
                fill: vi.fn(),
                createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() })
            };
        }
    });

    // We must mock the prototype for existing DOM elements since JSDOM already created them
    HTMLCanvasElement.prototype.getContext = function() {
        return {
            drawImage: vi.fn(),
            save: vi.fn(),
            scale: vi.fn(),
            restore: vi.fn(),
            fillRect: vi.fn(),
            strokeRect: vi.fn(),
            fillText: vi.fn(),
            beginPath: vi.fn(),
            arc: vi.fn(),
            fill: vi.fn(),
            createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() })
        };
    };
    HTMLCanvasElement.prototype.captureStream = function() {
        return { addTrack: vi.fn(), getTracks: () => [] };
    };

    vi.stubGlobal('MediaRecorder', class {
        static isTypeSupported() { return true; }
        constructor() {
            this.state = 'inactive';
        }
        start() { this.state = 'recording'; }
        stop() { 
            this.state = 'inactive';
            if (this.onstop) this.onstop();
        }
    });

    window.alert = vi.fn();
    window.confirm = vi.fn().mockReturnValue(true);
});

describe('App UI Interactions', () => {
    let app;

    beforeEach(async () => {
        app = new App();
        // Setup minimal questions for the UI mock
        app.questions = [{ id: 'q1', text: 'Test question', category: 'General' }];
        // Wait for async loadAppData to finish
        await new Promise(resolve => setTimeout(resolve, 50)); 
    });

    it('should display the dashboard view initially', () => {
        expect(document.getElementById('view-dashboard').classList.contains('hidden')).toBe(false);
        expect(document.getElementById('view-recorder').classList.contains('hidden')).toBe(true);
        expect(document.getElementById('view-settings').classList.contains('hidden')).toBe(true);
    });

    it('should switch to settings view when settings nav button is clicked', () => {
        document.getElementById('nav-settings').click();
        expect(app.currentView).toBe('settings');
        expect(document.getElementById('view-dashboard').classList.contains('hidden')).toBe(true);
        expect(document.getElementById('view-settings').classList.contains('hidden')).toBe(false);
    });

    it('should switch to dashboard view when dashboard nav button is clicked', () => {
        document.getElementById('nav-settings').click(); // switch away first
        document.getElementById('nav-dashboard').click();
        
        expect(app.currentView).toBe('dashboard');
        expect(document.getElementById('view-dashboard').classList.contains('hidden')).toBe(false);
        expect(document.getElementById('view-settings').classList.contains('hidden')).toBe(true);
    });

    it('should switch to recorder view and init camera when start session is clicked', async () => {
        const startBtn = document.getElementById('start-session-btn');
        expect(startBtn).not.toBeNull();
        
        startBtn.click();
        
        // Allow async camera init
        await new Promise(resolve => setTimeout(resolve, 50));
        
        expect(app.currentView).toBe('recorder');
        expect(document.getElementById('view-dashboard').classList.contains('hidden')).toBe(true);
        expect(document.getElementById('view-recorder').classList.contains('hidden')).toBe(false);
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    });

    it('should cancel recording and return to dashboard', async () => {
        document.getElementById('start-session-btn').click();
        await new Promise(resolve => setTimeout(resolve, 50)); // wait for init

        document.getElementById('cancel-recorder-btn').click();
        
        expect(app.currentView).toBe('dashboard');
        expect(document.getElementById('view-dashboard').classList.contains('hidden')).toBe(false);
        expect(document.getElementById('view-recorder').classList.contains('hidden')).toBe(true);
    });

    it('should have required UI elements loaded with text', () => {
        expect(document.getElementById('header-username').textContent).toBe('Benjamin');
        expect(document.querySelector('[data-i18n="manifestoTitle"]').textContent).toContain('Your Personal Time Capsule');
    });
});
