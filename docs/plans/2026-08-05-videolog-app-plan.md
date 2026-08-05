# VideoLog App - Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build a local-first, privacy-focused progressive web app (PWA) hosted on GitHub Pages that allows users to record recurring time capsule videos (up to 5 minutes) on their mobile devices, using structured question packs tailored by life stage, with a complete dashboard for history, reminders (ICS export), and question customization.

**Architecture:** 
- **Frontend-Only Architecture:** Vanilla JavaScript (ES modules) + Tailwind CSS via CDN + Lucide icons. Zero backend / zero server storage for absolute data privacy.
- **Storage:** Browser `IndexedDB` (via idb-keyval or native wrapper) for storing video blobs, recording metadata, and questionnaire settings locally.
- **Media Pipeline:** MediaRecorder API (`video/mp4` where supported or standard container with local transcoding/download), 5-minute hard/soft timer limit, live front-camera preview.
- **Hosting:** GitHub Pages static deployment.

**Tech Stack:**
- HTML5 / CSS3 / Tailwind CSS (Styling)
- JavaScript (ES6+ / Modules)
- IndexedDB (Local video and state persistence)
- Web Share API / ICS file generator (Reminders)

---

## Phase 1: Project Scaffolding & Core Layout

### Task 1: Initialize project structure and HTML shell
- Create: `index.html` (Main SPA layout with navigation tabs: Dashboard, Recorder, Settings/Questions)
- Create: `src/css/styles.css` (or Tailwind configuration)
- Create: `src/js/app.js` (Main router / state manager)

### Task 2: Implement IndexedDB Local Storage layer
- Create: `src/js/storage.js` (Wrapper for managing video recordings, metadata, and custom question packs in IndexedDB)

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
- Create: `src/js/recorder.js` (Camera permission check, front-camera stream attachment, 5-minute timer, MediaRecorder recording handling)

### Task 6: Interactive Teleprompter / Question Viewer during Recording
- Modify: `src/js/recorder.js` (Scrollable question list overlay on the live camera view so the user can read questions while recording)

---

## Phase 4: Polish, Testing & Deployment

### Task 7: Local Export & Playback
- Modify: `src/js/app.js` (Download recorded video as MP4, delete local logs, backup/restore local JSON metadata)

### Task 8: GitHub Pages Deployment Workflow
- Create: `.github/workflows/deploy.yml` (GitHub Action to deploy static files to GitHub Pages)
