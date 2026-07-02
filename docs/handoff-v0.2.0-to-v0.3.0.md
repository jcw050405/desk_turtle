# TurtleGuard 개발 인수인계서: v0.2.0 -> v0.3.0

이 문서는 새 Codex 채팅에서 TurtleGuard 개발을 바로 이어가기 위한 인수인계서다. 새 채팅에서는 이 파일을 먼저 읽고, 현재 저장소 상태를 확인한 뒤 `v0.3.0` 개발 범위를 정하면 된다.

## 새 채팅에 줄 프롬프트

```text
TurtleGuard 프로젝트를 이전 채팅에서 v0.2.0까지 완료했습니다.
저장소 경로는 C:\Users\jcw75\OneDrive\문서\desk_turtle\turtleguard 입니다.
먼저 C:\Users\jcw75\OneDrive\문서\desk_turtle\docs\handoff-v0.2.0-to-v0.3.0.md 를 읽고 현재 상태를 파악해 주세요.

현재 main 브랜치가 최신이고, v0.2.0 태그도 GitHub에 push되어 있습니다.
GitHub Release는 만들지 않았고, 빠른 개발을 위해 바로 v0.3.0 개발로 넘어가려 합니다.

진행 방식:
- 토큰 절약 모드로 진행해 주세요.
- 수동 확인이 필요한 설치/카메라/아두이노/Supabase 실제 동작은 나에게 체크리스트로 맡겨 주세요.
- 코드는 작은 커밋 단위로 진행해 주세요.
- 최종 품질 리뷰는 생략하고, 테스트/타입체크 중심으로 검증해 주세요.
- 새 기능은 codex/v0.3.0 브랜치에서 시작해 주세요.

다음 목표는 v0.3.0 기능 범위를 정하는 것입니다.
우선 소셜/랭킹 실사용화를 중심으로 어떤 기능을 넣을지 함께 정리해 주세요.
```

## 프로젝트 개요

TurtleGuard는 노트북 웹캠으로 사용자의 거북목/자세 상태를 감지하고, 아두이노 기반 거북이 인형 하드웨어와 연동해 BAD 자세일 때 인형 목이 나오고 GOOD 자세일 때 들어가도록 만드는 데스크톱 앱이다.

장기 목표는 사용자가 하드웨어 키트를 구매하고 앱을 설치하면, 자세 감지와 하드웨어 피드백을 쉽게 사용할 수 있게 하는 것이다. 이후에는 친구/그룹 기반 랭킹으로 누가 더 바른 자세로 공부했는지 경쟁하는 소셜 서비스를 붙이는 방향이다.

## 저장소 정보

- 로컬 루트: `C:\Users\jcw75\OneDrive\문서\desk_turtle`
- 앱 경로: `C:\Users\jcw75\OneDrive\문서\desk_turtle\turtleguard`
- GitHub: `https://github.com/jcw050405/desk_turtle.git`
- 현재 기본 브랜치: `main`
- 최신 확인 커밋: `1fcd5b7 chore: bump version to 0.2.0`
- 태그: `v0.2.0`
- GitHub Release: 만들지 않음
- `v0.2.0` 설치 파일: `C:\Users\jcw75\OneDrive\문서\desk_turtle\turtleguard\dist\TurtleGuard Setup 0.2.0.exe`

## 기술 스택

- Electron
- Vite
- React
- TypeScript
- MediaPipe Tasks Vision
- SerialPort / Electron main-process serial bridge
- Supabase RPC
- 로컬 JSON 저장소
- Node test runner

## 현재 완료 상태

### v0.1.0에서 안정화된 것

- Electron 데스크톱 앱 빌드
- Windows 설치 파일 생성
- 흰 화면 문제 해결
- `serialport` 패키징 문제 해결
- 아두이노 포트 자동 탐색/수동 연결
- 연결 상태 표시
- servo 테스트
- 카메라 기반 자세 감지
- 세션 로컬 저장
- 컴퓨터 절전/앱 종료 대응의 기초

### v0.2.0에서 추가된 것

- 5단계 자세 판정 기준 설정
  - `very_sensitive`
  - `sensitive`
  - `default`
  - `relaxed`
  - `very_relaxed`
- 랭킹 모드에서는 공정성을 위해 자세 기준을 항상 `default`로 강제
- 로컬 설정 저장
- 세션 payload builder
- Supabase schema/RPC migration draft
- 사용자가 Supabase SQL Editor에서 SQL 실행 성공 확인 완료
- Supabase RPC client
- 소셜 프로필 생성
- 그룹 생성
- 초대코드 기반 그룹 참가
- 일간/주간 그룹 랭킹 화면
- 세션 종료 시 Supabase 업로드 시도
- 업로드 실패 시 `pending_sync`, 미설정 시 `local_only`, 성공 시 `synced`
- 로컬 기록 화면에 Sync 상태 표시
- `v0.2.0` 버전 bump
- `v0.2.0` 태그 생성 및 GitHub push

