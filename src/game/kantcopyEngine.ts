/**
 * @file kantcopyEngine.ts — Kant Copy (كانت كوبي).
 *
 * 4 joueurs en 2 équipes (2v2 face-à-face). Baraja 40 cartes.
 * Chaque joueur tient TOUJOURS 4 cartes en main.
 * Objectif : un joueur réunit 4 cartes de même valeur (Kant) → il envoie
 * un signal discret à son partenaire qui doit annoncer "Carte Copie !".
 * Si un adversaire détecte le signal → vol = +2 points.
 *
 * Spécificités :
 *  - Pas de plis, pas de captures, pas de tapis.
 *  - Communication codée centrale (signal partenaire).
 *  - Mécanique de vol par adversaire.
 */

export type Suit = 'oros' | 'copas' | 'espadas' | 'bastos';
export type CardValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 10 | 11 | 12;

export interface Card {
  suit: Suit;
  value: CardValue;
  id: string;        // ex: "07-oros"
}

export interface Player {
  id: string;
  name: string;
  team: 'A' | 'B';
  hand: Card[];          // toujours 4 cartes
  isBot: boolean;
  /** Signal envoyé (au tour précédent ou actuel). UI-only, n'affecte pas la résolution. */
  signalSent: boolean;
  /** Vrai si ce joueur détient un Kant (calculé en temps réel). */
  hasKant: boolean;
  /** Valeur du Kant si présent. */
  kantValue: CardValue | null;
}

export type Phase = 'playing' | 'revealing' | 'gameOver';

export interface GameState {
  players: Player[];                  // 4 joueurs
  stock: Card[];                      // talon central
  discard: Card[];                    // défausse
  currentPlayerIndex: number;
  phase: Phase;
  scoreA: number;
  scoreB: number;
  targetScore: number;
  /** Index du dernier joueur qui a "défaussé une carte spécifique" — utilisé par stratégie IA. */
  lastDiscardBy: number | null;
  /** Annonce en cours (joueur qui crie "Carte Copie !"). */
  pendingAnnounce: { byIndex: number; targetIndex: number } | null;
  /** Résultat de la dernière manche. */
  lastRound: {
    type: 'win' | 'steal' | 'wrong' | 'exhausted';
    by: 'A' | 'B' | null;
    points: number;
    kantHolderName: string | null;
  } | null;
  /** Variante en cours. */
  variant: VariantOptions;
}

export interface VariantOptions {
  handSize: 4 | 5;                    // 4 = classique, 5 = variante
  acceptTringla?: boolean;            // accepte 4 cartes consécutives même couleur
  anyoneCanSteal?: boolean;           // variante voleur : même partenaire peut "voler"
  faceUpHands?: boolean;              // variante apprentissage à découvert
  silentMode?: boolean;               // signaux visuels uniquement (UI)
  bonusFigures?: boolean;             // +2 si Kant figures, +3 si Kant As
  targetScore?: number;
}

export type GameAction =
  | { type: 'DRAW'; from: 'stock' | 'discard' }
  | { type: 'DISCARD'; cardId: string }
  | { type: 'SEND_SIGNAL' }                                         // joueur avec Kant signale
  | { type: 'ANNOUNCE_COPY'; byIndex: number; targetIndex: number } // partenaire ou voleur
  | { type: 'RESOLVE_ANNOUNCE' }                                    // révèle main du target
  | { type: 'NEXT_ROUND' }
  | { type: 'RESET'; variant?: VariantOptions };

// ============================================================
// CONSTANTES
// ============================================================

export const SUITS: Suit[] = ['oros', 'copas', 'espadas', 'bastos'];
export const VALUES: CardValue[] = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
export const HAND_SIZE_DEFAULT = 4;
export const PLAYERS_COUNT = 4;

export const SUIT_GLYPH: Record<Suit, string> = {
  oros: '💰', copas: '🏆', espadas: '⚔️', bastos: '🌳',
};

