"use client";

import { useEffect, useState } from "react";

interface Particle {
  id: number;
  left: string;
  size: "small" | "medium" | "large";
  duration: number;
  delay: number;
}

export function Particles() {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    // Generate particles on client-side only
    const generatedParticles: Particle[] = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      size: (["small", "medium", "large"] as const)[Math.floor(Math.random() * 3)],
      duration: 15 + Math.random() * 20, // 15-35 seconds
      delay: Math.random() * 15, // 0-15 seconds delay
    }));
    setParticles(generatedParticles);
  }, []);

  if (particles.length === 0) return null;

  return (
    <div className="particles-container" aria-hidden="true">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className={`particle particle--${particle.size}`}
          style={{
            left: particle.left,
            animationDuration: `${particle.duration}s`,
            animationDelay: `${particle.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
