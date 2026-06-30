# TurtleGuard Final Design And Implementation Prompt

Date: 2026-06-30

Source project reviewed:

`C:\Users\jcw75\Downloads\turtleguard (1)`

Working project copy for implementation:

`.\turtleguard` from the `desk_turtle` workspace root.

## 1. Product Goal

TurtleGuard is a Windows/macOS desktop app for a hardware posture-correction kit. The kit contains a turtle doll with an Arduino-controlled servo motor. The app uses the laptop camera to detect forward-head posture locally. When bad posture is detected, the app sends a serial signal to the Arduino so the turtle's neck comes out. When posture returns to normal, or the user is away/paused, the turtle returns to the neutral position.

The first product direction is:

- Users download and install a desktop app.
- Camera processing happens locally.
- Arduino serial control happens locally.
- No camera images, face images, pose landmarks, or video frames are uploaded.
- Social/group ranking features come later, after the local desktop app is stable.

## 2. Current Code Summary

The current project is a Vite + React + Electron app.

Important files:

- `src/pages/Monitor.tsx`: currently mixes landing page, marketing sections, camera monitor, session stats, leaderboard, purchase form, and PiP mini mode.
- `src/services/poseDetection.ts`: uses MediaPipe `FaceDetector`, not full body pose. It estimates posture from face bounding box size and Y position.
- `src/services/webSerial.ts`: currently calls `window.require('serialport')` directly from the renderer.
- `main.js`: Electron main process currently enables `nodeIntegration: true` and `contextIsolation: false`.
- `arduino/turtle_control.ino`: reads serial `1` or `0` and moves servo to `90` or `0`.

Existing useful behavior:

- Camera is only requested after user action.
- Camera input is constrained to 320x240 and 10-15 fps.
- Detection is throttled to about once every 500 ms.
- A 3-second calibration flow already exists.
- Serial commands are edge-triggered/throttled.

Current issues:

- Marketing website and desktop app UI are mixed.
- Electron security model is not production-safe.
- Renderer directly accesses Node serial APIs.
- Hardware connection management is too implicit.
- Calibration silently falls back if no samples are collected.
- GOOD/BAD/AWAY/PAUSED states are not cleanly separated.
- Session storage is not robust against crash, sleep, or app shutdown.
- Supabase/social features should not block local hardware app stability.

## 3. Product Phasing

### MVP-1: Local Desktop App Stabilization

MVP-1 must work without Supabase and without internet after assets are available locally.

Scope:

- Rebuild the installed app around actual use, not marketing.
- Make the first real app screen the main monitor/dashboard.
- Move product introduction, purchase, and inquiry content out of the desktop app scope.
- Harden Electron security.
- Implement serial control through main/preload IPC.
- Add hardware connection management.
- Preserve and improve camera calibration.
- Track GOOD, BAD, AWAY, and PAUSED states separately.
- Store sessions locally and recover from interruption.
- Provide Windows/macOS test builds.

MVP-1 does not include:

- Supabase group ranking UI.
- Group invite code UI.
- Cloud sync.
- Public account system.
- Automatic updates.
- Product-sales-grade code signing.

### MVP-2: Supabase Group Ranking

MVP-2 adds social competition after MVP-1 is stable.

Scope:

- Nickname-based anonymous profile.
- One active group per user in the MVP UI.
- Database designed so multiple groups can be supported later.
- Group invite code system.
- Daily and weekly rankings based on `good_posture_seconds`.
- Local sync queue with retry.
- RPC-based group creation/joining/ranking.
- RLS as the final access-control boundary.

## 4. Desktop App Screens

The installed desktop app should be a tool, not a long landing page.

### Onboarding

MVP-1:

- Short camera/hardware explanation.
- Optional hardware setup guide.

MVP-2:

- Nickname setup.
- Create group or join group with invite code.

### Main Monitor Screen

The primary screen users see while studying.

Must show:

- Camera preview.
- Current status: GOOD, BAD, AWAY, PAUSED, CALIBRATING, or IDLE.
- Today's local good posture time.
- Current session time.
- Warning count.
- Hardware connection status.
- Start/stop session button.
- Recalibrate button.
- Link/button to settings.

This screen should avoid heavy marketing animation. Remove or disable unnecessary GSAP scroll effects and custom cursor behavior in the app shell.

### Hardware Settings Screen

Must show:

- Port list.
- Auto-detected recommended port.
- Manual port selection.
- Connect/disconnect/reconnect.
- Refresh ports.
- Servo test controls.
- Last selected port.
- Clear connection failure message.

### Local Session History Screen

Useful for MVP-1 before cloud ranking exists.

Must show:

