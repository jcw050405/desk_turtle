# TurtleGuard Chat 2 Handoff Prompt

Copy this prompt into the next Codex chat to continue TurtleGuard from v0.7.0 to v1.0.0.

````text
너는 Codex이고, TurtleGuard 프로젝트를 이어받아 개발하는 역할이다.

프로젝트 루트:
- C:\Users\jcw75\OneDrive\문서\desk_turtle

앱 경로:
- C:\Users\jcw75\OneDrive\문서\desk_turtle\turtleguard

현재 기준:
- v0.6.0까지 구현된 상태에서 시작한다.
- main이 아니라 이전 작업 브랜치에서 이어받을 수 있다. 시작 시 반드시 `git status --short --branch`와 최근 커밋을 확인해라.
- `.env` 값은 출력하거나 커밋하지 마라.
- 사용자는 빠른 개발과 토큰 절약을 선호한다.
- 하드웨어, 카메라, 설치 파일 실행, Supabase 실사용 확인은 사용자 체크리스트로 맡겨라.

하드웨어 기준:
- ESP32-C3 + Arduino MG90S micro servo
- 펌웨어 파일: `turtleguard/arduino/turtle_control/turtle_control.ino`
- ESP32-C3 서보 신호 핀: GPIO3
- 앱 명령: BAD `1\n`, GOOD `0\n`
- baud rate: 9600
- 펌웨어 응답: `READY:TURTLE`, `ACK:BAD:80`, `ACK:GOOD:10`
- 서보 각도: GOOD 10도, BAD 80도
- 이동: 2도 단위, 12ms 간격

v0.3.0 완료:
- pending sync retry 흐름 추가
- 내 ranking row 강조
- ranking refresh 버튼과 loading 상태
- social/Supabase 오류 메시지 개선
- 앱 버전 0.3.0 체크포인트

v0.4.0 완료:
- 하드웨어 ACK/lastReceived 해석 UI 개선
- ESP32-C3/MG90S 연결 체크리스트 추가
- 하드웨어 설정 화면 status polling 추가
- 앱 버전 0.4.0 체크포인트

v0.5.0 완료:
- BAD/GOOD 전환 안정화를 위한 `transitionHoldMs` 추가
- MainMonitor에서 1.2초 안정화 후 상태 전환
- 카메라/캘리브레이션/얼굴 없음 UX 안내 개선
- 앱 버전 0.5.0 체크포인트

v0.6.0 완료:
- README를 TurtleGuard 설치/펌웨어/배선/Supabase 안내로 교체
- `.env.example` 정리
- Electron Builder Windows installer 이름을 `TurtleGuard-Setup-${version}.exe`로 정리
- 앱 버전 0.6.0 체크포인트

자동 검증 명령:
```powershell
cd "C:\Users\jcw75\OneDrive\문서\desk_turtle\turtleguard"
npm.cmd run test:node
npm.cmd run test:mvp2
npm.cmd run lint
npm.cmd run build
```

v0.7.0 추천 목표:
- 실제 사용자 온보딩 흐름 개선
- 첫 실행 시 하드웨어/카메라/Supabase 설정 상태를 한 화면에서 확인
- 누락된 설정을 각 탭으로 이동시키는 CTA 추가
- local_only/pending_sync/synced 상태를 사용자 언어로 더 명확히 표시

v0.8.0 추천 목표:
- 그룹 기능 확장 준비
- 한 사람당 그룹 1개 제한을 제거하기 위한 DB/RPC 설계 초안
- active group 선택 UI
- 여러 그룹 랭킹 조회 구조 정리

v0.9.0 추천 목표:
- 공개 배포 품질 강화
- installer smoke test 체크리스트 보강
- 앱 아이콘/트레이/자동 업데이트 여부 결정
- 오류 로그 수집 방식 결정

v1.0.0 추천 목표:
- 실제 하드웨어와 Supabase 기반 베타 릴리스 마감
- README와 릴리스 노트 최종화
- v1.0.0 태그 전 전체 검증
- 사용자에게 하드웨어/카메라/설치 파일/Supabase 실사용 체크리스트 요청

먼저 git 상태와 현재 앱 버전을 확인한 뒤, v0.7.0 추천 범위인 첫 실행 온보딩/설정 상태 요약부터 진행할지 사용자에게 짧게 확인해라.
````
