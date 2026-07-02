import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useInterval } from 'react-use';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { serialService } from '../services/webSerial';
import { postureDetector } from '../services/poseDetection';
import { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { Preloader, CustomCursor, useMagnetic, useTilt } from '../components/Interactive';

gsap.registerPlugin(ScrollTrigger);

interface LeaderboardEntry {
  id: string;
  username: string;
  score: number;
}

function subscribeToLeaderboard(_onUpdate: () => void): () => void {
  return () => {};
}

async function fetchTopRankings(_limit = 5): Promise<LeaderboardEntry[]> {
  return [];
}

async function saveLeaderboardScore(
  _entry: Omit<LeaderboardEntry, 'id'> & { good_time: number; bad_time: number },
): Promise<void> {}

export default function Monitor() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // App States: IDLE (Landing) -> CALIBRATING -> ACTIVE
  const [appState, setAppState] = useState<'IDLE' | 'CALIBRATING' | 'ACTIVE'>('IDLE');
  const [isHardwareConnected, setIsHardwareConnected] = useState(false);
  const [isBadPosture, setIsBadPosture] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  
  const [currentAngle, setCurrentAngle] = useState(0);
  const [warningCount, setWarningCount] = useState(0);

  // Stats
  const [totalTime, setTotalTime] = useState(0);
  const [goodTime, setGoodTime] = useState(0);
  const [badTime, setBadTime] = useState(0);
  
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  // Section Refs for Scroll
  const heroRef = useRef<HTMLElement>(null);
  const problemRef = useRef<HTMLElement>(null);
  const howItWorksRef = useRef<HTMLElement>(null);
  const dashboardRef = useRef<HTMLElement>(null);
  const pricingRef = useRef<HTMLElement>(null);
  const contactRef = useRef<HTMLElement>(null);

  // Magnetic refs
  const heroH1Ref = useMagnetic<HTMLHeadingElement>();
  const heroBtnRef = useMagnetic<HTMLButtonElement>();

  const pricingBoxRef = useTilt<HTMLDivElement>();

  // Boss Mode (Document PiP API)
  const [isBossMode, setIsBossMode] = useState(false);
  const pipWindowRef = useRef<Window | null>(null);
  const [pipContainer, setPipContainer] = useState<HTMLElement | null>(null);

  const enterBossMode = async () => {
    if ('documentPictureInPicture' in window) {
      try {
        const pipWin = await (window as any).documentPictureInPicture.requestWindow({
          width: 320,
          height: 480,
        });

        // Copy styles to PiP window
        [...document.styleSheets].forEach((styleSheet) => {
          try {
            const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join('');
            const style = pipWin.document.createElement('style');
            style.textContent = cssRules;
            pipWin.document.head.appendChild(style);
          } catch (e) {
            const link = pipWin.document.createElement('link');
            link.rel = 'stylesheet';
            link.type = styleSheet.type;
            link.media = styleSheet.media.mediaText;
            link.href = styleSheet.href || '';
            pipWin.document.head.appendChild(link);
          }
        });
        
        // Add tailwind dynamically to the new window for styling
        const tailwindScript = pipWin.document.createElement('script');
        tailwindScript.src = "https://cdn.tailwindcss.com";
        pipWin.document.head.appendChild(tailwindScript);

        pipWin.addEventListener('pagehide', () => {
          setIsBossMode(false);
          setPipContainer(null);
          pipWindowRef.current = null;
        });

        pipWindowRef.current = pipWin;
        setPipContainer(pipWin.document.body);
        setIsBossMode(true);
      } catch (err) {
        console.error('Document PiP error:', err);
        fallbackVideoPiP();
      }
    } else {
      fallbackVideoPiP();
    }
  };

  const fallbackVideoPiP = async () => {
    if (videoRef.current) {
      try {
        await videoRef.current.requestPictureInPicture();
        setIsBossMode(true);
        videoRef.current.addEventListener('leavepictureinpicture', () => {
          setIsBossMode(false);
        }, { once: true });
      } catch (err) {
        console.error('Video PiP error:', err);
        alert('현재 브라우저는 화면 밖 플로팅 모드를 지원하지 않습니다.');
      }
    }
  };

  const exitBossMode = () => {
    if (pipWindowRef.current) {
      pipWindowRef.current.close();
    } else if (document.pictureInPictureElement) {
      document.exitPictureInPicture();
    }
    setIsBossMode(false);
  };

  useGSAP(() => {
    // Fade in and slide up elements on load
    gsap.from('.stagger-up', {
      y: 50,
      opacity: 0,
      duration: 1,
      stagger: 0.1,
      ease: 'power3.out',
      delay: 2.2 // After preloader
    });

    // ScrollTrigger reveal animation
    const reveals = gsap.utils.toArray('.scroll-reveal');
    reveals.forEach((el: any) => {
      gsap.fromTo(
        el,
        {
          opacity: 0,
          y: 50,
          filter: 'brightness(0.3)'
        },
        {
          opacity: 1,
          y: 0,
          filter: 'brightness(1)',
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 85%',
            toggleActions: 'play none none reverse'
          }
        }
      );
    });

    // 3-Card Staggered Reveal Animation
    gsap.fromTo(
      '.stagger-card',
      {
        opacity: 0,
        y: 30, // 약간 아래에서 시작
      },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        stagger: 0.2, // 0.2초 간격으로 순차 등장
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.card-stagger-container',
          start: 'top 80%',
          toggleActions: 'play none none reverse'
        }
      }
    );
  });

  const scrollToSection = (ref: React.RefObject<HTMLElement>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Throttle references for optimization
  const lastProcessTime = useRef(0);
  const lastSerialState = useRef<boolean | null>(null);
  const requestRef = useRef<number>();

  useEffect(() => {
    fetchLeaderboard();
    
    // Auto-connect hardware listeners
    const onHardwareConnected = () => setIsHardwareConnected(true);
    const onHardwareDisconnected = () => setIsHardwareConnected(false);
    
    window.addEventListener('hardware-connected', onHardwareConnected);
    window.addEventListener('hardware-disconnected', onHardwareDisconnected);

    if (!import.meta.env.VITE_SUPABASE_URL) return;
    
    // Use encapsulated subscription
    const unsubscribe = subscribeToLeaderboard(() => {
      fetchLeaderboard();
    });

    return () => {
      unsubscribe();
      window.removeEventListener('hardware-connected', onHardwareConnected);
      window.removeEventListener('hardware-disconnected', onHardwareDisconnected);
    };
  }, []);

  const fetchLeaderboard = async () => {
    if (!import.meta.env.VITE_SUPABASE_URL) return;
    try {
      const data = await fetchTopRankings(5);
      if (data) setLeaderboard(data);
    } catch (e) {
      console.error(e);
    }
  };

  // [원인 분석 및 수정] 카메라 권한 요청 타이밍 완벽 통제
  // 기존에는 초기화 코드나 useEffect 마운트 단계 등에서 암묵적으로 getUserMedia가 호출되어 
  // 페이지 진입 시점에 불필요한 카메라 권한 요청 팝업이 발생하는 버그가 있었습니다.
  // 이를 해결하기 위해, 브라우저의 카메라 자원에 접근하는 getUserMedia 함수 호출을 
  // 오직 사용자가 '관제 세션 시작(startCamera)' 버튼을 직접 클릭한 순간에만 
  // 실행되도록 이벤트 핸들러 내부로 완전히 캡슐화(Encapsulate)하였습니다.
  const startCamera = async () => {
    setCameraError(false);
    scrollToSection(dashboardRef);
    try {
      await postureDetector.initialize();
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 320, height: 240, frameRate: { ideal: 10, max: 15 } } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.warn('Video play error', e));
        videoRef.current.onloadeddata = () => {
          startCalibration();
        };
      }
    } catch (e) {
      console.error("Camera access denied", e);
      setCameraError(true);
    }
  };

  const stopCamera = async () => {
    setAppState('IDLE');
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    
    const score = totalTime > 0 ? Math.floor((goodTime / totalTime) * 1000) : 0;
    if (import.meta.env.VITE_SUPABASE_URL && totalTime > 10) {
      try {
        await saveLeaderboardScore({
          username: 'TurtleUser' + Math.floor(Math.random() * 1000),
          score,
          good_time: goodTime,
          bad_time: badTime
        });
      } catch (e) {
        console.error(e);
      }
    }
    setTotalTime(0); setGoodTime(0); setBadTime(0); setWarningCount(0);
  };

  const startCalibration = () => {
    setAppState('CALIBRATING');
    postureDetector.startCalibration((result) => {
      if (!result.ok) {
        setAppState('IDLE');
        setCameraError(true);
        return;
      }
      setAppState('ACTIVE');
      setIsBossMode(true); // Automatically enter Boss Mode when active
    });
  };

  const drawFaceBox = (ctx: CanvasRenderingContext2D, boundingBox: any) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    // Draw Face Bounding Box
    const x = boundingBox.originX * ctx.canvas.width;
    const y = boundingBox.originY * ctx.canvas.height;
    const w = boundingBox.width * ctx.canvas.width;
    const h = boundingBox.height * ctx.canvas.height;

    ctx.strokeStyle = '#2E7D63'; // Primary Green
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.stroke();

    // Draw center point
    ctx.fillStyle = '#D9534F'; // Accent Red
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, 5, 0, 2 * Math.PI);
    ctx.fill();
  };

  const detectLoop = useCallback((timestamp: number) => {
    if (appState === 'IDLE') return;

    if (timestamp - lastProcessTime.current >= 500) {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        const result = postureDetector.detectPosture(videoRef.current, timestamp);
        
        if (result !== null) {
          const { isBadPosture: currentBad, deviation, detection } = result;
          setIsBadPosture(currentBad);
          setCurrentAngle(deviation); // Repurposing currentAngle state for deviation percentage

          if (currentBad && lastSerialState.current !== currentBad) {
            setWarningCount(c => c + 1);
          }

          if (currentBad !== lastSerialState.current) {
            serialService.sendSignal(currentBad);
            lastSerialState.current = currentBad;
          }

          if (canvasRef.current && detection.boundingBox) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) drawFaceBox(ctx, detection.boundingBox);
          }
        }
      }
      lastProcessTime.current = timestamp;
    }
    
    requestRef.current = requestAnimationFrame(detectLoop);
  }, [appState]);

  useEffect(() => {
    if (appState !== 'IDLE') {
      requestRef.current = requestAnimationFrame(detectLoop);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [appState, detectLoop]);

  useInterval(() => {
    if (appState === 'ACTIVE') {
      setTotalTime(t => t + 1);
      if (isBadPosture) {
        setBadTime(t => t + 1);
      } else {
        setGoodTime(t => t + 1);
      }
    }
  }, appState === 'ACTIVE' ? 1000 : null);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const goodPercentage = totalTime > 0 ? Math.round((goodTime / totalTime) * 100) : 0;

  return (
    <div className="bg-[#FBFBF9] min-h-screen text-[#2C2C2A] font-sans selection:bg-[#2E7D63] selection:text-white">
      <Preloader />
      <CustomCursor />
      
      {/* 2.1 Navigation Bar */}
      <nav className="fixed top-0 w-full z-50 bg-[#FBFBF9]/90 backdrop-blur-md border-b border-[#2C2C2A]/5">
        <div className="max-w-[1180px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl text-[#2E7D63]">
            <span className="w-8 h-8 bg-[#2E7D63] rounded-lg flex items-center justify-center text-white">T</span>
            TurtleGuard
          </div>
          <div className="hidden md:flex items-center gap-8 font-medium text-sm text-[#2C2C2A]/70">
            <button onClick={() => scrollToSection(problemRef)} className="hover:text-[#2E7D63] transition-colors">제품 소개</button>
            <button onClick={() => scrollToSection(howItWorksRef)} className="hover:text-[#2E7D63] transition-colors">작동 원리</button>
            <button onClick={() => scrollToSection(dashboardRef)} className="hover:text-[#2E7D63] transition-colors">AI 관제실</button>
            <button onClick={() => scrollToSection(pricingRef)} className="hover:text-[#2E7D63] transition-colors">구매하기</button>
          </div>
        </div>
      </nav>

      {/* 2.2 Hero Section */}
      <section ref={heroRef} className="pt-32 pb-24 px-6 overflow-hidden">
        <div className="max-w-[1180px] mx-auto text-center flex flex-col items-center">
          <span className="stagger-up px-4 py-1.5 rounded-full bg-[#2E7D63]/10 text-[#2E7D63] font-bold text-sm mb-6 inline-block">
            거북목 방위대
          </span>
          <h1 ref={heroH1Ref} className="stagger-up interactive-target magnetic text-5xl md:text-[5rem] font-bold leading-[1.1] tracking-tight mb-8 text-[#2C2C2A] cursor-none">
            내 책상 위의 귀여운 감시자,<br />TurtleGuard
          </h1>
          <p className="stagger-up text-xl md:text-2xl text-[#2C2C2A]/70 max-w-2xl mx-auto mb-12 leading-relaxed tracking-wide">
            설치 없이 1초 만에 연결하는 웹 AI 자세 관제 솔루션.<br />당신의 목이 앞으로 나오면, 어깨 위 거북이도 목을 빼며 실시간 경고를 보냅니다.
          </p>
          <div className="stagger-up inline-block">
            <button 
              ref={heroBtnRef}
              onClick={startCamera}
              className="magnetic bg-[#2E7D63] text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-[#23604C] transition-colors shadow-lg shadow-[#2E7D63]/30"
            >
              지금 바로 내 자세 진단하기
            </button>
          </div>
        </div>
      </section>

      {/* 2.3 Problem Section */}
      <section ref={problemRef} className="py-32 bg-white px-6">
        <div className="max-w-[1180px] mx-auto">
          <div className="text-center mb-24 scroll-reveal">
            <h2 className="text-4xl md:text-[4rem] font-bold mb-6 leading-tight text-[#2C2C2A]">왜 거북목을 조심해야 할까요?</h2>
            <p className="text-lg md:text-xl text-[#2C2C2A]/50 font-light leading-relaxed tracking-wide">무의식적으로 무너지는 자세가 일상을 망친다꼬북!</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 card-stagger-container">
            <div className="bg-[#FBFBF9] p-10 rounded-[20px] shadow-sm border border-[#2C2C2A]/5 stagger-card interactive-target">
              <h3 className="text-2xl font-bold mb-4">방치하면 디스크</h3>
              <p className="text-[#2C2C2A]/70 leading-relaxed text-base tracking-wide">
                목이 1cm 앞으로 빠질 때마다 목뼈에는 2~3kg의 하중이 추가됩니다. 방치할 경우 거북목 증후군과 목 디스크로 악화될 수 있다꼬북!
              </p>
            </div>
            <div className="bg-[#FBFBF9] p-10 rounded-[20px] shadow-sm border border-[#2C2C2A]/5 stagger-card interactive-target">
              <h3 className="text-2xl font-bold mb-4">알면서도 안 고쳐지는 나쁜 습관</h3>
              <p className="text-[#2C2C2A]/70 leading-relaxed text-base tracking-wide">
                일에 집중하다 보면 누구나 모니터 앞으로 빨려 들어갑니다. 스스로 인지하고 자세를 고치는 것은 현실적으로 매우 어렵다꼬북!
              </p>
            </div>
            <div className="bg-[#FBFBF9] p-10 rounded-[20px] shadow-sm border border-[#2C2C2A]/5 stagger-card interactive-target">
              <h3 className="text-2xl font-bold mb-4">바른 자세 유지를 돕는 동반자</h3>
              <p className="text-[#2C2C2A]/70 leading-relaxed text-base tracking-wide">
                TurtleGuard는 당신이 일에 집중하는 동안 백그라운드에서 자세를 감지하고, 즉각적인 물리적 피드백을 통해 습관 교정을 돕는다꼬북!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 2.4 How it Works Section */}
      <section ref={howItWorksRef} className="py-32 px-6 bg-[#2C2C2A] text-[#FBFBF9]">
        <div className="max-w-[1180px] mx-auto">
          <div className="text-center mb-24 scroll-reveal">
            <h2 className="text-4xl md:text-[4rem] font-bold mb-6 leading-tight">무설치, 3단계 초간편 작동 원리</h2>
            <p className="text-white/70 text-lg md:text-xl leading-relaxed tracking-wide">복잡한 프로그램 설치 없이 브라우저 하나로 모든 것이 해결된다꼬북!</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            <div className="scroll-reveal interactive-target p-8 rounded-3xl hover:bg-white/5 transition-colors">
              <div className="w-20 h-20 bg-[#FBFBF9]/10 rounded-3xl mx-auto flex items-center justify-center text-3xl font-bold mb-8 text-[#2E7D63]">1</div>
              <h3 className="text-2xl font-bold mb-4">단 하나의 케이블</h3>
              <p className="text-white/70 text-base leading-relaxed tracking-wide">
                도착한 TurtleGuard 인형을 USB 포트에 연결하세요. 끝이다꼬북! (Web Serial API 활용)
              </p>
            </div>
            <div className="scroll-reveal interactive-target p-8 rounded-3xl hover:bg-white/5 transition-colors">
              <div className="w-20 h-20 bg-[#FBFBF9]/10 rounded-3xl mx-auto flex items-center justify-center text-3xl font-bold mb-8 text-[#2E7D63]">2</div>
              <h3 className="text-2xl font-bold mb-4">100% 브라우저 웹 AI</h3>
              <p className="text-white/70 text-base leading-relaxed tracking-wide">
                무거운 프로그램 설치 제로. 크롬 창을 켜는 순간 구글 MediaPipe 코어가 당신의 자세를 실시간 관제한다꼬북!
              </p>
            </div>
            <div className="scroll-reveal interactive-target p-8 rounded-3xl hover:bg-white/5 transition-colors">
              <div className="w-20 h-20 bg-[#FBFBF9]/10 rounded-3xl mx-auto flex items-center justify-center text-3xl font-bold mb-8 text-[#2E7D63]">3</div>
              <h3 className="text-2xl font-bold mb-4">물리적 거북이 목 경고</h3>
              <p className="text-white/70 text-base leading-relaxed tracking-wide">
                목이 앞으로 빠지면, 어깨 위 거북이 인형이 목을 물리적으로 돌출시켜 즉각적인 시각 피드백을 전달한다꼬북!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 2.5 AI Dashboard Section */}
      <section ref={dashboardRef} className="py-32 px-6 bg-[#FBFBF9]">
        <div className="max-w-[1180px] mx-auto">
          <div className="text-center mb-20 scroll-reveal">
            <h2 className="text-4xl md:text-[4rem] font-bold mb-6 leading-tight text-[#2C2C2A]">AI 실시간 관제 대시보드</h2>
            <p className="text-lg md:text-xl text-[#2C2C2A]/70 leading-relaxed tracking-wide">현재 당신의 자세와 세션 기록을 실시간으로 확인하세요.</p>
          </div>

          <div className="bg-white p-6 md:p-12 rounded-[2.5rem] shadow-xl border border-[#2C2C2A]/5 scroll-reveal hover:scale-[1.02] transition-transform duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-10">
              
              {/* Left: Vision Layer */}
              <div className="bg-[#2C2C2A] rounded-3xl overflow-hidden aspect-[4/3] relative flex items-center justify-center shadow-inner">
                <div className={`text-center p-8 ${appState !== 'IDLE' ? 'hidden' : ''}`}>
                  <div className="w-16 h-16 bg-[#2E7D63]/20 text-[#2E7D63] rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15.6 11.6L22 7v10l-6.4-4.5v-1zM4 5h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7c0-1.1.9-2 2-2z"/></svg>
                  </div>
                  <p className="text-[#FBFBF9] font-medium">카메라 대기 중</p>
                  <p className="text-[#FBFBF9]/50 text-sm mt-2">하단의 버튼을 눌러 측정을 시작하세요.</p>
                </div>

                <video 
                  ref={videoRef} 
                  playsInline 
                  muted 
                  className={`absolute inset-0 w-full h-full object-cover transform scale-x-[-1] opacity-70 ${appState === 'IDLE' ? 'hidden' : ''}`} 
                />
                <canvas 
                  ref={canvasRef} 
                  width={320} 
                  height={240} 
                  className={`absolute inset-0 w-full h-full object-cover transform scale-x-[-1] z-10 ${appState === 'IDLE' ? 'hidden' : ''}`} 
                />
                
                {/* Visual Red Warning Overlay */}
                <div 
                  className={`absolute inset-0 bg-[#D9534F]/30 pointer-events-none z-[15] transition-opacity duration-300 ${isBadPosture ? 'opacity-100' : 'opacity-0'}`} 
                />
                
                {appState === 'CALIBRATING' && (
                  <div className="absolute inset-x-0 bottom-4 mx-4 bg-[#2C2C2A]/70 p-4 rounded-2xl flex flex-col items-center justify-center text-white z-20 backdrop-blur-md">
                    <div className="w-6 h-6 border-4 border-[#2E7D63] border-t-transparent rounded-full animate-spin mb-2"></div>
                    <p className="font-bold text-center text-sm">현재 올바른 자세의 기준 각도를 측정하고 있다꼬북!<br/>정면을 바라봐 달라꼬북!</p>
                  </div>
                )}
                
                {cameraError && appState === 'IDLE' && (
                  <div className="absolute inset-0 bg-[#D9534F]/95 text-white flex flex-col items-center justify-center p-6 text-center z-30 backdrop-blur-sm">
                    <p className="text-xl font-bold mb-3">카메라 권한 거부됨</p>
                    <p className="text-sm text-white/90 leading-relaxed max-w-sm">
                      브라우저 주소창 좌측의 자물쇠 아이콘을 눌러 카메라 권한을 허용해주세요.<br/><br/>
                      AI Studio 미리보기 화면에서 권한 팝업이 뜨지 않는 경우, 우측 상단의 <b>'새 탭에서 열기'</b> 아이콘을 클릭하여 새 창에서 실행해주세요.
                    </p>
                  </div>
                )}
              </div>

              {/* Right: Diagnosis Layer */}
              <div className="flex flex-col gap-6">
                <div className="bg-[#FBFBF9] p-6 rounded-3xl border border-[#2C2C2A]/5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-[#2C2C2A]/50 mb-1">실시간 상태 진단이다꼬북!</p>
                    {appState === 'IDLE' ? (
                      <p className="text-2xl font-bold text-[#2C2C2A]/30">대기 중</p>
                    ) : isBadPosture ? (
                      <p className="text-2xl font-bold text-[#D9534F]">위험: 거북목 발생</p>
                    ) : (
                      <p className="text-2xl font-bold text-[#2E7D63]">양호함: 바른 자세</p>
                    )}
                  </div>
                  <div className={`w-4 h-4 rounded-full shadow-inner ${appState === 'IDLE' ? 'bg-[#2C2C2A]/10' : isBadPosture ? 'bg-[#D9534F] shadow-[#D9534F]' : 'bg-[#2E7D63] shadow-[#2E7D63]'}`}></div>
                </div>

                <div className="bg-[#FBFBF9] p-6 rounded-3xl border border-[#2C2C2A]/5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-[#2C2C2A]/50 mb-1">현재 측정 편차다꼬북!</p>
                    <p className="text-3xl font-bold text-[#2C2C2A]">{appState === 'IDLE' ? '--' : `${currentAngle > 0 ? '+' : ''}${currentAngle.toFixed(1)}%`}</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#2C2C2A]/50 mb-1">누적 경고 카운트다꼬북!</p>
                    <p className="text-3xl font-bold text-[#D9534F]">{warningCount} 회</p>
                  </div>
                </div>

                <div className="bg-[#FBFBF9] p-6 rounded-3xl border border-[#2C2C2A]/5">
                  <p className="text-sm font-bold text-[#2C2C2A]/50 mb-4">세션 타이머다꼬북!</p>
                  <div className="text-4xl font-bold font-mono text-[#2C2C2A]">{formatTime(totalTime)}</div>
                </div>
              </div>
            </div>

            {/* Bottom: Analysis & Ranking */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-4">
                <h3 className="font-bold text-lg">세션 분석 리포트다꼬북!</h3>
                <div className="bg-[#FBFBF9] p-5 rounded-2xl border border-[#2C2C2A]/5 flex justify-between items-center">
                  <span className="font-medium text-[#2C2C2A]/70">바른 자세 유지율</span>
                  <span className="font-bold text-xl text-[#2E7D63]">{goodPercentage}%</span>
                </div>
                <div className="bg-[#FBFBF9] p-5 rounded-2xl border border-[#2C2C2A]/5 flex justify-between items-center">
                  <span className="font-medium text-[#2C2C2A]/70">바른 자세 유지 시간</span>
                  <span className="font-bold text-xl">{formatTime(goodTime)}</span>
                </div>
                <div className="bg-[#FBFBF9] p-5 rounded-2xl border border-[#2C2C2A]/5 flex justify-between items-center">
                  <span className="font-medium text-[#2C2C2A]/70">위험 노출 시간</span>
                  <span className="font-bold text-xl text-[#D9534F]">{formatTime(badTime)}</span>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-lg">실시간 소셜 스코어 랭킹이다꼬북!</h3>
                <div className="bg-[#FBFBF9] rounded-2xl border border-[#2C2C2A]/5 overflow-hidden">
                  {leaderboard.length === 0 ? (
                    <div className="p-8 text-center text-sm text-[#2C2C2A]/40">랭킹 데이터가 없다꼬북!</div>
                  ) : (
                    <ul className="divide-y divide-[#2C2C2A]/5">
                      {leaderboard.map((entry, idx) => (
                        <li key={entry.id} className="p-4 flex items-center justify-between text-sm">
                          <div className="flex items-center gap-3">
                            <span className={`font-bold ${idx === 0 ? 'text-[#D9534F]' : 'text-[#2C2C2A]/40'}`}>{idx + 1}</span>
                            <span className="font-medium">{entry.username}</span>
                          </div>
                          <span className="font-bold text-[#2E7D63]">{entry.score} pts</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="mt-12 pt-10 border-t border-[#2C2C2A]/5 text-center flex flex-col items-center">
              
              <div className="flex flex-wrap items-center justify-center gap-6">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${isHardwareConnected ? 'border-[#2E7D63]/30 bg-[#2E7D63]/10 text-[#2E7D63]' : 'border-[#2C2C2A]/20 bg-gray-50 text-gray-500'} text-sm font-bold shadow-sm transition-colors`}>
                   <span className="relative flex h-3 w-3">
                     <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isHardwareConnected ? 'bg-[#2E7D63]' : 'bg-gray-400'}`}></span>
                     <span className={`relative inline-flex rounded-full h-3 w-3 ${isHardwareConnected ? 'bg-[#2E7D63]' : 'bg-gray-400'}`}></span>
                   </span>
                   {isHardwareConnected ? '인형 자동 연결됨' : '인형 연결 대기 중...'}
                </div>
                
                {appState === 'IDLE' ? (
                  <button 
                    onClick={startCamera}
                    className="px-10 py-4 rounded-full font-bold bg-[#2E7D63] text-white hover:bg-[#23604C] transition-colors shadow-md"
                  >
                    관제 세션 시작
                  </button>
                ) : (
                  <>
                    <button 
                      onClick={stopCamera}
                      className="px-10 py-4 rounded-full font-bold bg-[#D9534F] text-white hover:bg-[#C9302C] transition-colors shadow-md"
                    >
                      관제 세션 중지
                    </button>
                    <button 
                      onClick={enterBossMode}
                      className="px-8 py-4 rounded-full font-bold bg-[#2C2C2A] text-white hover:bg-black transition-colors shadow-md"
                    >
                      미니 모드로 전환
                    </button>
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 2.6 Pricing Section */}
      <section ref={pricingRef} className="py-32 px-6 bg-white">
        <div className="max-w-[1180px] mx-auto">
          <div className="text-center mb-20 scroll-reveal">
            <h2 className="text-4xl md:text-[4rem] font-bold mb-6 leading-tight text-[#2C2C2A]">하드웨어 패키지 구성</h2>
            <p className="text-lg md:text-xl text-[#2C2C2A]/70 leading-relaxed tracking-wide">당신의 데스크를 위한 완벽한 오가닉 솔루션 세트다꼬북!</p>
          </div>

          <div ref={pricingBoxRef} className="max-w-md mx-auto bg-[#FBFBF9] rounded-[2.5rem] overflow-hidden shadow-xl border border-[#2C2C2A]/5 scroll-reveal tilt-target">
            <div className="p-12 text-center border-b border-[#2C2C2A]/5">
              <h3 className="text-2xl font-bold mb-4">사전 예약 특별가</h3>
              <div className="text-5xl font-bold text-[#2E7D63]">₩49,000</div>
              <p className="text-base text-[#2C2C2A]/40 line-through mt-4">정상가 ₩69,000이다꼬북!</p>
            </div>
            <div className="p-12">
              <ul className="space-y-6 mb-12">
                <li className="flex items-center gap-4 text-base font-medium">
                  <span className="text-[#2E7D63] font-bold text-xl">✓</span> 프리미엄 거북목 인형 외관 케이스 (친환경 펠트 소재)
                </li>
                <li className="flex items-center gap-4 text-base font-medium">
                  <span className="text-[#2E7D63] font-bold text-xl">✓</span> 아두이노 호환 초소형 컨트롤러
                </li>
                <li className="flex items-center gap-4 text-base font-medium">
                  <span className="text-[#2E7D63] font-bold text-xl">✓</span> 저소음 고성능 서보모터 모듈
                </li>
                <li className="flex items-center gap-4 text-base font-medium">
                  <span className="text-[#2E7D63] font-bold text-xl">✓</span> 프리미엄 C타입 패키지 케이블 (2m)
                </li>
              </ul>
              <button onClick={() => scrollToSection(contactRef)} className="w-full py-5 rounded-xl font-bold text-lg bg-[#2C2C2A] text-white hover:bg-black transition-colors">
                사전 예약 신청하기
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2.7 Contact Form & Footer */}
      <section ref={contactRef} className="py-32 px-6 bg-[#2C2C2A] text-white">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-16 scroll-reveal">
            <h2 className="text-4xl md:text-[4rem] font-bold mb-6 leading-tight">구매 예약 및 문의</h2>
            <p className="text-lg md:text-xl text-white/70 leading-relaxed tracking-wide">궁금한 점이 있으시거나 구매를 원하시면 아래 폼을 작성해달라꼬북!</p>
          </div>

          <form action="https://formspree.io/f/xbjnrvok" method="POST" className="space-y-8 scroll-reveal">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">성함</label>
              <input type="text" name="name" required className="w-full px-5 py-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:border-[#2E7D63] focus:ring-1 focus:ring-[#2E7D63] transition-all" placeholder="홍길동" />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">이메일</label>
              <input type="email" name="email" required className="w-full px-5 py-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:border-[#2E7D63] focus:ring-1 focus:ring-[#2E7D63] transition-all" placeholder="example@email.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">문의 내용 (선택)</label>
              <textarea name="message" rows={4} className="w-full px-5 py-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:border-[#2E7D63] focus:ring-1 focus:ring-[#2E7D63] transition-all" placeholder="사전 예약 수량 혹은 궁금한 점을 남겨주세요."></textarea>
            </div>
            <button type="submit" className="w-full py-4 rounded-xl font-bold bg-[#2E7D63] text-white hover:bg-[#23604C] transition-colors mt-4">
              문의 전송하기
            </button>
          </form>
        </div>
      </section>

      <footer className="py-8 bg-[#1A1A1A] text-center text-white/30 text-xs">
        <p>© 2026 TurtleGuard. All rights reserved.</p>
        <p className="mt-1">이용약관 및 개인정보처리방침이다꼬북!</p>
      </footer>

      {/* Document PiP Portal */}
      {pipContainer && createPortal(
        <div className="bg-white w-full h-screen p-5 flex flex-col font-sans">
          <div className="flex justify-between items-center mb-4">
            <span className="font-bold text-sm text-[#2C2C2A] flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isBadPosture ? 'bg-[#D9534F]' : 'bg-[#2E7D63]'}`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 ${isBadPosture ? 'bg-[#D9534F]' : 'bg-[#2E7D63]'}`}></span>
              </span>
              TurtleGuard
            </span>
            <button 
              onClick={exitBossMode}
              className="text-[#2C2C2A]/50 hover:text-[#2C2C2A] bg-[#2C2C2A]/5 p-1.5 rounded-lg text-xs font-bold transition-colors"
            >
              크게 보기
            </button>
          </div>
          <div className="flex-1 relative rounded-2xl overflow-hidden bg-black mb-4">
            <video 
              playsInline
              muted
              ref={(node) => {
                if (node && streamRef.current) {
                  node.srcObject = streamRef.current;
                  node.play().catch(e => console.warn('PiP video play error', e));
                }
              }}
              className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]" 
            />
            <div 
              className={`absolute inset-0 bg-[#D9534F]/30 pointer-events-none transition-opacity duration-300 ${isBadPosture ? 'opacity-100' : 'opacity-0'}`} 
            />
          </div>
          <div className="flex flex-col gap-2 pointer-events-none">
            <div className={`p-4 rounded-xl text-center font-bold text-sm transition-colors ${isBadPosture ? 'bg-[#D9534F]/10 text-[#D9534F]' : 'bg-[#2E7D63]/10 text-[#2E7D63]'}`}>
              {isBadPosture ? '위험: 거북목 감지됐다꼬북!' : '양호: 바른 자세 유지 중이다꼬북!'}
            </div>
            <div className="text-xs text-center text-[#2C2C2A]/50 font-medium">
              누적 경고: {warningCount}회다꼬북!
            </div>
          </div>
        </div>,
        pipContainer
      )}
    </div>
  );
}
