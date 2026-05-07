/**
 * @file app.config.ts — Identité visuelle Kant Copy.
 * Teal profond + orange accent pour évoquer le café marocain (atay + cuivre).
 */
export const APP_CONFIG = {
  name: "Kant Copy",
  primary: "#0F766E",
  secondary: "#134E4A",
  splash: {
    glow: "rgba(19,78,74,0.6)",
    sallyGlow: "rgba(15,118,110,0.8)",
    pillBorder: "rgba(15,118,110,0.5)",
    pillBg: "rgba(19,78,74,0.15)",
    pillText: "#5EEAD4",
    suit: "📡",
    suit2: "🍵",
  },
  slides: {
    slide2: { tint: ["rgba(15,118,110,0.55)","rgba(19,78,74,0.7)","rgba(8,30,28,0.95)"], variant: "scattered" },
    slide3: { tint: ["rgba(245,158,11,0.45)","rgba(19,78,74,0.85)","rgba(8,30,28,0.95)"], variant: "grid" },
    slide4: { tint: ["rgba(168,85,247,0.45)","rgba(15,118,110,0.7)","rgba(8,30,28,0.95)"], variant: "fan" },
  },
} as const;

export type SlideVariant = 'fan' | 'scattered' | 'spread' | 'grid';
