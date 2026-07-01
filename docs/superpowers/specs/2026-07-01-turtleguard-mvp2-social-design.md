# TurtleGuard MVP-2 Social And Posture Standard Design

Date: 2026-07-01

Project: `.\turtleguard`

Base release: `v0.1.0`

## 1. Goal

MVP-2 adds social competition on top of the stable local desktop app.

The app already has a working local MVP:

- Windows installer builds and launches.
- Camera posture detection runs locally.
- Arduino serial control works through Electron.
- Local sessions can be measured and stored.

MVP-2 should not replace that local-first model. It should add cloud features only for summaries, groups, and rankings.

Core goals:

- Let users create a nickname-based profile.
- Let users create or join a group by invite code.
- Upload completed session summaries.
- Rank group members by good posture time.
- Support daily and weekly rankings.
- Add a local posture standard setting for personal mode.
- Force a fair default posture standard for ranking mode.

## 2. Product Policy

TurtleGuard has two usage modes.

### Personal Mode

Personal mode is for private posture tracking and Arduino feedback.

Rules:

- User can adjust the posture judgment standard.
- Setting is saved locally.
- Setting can be changed during a session.
- The changed setting applies from the next detection frame.
- Session data can remain local-only if the user is not in a group or not syncing.

### Ranking Mode

Ranking mode is for social/group competition.

Rules:

- Ranking sessions always use the default posture standard.
- Personal posture setting is preserved but ignored during ranking sessions.
- Uploaded ranking sessions record that the default standard was used.
- Rankings use `good_posture_seconds`, not a custom score.
- Ranking data contains session summaries only, never camera frames or face landmarks.

Reason:

If ranking sessions allowed very relaxed posture standards, users could inflate good posture time. The default standard keeps competition understandable and fair.

## 3. Posture Standard Setting

MVP-2 adds one user-facing posture standard control.

UI model:

```text
Posture standard

Sensitive  [1] [2] [3] [4] [5]  Relaxed
```

Labels:

```text
1. Very sensitive
2. Sensitive
3. Default
4. Relaxed
5. Very relaxed
```

The UI should not require users to understand percentages. It may show only the selected label and a short help sentence.
Korean display copy should be decided during implementation in the app's existing text encoding style.

Default value:

```text
Default
```

### Internal Mapping

The current posture detector uses:

- Face scale threshold: baseline face width multiplied by `1.08`.
- Y threshold: baseline face center Y plus `face height * 0.5`.

MVP-2 should extract these values into a small posture settings model.

Recommended internal mapping:

```text
very_sensitive:
  scaleIncreaseRatio: 0.06
  yDropFaceHeightMultiplier: 0.35

sensitive:
  scaleIncreaseRatio: 0.08
  yDropFaceHeightMultiplier: 0.45

default:
  scaleIncreaseRatio: 0.10
  yDropFaceHeightMultiplier: 0.55

relaxed:
  scaleIncreaseRatio: 0.13
  yDropFaceHeightMultiplier: 0.70

very_relaxed:
  scaleIncreaseRatio: 0.16
  yDropFaceHeightMultiplier: 0.85
```

These numbers should be treated as product defaults, not as user-facing copy.

### Ranking Override

During ranking sessions:

```text
effectivePostureStandard = default
```

During personal sessions:

```text
effectivePostureStandard = userSelectedPostureStandard
```

The app may display a small note in ranking mode:

```text
Ranking sessions use the default posture standard for fairness.
```

## 4. Local Settings Storage

Posture standard is a local app setting.

Recommended local fields:

```text
settings.posture_standard
settings.last_selected_group_id optional
settings.sync_enabled optional
```

Storage location:

- Electron main process owns persisted local settings.
- Store under Electron `app.getPath('userData')`.
- A JSON file is enough for MVP-2, matching the MVP-1 local session storage approach.

Example:

