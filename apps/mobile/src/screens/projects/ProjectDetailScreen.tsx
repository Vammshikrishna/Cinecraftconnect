import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { TabletContainer } from '../../components/common/TabletContainer';
import { useUserSettings } from '../../hooks/useUserSettings';
import { CachedImage } from '../../components/common/CachedImage';
import { getSupabaseClient } from '@cinecraft/api';

export const ProjectDetailScreen = ({ route, navigation }: { route: any; navigation: any }) => {
  const { themeColors, isDark } = useUserSettings();
  const { projectTitle, projectDescription, location, rolesCount, genre, imageUrl, projectId } =
    route.params || {};

  const [project, setProject] = useState<any>(null);
  const [appliedRoles, setAppliedRoles] = useState<Record<string, boolean>>({});
  const [applying, setApplying] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    (async () => {
      try {
        const supabase = getSupabaseClient();
        const { data } = await (supabase.from('projects') as any)
          .select('id, title, description, location, genre, required_roles, image_url, status, creator_id')
          .eq('id', projectId)
          .maybeSingle();
        if (active && data) setProject(data);
        const user = (await supabase.auth.getSession()).data.session?.user ?? null; // local session: getUser() is a network call
        if (user && active) {
          const { data: mine } = await (supabase.from('project_applications') as any)
            .select('id')
            .eq('project_id', projectId)
            .eq('user_id', user.id)
            .maybeSingle();
          if (mine) setAppliedRoles({ __any: true });
        }
      } catch (e) {
        console.warn('[ProjectDetail] load error:', e);
      }
    })();
    return () => {
      active = false;
    };
  }, [projectId]);

  const title = project?.title || projectTitle || 'Project';
  const desc = project?.description || projectDescription || '';
  const loc = project?.location || location || '';
  const roleList: string[] = Array.isArray(project?.required_roles) ? project.required_roles : [];
  const roles = roleList.length || rolesCount || 0;
  const rawGenre = project?.genre || genre;
  const projectGenre = Array.isArray(rawGenre) ? rawGenre.join(', ') : rawGenre || '';
  const img = project?.image_url || imageUrl || '';

  const handleApply = async (roleName: string) => {
    if (!projectId) return;
    setApplying(roleName);
    try {
      const supabase = getSupabaseClient();
      const user = (await supabase.auth.getSession()).data.session?.user ?? null; // local session: getUser() is a network call
      if (!user) {
        Alert.alert('Sign in required', 'Please sign in to apply.');
        return;
      }
      const { error } = await (supabase.from('project_applications') as any).insert({
        project_id: projectId,
        user_id: user.id,
        cover_letter: `Applying for role: ${roleName}`,
      });
      if (error) throw error;
      setAppliedRoles({ __any: true, [roleName]: true });
      Alert.alert('Application sent', `Your application for "${roleName}" has been submitted to the project team.`);
    } catch (e: any) {
      Alert.alert('Could not apply', e?.message || 'You may have already applied to this project.');
    } finally {
      setApplying(null);
    }
  };

  return (
    <TabletContainer
      backgroundColor={themeColors.bgScreen}
      header={
        <Header
          title="Project Overview"
          showLogo={false}
          onBack={() => navigation.goBack()}
        />
      }
    >
      <ScrollView contentContainerStyle={styles.content}>
        <CachedImage uri={img} style={[styles.image, { backgroundColor: themeColors.chipBg }]} resizeMode="cover" />

        <View style={[styles.card, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
          <View style={styles.badgeRow}>
            <View style={[styles.sceneBadge, { backgroundColor: isDark ? 'rgba(5, 150, 105, 0.2)' : '#ECFDF5' }]}>
              <Text style={[styles.sceneText, { color: isDark ? '#34D399' : '#059669' }]}>[SCENE: ACTIVE]</Text>
            </View>
            <Text style={styles.genreText}>GENRE // {projectGenre}</Text>
          </View>

          <Text style={[styles.title, { color: themeColors.textPrimary }]}>{title}</Text>

          <View style={styles.locationRow}>
            <Icon name="map-pin" size={13} color={themeColors.textSecondary} />
            <Text style={[styles.location, { color: themeColors.textSecondary }]}>{loc}</Text>
          </View>

          <Text style={[styles.desc, { color: themeColors.textSecondary }]}>{desc}</Text>

          <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />

          <Text style={[styles.sectionHeading, { color: themeColors.textPrimary }]}>Open Crew & Cast Roles ({roles})</Text>

          {roleList.map((role) => (
            <View key={role} style={[styles.roleItem, { borderBottomColor: themeColors.divider }]}>
              <View style={styles.roleInfo}>
                <Text style={[styles.roleName, { color: themeColors.textPrimary }]}>{role}</Text>
                
              </View>
              <TouchableOpacity style={styles.applyBtn} disabled={!!appliedRoles.__any || applying === role} onPress={() => handleApply(role)}>
                <Text style={styles.applyBtnText}>{appliedRoles[role] ? 'Applied' : appliedRoles.__any ? 'Applied' : applying === role ? '…' : 'Apply'}</Text>
              </TouchableOpacity>
            </View>
          ))}

          <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />

          <TouchableOpacity
            style={styles.spaceBtn}
            onPress={() =>
              navigation.navigate('ProjectSpace', {
                projectId,
                projectTitle: title,
                projectDescription: desc,
              })
            }
          >
            <Text style={styles.spaceBtnText}>Enter Production Workspace →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </TabletContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  content: {
    paddingBottom: 40,
  },
  image: {
    width: '100%',
    height: 200,
    backgroundColor: '#0D0D0D',
  },
  card: {
    backgroundColor: '#FFFFFF',
    margin: 14,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sceneBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  sceneText: {
    color: '#059669',
    fontSize: 10,
    fontFamily: 'Inconsolata-Bold',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  genreText: {
    color: '#FF4B33',
    fontSize: 10,
    fontFamily: 'Inconsolata-Bold',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  title: {
    color: '#0D0D0D',
    fontSize: 20,
    fontFamily: 'Lora-Bold',
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  location: {
    color: '#6B7280',
    fontSize: 11,
    fontFamily: 'Inconsolata-Bold',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  desc: {
    color: '#4B5563',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'WorkSans-Regular',
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 16,
  },
  sectionHeading: {
    color: '#0D0D0D',
    fontSize: 16,
    fontFamily: 'Lora-Bold',
    fontWeight: '700',
    marginBottom: 14,
  },
  roleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  roleInfo: {
    flex: 1,
    marginRight: 10,
  },
  roleName: {
    color: '#0D0D0D',
    fontSize: 14,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '700',
  },
  roleMeta: {
    color: '#9CA3AF',
    fontSize: 12,
    fontFamily: 'WorkSans-Regular',
    marginTop: 4,
  },
  applyBtn: {
    backgroundColor: 'rgba(255, 75, 51, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  applyBtnText: {
    color: '#FF4B33',
    fontSize: 12,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '700',
  },
  spaceBtn: {
    backgroundColor: '#FF4B33',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  spaceBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '700',
  },
});

export default ProjectDetailScreen;
