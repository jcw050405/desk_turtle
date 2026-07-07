# TurtleGuard 새 채팅_1 최종 프롬프트

아래 프롬프트를 새 Codex 채팅에 그대로 붙여 넣으면 된다. 이 프롬프트는 `v0.3.0`부터 `v0.6.0`까지 이어서 개발하기 위한 인수인계용이다.

````text
너는 Codex이고, TurtleGuard 프로젝트를 이어받아 개발하는 역할이다.

먼저 아래 정보를 바탕으로 현재 프로젝트 상태를 파악하고, 빠른 개발 모드로 v0.3.0부터 v0.6.0까지 순차적으로 진행해줘.

프로젝트 개요:
TurtleGuard는 노트북 웹캠으로 사용자의 거북목/바른 자세를 감지하고, ESP32-C3 기반 거북이 인형 하드웨어의 MG90S micro servo를 움직이는 Electron 데스크톱 앱이다. BAD 자세일 때 거북이 목을 내밀고, GOOD 자세일 때 중립 위치로 되돌린다. 이후 Supabase 기반 소셜/그룹 랭킹 기능까지 포함하는 것이 목표다.

로컬 경로:
- 워크스페이스 루트: C:\Users\jcw75\OneDrive\문서\desk_turtle
- 앱 경로: C:\Users\jcw75\OneDrive\문서\desk_turtle\turtleguard
- GitHub: https://github.com/jcw050405/desk_turtle.git

현재 기준:
- 현재 앱 버전은 `0.2.0`이다.
- 현재 main 브랜치가 최신 기준이다.
- 최근 핵심 커밋은 `61a4ab3 fix: confirm hardware servo commands`이다.
- GitHub Release는 만들지 않고 빠른 개발을 우선한다.
- 사용자는 토큰 절약을 선호한다.
- 실제 하드웨어, 카메라, 설치 파일 실행, Supabase 실사용 확인은 사용자에게 체크리스트로 맡겨라.
- 자동 검증은 주로 `test:node`, `test:mvp2`, `lint`, 필요 시 `build:electron`만 사용한다.
- `.env`에는 Supabase URL과 ANON_KEY가 이미 들어 있다. 값을 출력하거나 커밋하지 마라.

중요한 하드웨어 상태:
- 사용 보드: ESP32-C3
- 사용 모터: Arduino MG90S micro servo
- 현재 펌웨어 파일: `turtleguard/arduino/turtle_control/turtle_control.ino`
- 현재 ESP32-C3 서보 신호 핀: `GPIO3`
- 일반 Arduino 빌드에서는 `Servo.h`, ESP32 계열에서는 `ESP32Servo.h`를 사용한다.
- ESP32-C3에서는 `ESP32PWM::allocateTimer(0)`과 `ESP32PWM::allocateTimer(1)`만 사용한다.
- MG90S 보호를 위해 각도는 `10도`에서 `80도` 사이로 제한한다.
- MG90S 전류 피크와 기구 충격을 줄이기 위해 `2도` 단위, `12ms` 간격으로 부드럽게 이동한다.
- 앱이 보내는 명령:
  - BAD / 목 내밀기: `1\n`
  - GOOD / 중립 위치: `0\n`
  - baud rate: `9600`
- 펌웨어가 보내는 응답:
  - 시작 시: `READY:TURTLE`
  - BAD 처리 후: `ACK:BAD:80`
  - GOOD 처리 후: `ACK:GOOD:10`

현재 하드웨어 앱 로직:
- Electron main process의 핵심 파일은 `turtleguard/electron/serialManager.js`다.
- 포트 open 뒤 ESP32-C3 준비를 위해 `readyDelayMs = 1500ms`를 둔다.
- 테스트 버튼은 단순 전송이 아니라 펌웨어 ACK를 기다린다.
- ACK가 없으면 `Command was sent, but TurtleGuard firmware did not acknowledge it` 메시지를 표시한다.
- 하드웨어 설정 화면은 마지막 장치 응답 `lastReceived`를 표시한다.
- 웹캠 기반 자세 감지에서는 매 프레임마다 명령을 보내지 않고, `GOOD -> BAD`, `BAD -> GOOD`처럼 상태가 바뀔 때만 하드웨어 명령을 보낸다.
- 세션 시작/종료/절전 시에는 안전하게 `GOOD` 명령을 강제 전송한다.

하드웨어 문제를 다시 만났을 때 판단 기준:
- 앱 화면에 `ACK:BAD:80` 또는 `ACK:GOOD:10`이 뜨는데 모터가 안 움직이면, 앱-ESP32-C3 통신은 성공한 것이다. 원인은 전원, GND 공통, 신호선 GPIO3, 서보 불량, 기구 간섭 쪽이다.
- ACK가 안 뜨면, 앱은 포트에 쓰고 있지만 ESP32-C3 펌웨어가 명령을 못 받는 상태다. 이 경우 Arduino IDE Serial Monitor 닫힘 여부, 올바른 펌웨어 업로드 여부, USB CDC 설정, 실제 연결 포트가 맞는지부터 확인해야 한다.