```json
{
  "posture_standard": "default",
  "last_selected_group_id": null,
  "sync_enabled": true
}
```

Renderer should access settings through preload IPC, not direct filesystem access.

## 5. UX Flow

### Onboarding

If no local profile exists:

1. Ask user to enter a nickname.
2. Create a local profile record.
3. Let user continue without a group or create/join a group.

### Group Setup

User can choose:

- Create a group.
- Join a group with invite code.
- Skip social setup and use local mode.

MVP-2 UI shows one active group at a time.

Database design should still allow multiple group memberships later.

### Main Monitor

Main monitor should clearly show:

- Personal session or ranking session.
- Current posture status.
- Current selected posture standard in personal mode.
- Default posture standard notice in ranking mode.
- Group sync status if enabled.

### Ranking Screen

Group ranking screen shows:

- Group name.
- Invite code copy button.
- Daily ranking.
- Weekly ranking.
- Member list.
- Current user's rank.

Ranking metric:

```text
sum(good_posture_seconds)
```

Periods:

- Daily: sessions overlapping or starting within the current local day.
- Weekly: sessions starting within the current calendar week.

MVP-2 can start with session start time based grouping. More exact overlap handling can be added later if needed.

## 6. Supabase Data Model

Supabase stores only summaries and social metadata.

Do not store:

- Camera video.
- Camera frames.
- Face images.
- Face bounding boxes.
- Pose landmarks.
- Frame-level posture events.

### profiles

```text
id uuid primary key
nickname text not null
created_at timestamptz not null default now()
last_seen_at timestamptz
```

### groups

```text
id uuid primary key
name text not null
invite_code text not null unique
owner_profile_id uuid not null references profiles(id)
created_at timestamptz not null default now()
```

### group_members

```text
id uuid primary key
group_id uuid not null references groups(id) on delete cascade
profile_id uuid not null references profiles(id) on delete cascade
role text not null default 'member'
joined_at timestamptz not null default now()
unique(group_id, profile_id)
```

MVP-2 policy:

- UI allows one active group.
- RPC prevents joining more than one group for now.
- Schema does not block future multi-group support.

### study_sessions

