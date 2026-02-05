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
  const canvasSizeRef = useRef({ width: 0, height: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = "/ALLCLOTHES.png";

    img.onload = () => {
      logoImgRef.current = img;
      const scale = 14 / img.height;
      const width = img.width * scale;
      const height = 14;

      canvas.width = width * 2;
      canvas.height = height * 2;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvasSizeRef.current = { width: canvas.width, height: canvas.height };

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const particles: Particle[] = [];
      const gap = 2;

      for (let y = 0; y < canvas.height; y += gap) {
        for (let x = 0; x < canvas.width; x += gap) {
          const i = (y * canvas.width + x) * 4;
          const alpha = imageData.data[i + 3];

          if (alpha > 128) {
            const r = imageData.data[i];
            const g = imageData.data[i + 1];
            const b = imageData.data[i + 2];

            const angle = Math.random() * Math.PI * 2;
            const distance = 20 + Math.random() * 30;

            particles.push({
              x: x + Math.cos(angle) * distance,
              y: y + Math.sin(angle) * distance,
              originX: x,
              originY: y,
              color: `rgb(${r}, ${g}, ${b})`,
              size: gap * 0.8,
              vx: 0,
              vy: 0,
              friction: 0.92,
              ease: 0.04 + Math.random() * 0.02,
            });
          }
        }
      }

      particlesRef.current = particles;
      phaseRef.current = "assemble";
      timerRef.current = 0;
      setIsLoaded(true);
      animate();
    };

    function scatterParticles() {
      particlesRef.current.forEach((p) => {
        const angle = Math.random() * Math.PI * 2;
        const force = 0.8 + Math.random() * 1.2;
        p.vx = Math.cos(angle) * force;
        p.vy = Math.sin(angle) * force;
      });
    }

    function animate() {
      if (!ctx || !canvas) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (phaseRef.current === "assemble") {
        let allSettled = true;

        particlesRef.current.forEach((p) => {
          const dx = p.originX - p.x;
          const dy = p.originY - p.y;

          if (Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3) {
            allSettled = false;
          }

          p.vx += dx * p.ease;
          p.vy += dy * p.ease;
          p.vx *= p.friction;
          p.vy *= p.friction;
          p.x += p.vx;
          p.y += p.vy;

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
          ctx.drawImage(logoImgRef.current, 0, 0, canvasSizeRef.current.width, canvasSizeRef.current.height);
        }

        timerRef.current++;
        if (timerRef.current > 300) { // Hold for ~5 seconds at 60fps
          phaseRef.current = "scatter";
          timerRef.current = 0;
          scatterParticles();
        }
      } else if (phaseRef.current === "scatter") {
        particlesRef.current.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.995;
          p.vy *= 0.995;

          ctx.fillStyle = p.color;
          ctx.fillRect(p.x, p.y, p.size, p.size);
        });

        timerRef.current++;
        if (timerRef.current > 90) { // Scatter for ~1.5 seconds
          phaseRef.current = "assemble";
          timerRef.current = 0;
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: "block",
        opacity: isLoaded ? 1 : 0,
        transition: "opacity 0.3s ease",
      }}
    />
  );
}
