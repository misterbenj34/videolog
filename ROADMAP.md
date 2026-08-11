# VideoLog - Architecture & Roadmap

## 🏗️ Project Architecture

VideoLog is built as a strictly **Local-First Progressive Web App (PWA)**. 
- **Frontend:** Vanilla JavaScript (ES Modules), HTML5, and Tailwind CSS. We avoided heavy frameworks (like React or Vue) to ensure maximum simplicity, performance, and long-term maintainability.
- **Storage:** `IndexedDB` is used for metadata, settings, and translations. The native OS File System is used for heavy media (video blobs). There are **zero backend servers**, ensuring absolute privacy.
- **Testing:** `Vitest` paired with `JSDOM` and `fake-indexeddb` for fast, comprehensive unit and UI integration testing.
- **CI/CD:** GitHub Actions pipeline configured to enforce tests (`npm test`) on every push, automatically deploying to GitHub Pages only if tests pass.
- **Modules (src/js/):**
  - `app.js`: Core UI controller, Camera capture, Canvas rendering overlay, and event orchestration.
  - `storage.js`: IndexedDB wrapper handling persistent state across sessions.
  - `packs.js`: Static database for translations (EN, FR, ES, DE, IT) and default question packs.
  - `browser.js`: Capability bridge to handle differing browser features (e.g., File System Access API).

## 🧠 Key Technical Choices

1. **Burned-in Telemetry:** Instead of saving video metadata in separate files, we use a `<canvas>` element to intercept video frames, draw an overlay (Date, User, Category, REC indicator), and record the result via `canvas.captureStream()`. This permanently "burns" the context into the video file like a sci-fi time capsule.
2. **File System Access API + Persistence:** Implemented Chromium's modern File System Access API to ask the user for a specific "Videolog" folder once. The app saves the `dirHandle` in IndexedDB to automatically save subsequent videos without annoying prompts. It gracefully falls back to traditional `<a download>` links for Firefox and Safari.
3. **Strict Network-First Service Worker:** We chose a *Network-First* caching strategy (with aggressive query param cache-busting) over *Stale-While-Revalidate*. This ensures users immediately receive UI/feature updates upon page refresh without getting stuck on old code.
4. **Mocked DOM Testing:** Opted for `JSDOM` over heavy E2E frameworks (like Playwright) to test the UI interactions. This keeps the test suite blazing fast (< 2 seconds) while still verifying that DOM updates, routing, and buttons work correctly.

## ✅ Implemented Features (What has been done)

- **PWA & Offline:** Fully installable PWA with offline capabilities and a welcome onboarding flow.
- **Core Recorder:** Camera and microphone access, 5-minute timer, "REC" indicator, and cinematic telemetry overlay.
- **Smart Storage:** Saves videos with a strict flat naming convention (`Videolog - Username - Category - YYYYMMDD.mp4`).
- **Dashboard:** Video library showing past recordings with a built-in video playback modal.
- **Folder Scanner:** Ability to scan a local OS folder to import past `Videolog` files back into the app's dashboard.
- **Delete Management:** Deleting a video from the dashboard removes both the IndexedDB metadata AND the actual file from the OS folder.
- **Settings & Customization:** Multilingual UI (EN, FR, ES, DE, IT) and username configuration.
- **Question Management:** Active question limiter (max 5), enabling users to select the most relevant questions during onboarding, or edit their text and categories directly in the settings.
- **Reminders:** Ability to generate and download an `.ics` calendar file to remind the user every 6 months.
- **Testing Infrastructure:** 20 automated tests validating `StorageManager`, `BrowserBridge`, translations, and complete UI interaction flows.

## 🚀 Future Enhancements (Planned)

- [ ] **Data Backup & Restore:** JSON export/import of all metadata and custom settings for device migration.
- [ ] **Temporal Comparison:** Side-by-side video playback allowing users to compare their answers to the exact same question across multiple 6-month sessions.
- [ ] **Audio-Only Mode:** Fallback or toggle for users who prefer voice-only time capsules.
- [ ] **Cloud Adapters:** Optional end-to-end encrypted cloud backup integrations (e.g., WebDAV, Google Drive) without compromising the local-first philosophy.