현재 완료된 기능:
- Electron 데스크톱 앱 기본 구조
- Windows 설치 파일 생성
- 앱 실행/흰 화면 문제 해결
- `serialport` 패키징 문제 해결
- ESP32-C3 포트 후보 인식
- 하드웨어 설정 화면
- 수동/자동 포트 연결
- 목 내밀기 테스트/중립 위치 버튼
- 테스트 버튼 ACK 확인
- 웹캠 기반 자세 감지
- 캘리브레이션
- 5단계 거북목 판정 기준점 설정
- 로컬 세션 저장/복구
- Supabase 기반 프로필/그룹/초대코드/RPC 설계
- 그룹 초대코드 방식
- 한 사람당 그룹 1개로 시작하되, 이후 다중 그룹 참여가 가능하도록 확장 여지 유지
- 일간/주간 그룹 랭킹
- 세션 종료 시 Supabase 업로드 시도
- 실패 시 `pending_sync`, 미설정 시 `local_only`, 성공 시 `synced`

검증 명령:
PowerShell에서 `npm`이 실행 정책에 막히면 `npm.cmd`를 사용한다.

```powershell
cd "C:\Users\jcw75\OneDrive\문서\desk_turtle\turtleguard"
npm.cmd run test:node
npm.cmd run test:mvp2
npm.cmd run lint
npm.cmd run build:electron
```

개발 방식:
- 새 작업은 가능하면 `codex/v0.3.0` 브랜치에서 시작한다.
- 사용자의 기존 변경을 되돌리지 마라.
- `.env` 값은 출력하지 말고 커밋하지 마라.
- 하드웨어/카메라/Supabase 실사용 검증은 사용자에게 짧은 체크리스트로 맡겨라.
- 마지막 품질 리뷰나 대규모 리팩터링은 사용자가 원하지 않는 한 생략한다.
- 기능은 버전별로 작게 나누고, 각 버전마다 빌드 가능한 상태를 유지한다.

v0.3.0 목표:
소셜/랭킹 기능을 실제 사용 가능하게 다듬는다.
- pending sync 재시도 버튼/흐름 추가
- 내 순위 강조
- 랭킹 새로고침 버튼과 loading 상태
- 그룹/프로필 상태 안내 개선
- Supabase/RPC 에러 메시지 사용자 친화화
- 필요 시 설치 파일 빌드

v0.4.0 목표:
하드웨어 사용성을 다듬는다.
- 하드웨어 설정 화면의 ACK/lastReceived 표시를 더 이해하기 쉽게 개선
- ESP32-C3/MG90S 연결 문제 체크리스트 UI 또는 도움말 추가
- 포트 연결 상태가 끊겼을 때 자동 상태 갱신
- 앱 종료/절전/USB 분리 시 포트 정리 안정화
- 필요하다면 GPIO3, 각도 10~80, 이동 속도를 설정 화면 또는 펌웨어 상수로 쉽게 조정 가능하게 정리

v0.5.0 목표:
자세 측정 경험을 안정화한다.
- 캘리브레이션 안내 개선
- 카메라 끊김/권한 거부/얼굴 없음 상태 UX 개선
- BAD/GOOD 전환 안정화
- 자리 비움 처리와 랭킹 점수 반영 정책 재확인
- 성능 모드와 프레임 처리 부담 점검

v0.6.0 목표:
초기 공개 배포 직전 완성도를 올린다.
- 앱 이름/아이콘/설치 파일 이름 정리
- README와 사용자 설치 안내 작성
- ESP32-C3 펌웨어 업로드 안내 작성
- MG90S 배선/전원/GND 안내 작성
- `.env.example` 및 Supabase 설정 안내 정리
- v0.6.0 태그 생성 전 테스트/빌드 확인
- 다음 채팅_2가 `v0.7.0~v1.0.0`을 이어갈 수 있도록 인수인계서 작성

첫 행동:
1. `git status --short --branch`로 현재 상태를 확인한다.
2. 최근 커밋과 버전을 확인한다.
3. `turtleguard/arduino/turtle_control/turtle_control.ino`의 현재 핀이 `GPIO3`인지 확인한다.
4. 사용자가 빠른 개발을 원하므로 v0.3.0 범위를 짧게 확인한 뒤, 추천 범위가 맞으면 바로 구현한다.
5. 하드웨어 동작이 아직 미확인이라면, 새 기능 전에 사용자가 `ACK:BAD:80`, `ACK:GOOD:10`을 확인했는지 먼저 물어본다.

처음 사용자에게 물어볼 질문:
“v0.3.0은 추천 범위인 pending sync 재시도, 내 순위 강조, 랭킹 새로고침부터 바로 진행할까요? 그리고 현재 하드웨어 설정 화면에서 테스트 버튼을 눌렀을 때 `ACK:BAD:80`과 `ACK:GOOD:10`이 표시되는지도 확인됐나요?”
````

