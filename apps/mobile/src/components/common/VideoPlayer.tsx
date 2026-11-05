import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Linking,
  Modal,
  PanResponder,
  Pressable,
  StatusBar,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContext } from '@react-navigation/native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Icon } from './Icon';
import { CachedImage } from './CachedImage';
import { useUserSettings } from '../../hooks/useUserSettings';
import { prefersReducedMotion } from '../../utils/motion';
import { useVideoPlayback, useVideoPlaybackSelector, videoPlayback } from './videoPlaybackStore';

const ORANGE = '#FF4B33';

export function openVideoInBrowser(uri: string) {
  if (!/^https?:\/\//i.test(uri)) {
    Alert.alert('Could not open the video');
    return;
  }
  Linking.openURL(uri).catch(() => Alert.alert('Could not open the video'));
}

const formatTime = (sec: number) => {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
};

// ── small hooks ──────────────────────────────────────────────────────────────

/** true while the app is in the foreground */
function useAppActive() {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

/** true while the screen that holds this video is the focused one (true when there is no navigator) */
function useScreenFocused() {
  const nav = useContext(NavigationContext);
  const [focused, setFocused] = useState(nav ? nav.isFocused() : true);
  useEffect(() => {
    if (!nav) return;
    setFocused(nav.isFocused());
    const a = nav.addListener('focus', () => setFocused(true));
    const b = nav.addListener('blur', () => setFocused(false));
    return () => {
      a();
      b();
    };
  }, [nav]);
  return focused;
}

/** one handler for both: a single tap fires after ~250 ms unless a second tap makes it a double tap */
function useTapHandler(onSingle: () => void, onDouble?: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const singleRef = useRef(onSingle);
  const doubleRef = useRef(onDouble);
  singleRef.current = onSingle;
  doubleRef.current = onDouble;
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );
  return useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      if (doubleRef.current) doubleRef.current();
      else singleRef.current();
      return;
    }
    timer.current = setTimeout(() => {
      timer.current = null;
      singleRef.current();
    }, 250);
  }, []);
}

const PauseGlyph: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <View style={{ width: size, height: size, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: size * 0.2 }}>
    <View style={{ width: size * 0.22, height: size * 0.8, borderRadius: 2, backgroundColor: color }} />
    <View style={{ width: size * 0.22, height: size * 0.8, borderRadius: 2, backgroundColor: color }} />
  </View>
);

const CircleBtn: React.FC<{
  icon: string;
  label: string;
  onPress: () => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
}> = ({ icon, label, onPress, size = 32, style }) => (
  <TouchableOpacity
    accessibilityRole="button"
    accessibilityLabel={label}
    activeOpacity={0.8}
    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    onPress={onPress}
    style={[styles.circleBtn, { width: size, height: size, borderRadius: size / 2 }, style]}
  >
    <Icon name={icon as any} size={Math.round(size * 0.5)} color="#FFFFFF" />
  </TouchableOpacity>
);

const ErrorPanel: React.FC<{ uri: string; onRetry: () => void; compact?: boolean }> = ({ uri, onRetry, compact }) => (
  <View style={[styles.center, styles.errorBox]}>
    <Text style={styles.errorText}>Video unavailable</Text>
    <View style={styles.errorRow}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Retry" style={styles.errorBtn} activeOpacity={0.85} onPress={onRetry}>
        <Text style={styles.errorBtnText}>Retry</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Open in browser"
        style={[styles.errorBtn, styles.errorBtnGhost]}
        activeOpacity={0.85}
        onPress={() => openVideoInBrowser(uri)}
      >
        <Text style={styles.errorBtnText}>{compact ? 'Browser' : 'Open in browser'}</Text>
      </TouchableOpacity>
    </View>
  </View>
);

// ── inline (feed / post detail) ──────────────────────────────────────────────

interface SurfaceProps {
  uri: string;
  poster?: string | null;
  /** this video should be playing now (visible, focused, app in front) */
  wantsPlay: boolean;
  contentFit: 'contain' | 'cover';
  onDoubleTap?: () => void;
  expandTop: number;
  chipLeft: number;
  style?: StyleProp<ViewStyle>;
}