- Recent sessions.
- Good posture time.
- Bad posture time.
- Away time.
- Warning count.
- Whether a previous session was recovered after interruption.

### MVP-2 Group Ranking Screen

Added later.

Must show:

- Group name.
- Group invite code copy action.
- Members list.
- Daily ranking.
- Weekly ranking.

## 5. Electron Security And Serial Architecture

The current structure must be changed before test distribution.

Remove:

```js
nodeIntegration: true
contextIsolation: false
window.require('serialport')
```

Use:

```js
nodeIntegration: false
contextIsolation: true
preload: path.join(__dirname, 'preload.js')
```

Target architecture:

```text
React Renderer
  -> window.turtleSerial.listPorts()
  -> window.turtleSerial.connect(portPath)
  -> window.turtleSerial.disconnect()
  -> window.turtleSerial.sendPostureState(state)
  -> window.turtleSerial.testServo(position)

Electron Preload
  -> exposes a small, typed, validated API

Electron Main
  -> owns serialport
  -> lists ports
  -> opens/closes Arduino connection
  -> writes serial commands
  -> closes all open serial ports during app shutdown, window close, disconnect, write failure, and cable removal handling
```

Renderer must not import or require `serialport`.

Serial command contract:

```text
App BAD state -> serial '1' -> Arduino servo 90 degrees
App GOOD/AWAY/PAUSED/IDLE state -> serial '0' -> Arduino servo 0 degrees
```

This matches the current Arduino sketch.

## 6. Hardware Connection Management

The app must support both auto-detect and manual selection.

Connection order:

1. Try the last successful port.
2. Score available ports by metadata.
3. Prefer Arduino-like vendor/product IDs.
4. Prefer manufacturer/path text containing `Arduino`, `CH340`, `CH341`, `USB Serial`, or similar.
5. If one strong candidate exists, try it automatically.
6. If multiple candidates exist, try the strongest first, then offer manual selection.
7. If no candidate works, keep the app usable without hardware.

Required states:

```text
DISCONNECTED
SCANNING
CONNECTING
CONNECTED
ERROR
```

Hardware is optional for posture measurement. If hardware is unavailable, the app still runs as a camera posture tracker.

## 7. Posture Detection, Calibration, And Performance

Keep the current lightweight approach for MVP-1:

- MediaPipe FaceDetector.
- 320x240 camera input.
- Default inference interval: 500 ms.
- No full-body pose model in MVP-1 unless there is a strong reason.

### Calibration

Calibration is already present in the current code, but MVP-1 must make it explicit and reliable.

Requirements:

- Before each session, the app runs a 3-second baseline calibration.
- User is told to sit upright and face the camera.
- Calibration samples face bounding box scale and center Y.
- Calibration baseline data is session-scoped and in-memory only.
- Do not persist calibration baseline data across app restarts.
- Each new session must either run calibration again or explicitly reuse an active in-memory calibration from the same app run if the user has not stopped/restarted the posture session.
- If not enough face samples are collected, do not silently proceed with fallback values.
- Show retry instructions.
- Provide a "Recalibrate" action from the main screen.

The current fallback baseline behavior should be replaced with a user-visible calibration failure state.

### Posture States

Use a clear state machine:

```text
IDLE
CALIBRATING
GOOD
BAD
AWAY
PAUSED
ERROR
```

State meanings:

- GOOD: face detected and posture is within baseline threshold.
- BAD: face detected and posture exceeds threshold.
- AWAY: face not detected for a grace period.
- PAUSED: camera disconnected, user paused, or system sleep is being handled.
- ERROR: unrecoverable or user-action-needed failure.

Timing rules:

- GOOD increments `good_posture_seconds`.
- BAD increments `bad_posture_seconds` and may increment warning count when entering BAD.
- AWAY increments `away_seconds`, not good time.
- PAUSED does not increment posture time.

### Performance Modes

MVP-1 should support:

```text
Low power: 1000 ms inference interval
Default: 500 ms inference interval
Accuracy: 250-333 ms inference interval
```

The app should track basic internal performance metrics such as average inference time and dropped/no-face intervals, even if not shown prominently.

## 8. Session Storage And Recovery

MVP-1 stores locally. Supabase is not required for MVP-1.

Use a simple JSON file stored from the Electron main process as the MVP-1 local session store. The file should live under Electron's `app.getPath('userData')`, for example:

```text
<userData>/sessions.json
```

Rationale:

- It works without internet.
- It avoids deciding on a heavier database before the data model settles.
- It is enough for session drafts, recovery, and local history in MVP-1.
- It keeps Node filesystem access in the Electron main process instead of the renderer.

