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
      const logoWidth = img.width * scale;
      const logoHeight = 14;

      // Make canvas larger to allow particles to scatter
      const padding = 60;
      canvas.width = (logoWidth + padding * 2) * 2;
      canvas.height = (logoHeight + padding * 2) * 2;
      canvas.style.width = `${logoWidth + padding * 2}px`;
      canvas.style.height = `${logoHeight + padding * 2}px`;
      canvas.style.margin = `-${padding}px`;
      canvasSizeRef.current = {
        width: logoWidth * 2,
        height: logoHeight * 2,
        offsetX: padding * 2,
        offsetY: padding * 2
      };

      const offsetX = canvasSizeRef.current.offsetX;
      const offsetY = canvasSizeRef.current.offsetY;
      const logoW = canvasSizeRef.current.width;
      const logoH = canvasSizeRef.current.height;

      // Draw image in center to get pixel data
      ctx.drawImage(img, offsetX, offsetY, logoW, logoH);
      const imageData = ctx.getImageData(offsetX, offsetY, logoW, logoH);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const particles: Particle[] = [];
      const gap = 2;

      for (let y = 0; y < logoH; y += gap) {
        for (let x = 0; x < logoW; x += gap) {
          const i = (y * logoW + x) * 4;
          const alpha = imageData.data[i + 3];

          if (alpha > 128) {
            const r = imageData.data[i];
            const g = imageData.data[i + 1];
            const b = imageData.data[i + 2];

            const angle = Math.random() * Math.PI * 2;
            const distance = 20 + Math.random() * 30;

            const originX = x + offsetX;
            const originY = y + offsetY;

            particles.push({
              x: originX + Math.cos(angle) * distance,
              y: originY + Math.sin(angle) * distance,
              originX,
              originY,
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
        // Draw crisp logo image at offset position
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