const InlineSurface: React.FC<SurfaceProps> = ({ uri, poster, wantsPlay, contentFit, onDoubleTap, expandTop, chipLeft, style }) => {
  const { muted } = useVideoPlayback();
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.timeUpdateEventInterval = 0.25;
  });
  const [status, setStatus] = useState<string>(player.status);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false); // the user paused it with a tap
  const [duration, setDuration] = useState(0);
  const [fullOpen, setFullOpen] = useState(false);
  const [flashIcon, setFlashIcon] = useState<'play' | 'pause'>('pause');
  const flash = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const resumeAt = useRef(0);

  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);

  useEffect(() => {
    const subs = [
      player.addListener('statusChange', ({ status: s }) => {
        setStatus(s);
        if (s === 'readyToPlay' && player.duration > 0) setDuration(player.duration);
      }),
      player.addListener('playingChange', ({ isPlaying }) => {
        setPlaying(isPlaying);
        if (isPlaying) setStarted(true);
      }),
      player.addListener('timeUpdate', ({ currentTime }) => {
        const d = player.duration;
        if (d > 0) {
          progress.setValue(Math.min(1, currentTime / d));
          setDuration((cur) => (cur === d ? cur : d));
        }
      }),
    ];
    return () => subs.forEach((s) => s.remove());
  }, [player, progress]);

  const shouldPlay = wantsPlay && !paused && !fullOpen && status !== 'error';
  useEffect(() => {
    if (shouldPlay) player.play();
    else player.pause();
  }, [player, shouldPlay]);

  const doFlash = (icon: 'play' | 'pause') => {
    setFlashIcon(icon);
    flash.setValue(1);
    Animated.timing(flash, { toValue: 0, duration: 550, delay: 150, useNativeDriver: true }).start();
  };

  const toggle = () => {
    if (status === 'error') return;
    if (paused || !player.playing) {
      setPaused(false);
      doFlash('pause');
    } else {
      setPaused(true);
      doFlash('play');
    }
  };

  const onTap = useTapHandler(toggle, onDoubleTap);

  const retry = () => {
    setStatus('loading');
    player.replace(uri);
    if (shouldPlay || wantsPlay) player.play();
  };

  const openFull = () => {
    resumeAt.current = player.currentTime;
    setFullOpen(true);
  };

  const failed = status === 'error';
  const showSpinner = !failed && !started && (status === 'loading' || (wantsPlay && !playing));

  return (
    <View style={[styles.fill, styles.posterBox, style]}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
        contentFit={contentFit}
      />
      {!started && poster ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <CachedImage uri={poster} style={styles.fill} resizeMode={contentFit} />
        </View>
      ) : null}

      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onTap}
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Pause video' : 'Play video'}
      />

      {showSpinner ? (
        <View style={styles.center} pointerEvents="none">
          <ActivityIndicator color="#FFFFFF" />
        </View>
      ) : null}

      <Animated.View style={[styles.center, { opacity: flash }]} pointerEvents="none">
        <View style={styles.flashCircle}>
          {flashIcon === 'play' ? <Icon name="play" size={26} color="#FFFFFF" /> : <PauseGlyph size={26} color="#FFFFFF" />}
        </View>
      </Animated.View>

      {!failed ? (
        <>
          {!playing && duration > 0 ? (
            <View style={[styles.chip, { left: chipLeft }]} pointerEvents="none">
              <Text style={styles.chipText}>{formatTime(duration)}</Text>
            </View>
          ) : null}
          <CircleBtn
            icon="maximize-2"
            label="Open video full screen"
            onPress={openFull}
            size={30}
            style={{ position: 'absolute', top: expandTop, right: 12 }}
          />
          <CircleBtn
            icon={muted ? 'volume-x' : 'volume-2'}
            label={muted ? 'Unmute video' : 'Mute video'}
            onPress={() => videoPlayback.setMuted(!muted)}
            size={30}
            style={{ position: 'absolute', bottom: 12, right: 12 }}
          />
          <View style={styles.progressTrack} pointerEvents="none">
            <Animated.View
              style={[
                styles.progressFill,
                { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
              ]}
            />
          </View>
        </>
      ) : (
        <ErrorPanel uri={uri} onRetry={retry} compact />
      )}

      <VideoPlayerModal
        visible={fullOpen}
        uri={fullOpen ? uri : null}
        startTime={resumeAt.current}
        onClose={() => setFullOpen(false)}
      />
    </View>
  );
};

interface VideoPlayerProps {
  uri: string;
  /** a still shown before the first frame */
  poster?: string | null;
  /** id of the post; the playback store decides which post's video plays */
  postId?: string;
  /** post detail: plays on open, no list needed */
  isDetail?: boolean;
  /** false for a carousel slide that is not the visible slide */
  slideActive?: boolean;
  contentFit?: 'contain' | 'cover';
  style?: StyleProp<ViewStyle>;
  /** a double tap on the video (the feed's like) */
  onDoubleTap?: () => void;
  /** top offset of the expand button (leave room for a carousel counter) */
  expandTop?: number;
  /** left offset of the duration chip (leave room for the tagged-people button) */
  chipLeft?: number;
}

/**
 * Inline video like Instagram: no native controls, muted autoplay while the post is visible, tap to pause,
 * mute button, thin progress bar, expand to full screen. Players exist only for the video that is playing.
 */
