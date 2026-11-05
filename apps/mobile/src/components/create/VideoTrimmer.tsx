import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { POST_VIDEO_MAX_SECONDS } from '@cinecraft/core';
import { Icon } from '../common/Icon';
import { useUserSettings } from '../../hooks/useUserSettings';
import { releasePhoto, videoFrame, videoFrames, videoInfo, type VideoEdit } from '../../services/photoRender';

/**
 * Pick the part of a video to keep, and whether to keep its sound. A strip of pictures from the video sits under a big
 * still of the moment you are on; drag the two handles to choose the start and end, or touch the strip to look around.
 */
interface Props {
  uri: string;
  edit: VideoEdit | undefined;
  onChange: (next: VideoEdit) => void;
  onUnreadable?: () => void;
}

const ORANGE = '#FF4B33';
const FRAMES = 8;
const MIN_LENGTH = 1; // seconds

const clock = (s: number) => {
  const t = Math.max(0, Math.round(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

export const VideoTrimmer: React.FC<Props> = ({ uri, edit, onChange, onUnreadable }) => {
  const { themeColors } = useUserSettings();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [strip, setStrip] = useState<string[]>([]);
  const [still, setStill] = useState<string | null>(null);
  const [at, setAt] = useState(0); // the moment shown, in seconds
  const [width, setWidth] = useState(1);
  const [failed, setFailed] = useState(false);

  const editRef = useRef(edit);
  editRef.current = edit;
  const widthRef = useRef(1);
  widthRef.current = width;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const stills = useRef<string[]>([]);

  // read the video, and make the strip
  useEffect(() => {
    let alive = true;
    const made: string[] = [];
    (async () => {
      try {
        const info = await videoInfo(uri);
        if (!alive) return;
        const duration = info.duration / 1000;
        setSize({ width: info.width, height: info.height });
        if (!editRef.current) onChangeRef.current({ start: 0, end: Math.min(duration, POST_VIDEO_MAX_SECONDS), duration, mute: false });
        const frames = await videoFrames(uri, FRAMES, 160);
        made.push(...frames);
        if (alive) setStrip(frames);
      } catch {
        if (alive) { setFailed(true); onUnreadable?.(); }
      }
    })();
    return () => { alive = false; made.forEach((u) => releasePhoto(u)); stills.current.forEach((u) => releasePhoto(u)); };
  }, [uri]); // eslint-disable-line react-hooks/exhaustive-deps

  // the big still for the moment being looked at (latest request wins; older pictures are deleted)
  const seq = useRef(0);
  const ready = !!edit;
  useEffect(() => {
    if (!ready) return;
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const f = await videoFrame(uri, at * 1000, 720);
        if (mine !== seq.current) { releasePhoto(f.uri); return; }
        setStill(f.uri);
        stills.current.push(f.uri);
        while (stills.current.length > 2) releasePhoto(stills.current.shift());
      } catch { /* the previous picture stays */ }
    }, 90);
    return () => clearTimeout(t);
  }, [at, uri, ready]);

  const duration = edit?.duration || 1;
  const toSeconds = (x: number) => Math.max(0, Math.min(duration, (x / widthRef.current) * duration));

  const makeHandle = (side: 'start' | 'end') => {
    let origin = 0;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => { const e = editRef.current; origin = e ? e[side] : 0; },
      onPanResponderMove: (_e, g) => {
        const e = editRef.current;
        if (!e) return;
        const value = Math.max(0, Math.min(e.duration, origin + (g.dx / widthRef.current) * e.duration));
        if (side === 'start') {
          const start = Math.min(value, e.end - MIN_LENGTH);
          const end = Math.min(e.end, start + POST_VIDEO_MAX_SECONDS); // a video can be at most 3:59
          onChangeRef.current({ ...e, start, end });
          setAt(start);
        } else {
          const end = Math.max(value, e.start + MIN_LENGTH);
          const start = Math.max(e.start, end - POST_VIDEO_MAX_SECONDS);
          onChangeRef.current({ ...e, start, end });
          setAt(Math.max(start, end - 0.2));
        }
      },
    });
  };
  const handles = useRef<{ start: ReturnType<typeof PanResponder.create>; end: ReturnType<typeof PanResponder.create> } | null>(null);
  if (!handles.current) handles.current = { start: makeHandle('start'), end: makeHandle('end') };

  // touching the strip looks around without changing the cut
  const scrub = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => setAt(toSeconds(e.nativeEvent.locationX)),
      onPanResponderMove: (e) => setAt(toSeconds(e.nativeEvent.locationX)),
    }),
  ).current;

  const text = themeColors.textPrimary;
  const muted = themeColors.textSecondary;
  if (failed) {
    return <View style={styles.center}><Text style={{ color: muted, textAlign: 'center' }}>This video could not be opened for editing. It will be posted as it is.</Text></View>;
  }
  if (!edit || !size) {
    return <View style={styles.center}><ActivityIndicator color={ORANGE} /></View>;
  }

  const pct = (t: number) => (t / edit.duration) * 100;
  const kept = edit.end - edit.start;

  return (
    <View style={styles.root}>
      <View style={styles.stage}>
        {still ? (
          <Image source={{ uri: still }} style={{ width: '100%', height: '100%' }} resizeMode="contain" accessibilityLabel={`The video at ${clock(at)}`} />
        ) : <ActivityIndicator color={ORANGE} />}
      </View>

      <View style={[styles.panel, { backgroundColor: themeColors.bgCard, borderTopColor: themeColors.border }]}>
        <View style={styles.labels}>
          <Text style={{ color: text, fontWeight: '700', fontSize: 14 }}>Trim</Text>
          <Text style={{ color: muted, fontSize: 13, fontVariant: ['tabular-nums'] }}>{clock(edit.start)} – {clock(edit.end)} · {clock(kept)}</Text>
        </View>

        <View style={styles.stripWrap} onLayout={(e) => setWidth(Math.max(1, e.nativeEvent.layout.width))} {...scrub.panHandlers}>
          <View style={styles.strip} pointerEvents="none">
            {strip.length === 0 ? <ActivityIndicator color={ORANGE} style={{ flex: 1 }} /> : strip.map((u) => <Image key={u} source={{ uri: u }} style={styles.stripFrame} resizeMode="cover" />)}
          </View>
          {/* the parts that are cut away */}
          <View pointerEvents="none" style={[styles.dim, { left: 0, width: `${pct(edit.start)}%` }]} />
          <View pointerEvents="none" style={[styles.dim, { right: 0, width: `${100 - pct(edit.end)}%` }]} />
          <View pointerEvents="none" style={[styles.keepFrame, { left: `${pct(edit.start)}%`, width: `${pct(edit.end) - pct(edit.start)}%` }]} />
          <View pointerEvents="none" style={[styles.needle, { left: `${pct(at)}%` }]} />
          <View {...handles.current.start.panHandlers} accessibilityLabel="Start of the video" accessibilityRole="adjustable" style={[styles.handle, { left: `${pct(edit.start)}%`, marginLeft: -20 }]}>
            <View style={styles.handleBar} />
          </View>
          <View {...handles.current.end.panHandlers} accessibilityLabel="End of the video" accessibilityRole="adjustable" style={[styles.handle, { left: `${pct(edit.end)}%`, marginLeft: -20 }]}>
            <View style={styles.handleBar} />
          </View>
        </View>
        <Text style={{ color: muted, fontSize: 12, marginTop: 8 }}>
          Drag the two handles to choose the part to post. Touch the strip to look around. The cut starts at the nearest earlier keyframe, so it can begin a moment early.
          {edit.duration > POST_VIDEO_MAX_SECONDS ? ' Videos can be up to 3:59.' : ''}
        </Text>

        <TouchableOpacity
          onPress={() => onChange({ ...edit, mute: !edit.mute })}
          accessibilityRole="button"
          accessibilityState={{ selected: edit.mute }}
          style={[styles.muteBtn, { borderColor: edit.mute ? ORANGE : themeColors.border, backgroundColor: edit.mute ? ORANGE + '1A' : 'transparent' }]}
        >
          <Icon name={edit.mute ? 'volume-x' : 'volume-2'} size={16} color={edit.mute ? ORANGE : text} />
          <Text style={{ color: edit.mute ? ORANGE : text, fontWeight: '700', fontSize: 14 }}>{edit.mute ? 'Sound removed' : 'Keep the sound'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  stage: { flex: 1, minHeight: 200, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000000' },
  panel: { borderTopWidth: StyleSheet.hairlineWidth, padding: 14 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  stripWrap: { height: 64, justifyContent: 'center' },
  strip: { flexDirection: 'row', height: 56, borderRadius: 6, overflow: 'hidden', backgroundColor: '#1F2937' },
  stripFrame: { flex: 1, height: 56 },
  dim: { position: 'absolute', top: 4, bottom: 4, backgroundColor: 'rgba(0,0,0,0.65)' },
  keepFrame: { position: 'absolute', top: 4, bottom: 4, borderTopWidth: 2, borderBottomWidth: 2, borderColor: ORANGE },
  needle: { position: 'absolute', top: 2, bottom: 2, width: 2, backgroundColor: '#FFFFFF' },
  handle: { position: 'absolute', top: 0, bottom: 0, width: 40, alignItems: 'center', justifyContent: 'center' },
  handleBar: { width: 8, height: 60, borderRadius: 3, backgroundColor: ORANGE },
  muteBtn: { marginTop: 12, minHeight: 44, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});

export default VideoTrimmer;
