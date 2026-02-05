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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = "/ALLCLOTHES.png";

    img.onload = () => {
      // Set canvas size based on image
      const scale = 14 / img.height; // Match the 14px height
      const width = img.width * scale;
      const height = 14;

      canvas.width = width * 2; // Higher resolution
      canvas.height = height * 2;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      // Draw image to get pixel data
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Create particles from image pixels
      const particles: Particle[] = [];
      const gap = 2; // Sample every 2 pixels for performance

      for (let y = 0; y < canvas.height; y += gap) {
        for (let x = 0; x < canvas.width; x += gap) {
          const i = (y * canvas.width + x) * 4;
          const alpha = imageData.data[i + 3];

          if (alpha > 128) { // Only create particles for visible pixels
            const r = imageData.data[i];
            const g = imageData.data[i + 1];
            const b = imageData.data[i + 2];

            // Random starting position (scattered)
            const angle = Math.random() * Math.PI * 2;
            const distance = 50 + Math.random() * 100;

            particles.push({
              x: x + Math.cos(angle) * distance,
              y: y + Math.sin(angle) * distance,
              originX: x,
              originY: y,
              color: `rgb(${r}, ${g}, ${b})`,
              size: gap * 0.8,
              vx: 0,
              vy: 0,
              friction: 0.9,
              ease: 0.05 + Math.random() * 0.05,
            });
          }
        }
      }

      particlesRef.current = particles;
      setIsLoaded(true);
      animate();
    };

    function animate() {
      if (!ctx || !canvas) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let allSettled = true;

      particlesRef.current.forEach((p) => {
        // Move towards origin
        const dx = p.originX - p.x;
        const dy = p.originY - p.y;

        if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
          allSettled = false;
        }

        p.vx += dx * p.ease;
        p.vy += dy * p.ease;
        p.vx *= p.friction;
        p.vy *= p.friction;
        p.x += p.vx;
        p.y += p.vy;

        // Draw particle
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      });

      if (!allSettled) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Final render - draw the actual image for crisp result
        const img = new Image();
        img.src = "/ALLCLOTHES.png";
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
      }
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