Do not use browser-only `localStorage` for session drafts. IndexedDB or SQLite may be considered later if local history grows, but MVP-1 should start with a main-process JSON store.

Local session fields:

```text
id
started_at
ended_at nullable
good_posture_seconds
bad_posture_seconds
away_seconds
warning_count
ended_reason
created_at
updated_at
sync_status optional for MVP-2 readiness
```

Local storage requirements:

- Create a session draft when a session starts.
- Persist draft every 5-10 seconds.
- Persist immediately on state changes if useful.
- On normal stop, write `ended_at` and `ended_reason = user_stopped`.
- On app restart, detect unfinished local session drafts and offer recovery/closeout.
- Do not rely only on the user pressing stop.

Sleep handling:

- In Electron, use `powerMonitor` suspend/resume events.
- On suspend, immediately end the session with an appropriate `ended_reason`.
- This prevents sleep time from inflating session time.
- On resume, show that the previous session ended when the computer slept.

Camera interruption:

- Before a session starts, camera failure means session start failed.
- During a session, camera loss moves the session to PAUSED.
- Show a modal/banner: camera connection was lost.
- Stop posture time accumulation until recovery/restart.

## 9. MVP-2 Supabase Data Design

Supabase is for social/group ranking, not camera processing.

Do not store:

- Camera video.
- Face image.
- Face coordinates.
- Pose landmarks.
- Frame-level data.

Store:

- Nickname.
- Group membership.
- Session summary numbers.
- Ranking aggregates/query results.

Tables:

```text
profiles
- id
- nickname
- created_at
- last_seen_at

groups
- id
- name
- invite_code unique
- owner_profile_id
- created_at

group_members
- id
- group_id
- profile_id
- role
- joined_at
- unique(group_id, profile_id)

study_sessions
- id
- profile_id
- group_id nullable
- started_at
- ended_at nullable
- good_posture_seconds
- bad_posture_seconds
- away_seconds
- warning_count
- sync_status
- created_at
- updated_at
```

Notes:

- Remove `profiles.invite_code`; group invite codes are enough.
- `study_sessions.group_id` is nullable so users can track alone.
- `group_members` is the source of truth for membership.
- The UI may allow only one group in MVP-2, but the DB should be ready for multiple groups later.
- If `profiles.active_group_id` is used, treat it as current selection, not membership truth. Prefer local current group selection when possible.

## 10. Supabase RPC And RLS

Use RPC for core business actions:

```text
create_group_with_invite_code(group_name)
join_group_by_invite_code(invite_code)
get_group_rankings(group_id, period)
```

RPC handles:

- Invite code normalization.
- Group lookup.
- Duplicate membership prevention.
- One-group-per-user MVP policy.
- Transactional insert/update.
- Ranking aggregation.

RLS still handles:

- Users can modify only their own profile.
- Users can create sessions only for themselves.
- Users can view members/rankings only for groups they belong to.
- Users cannot query arbitrary group data.

Core rule:

```text
RPC owns workflow logic.
RLS is the final access-control boundary.
```

## 11. Error Handling Requirements

Camera:

- Permission denied: show actionable help.
- No camera: keep app open.
- Camera occupied: show retry path.
- Camera disconnect during session: PAUSED, not failed.

Face detection:

- No face briefly: keep previous visual state or show searching.
- No face for grace period: AWAY.
- AWAY sends neutral hardware signal.

Hardware:

- No Arduino: app remains usable.
- Port busy: show that another app may be using the port.
- Cable unplugged: update status to disconnected.
- Multiple candidates: score candidates and allow manual selection.
- Write failure: disconnect and show reconnect option.
- On app quit, window close, disconnect, write failure, and unexpected hardware removal, explicitly close every open serial port owned by the app.
- The main process must own port cleanup so abnormal renderer exits do not leave ports locked.

System:

- App crash/force quit: recover local draft on next launch.
- System sleep: end session on suspend.
- Offline: MVP-1 unaffected; MVP-2 queues sync.

## 12. Test Distribution Strategy

Current distribution stage:

```text
Test distribution
```

Target structure:

```text
Build for Windows and macOS.
Share test builds with friends/team/testers.
Do not require public code signing at the first test stage.
Do not implement auto-update in MVP-1.
Keep structure compatible with initial public distribution later.
```

Initial public distribution later:

- Download website.
- Installer files hosted on GitHub Releases, S3, Cloudflare R2, or similar.
- Privacy notice.
- Consider Windows/macOS code signing.
- Consider auto-update after core stability.

## 13. Implementation Order

Recommended implementation sequence:

