import { CachedImage } from '../common/CachedImage';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, StyleProp, ViewStyle, DimensionValue } from 'react-native';
import { Icon } from '../common/Icon';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

// 4 Corner brackets component matching Web CornerBrackets
const CornerBrackets: React.FC<{ color?: string }> = ({ color = ORANGE }) => (
  <>
    <View style={[styles.bracket, styles.bracketTL, { borderColor: color }]} pointerEvents="none" />
    <View style={[styles.bracket, styles.bracketTR, { borderColor: color }]} pointerEvents="none" />
    <View style={[styles.bracket, styles.bracketBL, { borderColor: color }]} pointerEvents="none" />
    <View style={[styles.bracket, styles.bracketBR, { borderColor: color }]} pointerEvents="none" />
  </>
);

interface JobShareCardProps {
  jobId: string;
  title?: string;
  company?: string;
  location?: string;
  logoUrl?: string;
  description?: string;
  salary?: string;
  type?: string;
  navigation?: any;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  width?: DimensionValue;
}

export const JobShareCard: React.FC<JobShareCardProps> = ({
  jobId,
  title: initialTitle,
  company: initialCompany,
  location: initialLocation,
  logoUrl: initialLogo,
  description: initialDesc,
  salary: initialSalary,
  type: initialType,
  navigation,
  compact = false,
  style,
  width,
}) => {
  const { themeColors, isDark } = useUserSettings();
  const [title, setTitle] = useState(initialTitle);
  const [company, setCompany] = useState(initialCompany);
  const [location, setLocation] = useState(initialLocation);
  const [logoUrl, setLogoUrl] = useState(initialLogo);
  const [description, setDescription] = useState(initialDesc);
  const [salary, setSalary] = useState(initialSalary);
  const [type, setType] = useState(initialType);

  useEffect(() => {
    const fetchJobDetails = async () => {
      if (!jobId || jobId === 'undefined') return;
      if (initialDesc && initialSalary) return;

      try {
        const supabase = getSupabaseClient();
        const { data: job } = await supabase
          .from('jobs')
          .select('*, profiles(full_name, avatar_url, username)')
          .eq('id', jobId)
          .maybeSingle();

        if (job) {
          setTitle(job.title || initialTitle);
          setCompany(job.profiles?.full_name || job.profiles?.username || initialCompany);
          setLocation(job.location || initialLocation);
          setLogoUrl(job.profiles?.avatar_url || initialLogo);
          setDescription(job.description || initialDesc);
          setType(job.type || initialType);

          const salaryText = job.salary_min && job.salary_max
            ? `₹${job.salary_min.toLocaleString()} - ₹${job.salary_max.toLocaleString()}`
            : job.salary_min
              ? `₹${job.salary_min.toLocaleString()}+`
              : initialSalary;
          setSalary(salaryText);
        }
      } catch {
        // Silently fall back to initial props
      }
    };

    fetchJobDetails();
  }, [jobId]);

  const handlePress = () => {
    if (!navigation) return;
    navigation.navigate('JobDetail', { jobId, jobTitle: title });
  };

  // Compact layout (used inside PostCard)
  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.compactContainer, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }, style]}
        activeOpacity={0.88}
        onPress={handlePress}
      >
        <CornerBrackets />
        <View style={[styles.headerBar, { backgroundColor: isDark ? '#1F1F1F' : INK }]}>
          <View style={styles.companyRow}>
            {logoUrl ? (
              <CachedImage uri={logoUrl} style={styles.logoImg} />
            ) : (
              <View style={styles.logoFallback}>
                <Text style={styles.logoFallbackText}>{(company || 'S').charAt(0)}</Text>
              </View>
            )}
            <Text style={styles.companyNameText} numberOfLines={1}>
              {company || 'CineCraft Studio'}
            </Text>
          </View>
          <View style={styles.hiringBadge}>
            <Text style={styles.hiringBadgeText}>HIRING</Text>
          </View>
        </View>

        <View style={[styles.compactBody, { backgroundColor: themeColors.bgScreen }]}>
          <View style={styles.titleTypeRow}>
            <Text style={[styles.titleText, { color: themeColors.textPrimary }]} numberOfLines={1}>
              {title || 'Open Casting Call'}
            </Text>
            {type && (
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>TYPE // {type.toUpperCase()}</Text>
              </View>
            )}
          </View>

          <View style={styles.metaRow}>
            <View style={styles.locationTag}>
              <Text style={styles.locationTagText} numberOfLines={1}>
                LOC // {location || 'Global'}
              </Text>
            </View>
            {salary && <Text style={styles.salaryText}>{salary}</Text>}
          </View>

          {description && (
            <Text style={[styles.descText, { color: themeColors.textSecondary }]} numberOfLines={2}>
              {description}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  // Standalone layout (used in chat messages / standalone card)
  return (
    <TouchableOpacity
      style={[styles.standaloneContainer, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }, width ? { width } : null, style]}
      activeOpacity={0.92}
      onPress={handlePress}
    >
      <CornerBrackets />

      {/* HIRING pill top-right */}
      <View style={styles.hiringBadgeStandalone}>
        <Text style={styles.hiringBadgeText}>HIRING</Text>
      </View>

      <View style={styles.standaloneBody}>
        {/* Title + Type */}
        <View style={styles.standaloneTitleRow}>
          <Text style={[styles.titleText, { color: themeColors.textPrimary }]} numberOfLines={2}>
            {title || 'Open Casting Call'}
          </Text>
          {type && (
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>TYPE // {type.toUpperCase()}</Text>
            </View>
          )}
        </View>

        {/* Location tag */}
        {location && (
          <View style={styles.locationTag}>
            <Text style={styles.locationTagText} numberOfLines={1}>
              LOC // {location}
            </Text>
          </View>
        )}

        {/* Description quote */}
        {description && (
          <View style={styles.descQuote}>
            <Text style={[styles.descText, { color: themeColors.textSecondary }]} numberOfLines={3}>
              {description}
            </Text>
          </View>
        )}

        {/* Meta row: Active badge + Salary */}
        <View style={styles.badgeRow}>
          <View style={styles.activeBadge}>
            <Icon name="clock" size={9} color={ORANGE} />
            <Text style={[styles.activeBadgeText, { color: themeColors.textSecondary }]}>Active Now</Text>
          </View>
          {salary && (
            <View style={styles.salaryBadge}>
              <Text style={styles.salaryBadgeText}>{salary}</Text>
            </View>
          )}
        </View>

        {/* Hiring entity row */}
        <View style={[styles.authorRow, { borderTopColor: themeColors.divider }]}>
          {logoUrl ? (
            <CachedImage uri={logoUrl} style={styles.authorLogo} />
          ) : (
            <View style={styles.authorLogoFallback}>
              <Text style={styles.authorLogoFallbackText}>{(company || 'S').charAt(0)}</Text>
            </View>
          )}
          <View style={styles.authorMeta}>
            <Text style={[styles.authorName, { color: themeColors.textPrimary }]} numberOfLines={1}>
              {company || 'CineCraft Studio'}
            </Text>
            <Text style={styles.authorRole}>Hiring Entity</Text>
          </View>
        </View>

        {/* CTA Button */}
        <TouchableOpacity style={styles.ctaButton} activeOpacity={0.85} onPress={handlePress}>
          <Icon name="briefcase" size={13} color="#FFFFFF" />
          <Text style={styles.ctaButtonText}>Apply for Role</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  compactContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginTop: 6,
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    position: 'relative',
  },
  standaloneContainer: {
    width: 240,
    maxWidth: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    position: 'relative',
  },
  bracket: {
    position: 'absolute',
    width: 8,
    height: 8,
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
  headerBar: {
    backgroundColor: INK,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  logoImg: {
    width: 24,
    height: 24,
    borderRadius: 6,
  },
  logoFallback: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoFallbackText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  companyNameText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  hiringBadge: {
    backgroundColor: ORANGE,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  hiringBadgeStandalone: {
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
    elevation: 3,
  },
  hiringBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  compactBody: {
    padding: 12,
  },
  standaloneBody: {
    padding: 14,
    paddingTop: 32,
    gap: 8,
  },
  standaloneTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 6,
  },
  titleTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  titleText: {
    fontSize: 14,
    fontWeight: '900',
    color: INK,
    fontFamily: 'Lora-Bold',
    flex: 1,
  },
  typeBadge: {
    backgroundColor: '#FFF7F5',
    borderWidth: 1,
    borderColor: '#FFE5DF',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  typeBadgeText: {
    color: ORANGE,
    fontSize: 8.5,
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  locationTag: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  locationTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
  salaryText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '800',
  },
  descText: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
    lineHeight: 15,
  },
  descQuote: {
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255,75,51,0.3)',
    paddingLeft: 8,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(107,114,128,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(107,114,128,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activeBadgeText: {
    color: '#374151',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  salaryBadge: {
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  salaryBadgeText: {
    color: '#16A34A',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  authorLogo: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  authorLogoFallback: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorLogoFallbackText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  authorMeta: {
    flex: 1,
  },
  authorName: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#111827',
    textTransform: 'uppercase',
  },
  authorRole: {
    fontSize: 8,
    fontWeight: '900',
    color: ORANGE,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FF3D00',
    paddingVertical: 9,
    borderRadius: 12,
    marginTop: 4,
    shadowColor: '#FF3D00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
});

export default JobShareCard;
