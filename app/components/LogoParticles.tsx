"use client";

import { useEffect, useRef, useState } from "react";

interface Particle {
  x: number;
  y: number;
  originX: number;
  originY: number;
  color: string;
  size: number;
  vx: number;
  vy: number;
  friction: number;
  ease: number;
}

export default function LogoParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const animationRef = useRef<number>();
  const particlesRef = useRef<Particle[]>([]);
  const phaseRef = useRef<"assemble" | "hold" | "scatter">("assemble");
  const timerRef = useRef<number>(0);
  const logoImgRef = useRef<HTMLImageElement | null>(null);
  const canvasSizeRef = useRef({ width: 0, height: 0, offsetX: 0, offsetY: 0 });
  const lastFrameRef = useRef<number>(0);
  const isVisibleRef = useRef(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    // Pause animation when canvas is not visible
    const observer = new IntersectionObserver(
      ([entry]) => { isVisibleRef.current = entry.isIntersecting; },
      { threshold: 0 }
    );
    observer.observe(canvas);

    const img = new Image();
    img.src = "/ALLCLOTHES.png";

    img.onload = () => {
      logoImgRef.current = img;

      // Target logo height in display pixels
      const targetHeight = 14;
      const scale = targetHeight / img.height;
      const logoWidth = Math.round(img.width * scale);
      const logoHeight = targetHeight;

      // Padding for particles to scatter
      const padding = 50;

      // Use 2x for retina
      const dpr = 2;
      const canvasW = (logoWidth + padding * 2) * dpr;
      const canvasH = (logoHeight + padding * 2) * dpr;

      canvas.width = canvasW;
      canvas.height = canvasH;
      canvas.style.width = `${logoWidth + padding * 2}px`;
      canvas.style.height = `${logoHeight + padding * 2}px`;
      canvas.style.margin = `-${padding}px`;

      const offsetX = padding * dpr;
      const offsetY = padding * dpr;
      const logoW = logoWidth * dpr;
      const logoH = logoHeight * dpr;

      canvasSizeRef.current = {
        width: logoW,
        height: logoH,
        offsetX,
        offsetY
      };

      // Draw image to read pixel data
      ctx.drawImage(img, offsetX, offsetY, logoW, logoH);
      const imageData = ctx.getImageData(offsetX, offsetY, logoW, logoH);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const particles: Particle[] = [];
      const gap = 2;

      for (let y = 0; y < logoH; y += gap) {
        for (let x = 0; x < logoW; x += gap) {
          const i = (y * logoW + x) * 4;
          const r = imageData.data[i];
          const g = imageData.data[i + 1];
          const b = imageData.data[i + 2];
          const alpha = imageData.data[i + 3];

          // Check if pixel is visible (either has alpha or is dark on white bg)
          const isDark = (r + g + b) / 3 < 128;
          const isVisible = alpha > 50 || (alpha > 0 && isDark);

          if (isVisible) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 30 + Math.random() * 50;

            const originX = x + offsetX;
            const originY = y + offsetY;

            particles.push({
              x: originX + Math.cos(angle) * distance,
              y: originY + Math.sin(angle) * distance,
              originX,
              originY,
              color: alpha > 50 ? `rgb(${r}, ${g}, ${b})` : "#000",
              size: gap * 0.9,
              vx: 0,
              vy: 0,
              friction: 0.96,
              ease: 0.02 + Math.random() * 0.01,
            });
          }
        }
      }

      particlesRef.current = particles;
      phaseRef.current = "assemble";
      timerRef.current = 0;
      setIsLoaded(true);
      animate(0);
    };

    function scatterParticles() {
      particlesRef.current.forEach((p) => {
        // Reset position to origin first
        p.x = p.originX;
        p.y = p.originY;

        // Quick burst but not too far
        const angle = Math.random() * Math.PI * 2;
        const force = 1.5 + Math.random() * 1.5;
        p.vx = Math.cos(angle) * force;
        p.vy = Math.sin(angle) * force;
      });
    }

    // Target ~30fps (33ms between frames) instead of 60fps
    const FRAME_INTERVAL = 33;

    function animate(timestamp: number) {
      if (!ctx || !canvas) return;

      animationRef.current = requestAnimationFrame(animate);

      // Skip frame if not visible
      if (!isVisibleRef.current) return;

      // Throttle to ~30fps
      const elapsed = timestamp - lastFrameRef.current;
      if (elapsed < FRAME_INTERVAL) return;
      lastFrameRef.current = timestamp - (elapsed % FRAME_INTERVAL);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (phaseRef.current === "assemble") {
        let allSettled = true;

        particlesRef.current.forEach((p) => {
          const dx = p.originX - p.x;
          const dy = p.originY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > 0.5) {
            allSettled = false;
            // Stronger lerp to compensate for lower framerate
            p.x += dx * 0.15;
            p.y += dy * 0.15;
          } else {
            p.x = p.originX;
            p.y = p.originY;
          }

          ctx.fillStyle = p.color;
          ctx.fillRect(p.x, p.y, p.size, p.size);
        });

        if (allSettled) {
          phaseRef.current = "hold";
          timerRef.current = 0;
        }
      } else if (phaseRef.current === "hold") {
        // Draw crisp logo image
        if (logoImgRef.current) {
          ctx.drawImage(
            logoImgRef.current,
            canvasSizeRef.current.offsetX,
            canvasSizeRef.current.offsetY,
            canvasSizeRef.current.width,
            canvasSizeRef.current.height
          );
        }

        timerRef.current++;
        if (timerRef.current > 240) { // ~8 seconds at 30fps
          phaseRef.current = "scatter";
          timerRef.current = 0;
          scatterParticles();
        }
      } else if (phaseRef.current === "scatter") {
        particlesRef.current.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.96;
          p.vy *= 0.96;

          ctx.fillStyle = p.color;
          ctx.fillRect(p.x, p.y, p.size, p.size);
        });

        timerRef.current++;
        if (timerRef.current > 40) { // ~1.3 seconds at 30fps
          phaseRef.current = "assemble";
          timerRef.current = 0;
        }
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: "block",
        opacity: isLoaded ? 1 : 0,
        transition: "opacity 0.3s ease",
        background: "transparent",
        pointerEvents: "none",
      }}
    />
  );
}
