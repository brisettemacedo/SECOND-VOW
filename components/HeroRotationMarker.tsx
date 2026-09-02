"use client";

import { useEffect } from "react";

export default function HeroRotationMarker({ index }: { index: number }) {
  useEffect(() => {
    document.cookie = `second_vow_hero=${index}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, [index]);
  return null;
}
