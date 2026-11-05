import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { VideoView } from '@livekit/react-native';
import { getSupabaseClient } from '@cinecraft/api';
import { Icon } from '../common/Icon';
import { CachedImage } from '../common/CachedImage';
import { LiveParticipant } from '../../services/liveCall';

const EMERALD = '#10B981';
const RED = '#EF4444';
const ABS_FILL = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };

/**
 * Everybody in a group call (discussion room / project space) as video tiles, or a picture when their camera is off.
 * The tiles are the biggest 16:9 size that fits the whole group into the space it is given, centred.
 */
export const CallParticipantGrid = ({ participants }: { participants: LiveParticipant[] }) => {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [avatars, setAvatars] = useState<Record<string, string>>({});

  const idsKey = participants.map((p) => p.identity).sort().join(',');
  useEffect(() => {
    const missing = participants.filter((p) => p.identity && !p.avatarUrl && !avatars[p.identity]).map((p) => p.identity);
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await (getSupabaseClient() as any).from('profiles').select('id, avatar_url').in('id', missing);
        if (cancelled || !data) return;
        setAvatars((prev) => {
          const next = { ...prev };
          data.forEach((r: any) => {
            if (r.avatar_url) next[r.id] = r.avatar_url;
          });
          return next;
        });
      } catch {
        // initials are the fallback
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const grid = useMemo(() => {
    const n = participants.length;
    if (box.w <= 0 || box.h <= 0 || n === 0) return null;
    const gap = 12;
    const availW = box.w - 16;
    let best = { w: 0, h: 0, gap };
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const cellW = (availW - gap * cols) / cols;
      const cellH = (box.h - 8 - gap * rows) / rows;
      const w = Math.floor(Math.min(cellW, (cellH * 16) / 9));
      if (w > best.w) best = { w, h: Math.floor((w * 9) / 16), gap };
    }
    return best.w > 0 ? best : null;
  }, [box.w, box.h, participants.length]);

  return (
    <View style={styles.box} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {grid &&
          participants.map((p) => {
            const avatar = p.avatarUrl || avatars[p.identity];
            const av = Math.max(56, Math.min(180, Math.round(grid.h * 0.42)));
            return (
              <View key={p.identity} style={{ width: grid.w, height: grid.h, margin: grid.gap / 2 }}>
                <View style={[styles.tile, p.isSpeaking && styles.tileSpeaking]}>
                  {p.isCameraOn && p.videoTrack ? (
                    <VideoView style={ABS_FILL} videoTrack={p.videoTrack} objectFit="cover" mirror={p.isLocal} />
                  ) : avatar ? (
                    <CachedImage uri={avatar} style={{ width: av, height: av, borderRadius: av / 2 }} />
                  ) : (
                    <View style={{ width: av, height: av, borderRadius: av / 2, backgroundColor: '#4C2A9A', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#FFFFFF', fontSize: Math.round(av * 0.37), fontWeight: '700' }}>{(p.name[0] || '?').toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.nameTag}>
                    <Icon name={p.isMicOn ? 'mic' : 'mic-off'} size={11} color={p.isMicOn ? EMERALD : RED} />
                    <Text style={styles.nameText} numberOfLines={1}>
                      {p.name}
                      {p.isLocal ? ' (You)' : ''}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  box: { flex: 1, alignSelf: 'stretch' },
  grid: { flexGrow: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center', paddingHorizontal: 8 },
  tile: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#18181C',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileSpeaking: { borderColor: EMERALD },
  nameTag: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    maxWidth: '90%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  nameText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});

export default CallParticipantGrid;
