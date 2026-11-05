import React from 'react';
import { View, Text, TouchableOpacity, Linking, Alert, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { Icon } from '../common/Icon';
import { useUserSettings } from '../../hooks/useUserSettings';
import { toSafeUrl } from '../../utils/safeUrl';

export interface SocialLinkItem { key: string; label: string; url: string }

const LABELS: Record<string, string> = {
  website: 'Website', youtube: 'YouTube', instagram: 'Instagram', twitter: 'X', x: 'X', linkedin: 'LinkedIn',
  imdb: 'IMDb', facebook: 'Facebook', vimeo: 'Vimeo', spotify: 'Spotify', tiktok: 'TikTok', behance: 'Behance',
};
const ORDER = ['website', 'youtube', 'instagram', 'twitter', 'x', 'linkedin', 'imdb', 'facebook', 'vimeo', 'spotify'];
const SKIP = new Set(['accept_direct_pitches', 'custom_links']);

/** Collects every link a profile has: website, the instagram/youtube columns, social_links keys and custom links. Empty values are dropped. */
export const collectSocialLinks = (p: any): SocialLinkItem[] => {
  if (!p) return [];
  const sl = (p.social_links && typeof p.social_links === 'object') ? p.social_links : {};
  const found: Record<string, string> = {};
  const put = (k: string, v: any) => {
    if (typeof v === 'string' && v.trim() && !found[k]) found[k] = v.trim();
  };
  put('website', p.website);
  put('instagram', p.instagram_url); put('youtube', p.youtube_url); put('spotify', p.spotify_url);
  Object.keys(sl).forEach((k) => { if (!SKIP.has(k)) put(k.toLowerCase(), sl[k]); });
  const keys = Object.keys(found).sort((a, b) => {
    const ia = ORDER.indexOf(a); const ib = ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  const items: SocialLinkItem[] = keys.map((k) => ({ key: k, label: LABELS[k] || (k.charAt(0).toUpperCase() + k.slice(1)), url: found[k] }));
  const custom = Array.isArray(sl.custom_links) ? sl.custom_links : [];
  custom.forEach((l: any, i: number) => {
    const url = String(l?.url || '').trim();
    if (!url) return;
    items.push({ key: `custom-${i}`, label: String(l?.title || '').trim() || 'Link', url });
  });
  return items;
};

const BRAND: Record<string, string> = {
  youtube: '#FF0000', instagram: '#E1306C', twitter: '#1D9BF0', x: '#1D9BF0', linkedin: '#0A66C2',
  facebook: '#1877F2', vimeo: '#1AB7EA', imdb: '#C9A400', spotify: '#1DB954',
};

const BrandGlyph = ({ k, color }: { k: string; color: string }) => {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (k) {
    case 'instagram':
      return (
        <Svg {...common}>
          <Rect x={2} y={2} width={20} height={20} rx={5} ry={5} />
          <Path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <Line x1={17.5} x2={17.51} y1={6.5} y2={6.5} />
        </Svg>
      );
    case 'linkedin':
      return (
        <Svg {...common}>
          <Path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
          <Rect x={2} y={9} width={4} height={12} />
          <Circle cx={4} cy={4} r={2} />
        </Svg>
      );
    case 'facebook':
      return (
        <Svg {...common}>
          <Path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
        </Svg>
      );
    case 'twitter':
    case 'x':
      return (
        <Svg {...common}>
          <Path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" />
        </Svg>
      );
    case 'imdb':
    case 'vimeo':
      return <Text style={{ color, fontSize: 11, fontWeight: '800' }}>{k === 'imdb' ? 'IMDb' : 'Vi'}</Text>;
    case 'youtube':
    case 'spotify':
      return <Icon name={k} size={20} />;
    case 'website':
      return <Icon name="globe" size={18} color={color} />;
    default:
      return <Icon name="link" size={18} color={color} />;
  }
};

export const openSocialLink = (url: string, label: string) => {
  const safe = toSafeUrl(url);
  if (!safe) {
    Alert.alert('Link not supported', `The ${label} link cannot be opened.`);
    return;
  }
  Linking.openURL(safe).catch(() => Alert.alert('Could not open the link', `The ${label} link could not be opened on this device.`));
};

/** A wrapping row of 40 px round icon buttons, one per link the profile has. Renders nothing when there are none. */
export const SocialLinksRow = ({ profile }: { profile: any }) => {
  const { themeColors: T } = useUserSettings();
  const items = collectSocialLinks(profile);
  if (items.length === 0) return null;
  return (
    <View style={s.row}>
      {items.map((it) => {
        const brand = BRAND[it.key] || T.textPrimary;
        const custom = it.key.startsWith('custom-');
        return (
          <TouchableOpacity
            key={it.key}
            accessibilityRole="link"
            accessibilityLabel={`Open ${it.label} link`}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            activeOpacity={0.7}
            onPress={() => openSocialLink(it.url, it.label)}
            style={[s.btn, { backgroundColor: T.chipBg, borderColor: T.border }, custom && s.customBtn]}
          >
            <BrandGlyph k={custom ? 'link' : it.key} color={brand} />
            {custom ? <Text numberOfLines={1} style={[s.customLabel, { color: T.textPrimary }]}>{it.label}</Text> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const s = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  btn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  customBtn: { width: undefined, minWidth: 40, maxWidth: 160, paddingHorizontal: 12, flexDirection: 'row', gap: 6 },
  customLabel: { fontSize: 12, fontWeight: '700', flexShrink: 1 },
});