## 주요 파일 지도

### 앱 구조

- `turtleguard/main.js`: Electron main process, IPC 등록
- `turtleguard/preload.js`: renderer에 안전한 API 노출
- `turtleguard/src/components/AppShell.tsx`: 메인 탭 UI
- `turtleguard/src/pages/MainMonitor.tsx`: 자세 감지/세션 시작 종료 메인 화면
- `turtleguard/src/pages/HardwareSettings.tsx`: 하드웨어 연결 설정
- `turtleguard/src/pages/LocalHistory.tsx`: 로컬 세션 기록
- `turtleguard/src/pages/SocialSetup.tsx`: 닉네임/그룹 생성/초대코드 참가
- `turtleguard/src/pages/GroupRanking.tsx`: 일간/주간 랭킹

### 서비스

- `turtleguard/src/services/poseDetection.ts`: MediaPipe 기반 자세 감지
- `turtleguard/src/services/postureStandard.ts`: 5단계 자세 기준 모델
- `turtleguard/src/services/settingsClient.ts`: renderer 설정 저장 client
- `turtleguard/electron/settingsStore.js`: Electron main-process JSON 설정 저장소
- `turtleguard/src/services/sessionClient.ts`: renderer 세션 저장 client
- `turtleguard/electron/sessionStore.js`: 로컬 세션 JSON 저장소
- `turtleguard/src/services/sessionPayload.ts`: Supabase 업로드 payload builder
- `turtleguard/src/services/sessionSync.ts`: 세션 종료 후 Supabase sync helper
- `turtleguard/src/services/supabase.ts`: Supabase client 생성
- `turtleguard/src/services/socialClient.ts`: Supabase RPC wrapper
- `turtleguard/src/services/serialClient.ts`: renderer serial API wrapper
- `turtleguard/electron/serialManager.js`: Electron main-process serial manager

### Supabase

- `turtleguard/supabase/migrations/20260701_mvp2_social.sql`

포함 내용:
- `profiles`
- `groups`
- `group_members`
- `study_sessions`
- `create_profile`
- `create_group_with_invite_code`
- `join_group_by_invite_code`
- `upload_study_session`
- `get_group_rankings`

## 검증 명령어

기본 검증:

```powershell
cd "C:\Users\jcw75\OneDrive\문서\desk_turtle\turtleguard"
npm run test:mvp2
npm run test:node
npm run lint
```

빌드:

```powershell
npm run build:electron
```

현재 마지막 확인 기준:

- `npm run test:mvp2`: 16 tests pass
- `npm run test:node`: 31 tests pass
- `npm run lint`: pass
- `npm run build:electron`: pass

## 환경 변수와 보안 주의사항

- `.env`는 로컬에 존재한다고 사용자가 확인했다.
- `.env`는 Git에 올리면 안 된다.
- 새 채팅에서 `.env` 값을 출력하거나 읽어 사용자에게 보여주지 말 것.
- 값 존재 여부만 확인하려면 다음 정도만 사용한다.

```powershell
if (Test-Path ".env") { "env_exists" } else { "env_missing" }
```

필요한 환경 변수:

```text
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## 현재 수동 확인 완료 내역

사용자가 직접 확인한 것:

- Supabase SQL Editor 실행 성공
- `v0.2.0` 설치 파일 빌드 결과 확인
- 앱 실행/설치 관련 기본 동작 확인
- 소셜/랭킹 기능이 포함된 상태를 확인했다고 보고

수동 확인이 필요한 항목은 앞으로도 사용자에게 체크리스트로 맡긴다:

- Windows 설치 파일 실행
- 카메라 권한
- 자세 감지 실제 동작
- 아두이노 포트 인식/연결
- servo 테스트
- Supabase 실제 네트워크 동작
- 친구/다른 사용자 환경 테스트

## v0.3.0 추천 방향

추천 중심 방향: **소셜/랭킹 실사용화**

이유:
- `v0.2.0`에서 소셜/그룹/랭킹의 뼈대가 들어갔다.
- 다음 버전에서는 친구들과 실제로 써도 어색하지 않게 만드는 것이 자연스럽다.
- 아직 pending sync 재시도, 내 순위 강조, 새로고침, 에러 메시지 등 실사용 UX가 부족하다.

## v0.3.0 기능 후보

### 1. Pending Sync 재시도

목표:
- Supabase 업로드 실패로 `pending_sync`가 된 세션을 사용자가 다시 업로드할 수 있게 한다.

후보 작업:
- `LocalHistory`에 `pending_sync` 세션 표시 강화
- `Retry sync` 버튼 추가
- `sessionSync` 재사용 또는 bulk sync helper 추가
- 성공 시 `synced`, 실패 시 `pending_sync` 유지

우선순위: 높음

### 2. 내 순위 강조

목표:
- 랭킹 화면에서 현재 사용자의 행을 눈에 띄게 보여준다.

후보 작업:
- `settings.profile_id`와 ranking entry의 `profile_id` 비교
- 내 행 배경 강조
- 내 순위 요약 카드 추가

우선순위: 높음

### 3. 랭킹 새로고침 개선

목표:
- 사용자가 랭킹을 수동으로 다시 불러올 수 있게 한다.

후보 작업:
- `Refresh` 버튼
- loading 상태
- 마지막 업데이트 시간 표시
- 선택적으로 30초 자동 새로고침

우선순위: 중간

### 4. 그룹 참가 UX 개선

목표:
- 현재는 프로필/그룹 상태가 단순 표시된다. 사용자가 다음에 뭘 해야 할지 더 명확하게 만든다.

후보 작업:
- 프로필이 없으면 그룹 생성/참가 버튼 disabled + 안내
- 이미 그룹이 있으면 생성/참가 입력 잠금
- 초대코드 복사 버튼
- 그룹 탈퇴는 v0.3.0에서는 보류 가능

우선순위: 중간

### 5. 소셜 에러 메시지 개선

목표:
- Supabase/RPC 에러를 사용자 친화적 문구로 보여준다.

후보 작업:
- `Supabase is not configured.`
- `MVP-2 supports one group per user.`
- `Invite code not found.`
- `Profile is not a member of this group.`
- 위 문구를 한국어 UI 메시지로 매핑

우선순위: 중간

## v0.3.0 추천 스코프

빠른 개발 기준으로는 아래 3개만 먼저 추천한다.

1. Pending Sync 재시도
2. 내 순위 강조
3. 랭킹 수동 새로고침

그룹 UX/에러 메시지는 시간이 남으면 추가한다.

## v0.3.0 시작 절차

새 채팅에서 권장되는 시작 절차:

```powershell
cd "C:\Users\jcw75\OneDrive\문서\desk_turtle\turtleguard"
git status --short --branch
git checkout main
git pull origin main
git checkout -b codex/v0.3.0
```

브랜치 생성 후:

```powershell
npm run test:mvp2
npm run lint
```

그 다음 기능 범위를 확정하고 작은 커밋 단위로 개발한다.

## 대화/작업 선호사항

사용자 선호:

- 빠른 개발이 중요하다.
- GitHub Release는 매번 만들 필요 없다.
- 필요한 경우 tag만 찍고 다음 버전 개발로 넘어간다.
- 수동 확인이 필요한 것은 사용자에게 체크리스트로 맡긴다.
- 하위 에이전트/과한 리뷰로 토큰을 많이 쓰는 것을 선호하지 않는다.
- 최종 품질 리뷰는 생략해도 된다.
- 자동 검증은 `test:mvp2`, `test:node`, `lint` 중심으로 한다.
- 설치/하드웨어/카메라/Supabase 실제 동작은 사용자가 직접 확인한다.

## 주의할 점

- 현재 코드 일부 파일에는 과거 깨진 한글 문자열이 남아 있을 수 있다. 새로 수정하는 화면은 가능하면 읽을 수 있는 한국어 또는 간단한 영어로 정리한다.
- `.env`는 절대 커밋하지 않는다.
- Supabase RLS는 현재 MVP 초안 성격이다. 정식 외부 배포 전에 보안 모델 재검토가 필요하다.
- `v0.2.0`은 GitHub Release 없이 tag만 있다.
- `dist` 산출물은 보통 Git에 포함하지 않는다.
- 앱 아이콘/코드 서명은 아직 정식 품질이 아니다.

## 다음 채팅의 첫 결정 질문

새 채팅에서 먼저 물어볼 질문:

```text
v0.3.0 첫 스코프를 아래 중 어디까지로 할까요?

1. 최소: pending sync 재시도만
2. 추천: pending sync 재시도 + 내 순위 강조 + 랭킹 새로고침
3. 확장: 추천 범위 + 그룹 UX 개선 + 에러 메시지 개선
```

추천 답변은 2번이다.
