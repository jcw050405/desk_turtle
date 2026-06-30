import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function Preloader() {
  const container = useRef<HTMLDivElement>(null);
  const turtles = useRef<HTMLDivElement[]>([]);

  useGSAP(() => {
    // Animate turtles bouncing
    gsap.fromTo(
      turtles.current,
      { y: 0, scale: 0.8, opacity: 0 },
      {
        y: -20,
        scale: 1.2,
        opacity: 1,
        duration: 0.5,
        stagger: 0.15,
        yoyo: true,
        repeat: 3,
        ease: 'power1.inOut',
        onComplete: () => {
          // Slide up the whole preloader
          gsap.to(container.current, {
            yPercent: -100,
            duration: 0.8,
            ease: 'power3.inOut',
            onComplete: () => {
              if (container.current) {
                container.current.style.display = 'none';
              }
            }
          });
        }
      }
    );
  }, { scope: container });

  return (
    <div 
      ref={container} 
      className="fixed inset-0 z-[9999] bg-[#FBFBF9] flex items-center justify-center flex-col"
    >
      <div className="flex gap-4">
        {[0, 1, 2].map((i) => (
          <div 
            key={i}
            ref={(el) => { if (el) turtles.current[i] = el; }}
            className="text-6xl"
          >
            🐢
          </div>
        ))}
      </div>
      <div className="mt-8 text-[#2E7D63] font-bold tracking-widest text-sm">
        TURTLE GUARD INITIALIZING
      </div>
    </div>
  );
}

export function CustomCursor() {
  const innerCursor = useRef<HTMLDivElement>(null);
  const outerCursor = useRef<HTMLDivElement>(null);
  const cursorText = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Hide default cursor on body
    document.body.style.cursor = 'none';
    
    // QuickTo for high performance following
    const xMoveInner = gsap.quickTo(innerCursor.current, "x", { duration: 0.1, ease: "power3" });
    const yMoveInner = gsap.quickTo(innerCursor.current, "y", { duration: 0.1, ease: "power3" });
    
    const xMoveOuter = gsap.quickTo(outerCursor.current, "x", { duration: 0.5, ease: "power3" });
    const yMoveOuter = gsap.quickTo(outerCursor.current, "y", { duration: 0.5, ease: "power3" });

    const xMoveText = gsap.quickTo(cursorText.current, "x", { duration: 0.5, ease: "power3" });
    const yMoveText = gsap.quickTo(cursorText.current, "y", { duration: 0.5, ease: "power3" });

    let isHovering = false;

    const onMouseMove = (e: MouseEvent) => {
      xMoveInner(e.clientX);
      yMoveInner(e.clientY);
      xMoveOuter(e.clientX);
      yMoveOuter(e.clientY);
      xMoveText(e.clientX);
      yMoveText(e.clientY + 40); // text position offset
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.interactive-target') || target.closest('button') || target.closest('a') || target.closest('h1') || target.closest('.magnetic') || target.closest('.tilt-target')) {
        if (!isHovering) {
          isHovering = true;
          gsap.to(outerCursor.current, {
            scale: 1.8,
            backgroundColor: 'rgba(255, 255, 255, 1)',
            duration: 0.3
          });
          
          if (target.closest('.interactive-target')) {
            gsap.to(cursorText.current, {
              opacity: 1,
              duration: 0.3
            });
          }
        }
      } else {
        if (isHovering) {
          isHovering = false;
          gsap.to(outerCursor.current, {
            scale: 1,
            backgroundColor: 'rgba(255, 255, 255, 1)',
            duration: 0.3
          });
          gsap.to(cursorText.current, {
            opacity: 0,
            duration: 0.3
          });
        }
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseover', handleMouseOver);

    return () => {
      document.body.style.cursor = 'auto';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseover', handleMouseOver);
    };
  }, []);

  return (
    <>
      <div 
        ref={innerCursor}
        className="fixed top-0 left-0 w-2 h-2 bg-[#2E7D63] rounded-full pointer-events-none z-[10000] -translate-x-1/2 -translate-y-1/2"
      />
      <div 
        ref={outerCursor}
        className="fixed top-0 left-0 w-10 h-10 bg-white rounded-full pointer-events-none z-[9999] -translate-x-1/2 -translate-y-1/2"
        style={{ mixBlendMode: 'difference' }}
      />
      <div
        ref={cursorText}
        className="fixed top-0 left-0 text-[#2E7D63] font-bold text-sm pointer-events-none z-[10000] -translate-x-1/2 opacity-0 drop-shadow-md"
      >
        꼬북?
      </div>
    </>
  );
}

// React hook for magnetic effect
export function useMagnetic<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const xTo = gsap.quickTo(el, "x", { duration: 1, ease: "elastic.out(1, 0.3)" });
    const yTo = gsap.quickTo(el, "y", { duration: 1, ease: "elastic.out(1, 0.3)" });

    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const { height, width, left, top } = el.getBoundingClientRect();
      const x = clientX - (left + width / 2);
      const y = clientY - (top + height / 2);
      xTo(x * 0.4); // 40% magnetic pull
      yTo(y * 0.4);
    };

    const handleMouseLeave = () => {
      xTo(0);
      yTo(0);
    };

    el.addEventListener("mousemove", handleMouseMove);
    el.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      el.removeEventListener("mousemove", handleMouseMove);
      el.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return ref;
}

// React hook for 3D Tilt effect
export function useTilt<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const { height, width, left, top } = el.getBoundingClientRect();
      const x = (clientX - left) / width - 0.5; // -0.5 to 0.5
      const y = (clientY - top) / height - 0.5; // -0.5 to 0.5
      
      gsap.to(el, {
        rotationY: x * 20, // Max 20 deg
        rotationX: -y * 20,
        transformPerspective: 1000,
        ease: "power2.out",
        duration: 0.5
      });
    };

    const handleMouseLeave = () => {
      gsap.to(el, {
        rotationY: 0,
        rotationX: 0,
        ease: "power3.out",
        duration: 0.8
      });
    };

    el.addEventListener("mousemove", handleMouseMove);
    el.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      el.removeEventListener("mousemove", handleMouseMove);
      el.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return ref;
}
