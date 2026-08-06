# VideoLog Roadmap

## Phase 1: Core PWA Foundation & Recording (Completed)
- [x] Static SPA architecture with responsive mobile layout (zero scroll recorder view).
- [x] Local-first storage via browser `IndexedDB` for absolute user privacy.
- [x] Service Worker caching with automated update notifications & network-first navigation.
- [x] Automatic PWA installation prompt modal.

## Phase 2: Multilingual Question Packs & Customization (Completed)
- [x] Multilingual support (English, French, Spanish, German, Italian) selectable in Settings.
- [x] 3 pre-configured life-stage question packs (Young Person, Young Adult, Adult) categorized by theme.
- [x] Interactive numbered question editor allowing users to add, edit, re-categorize, and delete questions.

## Phase 3: Smart File Saving & Browser Compatibility (Completed)
- [x] Cross-browser scenario handling: File System Access API for Chromium browsers (caching folder handle in memory) with graceful fallback to automatic standard downloads for Firefox and Safari.
- [x] Flat naming convention: `Videolog - Username - Category - YYYYMMDD.ext`.
- [x] Folder scanner utility to import existing recorded video files from a local directory.
- [x] In-app video playback modal for historical session review.
- [x] ICS calendar reminder generator (defaulting to 6-month intervals).

## Phase 4: Future Enhancements (Planned)
- [ ] Full data backup and restore (JSON export/import of all metadata and settings).
- [ ] Side-by-side video comparison across multiple 6-month sessions for the same question.
- [ ] Optional end-to-end encrypted cloud backup adapters.
