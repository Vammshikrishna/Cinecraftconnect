import { CachedImage } from '../common/CachedImage';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, StyleProp, ViewStyle, DimensionValue } from 'react-native';
import { Icon } from '../common/Icon';
import { getSupabaseClient } from '@cinecraft/api';
import LinearGradient from 'react-native-linear-gradient';
import { useUserSettings } from '../../hooks/useUserSettings';

const ORANGE = '#FF4B33';

// 4 Corner brackets component matching Web CornerBrackets
const CornerBrackets: React.FC<{ color?: string }> = ({ color = ORANGE }) => (
  <>
    <View style={[s.bracket, s.bracketTL, { borderColor: color }]} pointerEvents="none" />
    <View style={[s.bracket, s.bracketTR, { borderColor: color }]} pointerEvents="none" />
    <View style={[s.bracket, s.bracketBL, { borderColor: color }]} pointerEvents="none" />
    <View style={[s.bracket, s.bracketBR, { borderColor: color }]} pointerEvents="none" />
  </>
);

export interface ShareCardData {
  type: 'post' | 'job' | 'project' | 'pitch' | 'marketplace' | 'profile' | 'room' | 'announcement' | 'vendor' | 'company' | 'content';
  id?: string;
  // Room (DISCUSSION_SHARE) extras
  memberCount?: number;
  roomType?: string;
  isActive?: boolean;
  isPrivate?: boolean;
  // Pitch (PITCH_SHARE) extras
  format?: string;
  compensation?: string;
  budgetRange?: string;
  deadline?: string;
  // Content (CONTENT_SHARE) extras. `mediaType` is web's `type` ('movie' | 'tv'), kept apart because `type` is the card type.
  poster_path?: string | null;
  rating?: number;
  overview?: string;
  mediaType?: 'movie' | 'tv';
  title: string;
  subtitle?: string;
  imageUrl?: string;
  avatarUrl?: string;
  badge?: string;
  priceOrSalary?: string;
  location?: string;
  // Extended props from web self-healing
  author?: { username?: string; full_name?: string; avatar_url?: string; is_verified?: boolean };
  description?: string;
  status?: string;
  genre?: string;
  craft?: string;
  bio?: string;
  salary?: string;
  company?: string;
  logoUrl?: string;
  category?: string;
}

const asStr = (v: any): string | undefined => (typeof v === 'string' && v.trim() ? v : typeof v === 'number' ? String(v) : undefined);

/**
 * Turns a parsed *_SHARE payload (from web or mobile) into safe ShareCardData: widens the id fallback chain
 * (roomId, pitchId...), never lets an object land in a Text field (web pitch payloads carry `author{}`), and maps
 * web's CONTENT_SHARE `type: 'movie' | 'tv'` to `mediaType` when the card type is 'content'.
 * Callers can use it as `normalizeShareCardData({ ...parsed, type: 'content' })` (web's own type is read from `type` when it is movie/tv).
 */
export const normalizeShareCardData = (raw: any): ShareCardData => {
  const d: any = { ...(raw || {}) };
  d.id = asStr(d.id) || asStr(d.roomId) || asStr(d.pitchId) || asStr(d.projectId) || asStr(d.postId) || asStr(d.jobId) || asStr(d.listingId) || asStr(d.userId);
  d.title = asStr(d.title) || asStr(d.name) || '';
  if (d.type === 'movie' || d.type === 'tv') {
    d.mediaType = d.type;
    d.type = 'content';
  }
  if (d.author && typeof d.author === 'object') {
    d.author = {
      username: asStr(d.author.username),
      full_name: asStr(d.author.full_name) || asStr(d.author.name),
      avatar_url: asStr(d.author.avatar_url),
      is_verified: !!d.author.is_verified,
    };
  } else if (typeof d.author === 'string' && d.author) {
    d.author = { full_name: d.author };
  } else {
    delete d.author;
  }
  for (const k of ['subtitle', 'description', 'badge', 'category', 'format', 'compensation', 'deadline', 'roomType', 'location', 'genre']) {
    if (d[k] !== undefined && typeof d[k] !== 'string') {
      d[k] = Array.isArray(d[k]) ? asStr(d[k][0]) : asStr(d[k]);
    }
  }
  d.budgetRange = asStr(d.budgetRange) || asStr(d.budget_range);
  if (d.memberCount === undefined && d.member_count !== undefined) d.memberCount = d.member_count;
  if (typeof d.memberCount !== 'number') d.memberCount = Number(d.memberCount) || undefined;
  if (d.type === 'pitch') {
    if (!d.genre) d.genre = asStr(Array.isArray(d.genres) ? d.genres[0] : d.genres);
    if (!d.subtitle) d.subtitle = d.description;
  }
  if (d.type === 'room') {
    if (!d.badge) d.badge = d.category;
    d.isPrivate = d.isPrivate ?? (d.roomType === 'private' || d.room_type === 'private');
  }
  if (d.type === 'content') {
    d.rating = typeof d.rating === 'number' ? d.rating : Number(d.rating) || undefined;
    d.overview = asStr(d.overview);
    d.poster_path = asStr(d.poster_path) || null;
    if (!d.subtitle) d.subtitle = d.overview;
  }
  return d as ShareCardData;
};