export const VALUE_NAMES: Record<CardValue, string> = {
  1: 'As', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7',
  10: 'Sota', 11: 'Caballo', 12: 'Rey',
};

export function imageCode(card: Card): string {
  const v = card.value === 1 ? 'A' : card.value === 10 ? 'S' : card.value === 11 ? 'C' : card.value === 12 ? 'R' : String(card.value);
  return `${v}${card.suit[0].toUpperCase()}`;
}

// ============================================================
// DECK
// ============================================================

export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push({ suit, value, id: `${value.toString().padStart(2, '0')}-${suit}` });
    }
  }
  return deck;
}

export function shuffle(deck: Card[]): Card[] {
  const out = [...deck];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ============================================================
// HELPERS
// ============================================================

export function detectKant(hand: Card[], opts: VariantOptions): { has: boolean; value: CardValue | null } {
  if (hand.length !== opts.handSize) return { has: false, value: null };
  // 4 cartes de même valeur (peu importe handSize, on cherche un sous-ensemble de 4)
  const valueCounts: Record<number, Card[]> = {};
  for (const c of hand) {
    if (!valueCounts[c.value]) valueCounts[c.value] = [];
    valueCounts[c.value].push(c);
  }
  for (const v of Object.keys(valueCounts)) {
    if (valueCounts[Number(v)].length >= 4) return { has: true, value: Number(v) as CardValue };
  }
  // Tringla (variante) : 4 cartes consécutives même couleur
  if (opts.acceptTringla) {
    for (const suit of SUITS) {
      const sameSuit = hand.filter((c) => c.suit === suit).map((c) => c.value).sort((a, b) => a - b);
      // valeurs naturelles dans la baraja: 1..7, 10..12 (pas de 8/9)
      // on cherche 4 valeurs consécutives sans saut
      for (let i = 0; i < sameSuit.length - 3; i++) {
        if (sameSuit[i + 1] === sameSuit[i] + 1 &&
            sameSuit[i + 2] === sameSuit[i] + 2 &&
            sameSuit[i + 3] === sameSuit[i] + 3) {
          return { has: true, value: sameSuit[i] as CardValue };
        }
      }
    }
  }
  return { has: false, value: null };
}

function refreshKants(state: GameState): GameState {
  const players = state.players.map((p) => {
    const k = detectKant(p.hand, state.variant);
    return { ...p, hasKant: k.has, kantValue: k.value };
  });
  return { ...state, players };
}

function partnerOf(idx: number): number {
  // 0(N) ↔ 2(S), 1(E) ↔ 3(W)
  return (idx + 2) % 4;
}

function teamOf(idx: number): 'A' | 'B' {
  return idx === 0 || idx === 2 ? 'A' : 'B';
}

export function createInitialState(variant: Partial<VariantOptions> = {}): GameState {
  const opts: VariantOptions = {
    handSize: variant.handSize ?? HAND_SIZE_DEFAULT,
    acceptTringla: variant.acceptTringla ?? false,
    anyoneCanSteal: variant.anyoneCanSteal ?? false,
    faceUpHands: variant.faceUpHands ?? false,
    silentMode: variant.silentMode ?? false,
    bonusFigures: variant.bonusFigures ?? false,
    targetScore: variant.targetScore ?? 7,
  };
  const deck = shuffle(buildDeck());
  const players: Player[] = [];
  let i = 0;
  const names = ['Nord', 'Est', 'Sud', 'Ouest'];
  const teams: ('A' | 'B')[] = ['A', 'B', 'A', 'B'];
  for (let p = 0; p < PLAYERS_COUNT; p++) {
    const hand = deck.slice(i, i + opts.handSize);
    i += opts.handSize;
    players.push({
      id: `p${p}`, name: names[p], team: teams[p], hand,
      isBot: p !== 2,        // par défaut Sud = humain solo, autres = IA
      signalSent: false, hasKant: false, kantValue: null,
    });
  }
  const stock = deck.slice(i);
  const initial: GameState = {
    players, stock, discard: [],
    currentPlayerIndex: 1,    // antihoraire : à droite du donneur (Nord)
    phase: 'playing',
    scoreA: 0, scoreB: 0,
    targetScore: opts.targetScore!,
    lastDiscardBy: null,
    pendingAnnounce: null,
    lastRound: null,
    variant: opts,
  };
  return refreshKants(initial);
}

// ============================================================
// REDUCER
// ============================================================

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'RESET':
      return createInitialState(action.variant ?? state.variant);

    case 'NEXT_ROUND': {
      // Conserve le score, redistribue
      const next = createInitialState(state.variant);
      return { ...next, scoreA: state.scoreA, scoreB: state.scoreB };
    }

    case 'DRAW': {
      if (state.phase !== 'playing') return state;
      const cur = state.players[state.currentPlayerIndex];
      if (cur.hand.length !== state.variant.handSize) return state;       // déjà pioché
      let card: Card | undefined;
      let stock = state.stock, discard = state.discard;
      if (action.from === 'stock') {
        if (stock.length === 0) {
          // recycle defausse
          if (discard.length === 0) {
            // épuisement total → match nul
            return {
              ...state,
              phase: 'revealing',
              lastRound: { type: 'exhausted', by: null, points: 0, kantHolderName: null },
            };
          }
          stock = shuffle(discard);
          discard = [];
        }
        card = stock[stock.length - 1];
        stock = stock.slice(0, -1);
      } else {
        if (discard.length === 0) return state;
        card = discard[discard.length - 1];
        discard = discard.slice(0, -1);
      }
      if (!card) return state;
      const players = state.players.map((p, i) =>
        i === state.currentPlayerIndex ? { ...p, hand: [...p.hand, card!] } : p,
      );
      return refreshKants({ ...state, stock, discard, players });
    }

    case 'DISCARD': {
      if (state.phase !== 'playing') return state;
      const cur = state.players[state.currentPlayerIndex];
      if (cur.hand.length !== state.variant.handSize + 1) return state;   // doit avoir pioché
      const cardIdx = cur.hand.findIndex((c) => c.id === action.cardId);
      if (cardIdx < 0) return state;
      const card = cur.hand[cardIdx];
      const players = state.players.map((p, i) =>
        i === state.currentPlayerIndex ? { ...p, hand: p.hand.filter((c) => c.id !== action.cardId) } : p,
      );
      const discard = [...state.discard, card];
      const nextIdx = (state.currentPlayerIndex + 1) % PLAYERS_COUNT;     // antihoraire = +1 dans un cercle convenu
      return refreshKants({ ...state, players, discard, currentPlayerIndex: nextIdx, lastDiscardBy: state.currentPlayerIndex });
    }

    case 'SEND_SIGNAL': {
      // Joueur courant signale à son partenaire (UI-only flag).
      const players = state.players.map((p, i) =>
        i === state.currentPlayerIndex ? { ...p, signalSent: true } : p,
      );
      return { ...state, players };
    }

    case 'ANNOUNCE_COPY': {
      if (state.phase !== 'playing') return state;
      // L'annonceur prétend que `targetIndex` a un Kant.
      return { ...state, pendingAnnounce: { byIndex: action.byIndex, targetIndex: action.targetIndex } };
    }

    case 'RESOLVE_ANNOUNCE': {
      if (!state.pendingAnnounce) return state;
      const { byIndex, targetIndex } = state.pendingAnnounce;
      const target = state.players[targetIndex];
      const k = detectKant(target.hand, state.variant);
      const announcerTeam = teamOf(byIndex);
      const targetTeam = teamOf(targetIndex);

      if (k.has) {
        // Kant confirmé
        const stolen = announcerTeam !== targetTeam;
        // Bonus figures (variante)
        let pts = stolen ? 2 : 1;
        if (state.variant.bonusFigures) {
          if (k.value === 1) pts += 3;                                    // 4 As = +3
          else if (k.value === 10 || k.value === 11 || k.value === 12) pts += 2; // figures = +2
        }
        const winningTeam = announcerTeam;
        return {
          ...state,
          phase: 'revealing',
          pendingAnnounce: null,
          scoreA: state.scoreA + (winningTeam === 'A' ? pts : 0),
          scoreB: state.scoreB + (winningTeam === 'B' ? pts : 0),
          lastRound: {
            type: stolen ? 'steal' : 'win',
            by: winningTeam, points: pts,
            kantHolderName: target.name,
          },
        };
      }
      // Annonce ratée : pénalité pour l'annonceur
      const losingTeam = announcerTeam;
      const winningTeam: 'A' | 'B' = losingTeam === 'A' ? 'B' : 'A';
      const pts = 1;
      return {
        ...state,
        phase: 'revealing',
        pendingAnnounce: null,
        scoreA: state.scoreA + (winningTeam === 'A' ? pts : 0),
        scoreB: state.scoreB + (winningTeam === 'B' ? pts : 0),
        lastRound: { type: 'wrong', by: winningTeam, points: pts, kantHolderName: null },
      };
    }
  }
}

