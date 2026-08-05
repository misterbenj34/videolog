# Hector's Architectural Refinements & Product Owner Questions

> **Context:** This document captures Hector's architectural feedback, technical refinements for the VideoLog PWA, and critical questions for Benjamin (Product Owner) before full execution.

---

## Part 1: Plan Refinements & Technical Specifications

The implementation plan (`docs/plans/2026-08-05-videolog-app-plan.md`) has been updated with the following architectural hardening:

1. **IndexedDB Schema & Persistence:**
   - Object stores: `videos` (key: timestamp/id, value: Blob + metadata) and `settings` (key: active pack, questions, schedule config).
   - Persistence guard: Explicitly invoke `navigator.storage.persist()` on app startup to request quota exemption from iOS Safari / mobile browser eviction.
   - Backup/Restore: Add full JSON export/import for app settings and log metadata so users can migrate across devices or browser clears.

2. **MediaRecorder & Codec Strategy:**
   - Dynamic MIME type detection to handle mobile fragmentation:
     - iOS Safari: Prefers `video/mp4;codecs=avc1,mp4a.40.2`.
     - Android/Chrome: Prefers `video/webm;codecs=vp9,opus` or `video/mp4`.
   - Fallback chain ensuring recording never fails due to unsupported MIME types.

3. **ICS Calendar Reminders:**
   - Generate standard `.ics` file attachments with proper `FREQ=MONTHLY` or `FREQ=YEARLY` recurrence rules and custom `VALARM` triggers (e.g. 1 day prior) for seamless calendar integration.

---

## Part 2: Product Owner Questions & Edge Cases

To ensure the app fits your exact workflow, please review these key product questions:

1. **Video Export Workflow:**
   - *Question:* Since mobile browsers can be aggressive with storage cleanup, should the app **automatically trigger a file download** (saving to your phone's downloads / camera roll) immediately after stopping a recording, in addition to keeping a copy in IndexedDB?
   
2. **Offline PWA Support:**
   - *Question:* Do you want a basic **Service Worker** added so the app can be fully installed to your phone's home screen and used completely offline (even on a plane or without internet), or is online-only hosting on GitHub Pages sufficient for now?

3. **Reminder Frequency:**
   - *Question:* For the recurring reminders (ICS export), what cadence do you want as the default? (e.g., Every 6 months on specific dates like June 1st and December 1st, or a custom interval?)

4. **Multi-Device / Migration:**
   - *Question:* Since data is 100% local, would you like a simple "Export All Data (ZIP/JSON)" and "Import Backup" feature in settings so you can easily move your VideoLogs between your phone and your computer?
