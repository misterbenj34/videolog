import { StorageManager } from './storage.js';
import { ALL_QUESTIONS, TRANSLATIONS } from './packs.js';
import { BrowserBridge } from './browser.js';
import { CloudManager } from './cloud.js';

export class App {
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
        this.registration = null;
        this.dirHandle = null;

        // Canvas overlay rendering properties
        this.canvas = null;
        this.ctx = null;
        this.canvasAnimationId = null;

        this.initPWA();
        this.initListeners();
        this.loadAppData();
    }

    initPWA() {
        if ('serviceWorker' in navigator) {
            // The ?v= query param ensures we bypass HTTP cache for the worker file itself
            navigator.serviceWorker.register('./sw.js?v=0.6.5').then((reg) => {
                this.registration = reg;
                reg.update();
                setInterval(() => { reg.update(); }, 15 * 60 * 1000);
                if (reg.waiting) {
                    this.showUpdateModal(reg.waiting);
                }
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed') {
                                if (navigator.serviceWorker.controller) {
                                    this.showUpdateModal(newWorker);
                                }
                            }
                        });
                    }
                });
            }).catch(err => console.error('SW registration failed:', err));

            let refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!refreshing) {
                    refreshing = true;
                    window.location.reload();
                }
            });
        }

        document.getElementById('refresh-app-btn').addEventListener('click', () => {
            if (this.waitingWorker) {
                this.waitingWorker.postMessage({ type: 'SKIP_WAITING' });
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
                this.deferredPrompt = null;
            }
        });

        document.getElementById('dismiss-install-btn').addEventListener('click', () => {
            document.getElementById('install-modal').classList.add('hidden');
            sessionStorage.setItem('install_prompt_dismissed', 'true');
        });
    }

    showUpdateModal(worker) {
        this.waitingWorker = worker;
        document.getElementById('update-modal').classList.remove('hidden');
    }

    initListeners() {
        document.getElementById('start-session-btn').addEventListener('click', () => this.startSession());
        document.getElementById('scan-folder-btn').addEventListener('click', () => this.scanVideologFolder());
        document.getElementById('cancel-recorder-btn').addEventListener('click', () => this.stopCameraAndReturn());
        
        document.getElementById('nav-dashboard').addEventListener('click', () => this.switchView('dashboard'));
        document.getElementById('nav-settings').addEventListener('click', () => this.switchView('settings'));
        document.getElementById('nav-cloud').addEventListener('click', () => this.switchView('cloud'));

        document.getElementById('record-btn').addEventListener('click', () => this.startRecording());
        document.getElementById('stop-btn').addEventListener('click', () => this.stopRecording());

        document.getElementById('gdrive-connect-btn').addEventListener('click', () => {
            if (CloudManager.gdrive.isConnected()) {
                if (confirm('Disconnect Google Drive?')) {
                    CloudManager.gdrive.logout().then(() => this.renderCloud());
                }
            } else {
                CloudManager.gdrive.login();
            }
        });
    }

    async verifyPermission(fileHandle, readWrite) {
        const options = {};
        if (readWrite) {
            options.mode = 'readwrite';
        }
        if ((await fileHandle.queryPermission(options)) === 'granted') {
            return true;
        }
        if ((await fileHandle.requestPermission(options)) === 'granted') {
            return true;
        }
        return false;
    }

    async scanVideologFolder() {
        if (!BrowserBridge.supportsFileSystemAccess()) {
            alert('File System Access API is not supported in this browser (' + BrowserBridge.getBrowserType() + '). You can review recordings from Dashboard storage.');
            return;
        }

        try {
            const handle = await window.showDirectoryPicker();
            if (await this.verifyPermission(handle, true)) {
                this.dirHandle = handle;
                await StorageManager.setSetting('dirHandle', handle); // Persist across reloads
            }

            let count = 0;
            const dict = TRANSLATIONS[this.currentLang] || TRANSLATIONS['en'];

            for await (const entry of this.dirHandle.values()) {
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
                        packKey: 'imported',
                        blob: file,
                        duration: 0,
                        mimeType: file.type || 'video/mp4',
                        fileName: entry.name
                    };

                    await StorageManager.saveRecording(recordingObj);
                    count++;
                }
            }

            if (count > 0) {
                alert(`${count} ${dict.importedCount || 'recordings imported.'}`);
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
        await CloudManager.init();

        // Handle OAuth Callback if present in URL
        if (window.location.hash) {
            const handled = await CloudManager.handleAuthCallback(window.location.hash);
            if (handled) {
                // Clean the URL so the user doesn't bookmark the access token
                window.history.replaceState(null, '', window.location.pathname);
                // Immediately show cloud view so they see they are connected
                this.currentView = 'cloud';
            }
        }

        this.username = await StorageManager.getSetting('username', 'Benjamin');
        this.currentLang = await StorageManager.getSetting('language', 'en');
        
        try {
            const cachedHandle = await StorageManager.getSetting('dirHandle', null);
            if (cachedHandle) {
                this.dirHandle = cachedHandle;
            }
        } catch (e) {
            console.log("Could not load persisted directory handle", e);
        }

        const activeQ = await StorageManager.getSetting('activeQuestions', null);
        const { ALL_QUESTIONS } = await import('./packs.js');
        
        if (!activeQ) {
            const defaults = ALL_QUESTIONS.filter(q => q.defaultSelected).map(q => q.id);
            await StorageManager.setSetting('activeQuestions', defaults);
            this.activeQuestionIds = defaults;
            this.showOnboardingModal(ALL_QUESTIONS, defaults);
        } else {
            this.activeQuestionIds = activeQ;
        }

        document.getElementById('header-username').textContent = this.username;
        this.applyTranslations();
        this.renderDashboard();
    }

    showOnboardingModal(allQuestions, currentSelected) {
        const modal = document.getElementById('onboarding-modal');
        modal.classList.remove('hidden');
        this.renderOnboardingList(allQuestions, currentSelected);

        document.getElementById('skip-onboarding-btn').onclick = async () => {
            modal.classList.add('hidden');
            const defaults = allQuestions.filter(q => q.defaultSelected).map(q => q.id);
            this.activeQuestionIds = defaults;
            await StorageManager.setSetting('activeQuestions', defaults);
        };

        document.getElementById('save-onboarding-btn').onclick = async () => {
            if (this.tempSelectedIds.length === 0) {
                alert('Please select at least 1 question.');
                return;
            }
            modal.classList.add('hidden');
            this.activeQuestionIds = [...this.tempSelectedIds];
            await StorageManager.setSetting('activeQuestions', this.activeQuestionIds);
        };
    }

    renderOnboardingList(allQuestions, selectedIds) {
        this.tempSelectedIds = [...selectedIds];
        const container = document.getElementById('onboarding-questions-list');
        const counter = document.getElementById('onboarding-counter');
        const lang = this.currentLang;

        const updateUI = () => {
            counter.textContent = `${this.tempSelectedIds.length} / 5 selected`;
        };

        container.innerHTML = allQuestions.map(q => {
            const isSelected = this.tempSelectedIds.includes(q.id);
            const cat = (q.category[lang] || q.category['en']);
            const text = (q.text[lang] || q.text['en']);
            return `
                <div class="bg-slate-900 border ${isSelected ? 'border-blue-500 bg-blue-950/20' : 'border-slate-700'} rounded-xl p-3 flex items-start space-x-3 cursor-pointer transition select-question-item" data-id="${q.id}">
                    <input type="checkbox" ${isSelected ? 'checked' : ''} class="mt-1 w-4 h-4 text-blue-600 bg-slate-900 border-slate-700 rounded focus:ring-blue-500 pointer-events-none">
                    <div class="flex-1">
                        <span class="text-[10px] uppercase font-semibold text-blue-400">${cat}</span>
                        <p class="text-xs text-white mt-0.5">${text}</p>
                    </div>
                </div>
            `;
        }).join('');

        updateUI();

        container.querySelectorAll('.select-question-item').forEach(el => {
            el.addEventListener('click', () => {
                const id = el.dataset.id;
                const idx = this.tempSelectedIds.indexOf(id);
                if (idx > -1) {
                    this.tempSelectedIds.splice(idx, 1);
                } else {
                    if (this.tempSelectedIds.length >= 5) {
                        alert('You can select a maximum of 5 questions. Please unselect one first.');
                        return;
                    }
                    this.tempSelectedIds.push(id);
                }
                this.renderOnboardingList(allQuestions, this.tempSelectedIds);
            });
        });
    }

    async loadQuestionsForActivePack() {
        const { ALL_QUESTIONS } = await import('./packs.js');
        const activeIds = this.activeQuestionIds || ALL_QUESTIONS.filter(q => q.defaultSelected).map(q => q.id);
        
        this.questions = ALL_QUESTIONS
            .filter(q => activeIds.includes(q.id))
            .map(q => ({
                id: q.id,
                category: q.category[this.currentLang] || q.category['en'],
                text: q.text[this.currentLang] || q.text['en']
            }));
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
        document.getElementById('view-cloud').classList.add('hidden');

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
        } else if (viewName === 'cloud') {
            document.getElementById('view-cloud').classList.remove('hidden');
            this.renderCloud();
        }
    }

    renderCloud() {
        const dict = TRANSLATIONS[this.currentLang] || TRANSLATIONS['en'];
        const gStatus = document.getElementById('gdrive-status');
        const gBtn = document.getElementById('gdrive-connect-btn');
        const gBtnText = document.getElementById('gdrive-btn-text');

        if (CloudManager.gdrive.isConnected()) {
            gStatus.textContent = dict.connected || 'Connected (Ready to Backup)';
            gStatus.classList.remove('text-slate-400');
            gStatus.classList.add('text-green-400');
            
            gBtn.classList.remove('bg-slate-700', 'hover:bg-slate-600', 'border-slate-600');
            gBtn.classList.add('bg-red-900/40', 'hover:bg-red-900/60', 'border-red-800/50', 'text-red-400');
            gBtnText.textContent = dict.disconnect || 'Disconnect';
            gBtn.querySelector('i').setAttribute('data-lucide', 'log-out');
        } else {
            gStatus.textContent = dict.notConnected || 'Not connected';
            gStatus.classList.remove('text-green-400');
            gStatus.classList.add('text-slate-400');
            
            gBtn.classList.remove('bg-red-900/40', 'hover:bg-red-900/60', 'border-red-800/50', 'text-red-400');
            gBtn.classList.add('bg-slate-700', 'hover:bg-slate-600', 'border-slate-600', 'text-white');
            gBtnText.textContent = dict.connectGDrive || 'Connect Google Drive';
            gBtn.querySelector('i').setAttribute('data-lucide', 'log-in');
        }
        
        lucide.createIcons();
    }

    async renderDashboard() {
        const recordings = await StorageManager.getAllRecordings();
        const container = document.getElementById('logs-container');
        const dict = TRANSLATIONS[this.currentLang] || TRANSLATIONS['en'];

        if (recordings.length === 0) {
            container.innerHTML = `
                <div class="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 text-center text-slate-400 text-xs">
                    ${dict.noSessions || 'No sessions recorded yet.'}
                </div>
            `;
            return;
        }

        // Sort by timestamp descending
        recordings.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        container.innerHTML = recordings.map(rec => `
            <div class="bg-slate-800 border border-slate-700 rounded-lg p-3 flex justify-between items-center shadow-sm">
                <div class="min-w-0 pr-2">
                    <span class="text-[10px] text-blue-400 uppercase font-semibold block">${rec.category}</span>
                    <h4 class="font-medium text-white text-xs truncate">${rec.questionText}</h4>
                    <p class="text-[10px] text-slate-400 mt-0.5">
                        ${new Date(rec.timestamp).toLocaleDateString()} ${new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • ${Math.round(rec.duration)}s
                        ${rec.cloudSynced ? '<span class="ml-1 text-green-400" title="Backed up to cloud">☁️</span>' : ''}
                    </p>
                </div>
                <div class="flex space-x-1 shrink-0">
                    ${!rec.cloudSynced && CloudManager.gdrive.isConnected() ? `
                        <button onclick="window.uploadVideo('${rec.id}')" id="upload-btn-${rec.id}" class="bg-purple-600/20 text-purple-400 hover:bg-purple-600 hover:text-white p-1.5 rounded transition" title="Backup to Cloud">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                        </button>
                    ` : ''}
                    <button onclick="window.playVideo('${rec.id}')" class="bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white p-1.5 rounded transition" title="Play">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </button>
                    <button onclick="window.deleteVideo('${rec.id}')" class="bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white p-1.5 rounded transition" title="Delete">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            </div>
        `).join('');
    }

    async uploadVideoManual(id) {
        const recordings = await StorageManager.getAllRecordings();
        const rec = recordings.find(r => r.id === id);
        if (!rec || !rec.blob || !CloudManager.gdrive.isConnected()) return;

        const btn = document.getElementById(`upload-btn-${id}`);
        if (btn) {
            btn.classList.add('animate-pulse', 'opacity-50');
            btn.disabled = true;
        }

        try {
            await CloudManager.gdrive.uploadVideo(rec);
            rec.cloudSynced = true;
            await StorageManager.saveRecording(rec);
            this.renderDashboard();
        } catch (err) {
            console.error('Manual upload failed:', err);
            alert('Upload failed. Please check your connection or re-authenticate.');
            if (btn) {
                btn.classList.remove('animate-pulse', 'opacity-50');
                btn.disabled = false;
            }
        }
    }

    async deleteVideo(id) {
        if (!confirm('Are you sure you want to delete this recording?')) return;

        const recordings = await StorageManager.getAllRecordings();
        const rec = recordings.find(r => r.id === id);
        if (!rec) return;

        // 1. Delete from internal IndexedDB
        await StorageManager.deleteRecording(id);

        // 2. Try to delete the actual file from the OS folder if we have active folder permissions
        if (this.dirHandle && rec.fileName) {
            try {
                if (await this.verifyPermission(this.dirHandle, true)) {
                    await this.dirHandle.removeEntry(rec.fileName);
                    console.log(`Successfully deleted ${rec.fileName} from local file system.`);
                }
            } catch (err) {
                console.warn('Could not delete file from OS folder (it may have already been moved/deleted, or permission lost).', err);
            }
        }

        this.renderDashboard();
    }

    async renderSettings() {
        document.getElementById('username-input').value = this.username;
        document.getElementById('language-selector').value = this.currentLang;

        await this.renderQuestionsEditor();

        document.getElementById('username-input').addEventListener('change', async (e) => {
            this.username = e.target.value.trim() || 'User';
            document.getElementById('header-username').textContent = this.username;
            await StorageManager.setSetting('username', this.username);
        });

        document.getElementById('language-selector').addEventListener('change', async (e) => {
            this.currentLang = e.target.value;
            await StorageManager.setSetting('language', this.currentLang);
            this.applyTranslations();
            await this.renderSettings();
        });

        document.getElementById('download-ics-btn').onclick = () => this.downloadICS();
    }

    async renderQuestionsEditor() {
        const { ALL_QUESTIONS } = await import('./packs.js');
        const container = document.getElementById('questions-editor-list');
        const counter = document.getElementById('settings-counter');
        const lang = this.currentLang;
        const activeIds = this.activeQuestionIds || ALL_QUESTIONS.filter(q => q.defaultSelected).map(q => q.id);

        if (counter) {
            counter.textContent = `${activeIds.length} / 5 active`;
        }

        container.innerHTML = ALL_QUESTIONS.map(q => {
            const isActive = activeIds.includes(q.id);
            const cat = (q.category[lang] || q.category['en']);
            const text = (q.text[lang] || q.text['en']);
            return `
                <div class="bg-slate-900 border ${isActive ? 'border-blue-500/80 bg-blue-950/20' : 'border-slate-700'} rounded-xl p-3 flex items-start justify-between space-x-3">
                    <div class="flex items-start space-x-2.5 flex-1">
                        <input type="checkbox" ${isActive ? 'checked' : ''} class="mt-1 w-4 h-4 text-blue-600 bg-slate-900 border-slate-700 rounded focus:ring-blue-500 cursor-pointer toggle-question-checkbox" data-id="${q.id}">
                        <div>
                            <span class="text-[10px] uppercase font-semibold text-blue-400">${cat}</span>
                            <p class="text-xs text-white mt-0.5">${text}</p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.toggle-question-checkbox').forEach(chk => {
            chk.addEventListener('change', async (e) => {
                const id = e.target.dataset.id;
                if (e.target.checked) {
                    if (this.activeQuestionIds.length >= 5) {
                        alert('Maximum 5 questions allowed. Please uncheck one first.');
                        e.target.checked = false;
                        return;
                    }
                    this.activeQuestionIds.push(id);
                } else {
                    if (this.activeQuestionIds.length <= 1) {
                        alert('You must keep at least 1 active question.');
                        e.target.checked = true;
                        return;
                    }
                    this.activeQuestionIds = this.activeQuestionIds.filter(i => i !== id);
                }
                await StorageManager.setSetting('activeQuestions', this.activeQuestionIds);
                await this.renderQuestionsEditor();
            });
        });
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

            this.canvas = document.getElementById('recorder-canvas');
            this.ctx = this.canvas.getContext('2d');

            const renderOverlay = () => {
                if (this.currentView !== 'recorder') return;
                
                if (videoEl.readyState >= videoEl.HAVE_CURRENT_DATA) {
                    if (this.canvas.width !== videoEl.videoWidth || this.canvas.height !== videoEl.videoHeight) {
                        this.canvas.width = videoEl.videoWidth || 1280;
                        this.canvas.height = videoEl.videoHeight || 720;
                    }

                    this.ctx.save();
                    // Horizontal mirror for a natural selfie-camera feel
                    this.ctx.scale(-1, 1);
                    this.ctx.drawImage(videoEl, -this.canvas.width, 0, this.canvas.width, this.canvas.height);
                    this.ctx.restore();

                    this.drawTelemetryOverlay();
                }
                this.canvasAnimationId = requestAnimationFrame(renderOverlay);
            };

            if (this.canvasAnimationId) cancelAnimationFrame(this.canvasAnimationId);
            renderOverlay();

        } catch (err) {
            console.error('Error accessing camera:', err);
            alert('Unable to access camera and microphone. Please check permissions.');
            this.switchView('dashboard');
        }
    }

    drawTelemetryOverlay() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10) + ' ' + now.toTimeString().slice(0, 8);
        const q = this.questions[this.currentQuestionIndex] || {};
        const cat = (q.category || 'General').toUpperCase();
        const user = (this.username || 'BENJAMIN').toUpperCase();

        ctx.save();

        // 1. Top Left: Logo / Title badge (Subtle shadow, absolutely no background/border frames)
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText('⏳ VIDEOLOG', 40, 60);

        // 2. Top Right: REC Indicator (No boxes! Just the red dot and text with drop shadow)
        ctx.fillStyle = '#ef4444'; // Red dot
        ctx.beginPath();
        ctx.arc(w - 75, 53, 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px monospace';
        ctx.fillText('REC', w - 60, 60);

        // 3. Bottom Bar: Cinematic Full-Width Gradient (No rigid frames)
        ctx.shadowColor = 'transparent'; // Turn off shadow so gradient renders purely
        ctx.shadowBlur = 0;
        
        const grad = ctx.createLinearGradient(0, h - 90, 0, h);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(0.3, 'rgba(0, 0, 0, 0.6)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
        
        ctx.fillStyle = grad;
        // Fill the entire bottom edge cleanly, absolutely no strokeRect or framing!
        ctx.fillRect(0, h - 90, w, 90);

        // Restore shadow for crisp text readability over the gradient background
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 3;

        ctx.font = 'bold 16px monospace';
        ctx.fillStyle = '#60a5fa'; // Blue
        ctx.fillText(`USER: ${user}`, 40, h - 40);

        ctx.fillStyle = '#cbd5e1'; // Slate
        ctx.fillText(`•   ${dateStr}`, 220, h - 40);

        ctx.fillStyle = '#38bdf8'; // Light Blue
        ctx.fillText(`CATEGORY: ${cat}`, 40, h - 15);

        ctx.restore();
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
        
        const canvasStream = this.canvas.captureStream(30);
        const audioTracks = this.mediaStream.getAudioTracks();
        if (audioTracks.length > 0) {
            canvasStream.addTrack(audioTracks[0]);
        }

        const options = { mimeType: MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a.40.2') ? 'video/mp4;codecs=avc1,mp4a.40.2' : 'video/webm' };
        
        try {
            this.mediaRecorder = new MediaRecorder(canvasStream, options);
        } catch (e) {
            this.mediaRecorder = new MediaRecorder(canvasStream);
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

        const now = new Date();
        const yyyymmdd = now.toISOString().slice(0,10).replace(/-/g, '');
        const cleanUsername = this.username.replace(/[^a-zA-Z0-9-_]/g, '_');
        const cleanCategory = (q.category || 'General').replace(/[^a-zA-Z0-9-_]/g, '_');
        
        const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
        const fileName = `Videolog - ${cleanUsername} - ${cleanCategory} - ${yyyymmdd}.${ext}`;

        const recordingObj = {
            id: recordingId,
            timestamp: new Date().toISOString(),
            questionId: q.id,
            questionText: q.text,
            category: q.category || 'General',
            packKey: this.activePackKey,
            blob: blob,
            duration: this.secondsElapsed,
            mimeType: blob.type,
            fileName: fileName,
            cloudSynced: false
        };

        // Save internal metadata
        await StorageManager.saveRecording(recordingObj);

        // Upload to Cloud (if connected)
        if (CloudManager.gdrive.isConnected()) {
            try {
                // Show tiny indicator or just let it be background?
                // Background is fine for Option A, if it fails we just keep cloudSynced: false
                await CloudManager.gdrive.uploadVideo(recordingObj);
                recordingObj.cloudSynced = true;
                await StorageManager.saveRecording(recordingObj); // Update sync status
                console.log('Successfully backed up to Google Drive.');
            } catch (err) {
                console.error('Cloud upload failed:', err);
                // Fail silently for the user, they can retry in dashboard later
            }
        }

        // Save external file
        await BrowserBridge.saveFile(blob, fileName, async () => {
            if (!this.dirHandle) {
                alert('Please select your "Videolog" folder once. The app will remember it for future recordings.');
                const handle = await window.showDirectoryPicker();
                if (await this.verifyPermission(handle, true)) {
                    this.dirHandle = handle;
                    await StorageManager.setSetting('dirHandle', handle); // Persist across reloads
                }
            } else {
                // We have a stored handle, but we need to re-verify permissions before writing
                if (!(await this.verifyPermission(this.dirHandle, true))) {
                    console.warn("Permission to directory lost.");
                }
            }
            return this.dirHandle;
        });

        this.currentQuestionIndex++;
        if (this.currentQuestionIndex < this.questions.length) {
            this.loadCurrentQuestion();
        } else {
            alert(dict.sessionComplete || 'Session complete! Excellent work.');
            this.stopCameraAndReturn();
        }
    }

    stopCameraAndReturn() {
        if (this.canvasAnimationId) cancelAnimationFrame(this.canvasAnimationId);
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
    if (window.app) window.app.openVideoModal(id);
};

window.deleteVideo = function(id) {
    if (window.app) window.app.deleteVideo(id);
};

window.uploadVideo = function(id) {
    if (window.app) window.app.uploadVideoManual(id);
};

window.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
