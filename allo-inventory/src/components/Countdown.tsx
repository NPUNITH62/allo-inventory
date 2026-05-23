"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface CountdownProps {
  expiresAt: string; // ISO string
  onExpired: () => void;
}

export function Countdown({ expiresAt, onExpired }: CountdownProps) {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  });

  useEffect(() => {
    if (secondsLeft <= 0) {
      onExpired();
      return;
    }
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpired, secondsLeft]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const isUrgent = secondsLeft <= 60;

  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 rounded-full font-mono font-bold text-lg
        ${isUrgent
          ? "bg-red-100 text-red-700 animate-pulse"
          : "bg-amber-100 text-amber-700"
        }`}
    >
      <Clock className="w-5 h-5" />
      {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
    </div>
  );
}
