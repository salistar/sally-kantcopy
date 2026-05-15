/**
 * @file game/vs-bot.tsx
 * @description Route for vs Bot mode in Kant Copy. Redirects to the solo Kant game (vs IA).
 * @project SallyCards - Kant Copy
 */

import { Redirect } from 'expo-router';

export default function VsBotRedirect() {
  return <Redirect href="/game/solo?variant=vs-ai" />;
}

/* === End of game/vs-bot.tsx — Kant Copy — SallyCards === */