1. Verify current project build/dev behavior.
2. Split app concerns: desktop app UI vs marketing/download site.
3. Replace Electron security settings and add preload IPC.
4. Move serial control into Electron main process.
5. Add hardware connection UI and state model.
6. Rebuild the main monitor screen around actual use.
7. Strengthen calibration behavior.
8. Implement GOOD/BAD/AWAY/PAUSED posture state machine.
9. Implement local session draft storage and recovery.
10. Add sleep handling through Electron powerMonitor.
11. Add performance modes.
12. Test with no hardware, one Arduino, multiple serial candidates, camera denied, camera disconnected, and app restart.
13. Prepare Windows/macOS test build scripts.
14. After MVP-1 is stable, implement MVP-2 Supabase features.

## 14. Do Not Do In MVP-1

- Do not build Supabase rankings before local hardware/camera stability.
- Do not upload camera images or face data.
- Do not store landmark/frame-level data.
- Do not keep `window.require('serialport')` in renderer.
- Do not keep `nodeIntegration: true` for test distribution.
- Do not silently continue calibration with fake fallback baseline.
- Do not count AWAY time as good posture.
- Do not rely only on final session stop to save data.
- Do not let system sleep inflate study time.
- Do not make the installed app a long marketing landing page.

## 15. MVP-1 Completion Criteria

MVP-1 is complete when:

- App opens as a desktop posture tool.
- Camera can start/stop by user action.
- Calibration is required and can fail visibly.
- GOOD/BAD/AWAY/PAUSED are represented clearly.
- Good, bad, and away times are tracked separately.
- Hardware can be auto-detected when possible.
- Manual serial port selection works.
- Servo test works.
- BAD sends serial `1`; GOOD/AWAY/PAUSED sends serial `0`.
- Hardware absence does not block posture tracking.
- Camera disconnection pauses session safely.
- System sleep ends session safely.
- Session draft survives app interruption.
- Renderer does not access Node serial APIs directly.
- Windows test build can be created.
- macOS test build path is documented or configured.

## 16. Implementation Prompt For Next Codex Session

Use this prompt when starting implementation:

```text
You are working on TurtleGuard, a Windows/macOS Electron + React desktop app for a turtle-doll Arduino posture correction kit.

Source project:
.\turtleguard

Read the final design document first:
.\docs\superpowers\specs\2026-06-30-turtleguard-design.md

Goal:
Implement MVP-1 only: local desktop app stabilization. Do not implement Supabase social ranking yet.

MVP-1 requirements:
- Rebuild the installed app around actual use: main monitor, hardware settings, local session history.
- Remove or separate marketing/purchase/contact sections from the desktop app flow.
- Replace Electron insecure renderer serial access.
- Set nodeIntegration false and contextIsolation true.
- Add preload IPC API for serial actions.
- Move serialport usage into Electron main process.
- Ensure Electron main closes all open serial ports on quit, window close, disconnect, write failure, and unexpected cable removal.
- Implement serial port listing, auto-detect scoring, manual selection, connect, disconnect, reconnect, and servo test.
- Preserve lightweight FaceDetector posture detection.
- Require 3-second calibration before each session.
- Keep calibration baseline data in memory for the active session only; do not persist baseline values across app restarts.
- If calibration has too few face samples, show failure and require retry. Do not silently use fallback baseline.
- Implement posture states: IDLE, CALIBRATING, GOOD, BAD, AWAY, PAUSED, ERROR.
- Track good_posture_seconds, bad_posture_seconds, away_seconds, warning_count separately.
- BAD sends serial '1'. GOOD, AWAY, PAUSED, and IDLE send serial '0'.
- Persist a local session draft every 5-10 seconds.
- Store MVP-1 local session drafts/history in a JSON file under Electron app userData from the main process. Do not use renderer localStorage for session recovery.
- Recover unfinished sessions on next launch.
- Handle camera loss during a session as PAUSED, not a fatal failure.
- Handle Electron powerMonitor suspend by ending the current session before sleep inflates time.
- Add performance modes: low power, default, accuracy.

Do not do in MVP-1:
- Do not implement Supabase ranking UI.
- Do not require internet for the core app.
- Do not upload camera images, face coordinates, landmarks, or video frames.
- Do not use window.require('serialport') in renderer.
- Do not leave nodeIntegration true/contextIsolation false for the app build.
- Do not count AWAY time as good posture.

Implementation order:
1. Inspect project and run available build/typecheck.
2. Refactor Electron main/preload serial architecture.
3. Implement serial connection manager and UI.
4. Refactor app UI into main monitor/settings/local history.
5. Strengthen calibration and posture state machine.
6. Implement local session storage/recovery/sleep handling.
7. Verify with tests/manual checks and document remaining build limitations.
```