```text
id uuid primary key
profile_id uuid not null references profiles(id)
group_id uuid references groups(id) null
started_at timestamptz not null
ended_at timestamptz not null
good_posture_seconds integer not null
bad_posture_seconds integer not null
away_seconds integer not null
warning_count integer not null
ranking_mode boolean not null default false
posture_standard text not null
sync_status text
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Session upload rules:

- Personal local-only sessions do not need `group_id`.
- Ranking sessions must have `group_id`.
- Ranking sessions must use `ranking_mode = true`.
- Ranking sessions must use `posture_standard = 'default'`.
- Personal synced sessions may use the user's selected posture standard, but they should not count toward group rankings unless `ranking_mode = true`.

## 7. RPC Design

Use RPC for core workflows.

### create_profile

Input:

```text
nickname
```

Behavior:

- Creates a profile.
- Normalizes nickname length and whitespace.
- Returns profile id and nickname.

### create_group_with_invite_code

Input:

```text
profile_id
group_name
```

Behavior:

- Creates a group.
- Generates a unique invite code.
- Adds owner as group member.
- Enforces one-group MVP policy.

### join_group_by_invite_code

Input:

```text
profile_id
invite_code
```

Behavior:

- Normalizes invite code.
- Finds the group.
- Prevents duplicate membership.
- Enforces one-group MVP policy.
- Adds the user to the group.

### upload_study_session

Input:

```text
profile_id
group_id nullable
session summary fields
ranking_mode
posture_standard
```

Behavior:

- Validates ownership.
- Validates group membership when `group_id` is present.
- Rejects ranking sessions that do not use `posture_standard = 'default'`.
- Inserts the session summary.

### get_group_rankings

Input:

```text
group_id
period: daily | weekly
```

Behavior:

- Confirms requester is a group member.
- Aggregates only sessions where `ranking_mode = true`.
- Orders by total `good_posture_seconds` descending.
- Returns member nickname, profile id, total good seconds, total bad seconds, total away seconds, and rank.

## 8. RLS Policy

RPC owns workflow logic.

RLS remains the final access-control boundary.

Required rules:

- Users can read and update only their own profile.
- Users can read groups they belong to.
- Users can read group members only for groups they belong to.
- Users can insert sessions only for their own profile.
- Users can read ranking sessions only for groups they belong to.
- Users cannot discover arbitrary groups by querying invite codes directly.

Invite-code lookup should happen through RPC rather than broad table reads.

## 9. Sync Strategy

MVP-2 should keep local app behavior resilient when offline.

Local session behavior:

- Continue saving local session drafts and history as in MVP-1.
- At session end, enqueue a sync job if social sync is enabled.
- If offline or Supabase fails, keep `sync_status = pending`.
- Retry later from the app.

Sync statuses:

```text
local_only
pending
synced
failed
```

Ranking screen behavior:

- If offline, show cached local state and a clear offline message.
- Do not block posture tracking.

## 10. Error Handling

Nickname:

- Empty nickname is rejected.
- Very long nickname is trimmed or rejected with a clear message.

Invite code:

- Invalid code shows a not-found message.
- Already joined group shows a clear message.
- One-group MVP limit shows a message explaining that multiple groups will come later.

Session upload:

- Failed upload should not delete local data.
- Ranking upload with non-default posture standard should be rejected before network request if possible.

Posture standard:

- Invalid stored value falls back to `default`.
- Ranking mode always overrides local setting to `default`.

## 11. Testing Strategy

Keep automated tests focused and lean during feature development.

Automated checks:

- Unit test posture standard mapping.
- Unit test ranking-mode override.
- Unit test local settings validation fallback.
- Unit test session upload payload builder.
- Typecheck with `npm run lint`.

Manual checks assigned to the user:

- Install test build.
- Confirm posture standard slider changes BAD/GOOD sensitivity.
- Confirm ranking mode displays default-standard notice.
- Confirm Arduino still responds to BAD/GOOD.
- Confirm group creation/joining works against Supabase.
- Confirm daily/weekly rankings update after session upload.

Release-candidate checks:

- Run full `npm run test:node`.
- Run `npm run lint`.
- Run `npm run build:electron`.
- User runs the manual checklist on the installer.

## 12. Implementation Order

Recommended order:

1. Add local posture standard model and mapping.
2. Add local settings storage through Electron main/preload IPC.
3. Add 5-step posture standard UI for personal mode.
4. Apply selected posture standard to `PostureDetector`.
5. Add ranking-mode override to force `default`.
6. Add Supabase schema and RPC SQL draft.
7. Add nickname profile setup.
8. Add create/join group flow.
9. Add completed session sync queue.
10. Add daily/weekly ranking screen.
11. Add lean automated tests for settings, mapping, and payloads.
12. Build test installer and ask user to run manual QA.

## 13. Out Of Scope For MVP-2

- Multi-group UI.
- Paid code signing.
- Auto-update.
- Public marketing website.
- Camera/image upload.
- Frame-level posture history in Supabase.
- Anti-cheat beyond forcing default posture standard for ranking sessions.
- Full account/password system.
- Mobile app.

## 14. Acceptance Criteria

MVP-2 is complete when:

- User can choose a 5-step posture standard in personal mode.
- The selected posture standard persists across app restarts.
- Personal mode uses the selected standard.
- Ranking mode always uses the default standard.
- User can create a nickname profile.
- User can create a group and receive an invite code.
- User can join a group with an invite code.
- Completed ranking sessions upload summary data only.
- Daily and weekly rankings show group members ordered by good posture time.
- Offline or failed sync does not break local posture tracking.
- No camera images, face coordinates, pose landmarks, or video frames are uploaded.
