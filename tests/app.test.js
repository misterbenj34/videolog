import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { App } from '../src/js/app.js';
import { CloudManager } from '../src/js/cloud.js'; // Needed to mock CloudManager

const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

// Mock browser APIs not available in JSDOM
beforeEach(() => {
    // DOM setup
    document.documentElement.innerHTML = html;

    // Reset mocks
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
    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:test-url');
});

describe('App UI Interactions', () => {
    let app;

    beforeEach(async () => {
        app = new App();
        window.app = app; // Expose globally for inline DOM click handlers
        
        // Define global inline handlers (they are bound in app.js at the bottom normally)
        window.playVideo = function(id) { if(window.app) window.app.openVideoModal(id); };
        window.deleteVideo = function(id) { if(window.app) window.app.deleteVideo(id); };
        
        // Workaround for JSDOM evaluating onclick strings
        document.defaultView.playVideo = window.playVideo;
        document.defaultView.deleteVideo = window.deleteVideo;
        
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

    it('should switch to cloud view when cloud nav button is clicked', () => {
        document.getElementById('nav-cloud').click();
        expect(app.currentView).toBe('cloud');
        expect(document.getElementById('view-dashboard').classList.contains('hidden')).toBe(true);
        expect(document.getElementById('view-cloud').classList.contains('hidden')).toBe(false);
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

    it('should update username and reflect in UI', async () => {
        app.switchView('settings');
        // Wait for settings to render (renderSettings is async)
        await new Promise(resolve => setTimeout(resolve, 50));

        const input = document.getElementById('username-input');
        input.value = 'Alice';
        input.dispatchEvent(new Event('change'));
        
        await new Promise(resolve => setTimeout(resolve, 50)); // let async handlers settle
        expect(app.username).toBe('Alice');
        expect(document.getElementById('header-username').textContent).toBe('Alice');
    });

    it('should update language and re-translate UI', async () => {
        app.switchView('settings');
        // Wait for settings to render
        await new Promise(resolve => setTimeout(resolve, 50));

        const select = document.getElementById('language-selector');
        select.value = 'fr';
        select.dispatchEvent(new Event('change'));
        
        await new Promise(resolve => setTimeout(resolve, 50)); // let async handlers settle
        expect(app.currentLang).toBe('fr');
        expect(document.querySelector('[data-i18n="manifestoTitle"]').textContent).toContain('Votre Capsule Temporelle');
    });

    it('should start recording timer and toggle buttons', async () => {
        // Must setup canvas manually because JSDOM drops methods from prototype mock sometimes
        const canvas = document.getElementById('recorder-canvas');
        canvas.captureStream = vi.fn().mockReturnValue({ addTrack: vi.fn(), getTracks: () => [] });
        
        document.getElementById('start-session-btn').click();
        await new Promise(resolve => setTimeout(resolve, 50)); // init camera
        
        document.getElementById('record-btn').click(); // trigger startRecording
        
        expect(document.getElementById('record-btn').classList.contains('hidden')).toBe(true);
        expect(document.getElementById('stop-btn').classList.contains('hidden')).toBe(false);
        expect(document.getElementById('timer-overlay').classList.contains('hidden')).toBe(false);
        expect(document.getElementById('timer-display').textContent).toBe('00:00');
        expect(app.mediaRecorder.state).toBe('recording');
        
        app.stopRecording(); // Cleanup timer
    });

    it('should open and populate video modal', async () => {
        // Need to create a fake recording first
        const { StorageManager } = await import('../src/js/storage.js');
        await StorageManager.saveRecording({
            id: 'rec_modal_test',
            timestamp: new Date().toISOString(),
            questionId: 'q1',
            questionText: 'Test question?',
            category: 'General',
            packKey: 'adult',
            blob: new Blob(['fake video data'], { type: 'video/mp4' }),
            duration: 10,
            mimeType: 'video/mp4'
        });

        // Mock play method on HTMLMediaElement for JSDOM
        window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue();
        window.HTMLMediaElement.prototype.pause = vi.fn();

        await app.renderDashboard();
        
        // Find the play button in the DOM
        const playBtn = document.querySelector(`button[onclick="window.playVideo('rec_modal_test')"]`);
        expect(playBtn).not.toBeNull();
        
        // JSDOM has sandbox isolation issues with inline onclick strings, so we call the function directly
        // after verifying the button is correctly wired in the generated DOM.
        window.playVideo('rec_modal_test');
        
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(document.getElementById('video-modal').classList.contains('hidden')).toBe(false);
        expect(document.getElementById('modal-category').textContent).toBe('General');
        expect(document.getElementById('modal-question').textContent).toBe('Test question?');
        expect(document.getElementById('modal-video').src).toContain('blob:test-url'); 
    });

    it('should prevent selecting more than 5 questions', async () => {
        app.switchView('settings');
        // Let's pretend user opens onboarding
        const { ALL_QUESTIONS } = await import('../src/js/packs.js');
        
        // Give app 5 questions
        app.activeQuestionIds = ['q1', 'q2', 'q3', 'q4', 'q5'];
        app.tempSelectedIds = ['q1', 'q2', 'q3', 'q4', 'q5'];
        
        // Mock the renderOnboardingList locally to test the click logic
        app.renderOnboardingList(ALL_QUESTIONS, app.tempSelectedIds);
        
        // Try to click an unselected question to select a 6th
        const firstUnselected = document.querySelector('.select-question-item:not([data-id="q1"]):not([data-id="q2"]):not([data-id="q3"]):not([data-id="q4"]):not([data-id="q5"])');
        if (firstUnselected) {
            firstUnselected.click();
            expect(window.alert).toHaveBeenCalledWith('You can select a maximum of 5 questions. Please unselect one first.');
            expect(app.tempSelectedIds.length).toBe(5); // Should still be 5
        }
    });

    it('should prevent unselecting the last active question in settings', async () => {
        app.switchView('settings');
        // App has 1 active question
        app.activeQuestionIds = ['situation-current'];
        await app.renderQuestionsEditor();

        // Try to uncheck the only checked checkbox
        const checkbox = document.querySelector('.toggle-question-checkbox[data-id="situation-current"]');
        expect(checkbox).not.toBeNull();
        
        checkbox.checked = false;
        checkbox.dispatchEvent(new Event('change'));
        
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(window.alert).toHaveBeenCalledWith('You must keep at least 1 active question.');
        expect(app.activeQuestionIds.length).toBe(1);
    });
    it('should delete video after confirmation', async () => {
        // Setup initial video
        const { StorageManager } = await import('../src/js/storage.js');
        await StorageManager.saveRecording({
            id: 'rec_delete_test',
            timestamp: new Date().toISOString(),
            questionId: 'q1',
            questionText: 'To be deleted',
            category: 'General',
            blob: new Blob([]),
            duration: 5,
            mimeType: 'video/mp4'
        });

        await app.renderDashboard();
        expect((await StorageManager.getAllRecordings()).length).toBeGreaterThan(0);
        
        // Find the delete button in the DOM
        const deleteBtn = document.querySelector(`button[onclick="window.deleteVideo('rec_delete_test')"]`);
        expect(deleteBtn).not.toBeNull();
        
        // Call function directly due to JSDOM inline onclick sandbox
        window.deleteVideo('rec_delete_test');
        
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const allRecs = await StorageManager.getAllRecordings();
        expect(allRecs.find(r => r.id === 'rec_delete_test')).toBeUndefined();
    });
});
