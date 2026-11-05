import React, { useRef, useState } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/** Small controls for the photo editor: a slider that is easy to drag, a colour gradient bar and a row of colour swatches. */

export const ACCENT = '#FF4B33';
const THUMB = 28;
const PAD = THUMB / 2 + 2; // the track starts this far in from the touch area, so the thumb is never cut off
const EMIT_EVERY = 50; // ms: the picture is redrawn at most this often while a finger drags

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  /** where a double tap puts the slider back to (default 0, or the minimum when 0 is out of range) */
  neutral?: number;
  onStart: () => void;
  onChange: (v: number) => void;
  onEnd: () => void;
  trackColor: string;
  textColor: string;
  /** how the value is written (default: the number) */
  format?: (v: number) => string;
  /**
   * stacked: name and value above the track. bubble: the value floats above the thumb. inline: name, track and value in one row.
   */
  mode?: 'stacked' | 'bubble' | 'inline';
  /** inline mode: leave the name out of the row (it is shown by something else, but still read out) */
  hideLabel?: boolean;
}

/** A slider you drag along its track. Fills from the middle when the range goes below zero. Double tap puts it back. */
export const EditSlider: React.FC<SliderProps> = React.memo(({ label, value, min, max, neutral, onStart, onChange, onEnd, trackColor, textColor, format, mode = 'stacked', hideLabel }) => {
  const width = useRef(1);
  const [local, setLocal] = useState<number | null>(null);
  const live = useRef({ min, max, neutral: neutral ?? (min <= 0 && max >= 0 ? 0 : min), onChange, onStart, onEnd });
  live.current = { min, max, neutral: neutral ?? (min <= 0 && max >= 0 ? 0 : min), onChange, onStart, onEnd };
  const lastEmit = useRef(0);
  const pending = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startVal = useRef(value);
  const lastTap = useRef(0);
  const doubled = useRef(false);

  // the picture is told about the new value at most every EMIT_EVERY ms; the slider itself follows the finger at once
  const emit = (v: number) => {
    setLocal(v);
    pending.current = v;
    const now = Date.now();
    if (now - lastEmit.current >= EMIT_EVERY) {
      lastEmit.current = now;
      pending.current = null;
      live.current.onChange(v);
    } else if (!timer.current) {
      timer.current = setTimeout(() => {
        timer.current = null;
        if (pending.current !== null) { lastEmit.current = Date.now(); live.current.onChange(pending.current); pending.current = null; }
      }, EMIT_EVERY);
    }
  };
  const finish = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (pending.current !== null) { live.current.onChange(pending.current); pending.current = null; }
    setLocal(null);
    doubled.current = false;
    live.current.onEnd();
  };
  const emitRef = useRef(emit);
  emitRef.current = emit;
  const finishRef = useRef(finish);
  finishRef.current = finish;

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const { min: lo, max: hi, neutral: home } = live.current;
        live.current.onStart();
        const now = Date.now();
        if (now - lastTap.current < 320) {
          lastTap.current = 0;
          doubled.current = true;
          emitRef.current(home);
          return;
        }
        lastTap.current = now;
        const v = Math.round(lo + Math.max(0, Math.min(1, (e.nativeEvent.locationX - PAD) / width.current)) * (hi - lo));
        startVal.current = v;
        emitRef.current(v);
      },
      onPanResponderMove: (_e, g) => {
        if (doubled.current) return;
        if (Math.abs(g.dx) > 4) lastTap.current = 0; // a drag is not the first half of a double tap
        const { min: lo, max: hi } = live.current;
        emitRef.current(Math.round(Math.max(lo, Math.min(hi, startVal.current + (g.dx / width.current) * (hi - lo)))));
      },
      onPanResponderRelease: () => finishRef.current(),
      onPanResponderTerminate: () => finishRef.current(),
    }),
  ).current;

  const shown = local ?? value;
  const span = Math.max(1, max - min);
  const pct = Math.max(0, Math.min(100, ((shown - min) / span) * 100));
  const zero = Math.max(0, Math.min(100, ((live.current.neutral - min) / span) * 100));
  const fillLeft = min < 0 ? Math.min(pct, zero) : 0;
  const fillWidth = min < 0 ? Math.abs(pct - zero) : pct;
  const text = format ? format(shown) : String(shown > 0 && min < 0 ? `+${shown}` : shown);

  const track = (
    <View
      style={[styles.trackWrap, mode === 'inline' && { flex: 1 }]}
      onLayout={(e) => { width.current = Math.max(1, e.nativeEvent.layout.width - PAD * 2); }}
      {...responder.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`${label} slider`}
      accessibilityValue={{ min, max, now: shown, text }}
      accessibilityHint="Drag to change. Double tap quickly to reset."
    >
      <View style={styles.inner} pointerEvents="none">
        <View style={[styles.track, { backgroundColor: trackColor + '40' }]}>
          <View style={{ position: 'absolute', left: `${fillLeft}%`, width: `${fillWidth}%`, height: 4, backgroundColor: ACCENT }} />
        </View>
        {min < 0 && <View style={[styles.zeroTick, { left: `${zero}%`, backgroundColor: trackColor }]} />}
        <View style={[styles.thumb, { left: `${pct}%` }]} />
      </View>
    </View>
  );

  if (mode === 'inline') {
    return (
      <View style={styles.inlineRow}>
        {!hideLabel && <Text style={[styles.inlineLabel, { color: textColor }]} numberOfLines={1}>{label}</Text>}
        {track}
        <Text style={[styles.inlineValue, { color: textColor }]}>{text}</Text>
      </View>
    );
  }
  if (mode === 'bubble') {
    return (
      <View>
        <View style={styles.bubbleRow}>
          <View style={[styles.bubble, { left: `${pct}%` }]}><Text style={[styles.bubbleText, { color: textColor }]}>{text}</Text></View>
        </View>
        {track}
      </View>
    );
  }
  return (
    <View style={{ gap: 2 }}>
      <View style={styles.head}>
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
        <Text style={[styles.value, { color: trackColor }]}>{text}</Text>
      </View>
      {track}
    </View>
  );
});

