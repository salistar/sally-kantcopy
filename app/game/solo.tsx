/**
 * @file game/solo.tsx — Écran solo Kant Copy (vs IA).
 * Tu joues Sud, partenaire IA Nord, adversaires IA Est+Ouest.
 */
import React, { useReducer, useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable, Modal, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import AppHeader from '../../src/components/AppHeader';
import { useTheme } from '../../src/contexts/AppProviders';
import { logger } from '../../src/utils/logger';
import { APP_CONFIG } from '../../src/config/app.config';
import { findVariant } from '../../src/game/variants';
import {
  createInitialState, gameReducer, isGameOver, winner, isStuck,
  aiPickDiscard, aiDetectSignal, aiDetectStealOpportunity,
  VALUE_NAMES, SUIT_GLYPH,
} from '../../src/game/kantcopyEngine';
import * as api from '../../shared/api';

const log = logger.scoped('KantCopySolo');
const HUMAN_INDEX = 2;          // Sud
const PARTNER_INDEX = 0;        // Nord

export default function SoloKantCopyScreen() {
  const { variant } = useLocalSearchParams<{ variant: string }>();
  const router = useRouter();
  const { palette } = useTheme();
  const { t } = useTranslation();
  const v = findVariant(variant ?? 'vs-ai');

  if (!v || !v.available || v.options?.multi) {
    return (
      <View style={[styles.root, { backgroundColor: palette.bg }]}>
        <AppHeader title={t('solo.unavailableTitle')} showBack />
        <Text style={{ color: palette.text, padding: 20 }}>{t('solo.unavailableBody')}</Text>
      </View>
    );
  }

  const [state, dispatch] = useReducer(gameReducer, undefined, () =>
    createInitialState({
      handSize: v.options?.handSize ?? 4,
      acceptTringla: v.options?.acceptTringla,
      anyoneCanSteal: v.options?.anyoneCanSteal,
      bonusFigures: v.options?.bonusFigures,
      targetScore: v.options?.targetScore ?? 7,
    }),
  );
  const [showWin, setShowWin] = useState(false);
  const [showStuck, setShowStuck] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const startedAt = useRef(Date.now());
  const me = state.players[HUMAN_INDEX];
  const isMyTurn = state.currentPlayerIndex === HUMAN_INDEX && state.phase === 'playing';

  // IA tour
  useEffect(() => {
    if (state.phase !== 'playing') return;
    if (state.currentPlayerIndex === HUMAN_INDEX) return;
    const cur = state.players[state.currentPlayerIndex];
    const id = setTimeout(() => {
      if (cur.hand.length === state.variant.handSize) {
        dispatch({ type: 'DRAW', from: 'stock' });
      } else {
        dispatch({ type: 'DISCARD', cardId: aiPickDiscard(cur.hand) });
        // Détection signal/vol après défausse
        setTimeout(() => {
          if (cur.team === 'A' && state.players[HUMAN_INDEX].signalSent && state.players[HUMAN_INDEX].hasKant) {
            if (aiDetectSignal(state, HUMAN_INDEX, 'medium')) {
              dispatch({ type: 'ANNOUNCE_COPY', byIndex: PARTNER_INDEX, targetIndex: HUMAN_INDEX });
            }
          }
          if (cur.team === 'B') {
            const r = aiDetectStealOpportunity(state, state.currentPlayerIndex, 'medium');
            if (r.steal) dispatch({ type: 'ANNOUNCE_COPY', byIndex: state.currentPlayerIndex, targetIndex: r.targetIdx });
          }
        }, 250);
      }
    }, 900);
    return () => clearTimeout(id);
  }, [state.currentPlayerIndex, state.phase]);

  // Résolution annonce automatique
  useEffect(() => {
    if (state.pendingAnnounce) {
      const id = setTimeout(() => dispatch({ type: 'RESOLVE_ANNOUNCE' }), 1200);
      return () => clearTimeout(id);
    }
  }, [state.pendingAnnounce]);

  // Détection blocage (talon épuisé sans Kant possible)
  useEffect(() => {
    if (showStuck) return;
    if (isStuck(state)) {
      setShowStuck(true);
      saveResult({ gameType: 'kantcopy', variant: v.key, score: 0, moves: state.scoreA + state.scoreB, durationMs: Date.now() - startedAt.current, won: false });
    }
  }, [state, showStuck]);

  // Fin de manche → next round ou fin partie
  useEffect(() => {
    if (state.phase === 'revealing') {
      const id = setTimeout(() => {
        if (isGameOver(state)) {
          const w = winner(state);
          const won = w === 'A';
          setShowWin(true);
          saveResult({ gameType: 'kantcopy', variant: v.key, score: won ? 100 : 50, moves: state.scoreA + state.scoreB, durationMs: Date.now() - startedAt.current, won });
        } else {
          dispatch({ type: 'NEXT_ROUND' });
          setHasDrawn(false);
        }
      }, 2000);
      return () => clearTimeout(id);
    }
  }, [state.phase]);

  function onDraw(from: 'stock' | 'discard') {
    if (!isMyTurn || hasDrawn) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    dispatch({ type: 'DRAW', from });
    setHasDrawn(true);
  }

  function onDiscard(cardId: string) {
    if (!isMyTurn || !hasDrawn) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    dispatch({ type: 'DISCARD', cardId });
    setHasDrawn(false);
  }

  function onSendSignal() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    dispatch({ type: 'SEND_SIGNAL' });
    Alert.alert(t('kant.signalSentTitle'), t('kant.signalSentBody'));
  }

  function onAnnounceCopy() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    dispatch({ type: 'ANNOUNCE_COPY', byIndex: HUMAN_INDEX, targetIndex: PARTNER_INDEX });
  }

  function reset() {
    dispatch({ type: 'RESET', variant: state.variant });
    setHasDrawn(false);
    setShowWin(false);
    startedAt.current = Date.now();
  }

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <LinearGradient colors={palette.bgGradient as any} style={StyleSheet.absoluteFill} />
      <AppHeader title={t(`variant.${v.key}.name`, { defaultValue: v.name })} subtitle={t('kant.subtitle', { score: `${state.scoreA}-${state.scoreB}`, target: state.targetScore })} showBack />
      <ScrollView contentContainerStyle={styles.body}>
        <LinearGradient colors={[APP_CONFIG.primary + '33', palette.card]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.banner, { borderColor: palette.border }]}>
          <View style={styles.bannerStat}><Text style={[styles.bannerLabel, { color: palette.textSecondary }]}>{t('kant.teamA')}</Text><Text style={[styles.bannerValue, { color: APP_CONFIG.primary }]}>{state.scoreA}</Text></View>
          <View style={styles.bannerStat}><Text style={[styles.bannerLabel, { color: palette.textSecondary }]}>{t('kant.target')}</Text><Text style={[styles.bannerValue, { color: palette.text }]}>{state.targetScore}</Text></View>
          <View style={styles.bannerStat}><Text style={[styles.bannerLabel, { color: palette.textSecondary }]}>{t('kant.teamB')}</Text><Text style={[styles.bannerValue, { color: '#F97316' }]}>{state.scoreB}</Text></View>
        </LinearGradient>

        <View style={styles.othersRow}>
          {[0, 1, 3].map((idx) => {
            const p = state.players[idx];
            const isPartner = idx === PARTNER_INDEX;
            return (
              <View key={idx} style={[styles.opponent, { borderColor: isPartner ? APP_CONFIG.primary : palette.border }]}>
                <Text style={[styles.opponentName, { color: isPartner ? APP_CONFIG.primary : palette.text }]}>{p.name} {isPartner ? '🤝' : '⚔️'}</Text>
                <Text style={[styles.opponentCards, { color: palette.textSecondary }]}>🂠 × {p.hand.length}</Text>
                {p.signalSent && <Text style={{ fontSize: 10, color: '#F59E0B' }}>📡</Text>}
              </View>
            );
          })}
        </View>

        <View style={styles.midRow}>
          <Pressable onPress={() => onDraw('stock')} style={[styles.slot, { borderColor: isMyTurn && !hasDrawn ? APP_CONFIG.primary : palette.border }]}>
            <Text style={{ fontSize: 28 }}>🂠</Text>
            <Text style={[styles.slotLabel, { color: palette.textSecondary }]}>{t('kant.stock')} ({state.stock.length})</Text>
          </Pressable>
          <Pressable onPress={() => onDraw('discard')} style={[styles.slot, { borderColor: palette.border }]}>
            {state.discard.length > 0 ? (
              <Text style={{ fontSize: 22 }}>{SUIT_GLYPH[state.discard[state.discard.length - 1].suit]} {VALUE_NAMES[state.discard[state.discard.length - 1].value]}</Text>
            ) : (<Text style={{ fontSize: 28, color: palette.textSecondary }}>—</Text>)}
            <Text style={[styles.slotLabel, { color: palette.textSecondary }]}>{t('kant.discard')} ({state.discard.length})</Text>
          </Pressable>
        </View>

        <Text style={[styles.sectionTitle, { color: palette.text }]}>{t('kant.myHand')} ({me.hand.length}/{state.variant.handSize}{hasDrawn ? '+1' : ''})</Text>
        {me.hasKant && (
          <View style={[styles.kantBanner, { backgroundColor: APP_CONFIG.primary }]}>
            <Ionicons name="flame" size={16} color="#fff" />
            <Text style={styles.kantBannerText}>{t('kant.youHaveKant', { value: VALUE_NAMES[me.kantValue!] })}</Text>
          </View>
        )}
        <View style={styles.handRow}>
          {me.hand.map((c) => (
            <Pressable key={c.id} onPress={() => onDiscard(c.id)} style={[styles.cardBtn, { borderColor: hasDrawn ? APP_CONFIG.primary : palette.border, backgroundColor: palette.card }]}>
              <Text style={{ fontSize: 22 }}>{SUIT_GLYPH[c.suit]}</Text>
              <Text style={[styles.cardValue, { color: palette.text }]}>{VALUE_NAMES[c.value]}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.actions}>
          {me.hasKant && !me.signalSent && (
            <TouchableOpacity onPress={onSendSignal} style={[styles.btn, { backgroundColor: '#F59E0B' }]}>
              <Ionicons name="radio" size={16} color="#fff" /><Text style={styles.btnText}>{t('kant.sendSignal')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onAnnounceCopy} style={[styles.btn, { backgroundColor: APP_CONFIG.primary }]}>
            <Ionicons name="megaphone" size={16} color="#fff" /><Text style={styles.btnText}>{t('kant.announceCopy')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={reset} style={[styles.btn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
            <Ionicons name="refresh" size={16} color="#fff" /><Text style={styles.btnText}>{t('solo.restart')}</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.hint, { borderColor: palette.border }]}>
          <Ionicons name="information-circle-outline" size={14} color={palette.textSecondary} />
          <Text style={[styles.hintText, { color: palette.textSecondary }]}>
            {isMyTurn && !hasDrawn ? t('kant.hintDraw') : isMyTurn && hasDrawn ? t('kant.hintDiscard') : t('kant.hintWaiting', { name: state.players[state.currentPlayerIndex].name })}
          </Text>
        </View>

        {state.lastRound && (
          <View style={[styles.lastRound, { borderColor: palette.border }]}>
            <Text style={{ color: palette.text, fontFamily: 'Inter-Bold', fontSize: 13 }}>
              {state.lastRound.type === 'win' && t('kant.roundWin', { team: state.lastRound.by, kant: state.lastRound.kantHolderName })}
              {state.lastRound.type === 'steal' && t('kant.roundSteal', { team: state.lastRound.by })}
              {state.lastRound.type === 'wrong' && t('kant.roundWrong')}
              {state.lastRound.type === 'exhausted' && t('kant.roundExhausted')}
              {' '}+{state.lastRound.points}
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={showStuck} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <LinearGradient colors={['#7F1D1D', '#1F1216']} style={[styles.modalCard, { borderColor: '#EF4444' }]}>
            <Text style={{ fontSize: 56 }}>🔒</Text>
            <Text style={styles.modalTitle}>{t('kant.stuck.title')}</Text>
            <Text style={[styles.modalSub, { textAlign: 'center', paddingHorizontal: 8 }]}>{t('kant.stuck.body')}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
              <TouchableOpacity onPress={() => { setShowStuck(false); reset(); }} style={[styles.modalBtn, { backgroundColor: '#EF4444' }]}>
                <Text style={styles.modalBtnText}>🔄 {t('kant.stuck.again')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowStuck(false)} style={[styles.modalBtn, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                <Text style={styles.modalBtnText}>{t('kant.stuck.continue')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.back()} style={[styles.modalBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <Text style={styles.modalBtnText}>{t('solo.quit')}</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </Modal>

      <Modal visible={showWin} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <LinearGradient colors={['#0A0A1A', APP_CONFIG.secondary]} style={[styles.modalCard, { borderColor: APP_CONFIG.primary }]}>
            <Text style={{ fontSize: 56 }}>{winner(state) === 'A' ? '🏆' : '😞'}</Text>
            <Text style={styles.modalTitle}>{winner(state) === 'A' ? t('kant.winTitle') : t('kant.loseTitle')}</Text>
            <Text style={styles.modalSub}>{state.scoreA} - {state.scoreB}</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
              <TouchableOpacity onPress={reset} style={[styles.modalBtn, { backgroundColor: APP_CONFIG.primary }]}><Text style={styles.modalBtnText}>🔄 {t('solo.playAgain')}</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => router.back()} style={[styles.modalBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}><Text style={styles.modalBtnText}>{t('solo.quit')}</Text></TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </Modal>
    </View>
  );
}

async function saveResult(p: { gameType: string; variant: string; score: number; moves: number; durationMs: number; won: boolean }) {
  try { const r = await api.saveSoloGame(p); log.bout(`persist via ${r.via}`, { persisted: r.persisted }); }
  catch (e: any) { log.error('persist failed', e?.message); }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 12, paddingBottom: 40 },
  banner: { flexDirection: 'row', justifyContent: 'space-around', borderRadius: 14, padding: 12, borderWidth: 1, marginBottom: 12 },
  bannerStat: { alignItems: 'center', flex: 1 },
  bannerLabel: { fontSize: 9, fontFamily: 'Inter-Bold', letterSpacing: 1 },
  bannerValue: { fontSize: 22, fontFamily: 'Inter-Black', marginTop: 4 },
  othersRow: { flexDirection: 'row', gap: 8, marginBottom: 12, justifyContent: 'space-between' },
  opponent: { flex: 1, padding: 10, borderRadius: 12, borderWidth: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)' },
  opponentName: { fontSize: 12, fontFamily: 'Inter-Bold', marginBottom: 4 },
  opponentCards: { fontSize: 16, fontFamily: 'Inter-SemiBold' },
  midRow: { flexDirection: 'row', gap: 14, justifyContent: 'center', marginBottom: 14 },
  slot: { padding: 14, borderRadius: 12, borderWidth: 2, alignItems: 'center', minWidth: 110 },
  slotLabel: { fontSize: 10, fontFamily: 'Inter-Bold', marginTop: 4, letterSpacing: 1 },
  sectionTitle: { fontSize: 13, fontFamily: 'Inter-Bold', marginBottom: 8, marginTop: 4 },
  kantBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginBottom: 8, alignSelf: 'flex-start' },
  kantBannerText: { color: '#fff', fontSize: 12, fontFamily: 'Inter-Black' },
  handRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  cardBtn: { width: 60, height: 80, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  cardValue: { fontSize: 14, fontFamily: 'Inter-Black', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  btnText: { color: '#fff', fontSize: 12, fontFamily: 'Inter-Bold' },
  hint: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, padding: 10, borderRadius: 10, borderWidth: 1, marginTop: 12, backgroundColor: 'rgba(255,255,255,0.03)' },
  hintText: { flex: 1, fontSize: 11, fontFamily: 'Inter-Regular', lineHeight: 15 },
  lastRound: { padding: 10, borderRadius: 10, borderWidth: 1, marginTop: 8, backgroundColor: 'rgba(255,255,255,0.05)' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { padding: 28, borderRadius: 20, alignItems: 'center', borderWidth: 2, minWidth: 280 },
  modalTitle: { color: '#fff', fontSize: 22, fontFamily: 'Inter-Black', marginTop: 8 },
  modalSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: 'Inter-SemiBold', marginTop: 6 },
  modalBtn: { paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12 },
  modalBtnText: { color: '#fff', fontSize: 14, fontFamily: 'Inter-Bold' },
});
