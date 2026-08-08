import { describe, it, expect } from 'vitest';
import { BrowserBridge } from '../src/js/browser.js';

describe('BrowserBridge', () => {
    it('should correctly identify the browser type', () => {
        // Mock userAgent for Firefox
        Object.defineProperty(navigator, 'userAgent', {
            value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0',
            configurable: true
        });
        expect(BrowserBridge.getBrowserType()).toBe('firefox');

        // Mock userAgent for Chrome
        Object.defineProperty(navigator, 'userAgent', {
            value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
            configurable: true
        });
        expect(BrowserBridge.getBrowserType()).toBe('chrome');

        // Mock userAgent for Safari
        Object.defineProperty(navigator, 'userAgent', {
            value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15',
            configurable: true
        });
        expect(BrowserBridge.getBrowserType()).toBe('safari');
    });

    it('should correctly report File System Access API support', () => {
        // Simulate missing API (Firefox/Safari)
        window.showDirectoryPicker = undefined;
        expect(BrowserBridge.supportsFileSystemAccess()).toBe(false);

        // Simulate supported API (Chromium)
        window.showDirectoryPicker = () => Promise.resolve({});
        expect(BrowserBridge.supportsFileSystemAccess()).toBe(true);
    });
});