const tmdbPoster = (p?: string | null): string | undefined =>
  !p ? undefined : p.startsWith('http') ? p : `https://image.tmdb.org/t/p/w342${p.startsWith('/') ? '' : '/'}${p}`;

interface ShareCardProps {
  data: ShareCardData;
  navigation: any;
  style?: StyleProp<ViewStyle>;
  width?: DimensionValue;
}

// Map share type to icon, CTA text, CTA color, and label
const CARD_CONFIG: Record<string, { icon: string; cta: string; label: string; gradientColors: string[] }> = {
  post: {
    icon: 'image',
    cta: 'View Post',
    label: 'SHARED POST',
    gradientColors: ['#0A0A0A', '#1A1A2E'],
  },
  job: {
    icon: 'briefcase',
    cta: 'Apply for Role',
    label: 'JOB OPPORTUNITY',
    gradientColors: ['#0A0A0A', '#1C1917'],
  },
  project: {
    icon: 'box',
    cta: 'Enter Project Space',
    label: 'PROJECT SPACE',
    gradientColors: ['#0F172A', '#1E3A5F'],
  },
  pitch: {
    icon: 'zap',
    cta: 'View Pitch Deck',
    label: 'PITCH DECK',
    gradientColors: ['#1A0A2E', '#2D1B69'],
  },
  marketplace: {
    icon: 'shopping-bag',
    cta: 'Book Equipment',
    label: 'EQUIPMENT LISTING',
    gradientColors: ['#0A1628', '#1A2332'],
  },
  profile: {
    icon: 'user',
    cta: 'View Portfolio',
    label: 'CREATOR PROFILE',
    gradientColors: ['#0D0D0D', '#1F1F1F'],
  },
  room: {
    icon: 'message-circle',
    cta: 'Join Discussion',
    label: 'DISCUSSION ROOM',
    gradientColors: ['#0A1A0A', '#1A2E1A'],
  },
  announcement: {
    icon: 'bell',
    cta: 'View Announcement',
    label: 'ANNOUNCEMENT',
    gradientColors: ['#2E1A0A', '#3D2817'],
  },
  vendor: {
    icon: 'truck',
    cta: 'View Vendor',
    label: 'VERIFIED VENDOR',
    gradientColors: ['#0A0A1E', '#1A1A3E'],
  },
  content: {
    icon: 'film',
    cta: 'View Details',
    label: 'FILM / SERIES',
    gradientColors: ['#0A0A0A', '#1F1511'],
  },
  company: {
    icon: 'building',
    cta: 'View Studio Page',
    label: 'STUDIO PAGE',
    gradientColors: ['#0A1A2E', '#1A2A3E'],
  },
};

