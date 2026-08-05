import { StorageManager } from './storage.js';
import { QUESTION_PACKS, TRANSLATIONS } from './packs.js';

class App {
    constructor() {
        this.currentView = 'dashboard';
        this.activePackKey = 'adult';
        this.username = 'Benjamin';
        this.currentLang = 'en';
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.mediaStream = null;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.timerInterval = null;
        this.secondsElapsed = 0;
        this.maxSeconds = 300; // 5 minutes
        this.deferredPrompt = null;
        this.newWorker = null;

        this.initPWA();
        this.initListeners();
        this.loadAppData();
    }

    initPWA() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js').then((reg) => {
                // Check for updates on load & every 30 mins
                reg.update();
                setInterval(() => { reg.update(); }, 30 * 60 * 1000);

                const handleUpdateFound = () => {
                    const installingWorker = reg.installing;
                    if (!installingWorker) return;
                    installingWorker.addEventListener('statechange', () => {
                        if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.newWorker = installingWorker;
                            this.showUpdateModal();
                        }
                    });
                };

                if (reg.waiting && navigator.serviceWorker.controller) {
                    this.newWorker = reg.waiting;
                    this.showUpdateModal();
                }

                reg.addEventListener('updatefound', handleUpdateFound);
            });

            let refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!refreshing) {
                    refreshing = true;
                    window.location.reload();
                }
            });
        }

        document.getElementById('refresh-app-btn').addEventListener('click', () => {
            if (this.newWorker) {
                this.newWorker.postMessage({ type: 'SKIP_WAITING' });
            } else {
                window.location.reload();
            }
        });

        document.getElementById('dismiss-update-btn').addEventListener('click', () => {
            document.getElementById('update-modal').classList.add('hidden');
        });

        document.getElementById('close-modal-btn').addEventListener('click', () => {
            this.closeVideoModal();
        });

        // Install PWA Prompt handling
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            if (!sessionStorage.getItem('install_prompt_dismissed')) {
                document.getElementById('install-modal').classList.remove('hidden');
            }
        });

        document.getElementById('confirm-install-btn').addEventListener('click', async () => {
            document.getElementById('install-modal').classList.add('hidden');
            if (this.deferredPrompt) {
                this.deferredPrompt.prompt();
                const { outcome } = await this.deferredPrompt.userChoice;
                console.log(`User response to install prompt: ${outcome}`);
                this.deferredPrompt = null;
            }
        });

        document.getElementById('dismiss-install-btn').addEventListener('click', () => {
            document.getElementById('install-modal').classList.add('hidden');
            sessionStorage.setItem('install_prompt_dismissed', 'true');
        });
    }

    showUpdateModal() {
        document.getElementById('update-modal').classList.remove('hidden');
    }

    initListeners() {
        document.getElementById('start-session-btn').addEventListener('click', () => this.startSession());
        document.getElementById('scan-folder-btn').addEventListener('click', () => this.scanVideologFolder());
        document.getElementById('cancel-recorder-btn').addEventListener('click', () => this.stopCameraAndReturn());
        
        document.getElementById('nav-dashboard').addEventListener('click', () => this.switchView('dashboard'));
        document.getElementById('nav-settings').addEventListener('click', () => this.switchView('settings'));

        document.getElementById('record-btn').addEventListener('click', () => this.startRecording());
        document.getElementById('stop-btn').addEventListener('click', () => this.stopRecording());
    }

    async scanVideologFolder() {
        if (!window.showDirectoryPicker) {
            alert('File System Access API is not supported on this browser (try Chrome, Edge, or Desktop PWA).');
            return;
        }

        try {
            alert('Please select your "Videolog" folder to scan for existing recordings.');
            const dirHandle = await window.showDirectoryPicker();
            let count = 0;
            const dict = TRANSLATIONS[this.currentLang] || TRANSLATIONS['en'];

            for await (const entry of dirHandle.values()) {
                if (entry.kind === 'file' && entry.name.startsWith('Videolog -') && (entry.name.endsWith('.mp4') || entry.name.endsWith('.webm'))) {
                    const file = await entry.getFile();
                    
                    const parts = entry.name.replace(/\.[^/.]+$/, "").split(' - ');
                    const category = parts.length >= 3 ? parts[2] : 'General';
                    const timestampStr = parts.length >= 4 ? parts[3] : new Date().toISOString().slice(0,10);
                    
                    let isoDate = new Date().toISOString();
                    if (timestampStr.length === 8) {
                        const y = timestampStr.slice(0,4);
                        const m = timestampStr.slice(4,6);
                        const d = timestampStr.slice(6,8);
                        isoDate = new Date(`${y}-${m}-${d}`).toISOString();
                    }

                    const recordingObj = {
                        id: 'imported_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                        timestamp: isoDate,
                        questionId: 'imported',
                        questionText: entry.name,
                        category: category,
                        packKey: this.activePackKey,
                        blob: file,
                        duration: 0,
                        mimeType: file.type || 'video/mp4'
                    };

                    await StorageManager.saveRecording(recordingObj);
                    count++;
                }
            }

            if (count > 0) {
                alert(`${count} ${dict.importedCount}`);
                this.renderDashboard();
            } else {
                alert('No matching Videolog files found in this folder.');
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Error scanning folder:', err);
                alert('Error accessing folder. Please try again.');
            }
        }
    }

    async loadAppData() {
        await StorageManager.initPersistence();
        this.activePackKey = await StorageManager.getSetting('active_pack', 'adult');
        this.username = await StorageManager.getSetting('username', 'Benjamin');
        this.currentLang = await StorageManager.getSetting('language', 'en');
        
        this.loadQuestionsForActivePack();
        document.getElementById('header-username').textContent = this.username;
        this.applyTranslations();
        this.renderDashboard();
    }

    loadQuestionsForAppLang() {
        const packData = QUESTION_PACKS[this.activePackKey];
        return packData.questions.map(q => ({
            id: q.id,
            category: q.category[this.currentLang] || q.category['en'],
            text: q.text[this.currentLang] || q.text['en']
        }));
    }

    async loadQuestionsForActivePack() {
        const savedPacks = await StorageManager.getSetting('custom_packs', null);
        if (savedPacks && savedPacks[this.activePackKey]) {
            this.questions = savedPacks[this.activePackKey].questions;
        } else {
            this.questions = this.loadQuestionsForAppLang();
        }
    }

    applyTranslations() {
        const dict = TRANSLATIONS[this.currentLang] || TRANSLATIONS['en'];
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[key]) {
                el.textContent = dict[key];
            }
        });
    }

    switchView(viewName) {
        this.currentView = viewName;
        document.getElementById('view-dashboard').classList.add('hidden');
        document.getElementById('view-recorder').classList.add('hidden');
        document.getElementById('view-settings').classList.add('hidden');

        document.querySelectorAll('.nav-btn').forEach(btn => {
            const target = btn.getAttribute('data-target');
            if (target === viewName) {
                btn.classList.remove('text-slate-400');
                btn.classList.add('text-blue-400');
            } else {
                btn.classList.remove('text-blue-400');
                btn.classList.add('text-slate-400');
            }
        });

        if (viewName === 'dashboard') {
            document.getElementById('view-dashboard').classList.remove('hidden');
            this.renderDashboard();
        } else if (viewName === 'recorder') {
            document.getElementById('view-recorder').classList.remove('hidden');
            lucide.createIcons();
        } else if (viewName === 'settings') {
            document.getElementById('view-settings').classList.remove('hidden');
            this.renderSettings();
        }
    }

    async renderDashboard() {
        const recordings = await StorageManager.getAllRecordings();
        const container = document.getElementById('logs-container');
        const dict = TRANSLATIONS[this.currentLang] || TRANSLATIONS['en'];

        if (recordings.length === 0) {
            container.innerHTML = `
                <div class="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 text-center text-slate-400 text-xs">
                    ${dict.noSessions}
                </div>
            `;
            return;
        }

        container.innerHTML = recordings.map(rec => `
            <div class="bg-slate-800 border border-slate-700 rounded-lg p-3 flex justify-between items-center shadow-sm">
                <div class="min-w-0 pr-2">
                    <span class="text-[10px] text-blue-400 uppercase font-semibold block">${rec.category}</span>
                    <h4 class="font-medium text-white text-xs truncate">${rec.questionText}</h4>
                    <p class="text-[10px] text-slate-400 mt-0.5">${new Date(rec.timestamp).toLocaleDateString()} • ${Math.round(rec.duration)}s</p>
                </div>
                <button onclick="window.playVideo('${rec.id}')" class="bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white px-2.5 py-1.5 rounded text-xs font-semibold transition shrink-0">
                    ${dict.play}
                </button>
            </div>
        `).join('');
    }

    async renderSettings() {
        document.getElementById('username-input').value = this.username;
        document.getElementById('language-selector').value = this.currentLang;

        const packSelector = document.getElementById('pack-selector');
        packSelector.innerHTML = Object.keys(QUESTION_PACKS).map(key => `
            <option value="${key}" ${key === this.activePackKey ? 'selected' : ''}>${QUESTION_PACKS[key].name[this.currentLang] || QUESTION_PACKS[key].name['en']}</option>
        `).join('');

        this.renderQuestionsEditor();

        document.getElementById('username-input').onchange = async (e) => {
            this.username = e.target.value.trim() || 'User';
            document.getElementById('header-username').textContent = this.username;
            await StorageManager.setSetting('username', this.username);
        };

        document.getElementById('language-selector').onchange = async (e) => {
            this.currentLang = e.target.value;
            await StorageManager.setSetting('language', this.currentLang);
            this.applyTranslations();
            
            const savedPacks = await StorageManager.getSetting('custom_packs', null);
            if (!savedPacks || !savedPacks[this.activePackKey]) {
                this.questions = this.loadQuestionsForAppLang();
            }
            this.renderSettings();
        };

        packSelector.onchange = async (e) => {
            this.activePackKey = e.target.value;
            await StorageManager.setSetting('active_pack', this.activePackKey);
            
            const savedPacks = await StorageManager.getSetting('custom_packs', {});
            if (savedPacks[this.activePackKey]) {
                this.questions = savedPacks[this.activePackKey].questions;
            } else {
                this.questions = this.loadQuestionsForAppLang();
            }
            this.renderQuestionsEditor();
        };

        document.getElementById('add-question-btn').onclick = () => {
            this.questions.push({
                id: 'custom-' + Date.now(),
                category: 'General',
                text: 'New question text...'
            });
            this.saveAndRenderQuestions();
        };

        document.getElementById('download-ics-btn').onclick = () => this.downloadICS();
    }

    renderQuestionsEditor() {
        const listContainer = document.getElementById('questions-editor-list');
        const dict = TRANSLATIONS[this.currentLang] || TRANSLATIONS['en'];

        listContainer.innerHTML = this.questions.map((q, idx) => `
            <div class="bg-slate-900 border border-slate-700/80 rounded-lg p-3 space-y-2">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-mono text-blue-400 font-bold">#${idx + 1}</span>
                    <button onclick="window.removeQuestion(${idx})" class="text-red-400 hover:text-red-300 text-xs px-1.5 py-0.5 rounded">${dict.delete}</button>
                </div>
                <div class="space-y-1.5">
                    <input type="text" value="${q.category}" onchange="window.updateQuestionProp(${idx}, 'category', this.value)" class="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[11px] text-blue-300 font-medium focus:outline-none" placeholder="Category">
                    <textarea rows="2" onchange="window.updateQuestionProp(${idx}, 'text', this.value)" class="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-white focus:outline-none">${q.text}</textarea>
                </div>
            </div>
        `).join('');
    }

    async saveAndRenderQuestions() {
        const savedPacks = await StorageManager.getSetting('custom_packs', {});
        savedPacks[this.activePackKey] = { questions: this.questions };
        await StorageManager.setSetting('custom_packs', savedPacks);
        this.renderQuestionsEditor();
    }

    downloadICS() {
        const icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//VideoLog Time Capsule//EN',
            'BEGIN:VEVENT',
            'SUMMARY:VideoLog Time Capsule Session',
            'DESCRIPTION:Time to record your 6-month VideoLog time capsule and capture your mindset!',
            'FREQ=MONTHLY;INTERVAL=6',
            'ACTION:DISPLAY',
            'TRIGGER:-P1D',
            'END:VEVENT',
            'END:VCALENDAR'
        ].join('\r\n');

        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'videolog-reminder.ics';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    async startSession() {
        this.currentQuestionIndex = 0;
        this.switchView('recorder');
        await this.initCamera();
        this.loadCurrentQuestion();
    }

    async initCamera() {
        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: true
            });
            const videoEl = document.getElementById('camera-preview');
            videoEl.srcObject = this.mediaStream;
        } catch (err) {
            console.error('Error accessing camera:', err);
            alert('Unable to access camera and microphone. Please check permissions.');
            this.switchView('dashboard');
        }
    }

    loadCurrentQuestion() {
        const q = this.questions[this.currentQuestionIndex];
        document.getElementById('current-question-text').textContent = q.text;
        document.getElementById('current-category-badge').textContent = q.category || 'General';
        document.getElementById('question-counter').textContent = `Question ${this.currentQuestionIndex + 1} of ${this.questions.length}`;
        document.getElementById('record-btn').classList.remove('hidden');
        document.getElementById('stop-btn').classList.add('hidden');
        document.getElementById('timer-overlay').classList.add('hidden');
    }

    startRecording() {
        this.recordedChunks = [];
        const options = { mimeType: MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a.40.2') ? 'video/mp4;codecs=avc1,mp4a.40.2' : 'video/webm' };
        
        try {
            this.mediaRecorder = new MediaRecorder(this.mediaStream, options);
        } catch (e) {
            this.mediaRecorder = new MediaRecorder(this.mediaStream);
        }

        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                this.recordedChunks.push(e.data);
            }
        };

        this.mediaRecorder.onstop = () => this.saveCurrentRecording();

        this.mediaRecorder.start();
        document.getElementById('record-btn').classList.add('hidden');
        document.getElementById('stop-btn').classList.remove('hidden');
        document.getElementById('timer-overlay').classList.remove('hidden');

        this.secondsElapsed = 0;
        this.updateTimerDisplay();
        this.timerInterval = setInterval(() => {
            this.secondsElapsed++;
            this.updateTimerDisplay();
            if (this.secondsElapsed >= this.maxSeconds) {
                this.stopRecording();
            }
        }, 1000);
    }

    updateTimerDisplay() {
        const mins = Math.floor(this.secondsElapsed / 60).toString().padStart(2, '0');
        const secs = (this.secondsElapsed % 60).toString().padStart(2, '0');
        document.getElementById('timer-display').textContent = `${mins}:${secs}`;
    }

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        clearInterval(this.timerInterval);
    }

    async saveCurrentRecording() {
        const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder.mimeType || 'video/webm' });
        const q = this.questions[this.currentQuestionIndex];
        const recordingId = 'rec_' + Date.now();
        const dict = TRANSLATIONS[this.currentLang] || TRANSLATIONS['en'];

        const recordingObj = {
            id: recordingId,
            timestamp: new Date().toISOString(),
            questionId: q.id,
            questionText: q.text,
            category: q.category || 'General',
            packKey: this.activePackKey,
            blob: blob,
            duration: this.secondsElapsed,
            mimeType: blob.type
        };

        // 1. Save to IndexedDB
        await StorageManager.saveRecording(recordingObj);

        // 2. Automatically download locally formatted as: Videolog/Username/Category/YYYYMMDD
        const now = new Date();
        const yyyymmdd = now.toISOString().slice(0,10).replace(/-/g, '');
        const cleanUsername = this.username.replace(/[^a-zA-Z0-9-_]/g, '_');
        const cleanCategory = (q.category || 'General').replace(/[^a-zA-Z0-9-_]/g, '_');
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
        a.download = `Videolog/${cleanUsername}/${cleanCategory}/${yyyymmdd}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Advance to next question or finish session
        this.currentQuestionIndex++;
        if (this.currentQuestionIndex < this.questions.length) {
            this.loadCurrentQuestion();
        } else {
            alert(dict.sessionComplete);
            this.stopCameraAndReturn();
        }
    }

    stopCameraAndReturn() {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
        }
        clearInterval(this.timerInterval);
        this.switchView('dashboard');
    }

    async openVideoModal(id) {
        const recordings = await StorageManager.getAllRecordings();
        const rec = recordings.find(r => r.id === id);
        if (!rec || !rec.blob) {
            alert('Video blob not found in storage.');
            return;
        }

        const url = URL.createObjectURL(rec.blob);
        document.getElementById('modal-category').textContent = rec.category;
        document.getElementById('modal-question').textContent = rec.questionText;
        document.getElementById('modal-timestamp').textContent = new Date(rec.timestamp).toLocaleString();
        
        const videoEl = document.getElementById('modal-video');
        videoEl.src = url;
        videoEl.type = rec.mimeType || 'video/webm';
        
        document.getElementById('video-modal').classList.remove('hidden');
        videoEl.play().catch(e => console.log('Autoplay prevented:', e));
    }

    closeVideoModal() {
        const videoEl = document.getElementById('modal-video');
        videoEl.pause();
        videoEl.src = '';
        document.getElementById('video-modal').classList.add('hidden');
    }
}

// Global helpers for inline HTML callbacks & video replay
window.updateQuestionProp = function(idx, prop, value) {
    if (window.app && window.app.questions[window.app.questions.length > idx ? idx : 0]) {
        window.app.questions[idx][prop] = value;
        window.app.saveAndRenderQuestions();
    }
};

window.removeQuestion = function(idx) {
    if (window.app && window.app.questions.length > 1) {
        window.app.questions.splice(idx, 1);
        window.app.saveAndRenderQuestions();
    } else {
        alert('You must keep at least one question in the pack.');
    }
};

window.playVideo = function(id) {
    if (window.app) {
        window.app.openVideoModal(id);
    }
};

window.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
