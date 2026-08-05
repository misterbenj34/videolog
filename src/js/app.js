import { StorageManager } from './storage.js';
import { QUESTION_PACKS } from './packs.js';

class App {
    constructor() {
        this.currentView = 'dashboard';
        this.activePackKey = 'adult';
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.mediaStream = null;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.timerInterval = null;
        this.secondsElapsed = 0;
        this.maxSeconds = 300; // 5 minutes

        this.initPWA();
        this.initListeners();
        this.loadAppData();
    }

    initPWA() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js').then((reg) => {
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            document.getElementById('update-banner').classList.remove('hidden');
                        }
                    });
                });
            });
        }

        document.getElementById('reload-btn').addEventListener('click', () => {
            window.location.reload();
        });
    }

    initListeners() {
        document.getElementById('start-session-btn').addEventListener('click', () => this.startSession());
        document.getElementById('cancel-recorder-btn').addEventListener('click', () => this.stopCameraAndReturn());
        document.getElementById('nav-dashboard').addEventListener('click', () => this.switchView('dashboard'));
        document.getElementById('nav-settings').addEventListener('click', () => this.switchView('settings'));

        document.getElementById('record-btn').addEventListener('click', () => this.startRecording());
        document.getElementById('stop-btn').addEventListener('click', () => this.stopRecording());
    }

    async loadAppData() {
        await StorageManager.initPersistence();
        this.activePackKey = await StorageManager.getSetting('active_pack', 'adult');
        this.questions = QUESTION_PACKS[this.activePackKey].questions;
        this.renderDashboard();
    }

    switchView(viewName) {
        this.currentView = viewName;
        document.getElementById('view-dashboard').classList.add('hidden');
        document.getElementById('view-recorder').classList.add('hidden');
        document.getElementById('view-settings').classList.add('hidden');

        if (viewName === 'dashboard') {
            document.getElementById('view-dashboard').classList.remove('hidden');
            this.renderDashboard();
        } else if (viewName === 'recorder') {
            document.getElementById('view-recorder').classList.remove('hidden');
        } else if (viewName === 'settings') {
            document.getElementById('view-settings').classList.remove('hidden');
            this.renderSettings();
        }
    }

    async renderDashboard() {
        const recordings = await StorageManager.getAllRecordings();
        const container = document.getElementById('logs-container');

        if (recordings.length === 0) {
            container.innerHTML = `
                <div class="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 text-center text-slate-400 text-sm">
                    No videologs recorded yet. Start your first session above!
                </div>
            `;
            return;
        }

        container.innerHTML = recordings.map(rec => `
            <div class="bg-slate-800 border border-slate-700 rounded-lg p-4 flex justify-between items-center">
                <div>
                    <h4 class="font-medium text-white text-sm">${rec.questionText}</h4>
                    <p class="text-xs text-slate-400 mt-1">${new Date(rec.timestamp).toLocaleDateString()} • ${Math.round(rec.duration)}s</p>
                </div>
                <button onclick="window.playVideo('${rec.id}')" class="bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white px-3 py-1.5 rounded text-xs font-semibold transition">
                    Play
                </button>
            </div>
        `).join('');
    }

    renderSettings() {
        const container = document.getElementById('view-settings');
        container.innerHTML = `
            <h2 class="text-lg font-semibold mb-4">Question Packs & Settings</h2>
            <div class="space-y-4">
                <div class="bg-slate-800 border border-slate-700 rounded-xl p-4">
                    <label class="block text-sm font-medium text-slate-300 mb-2">Select Active Question Pack</label>
                    <select id="pack-selector" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm">
                        ${Object.keys(QUESTION_PACKS).map(key => `
                            <option value="${key}" ${key === this.activePackKey ? 'selected' : ''}>${QUESTION_PACKS[key].name}</option>
                        `).join('')}
                    </select>
                </div>
                <div class="bg-slate-800 border border-slate-700 rounded-xl p-4">
                    <h3 class="text-sm font-medium text-slate-300 mb-2">Calendar Reminders</h3>
                    <p class="text-xs text-slate-400 mb-3">Download an ICS reminder file to set a recurring reminder every 6 months.</p>
                    <button id="download-ics-btn" class="bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold py-2 px-4 rounded-lg transition">
                        Download 6-Month Reminder (.ics)
                    </button>
                </div>
            </div>
        `;

        document.getElementById('pack-selector').addEventListener('change', async (e) => {
            this.activePackKey = e.target.value;
            this.questions = QUESTION_PACKS[this.activePackKey].questions;
            await StorageManager.setSetting('active_pack', this.activePackKey);
            alert('Active question pack updated!');
        });

        document.getElementById('download-ics-btn').addEventListener('click', () => this.downloadICS());
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

        const recordingObj = {
            id: recordingId,
            timestamp: new Date().toISOString(),
            questionId: q.id,
            questionText: q.text,
            packKey: this.activePackKey,
            blob: blob,
            duration: this.secondsElapsed,
            mimeType: blob.type
        };

        // 1. Save to IndexedDB
        await StorageManager.saveRecording(recordingObj);

        // 2. Automatically download to local device / camera roll
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
        a.download = `videolog-${q.id}-${new Date().toISOString().slice(0,10)}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Advance to next question or finish session
        this.currentQuestionIndex++;
        if (this.currentQuestionIndex < this.questions.length) {
            alert('Answer saved and downloaded! Moving to next question.');
            this.loadCurrentQuestion();
        } else {
            alert('Session complete! All answers recorded and saved locally.');
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
}

// Global play helper
window.playVideo = async function(id) {
    const recordings = await StorageManager.getAllRecordings();
    const rec = recordings.find(r => r.id === id);
    if (!rec) return;

    const url = URL.createObjectURL(rec.blob);
    const win = window.open();
    win.document.write(`
        <html>
        <head><title>VideoLog Playback</title></head>
        <body style="background:#0f172a; color:#fff; font-family:sans-serif; text-align:center; padding:20px;">
            <h3>${rec.questionText}</h3>
            <p>${new Date(rec.timestamp).toLocaleString()}</p>
            <video controls autoplay style="max-width:100%; max-height:80vh; border-radius:12px;"><source src="${url}" type="${rec.mimeType}"></video>
        </body>
        </html>
    `);
};

window.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
