export class BrowserBridge {
    static getBrowserType() {
        const ua = navigator.userAgent;
        if (/firefox/i.test(ua)) return 'firefox';
        if (/safari/i.test(ua) && !/chrome/i.test(ua)) return 'safari';
        if (/edg/i.test(ua)) return 'edge';
        if (/chrome/i.test(ua)) return 'chrome';
        return 'other';
    }

    static supportsFileSystemAccess() {
        return typeof window.showDirectoryPicker === 'function';
    }

    static async saveFile(blob, fileName, dirHandleCallback) {
        const browser = this.getBrowserType();

        // 1. Chromium Desktop / PWA (Chrome, Edge) with File System Access API
        if (this.supportsFileSystemAccess() && browser !== 'safari') {
            try {
                const dirHandle = await dirHandleCallback();
                if (dirHandle) {
                    if ((await dirHandle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
                        await dirHandle.requestPermission({ mode: 'readwrite' });
                    }
                    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    return { success: true, method: 'filesystem' };
                }
            } catch (err) {
                if (err.name === 'AbortError') return { success: false, cancelled: true };
                console.warn('File System Access failed, falling back to download:', err);
            }
        }

        // 2. Fallback for Firefox, Safari, Mobile Browsers (Standard Download)
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return { success: true, method: 'download' };
    }
}
