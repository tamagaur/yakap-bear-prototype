import type { LedColor } from "@/components/bear/bear-figure";

/** The heart light always comes with words, never color alone. */
export const HEART_LIGHT: Record<LedColor, { dot: string; color: string; meaning: string }> = {
  green: { dot: "bg-[#4cc27a]", color: "green", meaning: "Connected" },
  blue: { dot: "bg-[#4a9be0]", color: "blue", meaning: "Reminder waiting" },
  amber: { dot: "bg-[#f2a33a]", color: "amber", meaning: "Low battery" },
  gray: { dot: "bg-[#a39a93]", color: "off", meaning: "Offline" },
};