export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  uri,
  poster,
  postId,
  isDetail = false,
  slideActive = true,
  contentFit = 'cover',
  style,
  onDoubleTap,
  expandTop = 12,
  chipLeft = 12,
}) => {
  const { settings } = useUserSettings();
  // per-card slices: only the card that becomes / stops being active (or a network change) re-renders
  const isActiveId = useVideoPlaybackSelector((s) => !!postId && s.activeId === postId);
  const wifi = useVideoPlaybackSelector((s) => s.wifi);
  const focused = useScreenFocused();
  const appActive = useAppActive();
  const [manual, setManual] = useState(false);
  const [engaged, setEngaged] = useState(false);

  const mode = settings?.video_autoplay ?? 'wifi';
  const autoAllowed = mode !== 'never' && !(mode === 'wifi' && !wifi) && !prefersReducedMotion();
  const postActive = isDetail || isActiveId;
  const eligible = postActive && slideActive && focused && appActive && (autoAllowed || manual);

  // keep a player only while this video is the one in use; release it a moment after it is scrolled away.
  // Starting waits ~220 ms so a fling past the card never creates a player (scroll stays uninterrupted).
  useEffect(() => {
    if (eligible) {
      const delay = isDetail || manual ? 0 : 220;
      const s = setTimeout(() => setEngaged(true), delay);
      return () => clearTimeout(s);
    }
    const t = setTimeout(() => {
      setEngaged(false);
      if (!postActive) setManual(false);
    }, 1500);
    return () => clearTimeout(t);
  }, [eligible, postActive]);

  const startManual = () => {
    setManual(true);
    if (!isDetail && postId) videoPlayback.forcePlay(postId);
  };
  const onPosterTap = useTapHandler(startManual, onDoubleTap);

  if (engaged) {
    return (
      <InlineSurface
        uri={uri}
        poster={poster}
        wantsPlay={eligible}
        contentFit={contentFit}
        onDoubleTap={onDoubleTap}
        expandTop={expandTop}
        chipLeft={chipLeft}
        style={style}
      />
    );
  }

  return (
    <View style={[styles.fill, styles.posterBox, style]}>
      {poster ? <CachedImage uri={poster} style={styles.fill} resizeMode={contentFit} /> : null}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onPosterTap}
        accessibilityRole="button"
        accessibilityLabel="Play video"
      />
      {!autoAllowed ? (
        <View style={styles.center} pointerEvents="none">
          <View style={styles.playCircle}>
            <Icon name="play" size={24} color="#FFFFFF" />
          </View>
        </View>
      ) : null}
    </View>
  );
};

// ── full-screen viewer ───────────────────────────────────────────────────────

interface VideoPlayerModalProps {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
  /** where to start, in seconds */
  startTime?: number;
}

