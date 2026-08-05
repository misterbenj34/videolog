# VideoLog App - Finalized Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build a local-first, privacy-focused Progressive Web App (PWA) hosted on GitHub Pages that allows users to record 1 video per question (per session) with a 5-minute limit, storing recordings directly to the local device / camera roll, fully offline-capable via a Service Worker with update notifications, structured question packs by life stage, and ICS reminders every 6 months.

---

## Key Architectural Adjustments based on Product Decisions:
1. **Per-Question Recording Flow:** Instead of one monolithic video for all questions, each question is recorded separately as its own video asset, making cross-year comparisons trivial.
2. **Local Device Export:** Automatically trigger downloads/saves to the phone's local storage/camera roll after each recording.
3. **Offline PWA & Service Worker:** Full offline support with a Service Worker and an automatic update prompt when new source code is deployed.
4. **Reminder & Onboarding:** Default cadence set to every 6 months, featuring an interactive guided onboarding flow for the first recording.

---

## Phase 1: PWA Scaffolding, Offline Support & IndexedDB

### Task 1: Initialize HTML Shell, Tailwind & Service Worker
- Create: `index.html` (Main SPA layout: Dashboard, Recorder, Packs/Settings, Onboarding modal)
- Create: `sw.js` (Service Worker for offline caching of static assets)
- Create: `src/js/pwa.js` (PWA registration and update notification banner logic)

### Task 2: Implement IndexedDB Local Storage Layer
- Create: `src/js/storage.js` (IndexedDB database for video metadata, question packs, and settings; requests `navigator.storage.persist()`)

---

## Phase 2: Question Packs & Onboarding Flow

### Task 3: Implement Life-Stage Question Packs (Per-Question Architecture)
- Create: `src/js/packs.js` (Packs for Young Person, Young Adult, Adult, structured so users answer specific recurring questions over time)

### Task 4: Guided Onboarding & 6-Month Reminder Generator
- Create: `src/js/onboarding.js` (First-time user walkthrough)
- Create: `src/js/reminders.js` (ICS calendar export generator with a default 6-month recurrence rule)

---

## Phase 3: Mobile Camera & Per-Question Video Recorder

### Task 5: Camera & MediaRecorder Engine
- Create: `src/js/recorder.js` (Front-camera stream constraints, dynamic MIME type detection for iOS/Android, 5-minute timer, local file export / camera roll download trigger)

### Task 6: Teleprompter & Question Session UI
- Modify: `src/js/recorder.js` & `app.js` (Step-by-step question flow: record video for Question 1, review, save, proceed to Question 2)

---

## Phase 4: Dashboard, Review & Deployment

### Task 7: Dashboard & Historical Review
- Modify: `src/js/app.js` (Dashboard listing past logs grouped by question/category to easily compare past vs. present)

### Task 8: GitHub Pages Deployment Workflow
- Create: `.github/workflows/deploy.yml` (GitHub Actions workflow to build and deploy static PWA to GitHub Pages)