export const ShareCard: React.FC<ShareCardProps> = ({ data: rawData, navigation, style, width }) => {
  const { themeColors, isDark } = useUserSettings();
  const data = React.useMemo(() => normalizeShareCardData(rawData), [rawData]);
  const [liveData, setLiveData] = useState(data);

  // Self-healing: fetch live data from Supabase if we have an ID
  useEffect(() => {
    const fetchLiveData = async () => {
      if (!data.id) return;
      const supabase = getSupabaseClient();

      try {
        switch (data.type) {
          case 'project': {
            const { data: project } = await supabase
              .from('projects')
              .select('*')
              .eq('id', data.id)
              .maybeSingle();
            if (project) {
              setLiveData(prev => ({
                ...prev,
                title: project.title || prev.title,
                subtitle: project.description || prev.subtitle,
                imageUrl: project.image_url || prev.imageUrl,
                location: project.location || prev.location,
                status: project.status || prev.status,
                genre: (project.genre as any)?.[0] || prev.genre,
              }));
            }
            break;
          }
          case 'post': {
            const { data: post } = await supabase
              .from('posts')
              .select('id, content, media_url, profiles:author_id(username, full_name, avatar_url, is_verified)')
              .eq('id', data.id)
              .maybeSingle();
            if (post) {
              const profile = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
              setLiveData(prev => ({
                ...prev,
                title: post.content?.slice(0, 80) || prev.title,
                imageUrl: post.media_url || prev.imageUrl,
                author: {
                  username: profile?.username || undefined,
                  full_name: profile?.full_name || undefined,
                  avatar_url: profile?.avatar_url || undefined,
                  is_verified: profile?.is_verified || false,
                },
              }));
            }
            break;
          }
          case 'job': {
            const { data: job } = await supabase
              .from('jobs')
              .select('*, profiles(full_name, avatar_url, username)')
              .eq('id', data.id)
              .maybeSingle();
            if (job) {
              const salaryText = job.salary_min && job.salary_max
                ? `₹${job.salary_min.toLocaleString()} - ₹${job.salary_max.toLocaleString()}`
                : job.salary_min
                  ? `₹${job.salary_min.toLocaleString()}+`
                  : undefined;
              setLiveData(prev => ({
                ...prev,
                title: job.title || prev.title,
                subtitle: job.description || prev.subtitle,
                company: job.profiles?.full_name || job.profiles?.username || prev.company,
                logoUrl: job.profiles?.avatar_url || prev.logoUrl,
                location: job.location || prev.location,
                salary: salaryText || prev.salary,
                badge: job.type || prev.badge,
              }));
            }
            break;
          }
          case 'profile': {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', data.id)
              .maybeSingle();
            if (profile) {
              setLiveData(prev => ({
                ...prev,
                title: profile.full_name || profile.username || prev.title,
                avatarUrl: profile.avatar_url || prev.avatarUrl,
                craft: profile.craft || prev.craft,
                bio: profile.bio || prev.bio,
                author: { is_verified: profile.is_verified ?? false },
              }));
            }
            break;
          }
          case 'marketplace': {
            const { data: listing } = await supabase
              .from('marketplace_listings')
              .select('*, profiles(username, avatar_url)')
              .eq('id', data.id)
              .maybeSingle();
            if (listing) {
              setLiveData(prev => ({
                ...prev,
                title: listing.title || prev.title,
                imageUrl: listing.images?.[0] || prev.imageUrl,
                priceOrSalary: listing.price_per_day ? `₹${listing.price_per_day.toLocaleString()}/day` : prev.priceOrSalary,
                subtitle: listing.description || prev.subtitle,
                category: listing.category || prev.category,
                location: listing.location || prev.location,
              }));
            }
            break;
          }
          case 'room': {
            const { data: room } = await (supabase as any)
              .from('discussion_rooms')
              .select('title, description, room_type, member_count, room_categories(name)')
              .eq('id', data.id)
              .maybeSingle();
            if (room) {
              const cat = Array.isArray(room.room_categories) ? room.room_categories[0] : room.room_categories;
              setLiveData(prev => ({
                ...prev,
                title: asStr(room.title) || prev.title,
                subtitle: asStr(room.description) || prev.subtitle,
                memberCount: typeof room.member_count === 'number' ? room.member_count : prev.memberCount,
                badge: asStr(cat?.name) || prev.badge,
                roomType: asStr(room.room_type) || prev.roomType,
                isPrivate: room.room_type ? room.room_type === 'private' : prev.isPrivate,
              }));
            }
            break;
          }
          case 'pitch': {
            const { data: pitch } = await (supabase as any)
              .from('pitch_calls')
              .select('title, requirement_description, format, compensation, budget_range, deadline, genre')
              .eq('id', data.id)
              .maybeSingle();
            if (pitch) {
              setLiveData(prev => ({
                ...prev,
                title: asStr(pitch.title) || prev.title,
                subtitle: asStr(pitch.requirement_description) || prev.subtitle,
                format: asStr(pitch.format) || prev.format,
                compensation: asStr(pitch.compensation) || prev.compensation,
                budgetRange: asStr(pitch.budget_range) || prev.budgetRange,
                deadline: asStr(pitch.deadline) || prev.deadline,
                genre: asStr(pitch.genre?.[0]) || prev.genre,
              }));
            }
            break;
          }
          case 'content': {
            // Native cinema ids are uuids (contain '-'); TMDB ids are plain numbers and come with a poster_path.
            if (!data.id.includes('-')) break;
            const { data: film } = await (supabase as any)
              .from('platform_cinema')
              .select('title, poster_url, description')
              .eq('id', data.id)
              .maybeSingle();
            if (film) {
              setLiveData(prev => ({
                ...prev,
                title: asStr(film.title) || prev.title,
                imageUrl: asStr(film.poster_url) || prev.imageUrl,
                subtitle: asStr(film.description) || prev.subtitle,
              }));
            }
            break;
          }
        }
      } catch (err) {
        console.warn('ShareCard self-heal error:', err);
      }
    };

    fetchLiveData();
  }, [data.id, data.type]);

  const config = CARD_CONFIG[data.type] || CARD_CONFIG.post;

  const handlePress = () => {
    switch (data.type) {
      case 'post':
        navigation.navigate('PostDetail', { postId: data.id, authorName: liveData.author?.full_name || data.subtitle || 'Creator', postText: data.title, imageUrl: liveData.imageUrl || data.imageUrl });
        break;
      case 'job':
        navigation.navigate('JobDetail', { jobId: data.id, jobTitle: data.title });
        break;
      case 'project':
        navigation.navigate('ProjectDetail', { projectId: data.id, projectTitle: data.title });
        break;
      case 'pitch':
        navigation.navigate('PitchDetail', { pitchId: data.id, pitchTitle: data.title });
        break;
      case 'marketplace':
        navigation.navigate('MarketplaceDetail', { listingId: data.id, listingTitle: data.title, price: liveData.priceOrSalary || data.priceOrSalary, location: liveData.location || data.location, imageUrl: liveData.imageUrl || data.imageUrl });
        break;
      case 'profile':
        navigation.navigate('PublicProfile', { userId: data.id, creatorName: data.title, craft: liveData.craft || data.subtitle, avatarUrl: liveData.avatarUrl || data.avatarUrl });
        break;
      case 'room':
        navigation.navigate('DiscussionRoomDetail', { roomId: data.id, roomTitle: liveData.title || data.title, category: liveData.badge || data.badge });
        break;
      case 'content':
        navigation.navigate('ContentDetail', {
          contentId: data.id,
          mediaType: data.mediaType || 'movie',
          title: liveData.title || data.title,
          posterPath: data.poster_path || undefined,
          overview: liveData.overview || data.overview,
          voteAverage: data.rating,
        });
        break;
      case 'announcement':
        navigation.navigate('Announcements');
        break;
      case 'vendor':
        navigation.navigate('VendorDetail', { vendorName: data.title, category: data.badge, imageUrl: data.imageUrl });
        break;
      case 'company':
        navigation.navigate('CompanyPageDetail', { pageName: data.title, industry: data.badge, logoUrl: data.imageUrl });
        break;
    }
  };

  const displayTitle = liveData.title || data.title || 'Shared Item';
  const displaySubtitle = liveData.subtitle || data.subtitle;
  const displayImage = liveData.imageUrl || data.imageUrl || (data.type === 'content' && !data.id?.includes('-') ? tmdbPoster(data.poster_path) : undefined);
  const displayAvatar = liveData.avatarUrl || data.avatarUrl;
  const displayLocation = liveData.location || data.location;
  const displayBadge = liveData.badge || liveData.category || data.badge;
  const displayPrice = liveData.priceOrSalary || liveData.salary || data.priceOrSalary || (data.type === 'pitch' ? liveData.compensation || liveData.budgetRange : undefined);
  const displayCompany = liveData.company || data.company;
  const displayCraft = liveData.craft;
  const displayBio = liveData.bio;
  const authorName = liveData.author?.full_name || liveData.author?.username || displayCompany;
  const authorAvatar = liveData.author?.avatar_url || liveData.logoUrl || displayAvatar;
  const initials = (displayTitle || 'S').charAt(0).toUpperCase();

  // Profile card has a unique vertical layout
  if (data.type === 'profile') {
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Open shared ${data.type}`}
        style={[
          s.card,
          { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
          width ? { width } : null,
          style,
        ]}
        activeOpacity={0.92}
        onPress={handlePress}
      >
        <CornerBrackets />
        {/* Decorative gradient header */}
        <LinearGradient colors={['rgba(255,75,51,0.12)', 'rgba(255,75,51,0.03)', 'transparent']} style={s.profileGradientHeader} />

        <View style={s.profileContent}>
          {/* Avatar */}
          <View style={s.profileAvatarContainer}>
            {displayAvatar ? (
              <CachedImage uri={displayAvatar} style={[s.profileAvatar, { borderColor: themeColors.border }]} />
            ) : (
              <View style={[s.profileAvatar, s.profileAvatarFallback, { borderColor: themeColors.border }]}>
                <Text style={s.profileAvatarInitial}>{initials}</Text>
              </View>
            )}
            {liveData.author?.is_verified && (
              <View style={s.verifiedBadge}>
                <Icon name="check" size={8} color="#FFFFFF" />
              </View>
            )}
          </View>

          {/* Name */}
          <Text style={[s.profileName, { color: themeColors.textPrimary }]} numberOfLines={2}>{displayTitle}</Text>

          {/* Craft badge */}
          <View style={s.monoBadge}>
            <Text style={s.monoBadgeText}>CRAFT // {displayCraft || 'Filmmaker'}</Text>
          </View>

          {/* Bio */}
          {displayBio && (
            <Text style={[s.profileBio, { color: themeColors.textSecondary }]} numberOfLines={2}>"{displayBio}"</Text>
          )}

          {/* CTA */}
          <TouchableOpacity style={s.ctaButton} activeOpacity={0.85} onPress={handlePress}>
            <Icon name="user" size={13} color="#000000" />
            <Text style={s.ctaText}>View Portfolio</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  // Job card has hiring badge and special layout
  if (data.type === 'job') {
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Open shared ${data.type}`}
        style={[
          s.card,
          { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
          width ? { width } : null,
          style,
        ]}
        activeOpacity={0.92}
        onPress={handlePress}
      >
        <CornerBrackets />
        {/* Hiring badge */}
        <View style={s.hiringBadge}>
          <Text style={s.hiringBadgeText}>HIRING</Text>
        </View>

        <View style={s.jobContent}>
          {/* Title + Type */}
          <View style={s.jobTitleRow}>
            <Text style={[s.cardTitle, { color: themeColors.textPrimary }]} numberOfLines={2}>{displayTitle}</Text>
            {displayBadge && (
              <View style={s.monoBadge}>
                <Text style={s.monoBadgeText}>TYPE // {displayBadge}</Text>
              </View>
            )}
          </View>

          {/* Location */}
          {displayLocation && (
            <View style={s.locationBadge}>
              <Text style={s.locationBadgeText}>LOC // {displayLocation}</Text>
            </View>
          )}

          {/* Description */}
          {displaySubtitle && (
            <View style={s.descriptionBorder}>
              <Text style={[s.descriptionText, { color: themeColors.textSecondary }]} numberOfLines={3}>{displaySubtitle}</Text>
            </View>
          )}

          {/* Status + Salary badges */}
          <View style={s.badgeRow}>
            <View style={s.statusBadge}>
              <Icon name="clock" size={9} color={ORANGE} />
              <Text style={[s.statusBadgeText, { color: themeColors.textSecondary }]}>Active Now</Text>
            </View>
            {displayPrice && (
              <View style={s.salaryBadge}>
                <Text style={s.salaryBadgeText}>{displayPrice}</Text>
              </View>
            )}
          </View>

          {/* Company / Poster */}
          {(authorName || displayCompany) && (
            <View style={[s.authorRow, { borderTopColor: themeColors.divider }]}>
              {authorAvatar ? (
                <CachedImage uri={authorAvatar} style={s.authorAvatarSmall} />
              ) : (
                <View style={[s.authorAvatarSmall, s.authorAvatarFallback]}>
                  <Text style={s.authorAvatarFallbackText}>{(authorName || displayCompany || 'S').charAt(0)}</Text>
                </View>
              )}
              <View style={s.authorMeta}>
                <Text style={[s.authorName, { color: themeColors.textPrimary }]} numberOfLines={1}>{authorName || displayCompany}</Text>
                <Text style={s.authorRole}>Hiring Entity</Text>
              </View>
            </View>
          )}

          {/* CTA */}
          <TouchableOpacity style={s.ctaButtonJob} activeOpacity={0.85} onPress={handlePress}>
            <Icon name="briefcase" size={14} color="#FFFFFF" />
            <Text style={s.ctaTextJob}>Apply for Role</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  // Film / series: poster beside the title, rating and a details button
  if (data.type === 'content') {
    const rating = typeof liveData.rating === 'number' && liveData.rating > 0 ? liveData.rating : data.rating;
    return (
      <TouchableOpacity
        style={[s.card, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }, width ? { width } : null, style]}
        activeOpacity={0.92}
        onPress={handlePress}
      >
        <CornerBrackets />
        <View style={{ flexDirection: 'row', padding: 12, gap: 10 }}>
          {displayImage ? (
            <CachedImage uri={displayImage} style={{ width: 70, height: 105, borderRadius: 8, backgroundColor: '#0A0A0A' }} resizeMode="cover" />
          ) : (
            <LinearGradient colors={config.gradientColors} style={{ width: 70, height: 105, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={config.icon} size={22} color="rgba(255,75,51,0.5)" />
            </LinearGradient>
          )}
          <View style={{ flex: 1, gap: 6 }}>
            <View style={s.monoBadge}>
              <Text style={s.monoBadgeText}>{data.mediaType === 'tv' ? 'SERIES' : 'FILM'}</Text>
            </View>
            <Text style={[s.cardTitle, { color: themeColors.textPrimary }]} numberOfLines={3}>{displayTitle}</Text>
            {rating ? (
              <View style={s.statusBadge}>
                <Icon name="star" size={8} color={ORANGE} />
                <Text style={[s.statusBadgeText, { color: themeColors.textSecondary }]}>{rating.toFixed(1)}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
          <TouchableOpacity style={s.ctaButton} activeOpacity={0.85} onPress={handlePress}>
            <Icon name={config.icon} size={13} color="#000000" />
            <Text style={s.ctaText}>{config.cta}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  // Default premium card for all other types (post, project, marketplace, pitch, etc.)
  return (
    <TouchableOpacity
      style={[
        s.card,
        { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
        width ? { width } : null,
        style,
      ]}
      activeOpacity={0.92}
      onPress={handlePress}
    >
      <CornerBrackets />
      {/* Image Header Section */}
      {displayImage ? (
        <View style={s.imageContainer}>
          <CachedImage uri={displayImage} style={s.cardImage} resizeMode="cover" />
          <LinearGradient
            colors={['rgba(0,0,0,0.2)', 'transparent', 'rgba(0,0,0,0.65)']}
            style={StyleSheet.absoluteFillObject}
          />
          {/* Type label badge at bottom-left of image */}
          <View style={s.imageTypeBadge}>
            <Icon name={config.icon} size={9} color={ORANGE} />
            <Text style={s.imageTypeBadgeText}>{config.label}</Text>
          </View>
        </View>
      ) : (
        <LinearGradient colors={config.gradientColors} style={s.noImageHeader}>
          <Icon name={config.icon} size={28} color="rgba(255,75,51,0.3)" />
          <View style={s.imageTypeBadge}>
            <Icon name={config.icon} size={9} color={ORANGE} />
            <Text style={s.imageTypeBadgeText}>{config.label}</Text>
          </View>
        </LinearGradient>
      )}

      {/* Content Section */}
      <View style={s.contentSection}>
        {/* Author row if available (for posts) */}
        {data.type === 'post' && authorName && (
          <View style={[s.postAuthorRow, { borderBottomColor: themeColors.divider }]}>
            {authorAvatar ? (
              <CachedImage uri={authorAvatar} style={s.postAuthorAvatar} />
            ) : (
              <View style={[s.postAuthorAvatar, s.postAuthorAvatarFallback]}>
                <Text style={s.postAuthorFallbackText}>{(authorName).charAt(0)}</Text>
              </View>
            )}
            <Text style={[s.postAuthorName, { color: themeColors.textPrimary }]} numberOfLines={1}>{authorName}</Text>
          </View>
        )}

        {/* Title */}
        <Text style={[s.cardTitle, { color: themeColors.textPrimary }]} numberOfLines={2}>{displayTitle}</Text>

        {/* Description / Subtitle */}
        {displaySubtitle && (
          <View style={s.descriptionBorder}>
            <Text style={[s.descriptionText, { color: themeColors.textSecondary }]} numberOfLines={2}>{displaySubtitle}</Text>
          </View>
        )}

        {/* Location */}
        {displayLocation && (
          <View style={s.locationBadge}>
            <Text style={s.locationBadgeText}>LOC // {displayLocation}</Text>
          </View>
        )}

        {/* Badges row: Status / Price / Category */}
        <View style={s.badgeRow}>
          {displayBadge && (
            <View style={s.monoBadge}>
              <Text style={s.monoBadgeText}>{displayBadge}</Text>
            </View>
          )}
          {displayPrice && (
            <View style={s.salaryBadge}>
              <Text style={s.salaryBadgeText}>{displayPrice}</Text>
            </View>
          )}
          {liveData.status && (
            <View style={s.statusBadge}>
              <Icon name="clock" size={8} color="#64748B" />
              <Text style={[s.statusBadgeText, { color: themeColors.textSecondary }]}>{liveData.status}</Text>
            </View>
          )}
          {liveData.genre && (
            <View style={s.monoBadgeMuted}>
              <Text style={s.monoBadgeMutedText}>{liveData.genre}</Text>
            </View>
          )}
          {data.type === 'pitch' && liveData.format ? (
            <View style={s.monoBadgeMuted}>
              <Text style={s.monoBadgeMutedText}>{liveData.format}</Text>
            </View>
          ) : null}
          {data.type === 'pitch' && liveData.deadline ? (
            <View style={s.statusBadge}>
              <Icon name="clock" size={8} color="#64748B" />
              <Text style={[s.statusBadgeText, { color: themeColors.textSecondary }]}>
                Due {(() => { const t = new Date(liveData.deadline as string); return isNaN(t.getTime()) ? liveData.deadline : t.toLocaleDateString(); })()}
              </Text>
            </View>
          ) : null}
          {data.type === 'room' && typeof liveData.memberCount === 'number' ? (
            <View style={s.statusBadge}>
              <Icon name="users" size={8} color="#64748B" />
              <Text style={[s.statusBadgeText, { color: themeColors.textSecondary }]}>{liveData.memberCount} members</Text>
            </View>
          ) : null}
          {data.type === 'room' && liveData.isPrivate ? (
            <View style={s.statusBadge}>
              <Icon name="lock" size={8} color="#64748B" />
              <Text style={[s.statusBadgeText, { color: themeColors.textSecondary }]}>Private</Text>
            </View>
          ) : null}
        </View>

        {/* Verified Listing row (for marketplace, vendor, company) */}
        {['marketplace', 'vendor', 'company'].includes(data.type) && (
          <View style={[s.authorRow, { borderTopColor: themeColors.divider }]}>
            <View style={[s.authorAvatarSmall, s.authorAvatarFallback]}>
              <Text style={s.authorAvatarFallbackText}>✓</Text>
            </View>
            <View style={s.authorMeta}>
              <Text style={[s.authorName, { color: themeColors.textPrimary }]} numberOfLines={1}>{displayCompany || displayTitle}</Text>
              <Text style={s.authorRole}>Verified Listing</Text>
            </View>
          </View>
        )}

        {/* CTA Button */}
        <TouchableOpacity style={s.ctaButton} activeOpacity={0.85} onPress={handlePress}>
          <Icon name={config.icon} size={13} color="#000000" />
          <Text style={s.ctaText}>{config.cta}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const s = StyleSheet.create({
  // ─── Card Container ────────────────────────────────────
  card: {
    width: 240,
    maxWidth: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    marginVertical: 4,
    position: 'relative',
  },

  // ─── Corner Brackets ──────────────────────────────────
  bracket: {
    position: 'absolute',
    width: 9,
    height: 9,
    zIndex: 20,
    opacity: 0.85,
  },
  bracketTL: {
    top: 5,
    left: 5,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
  },
  bracketTR: {
    top: 5,
    right: 5,
    borderTopWidth: 1.5,
    borderRightWidth: 1.5,
  },
  bracketBL: {
    bottom: 5,
    left: 5,
    borderBottomWidth: 1.5,
    borderLeftWidth: 1.5,
  },
  bracketBR: {
    bottom: 5,
    right: 5,
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
  },

  // ─── Image Header ──────────────────────────────────────
  imageContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#0A0A0A',
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  noImageHeader: {
    width: '100%',
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageTypeBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,75,51,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,75,51,0.25)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  imageTypeBadgeText: {
    color: ORANGE,
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  // ─── Content Section ───────────────────────────────────
  contentSection: {
    padding: 14,
    gap: 8,
  },

  // ─── Post Author Row ──────────────────────────────────
  postAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    marginBottom: 2,
  },
  postAuthorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  postAuthorAvatarFallback: {
    backgroundColor: 'rgba(255,75,51,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postAuthorFallbackText: {
    color: ORANGE,
    fontSize: 12,
    fontWeight: '700',
  },
  postAuthorName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    letterSpacing: -0.2,
  },

  // ─── Card Title ────────────────────────────────────────
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
    lineHeight: 17,
    textTransform: 'uppercase',
    fontFamily: 'Lora-Bold',
  },

  // ─── Description ───────────────────────────────────────
  descriptionBorder: {
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255,75,51,0.25)',
    paddingLeft: 8,
    marginTop: 2,
  },
  descriptionText: {
    fontSize: 12,
    color: 'rgba(17,24,39,0.6)',
    fontStyle: 'italic',
    lineHeight: 15,
    fontWeight: '500',
  },

  // ─── Badge Row ─────────────────────────────────────────
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    alignItems: 'center',
    marginTop: 2,
  },

  // ─── Mono Badge (Primary) ──────────────────────────────
  monoBadge: {
    backgroundColor: 'rgba(255,75,51,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,75,51,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  monoBadgeText: {
    color: ORANGE,
    fontSize: 7.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontFamily: 'Inconsolata-Bold',
  },

  // ─── Mono Badge (Muted) ───────────────────────────────
  monoBadgeMuted: {
    backgroundColor: 'rgba(107,114,128,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(107,114,128,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  monoBadgeMutedText: {
    color: '#64748B',
    fontSize: 7.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontFamily: 'Inconsolata-Bold',
  },

  // ─── Location Badge ────────────────────────────────────
  locationBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(107,114,128,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(107,114,128,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  locationBadgeText: {
    color: '#64748B',
    fontSize: 7.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontFamily: 'Inconsolata-Bold',
  },

  // ─── Status Badge ──────────────────────────────────────
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(107,114,128,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(107,114,128,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: {
    color: '#374151',
    fontSize: 7.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontFamily: 'Inconsolata-Bold',
  },

  // ─── Salary Badge ──────────────────────────────────────
  salaryBadge: {
    backgroundColor: 'rgba(34,197,94,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  salaryBadgeText: {
    color: '#16A34A',
    fontSize: 7.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontFamily: 'Inconsolata-Bold',
  },

  // ─── Author Row ────────────────────────────────────────
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  authorAvatarSmall: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  authorAvatarFallback: {
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorAvatarFallbackText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  authorMeta: {
    flex: 1,
  },
  authorName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  authorRole: {
    fontSize: 7.5,
    fontWeight: '700',
    color: ORANGE,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // ─── CTA Button (Primary / Orange) ────────────────────
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: ORANGE,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 4,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  ctaText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },

  // ─── CTA Button (Job / Red) ───────────────────────────
  ctaButtonJob: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FF3D00',
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 4,
    shadowColor: '#FF3D00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  ctaTextJob: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },

  // ─── Hiring Badge ──────────────────────────────────────
  hiringBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
    backgroundColor: '#FF3D00',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  hiringBadgeText: {
    color: '#FFFFFF',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  // ─── Job Content ───────────────────────────────────────
  jobContent: {
    padding: 14,
    paddingTop: 32,
    gap: 8,
  },
  jobTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 6,
  },

  // ─── Profile Card Styles ───────────────────────────────
  profileGradientHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    zIndex: 0,
  },
  profileContent: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
    gap: 8,
    zIndex: 1,
  },
  profileAvatarContainer: {
    position: 'relative',
    marginBottom: 4,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  profileAvatarFallback: {
    backgroundColor: 'rgba(255,75,51,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarInitial: {
    color: ORANGE,
    fontSize: 28,
    fontWeight: '700',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3B82F6',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: -0.3,
    textAlign: 'center',
    lineHeight: 17,
    fontFamily: 'Lora-Bold',
  },
  profileBio: {
    fontSize: 12,
    color: 'rgba(107,114,128,0.8)',
    fontStyle: 'italic',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 15,
    paddingHorizontal: 8,
  },
});

export default ShareCard;
