# VideoLog App - Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build a local-first, privacy-focused progressive web app (PWA) hosted on GitHub Pages that allows users to record recurring time capsule videos (up to 5 minutes) on their mobile devices, using structured question packs tailored by life stage, with a complete dashboard for history, reminders (ICS export), and question customization.

**Architecture:** 
- **Frontend-Only Architecture:** Vanilla JavaScript (ES modules) + Tailwind CSS via CDN + Lucide icons. Zero backend / zero server storage for absolute data privacy.
- **Storage:** Browser `IndexedDB` (using native Promises or `idb-keyval` wrapper) for storing video blobs, recording metadata, and questionnaire settings locally. Includes `navigator.storage.persist()` check and JSON backup/restore.
- **Media Pipeline:** MediaRecorder API with dynamic MIME type feature detection (`video/mp4;codecs=avc1,mp4a.40.2` for iOS Safari vs `video/webm;codecs=vp9,opus` for Chrome/Android), 5-minute hard/soft timer limit, live front-camera preview.
- **Hosting:** GitHub Pages static deployment.

**Tech Stack:**
- HTML5 / CSS3 / Tailwind CSS (Styling)
- JavaScript (ES6+ / Modules)
- IndexedDB (Local video blobs & JSON metadata persistence)
- Web Share API / ICS file generator (Reminders)

---

## Phase 1: Project Scaffolding & Core Layout

### Task 1: Initialize project structure and HTML shell
- Create: `index.html` (Main SPA layout with navigation tabs: Dashboard, Recorder, Settings/Questions)
- Create: `src/css/styles.css` (or Tailwind configuration)
- Create: `src/js/app.js` (Main router / state manager)

### Task 2: Implement IndexedDB Local Storage layer
- Create: `src/js/storage.js` (Wrapper for managing video recordings, metadata, and custom question packs in IndexedDB, with storage persistence request and backup/restore export features)

---

## Phase 2: Dashboard & Question Packs

### Task 3: Implement Question Packs (Life Stages)
- Create: `src/js/packs.js` (Predefined packs: Young Person, Young Adult, Adult with initial 360° questions)
- Modify: `src/js/app.js` (UI for selecting and editing the active question pack)

### Task 4: Dashboard View & Reminder Generator
- Modify: `src/js/app.js` (List existing video logs, playback local videos from IndexedDB, export ICS calendar reminder for recurring sessions)

---

## Phase 3: Mobile Camera & Video Recorder

### Task 5: Mobile Front Camera & MediaRecorder Integration
- Create: `src/js/recorder.js` (Camera permission check, front-camera stream attachment with proper resolution constraints, MIME type detection for iOS/Android, 5-minute timer, MediaRecorder streaming handling)

### Task 6: Interactive Teleprompter / Question Viewer during Recording
- Modify: `src/js/recorder.js` (Scrollable question list overlay on the live camera view so the user can read questions while recording)

---

## Phase 4: Polish, Testing & Deployment

### Task 7: Local Export & Playback
- Modify: `src/js/app.js` (Download recorded video directly to camera roll/downloads as MP4/WebM, delete local logs, backup/restore local JSON metadata)

### Task 8: GitHub Pages Deployment Workflow
- Create: `.github/workflows/deploy.yml` (GitHub Action to deploy static files to GitHub Pages)