export function isGameOver(state: GameState): boolean {
  return state.scoreA >= state.targetScore || state.scoreB >= state.targetScore;
}

export function winner(state: GameState): 'A' | 'B' | null {
  if (state.scoreA >= state.targetScore && state.scoreA > state.scoreB) return 'A';
  if (state.scoreB >= state.targetScore && state.scoreB > state.scoreA) return 'B';
  return null;
}

// ============================================================
// IA (heuristique simple pour vs-bot)
// ============================================================

/** Choisit la meilleure carte à défausser : isolée (pas en paire). */
export function aiPickDiscard(hand: Card[]): string {
  const counts: Record<number, Card[]> = {};
  for (const c of hand) (counts[c.value] ??= []).push(c);
  const sorted = Object.values(counts).sort((a, b) => a.length - b.length);
  return sorted[0][0].id;
}

/** Teste si l'IA partenaire détecte le signal (probabilité variable). */
export function aiDetectSignal(state: GameState, partnerIdx: number, difficulty: 'easy' | 'medium' | 'hard'): boolean {
  const partner = state.players[partnerIdx];
  if (!partner.signalSent) return false;
  const p = difficulty === 'easy' ? 0.3 : difficulty === 'medium' ? 0.6 : 0.9;
  return Math.random() < p;
}

