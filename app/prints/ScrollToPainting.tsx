'use client';

import { useEffect } from "react";

type ScrollToPaintingProps = {
  targetId?: string;
};

export default function ScrollToPainting({ targetId }: ScrollToPaintingProps) {
  useEffect(() => {
    if (!targetId) return;

    const element = document.getElementById(`painting-${targetId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [targetId]);

  return null;
}