/** A colour gradient you drag along (for hue and lightness). `colors` are the gradient stops, left to right. */
export const GradientBar: React.FC<{
  label: string; colors: string[]; value: number; onChange: (v: number) => void; onStart?: () => void; onEnd?: () => void; thumbColor: string;
}> = React.memo(({ label, colors, value, onChange, onStart, onEnd, thumbColor }) => {
  const width = useRef(1);
  const live = useRef({ onChange, onStart, onEnd });
  live.current = { onChange, onStart, onEnd };
  const last = useRef(0);
  const at = (x: number) => Math.max(0, Math.min(1, (x - PAD) / width.current));
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => { live.current.onStart?.(); last.current = Date.now(); live.current.onChange(at(e.nativeEvent.locationX)); },
      onPanResponderMove: (e) => {
        const now = Date.now();
        if (now - last.current < EMIT_EVERY) return;
        last.current = now;
        live.current.onChange(at(e.nativeEvent.locationX));
      },
      onPanResponderRelease: (e) => { live.current.onChange(at(e.nativeEvent.locationX)); live.current.onEnd?.(); },
      onPanResponderTerminate: () => live.current.onEnd?.(),
    }),
  ).current;
  return (
    <View
      style={styles.trackWrap}
      onLayout={(e) => { width.current = Math.max(1, e.nativeEvent.layout.width - PAD * 2); }}
      {...responder.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`${label} slider`}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
    >
      <View style={styles.inner} pointerEvents="none">
        <View style={styles.gradient}>
          {colors.map((c, i) => <View key={i} style={{ flex: 1, backgroundColor: c }} />)}
        </View>
        <View style={[styles.thumb, { left: `${value * 100}%`, backgroundColor: thumbColor }]} />
      </View>
    </View>
  );
});

/** A scrolling row of colour dots (each with a 44 px touch area). `auto` adds a first "A" dot for "pick for me". */
export const ColorRow: React.FC<{
  colors: string[]; selected: string | null; onPick: (c: string) => void; ring: string; border: string; label: string; auto?: { selected: boolean; onPick: () => void; color: string };
}> = React.memo(({ colors, selected, onPick, ring, border, label, auto }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 2 }} accessibilityLabel={label} keyboardShouldPersistTaps="handled">
    {auto && (
      <TouchableOpacity onPress={auto.onPick} accessibilityRole="button" accessibilityLabel={`${label}: automatic`} accessibilityState={{ selected: auto.selected }} style={styles.swatchTouch}>
        <View style={[styles.swatch, { borderColor: auto.selected ? ring : border, borderWidth: auto.selected ? 3 : 1, alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: auto.color }}>A</Text>
        </View>
      </TouchableOpacity>
    )}
    {colors.map((c) => {
      const on = selected !== null && selected.toUpperCase() === c.toUpperCase();
      return (
        <TouchableOpacity key={c} onPress={() => onPick(c)} accessibilityRole="button" accessibilityLabel={`${label} ${c}`} accessibilityState={{ selected: on }} style={styles.swatchTouch}>
          <View style={[styles.swatch, { backgroundColor: c, borderColor: on ? ring : border, borderWidth: on ? 3 : 1 }]} />
        </TouchableOpacity>
      );
    })}
  </ScrollView>
));

/** A text label that resets on double tap (used for the filter intensity). */
export const DoubleTapLabel: React.FC<{ label: string; onDouble: () => void; color: string }> = ({ label, onDouble, color }) => {
  const last = useRef(0);
  return (
    <Pressable
      onPress={() => { const now = Date.now(); if (now - last.current < 320) { last.current = 0; onDouble(); } else last.current = now; }}
      accessibilityRole="button"
      accessibilityLabel={`${label}. Double tap to reset to 100.`}
      style={{ minHeight: 44, justifyContent: 'center' }}
    >
      <Text style={{ color, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 13, fontWeight: '600' },
  value: { fontSize: 13, fontVariant: ['tabular-nums'] },
  trackWrap: { height: 44, justifyContent: 'center' },
  inner: { marginHorizontal: PAD, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  zeroTick: { position: 'absolute', width: 2, height: 10, marginLeft: -1, opacity: 0.5 },
  thumb: { position: 'absolute', width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: '#FFFFFF', marginLeft: -THUMB / 2, borderWidth: 3, borderColor: ACCENT, elevation: 2 },
  gradient: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden' },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inlineLabel: { fontSize: 13, fontWeight: '600', minWidth: 62 },
  inlineValue: { fontSize: 13, fontWeight: '700', minWidth: 40, textAlign: 'right', fontVariant: ['tabular-nums'] },
  bubbleRow: { height: 20, marginHorizontal: PAD },
  bubble: { position: 'absolute', top: 0, width: 56, marginLeft: -28, alignItems: 'center' },
  bubbleText: { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  swatchTouch: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 30, height: 30, borderRadius: 15 },
});
