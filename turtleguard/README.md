# TurtleGuard

TurtleGuard is an Electron desktop app that watches posture through a laptop webcam, stores local posture sessions, optionally syncs ranking sessions to Supabase, and drives an ESP32-C3 + MG90S servo turtle hardware indicator.

When posture is BAD, the app sends `1\n` to the board and the firmware moves the servo to 80 degrees. When posture returns to GOOD, the app sends `0\n` and the firmware returns the servo to 10 degrees.

## Requirements

- Windows desktop for the packaged app flow
- Node.js 22 or newer
- ESP32-C3 board
- Arduino MG90S micro servo
- Arduino IDE with the ESP32 board package
- `ESP32Servo` Arduino library for ESP32-C3 builds
- Supabase project for social profiles, groups, session sync, and rankings

## Local Development

```powershell
npm.cmd install
npm.cmd run electron:dev
```

The renderer dev server runs on port 3000 and Electron opens the desktop shell.

## Build

```powershell
npm.cmd run build
npm.cmd run build:electron
```

The Windows installer is configured as:

```text
release/TurtleGuard-Setup-<version>.exe
```

For v0.6.0 the expected installer name is `TurtleGuard-Setup-0.6.0.exe`.

## Verification Commands

```powershell
npm.cmd run test:node
npm.cmd run test:mvp2
npm.cmd run lint
npm.cmd run build
```

Use `npm.cmd` on PowerShell if `npm` is blocked by execution policy.

## ESP32-C3 Firmware Upload

Firmware path:

```text
arduino/turtle_control/turtle_control.ino
```

Arduino IDE checklist:

- Select an ESP32-C3 board profile.
- Install the `ESP32Servo` library.
- Upload `turtle_control.ino`.
- Close Arduino IDE Serial Monitor before connecting from TurtleGuard.
- Baud rate is `9600`.

Expected firmware responses:

```text
READY:TURTLE
ACK:BAD:80
ACK:GOOD:10
```

If the TurtleGuard hardware screen shows `ACK:BAD:80` or `ACK:GOOD:10`, app-to-board serial communication is working.

## MG90S Wiring

- ESP32-C3 GPIO3 -> MG90S signal wire
- ESP32-C3 GND -> MG90S power supply GND
- MG90S VCC -> stable 5V servo power
- Keep ESP32-C3 GND and servo power GND common

The firmware limits motion to 10-80 degrees and moves in 2 degree steps with 12ms delay to reduce MG90S current spikes and mechanical shock.

If ACK appears but the servo does not move, check power, common GND, GPIO3 signal wiring, servo damage, and mechanical binding.

## Supabase Setup

1. Create a Supabase project.
2. Run `supabase/migrations/20260701_mvp2_social.sql` in the SQL editor or migration pipeline.
3. Copy `.env.example` to `.env`.
4. Fill in:

```text
VITE_SUPABASE_URL="https://your-project-ref.supabase.co"
VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"
```

Do not commit `.env`.

Social features use these RPC functions:

- `create_profile`
- `create_group_with_invite_code`
- `join_group_by_invite_code`
- `upload_study_session`
- `get_group_rankings`

## User Manual Checklist

These checks require real devices or live services and are not covered by automated tests:

- Hardware settings screen shows `ACK:BAD:80` after the BAD test button.
- Hardware settings screen shows `ACK:GOOD:10` after the GOOD test button.
- MG90S physically moves between neutral and extended positions.
- Camera permission prompt appears only when starting a session.
- Calibration succeeds with the user's normal upright posture.
- Ranking session uploads to the configured Supabase project.
- Pending sync retry changes a failed session to `synced`.
- Windows installer opens and installs on the target machine.

## Current Version

`0.6.0`
