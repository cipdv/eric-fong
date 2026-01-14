"use client";

import { useEffect, useState } from "react";

type Props = {
  message: string;
  durationMs?: number;
};

export default function FulfilledNotice({ message, durationMs = 3000 }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => setVisible(false), durationMs);
    return () => clearTimeout(id);
  }, [durationMs]);

  if (!visible) return null;

  return (
    <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
      {message}
    </div>
  );
}
