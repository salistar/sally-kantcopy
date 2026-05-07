/**
 * @file variants.ts — Catalogue Kant Copy (كانت كوبي).
 * Multi >1 joueur : socket+STUN/TURN+Jitsi via /room/create. Solo vs-ai sans socket.
 */

export type VariantKey =
  | 'kant-classic' | 'kant-5cards' | 'kant-tringla' | 'kant-voleur'
  | 'kant-casa-sala' | 'kant-silent' | 'kant-discovery'
  | 'vs-ai';

export interface Variant {
  key: VariantKey;
  engine: 'kant' | 'vs-ai';
  emoji: string;
  name: string;
  shortDesc: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  winRate: string;
  duration: string;
  cards: number;
  rules: { title: string; body: string }[];
  available: boolean;
  options?: {
    handSize?: 4 | 5;
    acceptTringla?: boolean;
    anyoneCanSteal?: boolean;
    silentMode?: boolean;
    faceUpHands?: boolean;
    bonusFigures?: boolean;
    targetScore?: number;
    multi?: boolean;
  };
}

export const VARIANTS: Variant[] = [
  {
    key: 'kant-classic', engine: 'kant', emoji: '📡', name: 'Kant Copy Classique',
    shortDesc: '4 joueurs en 2v2, 4 cartes en main, signal codé. 7 points.',
    difficulty: 4, winRate: '~50%', duration: '~30 min', cards: 40, available: true,
    options: { handSize: 4, targetScore: 7, multi: true },
    rules: [
      { title: 'Vue d\'ensemble', body: 'Jeu marocain unique : collecte secrète + signal codé entre partenaires. 4 joueurs en 2 équipes face-à-face.' },
      { title: 'Cartes', body: 'Baraja 40 cartes : 4 couleurs (Oros, Copas, Espadas, Bastos) × 10 valeurs (1-7 + Sota=10, Caballo=11, Rey=12). PAS de 8 ni 9.' },
      { title: 'Mise en place', body: '4 cartes par joueur (face cachée). 24 dans la pioche. Pas de tapis. Antihoraire.' },
      { title: 'Tour de jeu', body: 'À ton tour : 1) pioche 1 carte (talon ou défausse). 2) défausse 1 carte. Tu gardes toujours 4 cartes.' },
      { title: 'Le Kant', body: 'Réunir 4 cartes de même valeur en main (4 Sotas, 4 Reyes, 4 As…). Comme la baraja a 4 par valeur, un seul Kant possible à la fois.' },
      { title: 'Signal codé', body: 'Tu NE PEUX PAS annoncer toi-même ! Tu envoies un signal discret à ton partenaire (clin d\'œil, mot codé "Atay sakhoun"…). Il/elle annonce.' },
      { title: 'Annonce "Carte Copie !"', body: 'Quand le partenaire détecte le signal, il crie "Carte Copie !". Tu révèles. Vérification → +1 point.' },
      { title: 'Vol par adversaire', body: 'Si un adversaire détecte le signal AVANT ton partenaire, il peut crier "Carte Copie !" → vol = +2 points pour son équipe.' },
      { title: 'Annonce ratée', body: 'Si annonce sans Kant confirmé → −1 ou −2 points (manche perdue).' },
      { title: 'Talon épuisé', body: 'Talon recyclé depuis la défausse. Si épuisé 2× sans Kant → match nul, redistribution.' },
      { title: 'Stratégie de dissimulation', body: 'Reste calme. Envoie de FAUX signaux pour brouiller les pistes adverses. Change ton signal à chaque manche.' },
      { title: 'Stratégie de détection', body: 'Observe les changements de comportement (regard, défausse, rythme). Compte les défausses par valeur.' },
      { title: 'Victoire', body: 'Première équipe à 7 points.' },
    ],
  },
  {
    key: 'kant-5cards', engine: 'kant', emoji: '🖐️', name: 'Kant Copy 5 cartes',
    shortDesc: '5 cartes en main au lieu de 4 — plus de marge.',
    difficulty: 4, winRate: '~50%', duration: '~40 min', cards: 40, available: true,
    options: { handSize: 5, targetScore: 7, multi: true },
    rules: [
      { title: 'Différence', body: 'Chaque joueur tient 5 cartes en main (au lieu de 4). Le Kant reste 4 cartes identiques dans tes 5.' },
      { title: 'Plus de marge', body: 'Une carte "libre" en plus = plus de flexibilité tactique.' },
      { title: 'Durée', body: 'Parties légèrement plus longues.' },
    ],
  },
  {
    key: 'kant-tringla', engine: 'kant', emoji: '🪜', name: 'Kant Tringla',
    shortDesc: 'Accepte aussi 4 cartes consécutives même couleur (suite).',
    difficulty: 5, winRate: '~50%', duration: '~30 min', cards: 40, available: true,
    options: { handSize: 4, acceptTringla: true, targetScore: 7, multi: true },
    rules: [
      { title: 'Différence', body: 'Le Kant peut être : 4 cartes identiques (classique) OU 4 cartes consécutives même couleur (4-5-6-7 d\'Oros par ex).' },
      { title: 'Plus de chances', body: 'Plus facile de réunir les conditions, mais plus difficile à dissimuler.' },
      { title: 'Suites valides', body: 'Pas de saut. La baraja n\'a pas 8 ni 9 → 7→10 n\'est PAS consécutif. Suites : 1-2-3-4 jusqu\'à 4-5-6-7, ou 10-11-12 (3 cartes seulement).' },
    ],
  },
  {
    key: 'kant-voleur', engine: 'kant', emoji: '🦹', name: 'Kant Voleur',
    shortDesc: 'Tout joueur peut voler — même ton propre partenaire.',
    difficulty: 5, winRate: '~50%', duration: '~30 min', cards: 40, available: true,
    options: { handSize: 4, anyoneCanSteal: true, targetScore: 7, multi: true },
    rules: [
      { title: 'Différence', body: 'Tout joueur (pas seulement les adversaires) peut voler une annonce.' },
      { title: 'Tension extrême', body: 'Même ton partenaire peut "voler" si tu tardes à annoncer après son signal.' },
      { title: 'Stratégie', body: 'Annonce IMMÉDIATEMENT dès que tu détectes le signal. Pas de perte de temps.' },
    ],
  },
  {
    key: 'kant-casa-sala', engine: 'kant', emoji: '🏛️', name: 'Kant Casa/Sala',
    shortDesc: 'Bonus Kant figures (+2) et As (+3).',
    difficulty: 4, winRate: '~50%', duration: '~30 min', cards: 40, available: true,
    options: { handSize: 4, bonusFigures: true, targetScore: 11, multi: true },
    rules: [
      { title: 'Variante locale', body: 'Casablanca, Salé, Rabat — bonus pour Kants prestigieux.' },
      { title: 'Bonus figures', body: 'Kant de Sotas/Caballos/Reyes = +2 points supplémentaires.' },
      { title: 'Bonus As', body: 'Kant d\'As (4 cartes valeur 1) = +3 points supplémentaires.' },
      { title: 'Cible', body: '11 points pour gagner.' },
    ],
  },
  {
    key: 'kant-silent', engine: 'kant', emoji: '🤫', name: 'Kant Silencieux',
    shortDesc: 'Aucune voix autorisée. Signaux visuels uniquement.',
    difficulty: 5, winRate: '~50%', duration: '~30 min', cards: 40, available: true,
    options: { handSize: 4, silentMode: true, targetScore: 7, multi: true },
    rules: [
      { title: 'Mode silence', body: 'Aucune communication verbale autorisée. Seuls signaux VISUELS physiques.' },
      { title: 'Mode mobile', body: 'Avec audio/vidéo activée, l\'expérience est encore plus intense.' },
      { title: 'Détection', body: 'Beaucoup plus difficile : tout repose sur la lecture corporelle.' },
    ],
  },
  {
    key: 'kant-discovery', engine: 'kant', emoji: '🎓', name: 'Kant À Découvert',
    shortDesc: 'Toutes les mains visibles — mode apprentissage.',
    difficulty: 1, winRate: 'N/A', duration: '~15 min', cards: 40, available: true,
    options: { handSize: 4, faceUpHands: true, targetScore: 5, multi: true },
    rules: [
      { title: 'Mode apprentissage', body: 'Toutes les mains sont visibles par tous les joueurs.' },
      { title: 'Pas de signal nécessaire', body: 'Idéal pour comprendre la mécanique de base.' },
      { title: 'Pour qui', body: 'Débutants, enfants, ou pour expliquer le jeu.' },
    ],
  },
  {
    key: 'vs-ai', engine: 'vs-ai', emoji: '🤖', name: 'Solo vs IA',
    shortDesc: 'Solo : tu joues avec 1 IA partenaire vs 2 IA adverses.',
    difficulty: 3, winRate: '~50%', duration: '~25 min', cards: 40, available: true,
    options: { handSize: 4, targetScore: 7 },
    rules: [
      { title: 'Mode', body: 'Solo : tu joues Sud, ton partenaire IA joue Nord, les adversaires IA sont Est et Ouest.' },
      { title: 'IA partenaire', body: 'Détecte ton signal avec fiabilité variable selon la difficulté.' },
      { title: 'IA adversaires', body: 'Peuvent tenter le vol s\'ils détectent ton signal (probabilité plus faible).' },
      { title: 'Hors-ligne', body: 'Pas de socket, idéal pour s\'entraîner avant les parties multijoueur.' },
    ],
  },
];

export const AVAILABLE_VARIANTS = VARIANTS.filter((v) => v.available);
export function findVariant(key: string): Variant | undefined {
  return VARIANTS.find((v) => v.key === key);
}