const ModalBody: React.FC<{ uri: string; startTime: number; onClose: () => void }> = ({ uri, startTime, onClose }) => {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = false;
    p.timeUpdateEventInterval = 0.25;
    if (startTime > 0) p.currentTime = startTime;
    p.play();
  });
  const [status, setStatus] = useState<string>(player.status);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [cur, setCur] = useState(startTime);
  const [dur, setDur] = useState(0);
  const [overlay, setOverlay] = useState(true);
  const [drag, setDrag] = useState<number | null>(null);
  const trackW = useRef(1);
  const dragStart = useRef(0);
  const durRef = useRef(0);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const ty = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const subs = [
      player.addListener('statusChange', ({ status: s }) => {
        setStatus(s);
        if (player.duration > 0) {
          durRef.current = player.duration;
          setDur(player.duration);
        }
      }),
      player.addListener('playingChange', ({ isPlaying }) => setPlaying(isPlaying)),
      player.addListener('timeUpdate', ({ currentTime }) => {
        setCur(currentTime);
        if (player.duration > 0 && player.duration !== durRef.current) {
          durRef.current = player.duration;
          setDur(player.duration);
        }
      }),
    ];
    return () => subs.forEach((s) => s.remove());
  }, [player]);

  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);

  useEffect(() => {
    Animated.timing(fade, { toValue: overlay ? 1 : 0, duration: 180, useNativeDriver: true }).start();
  }, [overlay, fade]);

  const togglePlay = () => {
    if (player.playing) player.pause();
    else {
      // restart when it ended
      if (durRef.current > 0 && player.currentTime >= durRef.current - 0.2) player.currentTime = 0;
      player.play();
    }
  };

  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 12 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
      onPanResponderMove: (_, g) => ty.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120 || g.vy > 0.9) closeRef.current();
        else Animated.spring(ty, { toValue: 0, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () => Animated.spring(ty, { toValue: 0, useNativeDriver: true }).start(),
    })
  ).current;

  const scrub = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        dragStart.current = e.nativeEvent.locationX;
        setDrag(Math.max(0, Math.min(1, dragStart.current / trackW.current)));
      },
      onPanResponderMove: (_, g) => {
        setDrag(Math.max(0, Math.min(1, (dragStart.current + g.dx) / trackW.current)));
      },
      onPanResponderRelease: (_, g) => {
        const f = Math.max(0, Math.min(1, (dragStart.current + g.dx) / trackW.current));
        if (durRef.current > 0) {
          player.currentTime = f * durRef.current;
          setCur(f * durRef.current);
        }
        setDrag(null);
      },
      onPanResponderTerminate: () => setDrag(null),
    })
  ).current;

  const retry = () => {
    setStatus('loading');
    player.replace(uri);
    player.play();
  };

  const frac = drag ?? (dur > 0 ? Math.min(1, cur / dur) : 0);
  const shownTime = drag !== null ? drag * dur : cur;
  const failed = status === 'error';

  return (
    <Animated.View style={[styles.modalRoot, { transform: [{ translateY: ty }] }]} {...swipe.panHandlers}>
      <StatusBar hidden />
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
        contentFit="contain"
      />
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => setOverlay((o) => !o)}
        accessible={false}
        importantForAccessibility="no"
      />
      {!failed && status === 'loading' ? (
        <View style={styles.center} pointerEvents="none">
          <ActivityIndicator color="#FFFFFF" size="large" />
        </View>
      ) : null}
      {failed ? <ErrorPanel uri={uri} onRetry={retry} /> : null}

      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]} pointerEvents={overlay ? 'box-none' : 'none'}>
        <SafeAreaView style={styles.modalTop} edges={['top']} pointerEvents="box-none">
          <CircleBtn icon="x" label="Close video" onPress={onClose} size={40} />
          {!failed ? (
            <CircleBtn
              icon={muted ? 'volume-x' : 'volume-2'}
              label={muted ? 'Unmute video' : 'Mute video'}
              onPress={() => setMuted((m) => !m)}
              size={40}
            />
          ) : null}
        </SafeAreaView>

        {!failed ? (
          <View style={styles.center} pointerEvents="box-none">
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={playing ? 'Pause video' : 'Play video'}
              activeOpacity={0.8}
              style={styles.flashCircle}
              onPress={togglePlay}
            >
              {playing ? <PauseGlyph size={28} color="#FFFFFF" /> : <Icon name="play" size={28} color="#FFFFFF" />}
            </TouchableOpacity>
          </View>
        ) : null}

        {!failed ? (
          <SafeAreaView style={styles.modalBottom} edges={['bottom']} pointerEvents="box-none">
            <View style={styles.scrubRow}>
              <Text style={styles.timeText}>{formatTime(shownTime)}</Text>
              <View
                style={styles.scrubHit}
                onLayout={(e) => {
                  trackW.current = Math.max(1, e.nativeEvent.layout.width);
                }}
                accessibilityRole="adjustable"
                accessibilityLabel="Video position"
                {...scrub.panHandlers}
              >
                <View style={styles.scrubTrack} pointerEvents="none">
                  <View style={[styles.scrubFill, { width: `${frac * 100}%` }]} />
                </View>
                <View
                  pointerEvents="none"
                  style={[styles.scrubKnob, { left: `${frac * 100}%`, transform: [{ translateX: -5 }, { scale: drag !== null ? 1.4 : 1 }] }]}
                />
              </View>
              <Text style={styles.timeText}>{formatTime(dur)}</Text>
            </View>
          </SafeAreaView>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
};

/** Full-screen player: black, contain, minimal overlay. Swipe down or back closes it. */
export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({ visible, uri, onClose, startTime = 0 }) => (
  <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent transparent={false}>
    {visible && uri ? <ModalBody uri={uri} startTime={startTime} onClose={onClose} /> : <View style={styles.modalRoot} />}
  </Modal>
);

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  posterBox: { backgroundColor: '#0F172A', overflow: 'hidden' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  playCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 75, 51, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleBtn: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    position: 'absolute',
    bottom: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  chipText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  progressFill: { height: 3, backgroundColor: ORANGE },
  errorBox: { backgroundColor: 'rgba(15,23,42,0.92)', paddingHorizontal: 24, gap: 10 },
  errorText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  errorRow: { flexDirection: 'row', gap: 10 },
  errorBtn: { backgroundColor: ORANGE, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18 },
  errorBtnGhost: { backgroundColor: 'rgba(255,255,255,0.18)' },
  errorBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  modalRoot: { flex: 1, backgroundColor: '#000000' },
  modalTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  modalBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingBottom: 12 },
  scrubRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600', minWidth: 36, textAlign: 'center' },
  scrubHit: { flex: 1, height: 36, justifyContent: 'center' },
  scrubTrack: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  scrubFill: { height: 3, backgroundColor: ORANGE },
  scrubKnob: {
    position: 'absolute',
    top: 13,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
});