/** Teste si une IA adverse détecte le signal (probabilité plus faible). */
export function aiDetectStealOpportunity(state: GameState, observerIdx: number, difficulty: 'easy' | 'medium' | 'hard'): { steal: boolean; targetIdx: number } {
  // L'IA observe les autres joueurs. Si un d'eux a "signalSent" récent, elle peut tenter le vol.
  for (let i = 0; i < state.players.length; i++) {
    if (i === observerIdx) continue;
    if (teamOf(i) === teamOf(observerIdx)) continue;
    if (state.players[i].signalSent) {
      const p = difficulty === 'easy' ? 0.05 : difficulty === 'medium' ? 0.2 : 0.4;
      if (Math.random() < p) return { steal: true, targetIdx: partnerOf(i) };
    }
  }
  return { steal: false, targetIdx: -1 };
}

/**
 * Détection de blocage Kant Copy :
 *  - Stock vide + défausse vide (impossible de continuer)
 *  - OU dernière manche a été déclenchée par "exhausted" (talon épuisé sans Kant)
 *  - Aucun joueur n'a un Kant en main et plus de cartes à piocher
 */
export function isStuck(state: GameState): boolean {
  if (state.phase !== 'playing') {
    return state.lastRound?.type === 'exhausted';
  }
  // Si le talon ET la défausse sont vides ET aucun joueur n'a de Kant → stuck
  if (state.stock.length === 0 && state.discard.length === 0) {
    const anyKant = state.players.some((p) => p.hasKant);
    if (!anyKant) return true;
  }
  return false;
}
