import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { ImagePickerBox } from '../../components/common/ImagePickerBox';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';

const ORANGE = '#FF4B33';

const AVAILABLE_GENRES = [
  'Action', 'Drama', 'Comedy', 'Thriller', 'Horror', 'Sci-Fi', 'Romance',
  'Documentary', 'Animation', 'Fantasy', 'Mystery', 'Adventure', 'Musical'
];

const AVAILABLE_ROLES = [
  'Director', 'Producer', 'Cinematographer', 'Editor', 'Sound Designer',
  'Production Designer', 'Costume Designer', 'Makeup Artist', 'Actor',
  'Screenwriter', 'Composer', 'VFX Artist', 'Gaffer', 'Script Supervisor'
];

const STATUS_OPTIONS = [
  { id: 'planning', label: 'Planning' },
  { id: 'pre-production', label: 'Pre-Production' },
  { id: 'production', label: 'Production' },
  { id: 'post-production', label: 'Post-Production' },
  { id: 'completed', label: 'Completed' },
];

export const CreateProjectScreen = ({ navigation }: { navigation: any }) => {
  const { themeColors, isDark } = useUserSettings();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Basic Info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('Hyderabad, Telangana, IND');
  const [isPublic, setIsPublic] = useState(true);
  const [imageUrl, setImageUrl] = useState('');

  // Step 2: Genres & Required Roles
  const [selectedGenres, setSelectedGenres] = useState<string[]>(['Action']);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['Director', 'Cinematographer']);

  // Step 3: Budget & Timeline
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('planning');

  const toggleGenre = (g: string) => {
    setSelectedGenres((prev) =>
      prev.includes(g) ? prev.filter((item) => item !== g) : [...prev, g]
    );
  };

  const toggleRole = (r: string) => {
    setSelectedRoles((prev) =>
      prev.includes(r) ? prev.filter((item) => item !== r) : [...prev, r]
    );
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (!title.trim() || !description.trim()) {
        Alert.alert('Required Fields', 'Project Name and Description are required.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (selectedGenres.length === 0) {
        Alert.alert('Genre Required', 'Please select at least one genre for your project.');
        return;
      }
      setStep(3);
    }
  };

  const handlePrevStep = () => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  const handleCreate = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('Missing Info', 'Please provide a title and description for your project.');
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) {
        throw new Error('You must be signed in to create a project workspace.');
      }

      const payload: any = {
        title: title.trim(),
        description: description.trim(),
        location: location.trim() || null,
        genre: selectedGenres,
        required_roles: selectedRoles,
        status: status,
        is_public: isPublic,
        creator_id: user.id,
        budget_min: budgetMin ? parseFloat(budgetMin) : null,
        budget_max: budgetMax ? parseFloat(budgetMax) : null,
        start_date: startDate.trim() || null,
        end_date: endDate.trim() || null,
        image_url: imageUrl.trim() || null,
      };

      const { data: newProject, error } = await (supabase as any)
        .from('projects')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      if (newProject) {
        let spaceIdToUse: string | null = null;

        // 1. Create matching project_space workspace entry
        const { data: spaceData, error: spaceError } = await (supabase as any)
          .from('project_spaces')
          .insert({
            project_id: newProject.id,
            name: `${title.trim()} Workspace`,
            creator_id: user.id,
          })
          .select()
          .single();

        if (spaceData?.id) {
          spaceIdToUse = spaceData.id;
        } else if (spaceError) {
          // Fallback if space was pre-created or trigger generated
          const { data: existingSpace } = await (supabase as any)
            .from('project_spaces')
            .select('id')
            .eq('project_id', newProject.id)
            .maybeSingle();

          if (existingSpace?.id) {
            spaceIdToUse = existingSpace.id;
          }
        }

        if (spaceIdToUse) {
          // 2. Add creator as owner of the workspace with correct column project_space_id
          await (supabase as any)
            .from('project_space_members')
            .upsert(
              {
                project_space_id: spaceIdToUse,
                user_id: user.id,
                role: 'owner',
              },
              { onConflict: 'project_space_id,user_id', ignoreDuplicates: true }
            );
        }
      }

      Alert.alert('Project Created!', 'Your new ProjectSpace is ready with chat, call sheets, and production workspaces.', [
        {
          text: 'Open Workspace',
          onPress: () =>
            navigation.replace('ProjectSpace', {
              projectId: newProject.id,
              projectTitle: newProject.title,
              projectDescription: newProject.description,
            }),
        },
      ]);
    } catch (err: any) {
      Alert.alert('Creation Failed', err.message || 'Could not create project space. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bgScreen }]}>
      <Header
        title="Create ProjectSpace"
        showLogo={false}
        onBack={() => {
          if (step > 1) handlePrevStep();
          else navigation.goBack();
        }}
      />

      {/* Multi-Step Wizard Progress Bar */}
      <View style={[styles.progressHeader, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
        <View style={styles.stepIndicatorRow}>
          <TouchableOpacity
            style={[styles.stepTab, step === 1 && styles.stepTabActive]}
            onPress={() => setStep(1)}
          >
            <Text style={[styles.stepTabNumber, step === 1 && styles.stepTabNumberActive]}>1</Text>
            <Text style={[styles.stepTabText, { color: step === 1 ? ORANGE : themeColors.textMuted }]}>Basic Info</Text>
          </TouchableOpacity>

          <View style={[styles.stepConnector, { backgroundColor: step >= 2 ? ORANGE : themeColors.border }]} />

          <TouchableOpacity
            style={[styles.stepTab, step === 2 && styles.stepTabActive]}
            onPress={() => {
              if (title.trim() && description.trim()) setStep(2);
            }}
          >
            <Text style={[styles.stepTabNumber, step === 2 && styles.stepTabNumberActive]}>2</Text>
            <Text style={[styles.stepTabText, { color: step === 2 ? ORANGE : themeColors.textMuted }]}>Genre & Roles</Text>
          </TouchableOpacity>

          <View style={[styles.stepConnector, { backgroundColor: step === 3 ? ORANGE : themeColors.border }]} />

          <TouchableOpacity
            style={[styles.stepTab, step === 3 && styles.stepTabActive]}
            onPress={() => {
              if (title.trim() && description.trim() && selectedGenres.length > 0) setStep(3);
            }}
          >
            <Text style={[styles.stepTabNumber, step === 3 && styles.stepTabNumberActive]}>3</Text>
            <Text style={[styles.stepTabText, { color: step === 3 ? ORANGE : themeColors.textMuted }]}>Budget & Dates</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* STEP 1: BASIC INFORMATION */}
        {step === 1 && (
          <View style={[styles.card, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
            <View style={styles.stepTitleRow}>
              <Icon name="file-text" size={20} color={ORANGE} />
              <Text style={[styles.cardTitle, { color: themeColors.textPrimary }]}>1. Basic Information</Text>
            </View>
            <Text style={[styles.cardSub, { color: themeColors.textSecondary }]}>
              Enter your project name, synopsis, location, and visibility settings.
            </Text>

            <Text style={[styles.label, { color: themeColors.textSecondary }]}>PROJECT NAME *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
              placeholder="e.g. Project Vaikuntam / Scene 45"
              placeholderTextColor={themeColors.textMuted}
              value={title}
              onChangeText={setTitle}
            />

            <Text style={[styles.label, { color: themeColors.textSecondary }]}>LOGLINE / DESCRIPTION *</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
              placeholder="Describe your project vision, storyline, or production summary..."
              placeholderTextColor={themeColors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <Text style={[styles.label, { color: themeColors.textSecondary }]}>LOCATION / FILMING STAGE</Text>
            <TextInput
              style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. Ramoji Film City, Hyderabad"
              placeholderTextColor={themeColors.textMuted}
            />

            <ImagePickerBox
              imageUrl={imageUrl}
              onImageSelected={setImageUrl}
              label="PROJECT COVER IMAGE"
              bucket="portfolios"
              folder="projects"
            />

            <Text style={[styles.label, { color: themeColors.textSecondary }]}>PROJECT VISIBILITY</Text>
            <View style={[styles.switchCard, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.switchTitle, { color: themeColors.textPrimary }]}>
                  {isPublic ? '🌐 Public Space' : '🔒 Private Space'}
                </Text>
                <Text style={[styles.switchSub, { color: themeColors.textSecondary }]}>
                  {isPublic
                    ? 'Visible on CineCraft directory. Creators can view and apply.'
                    : 'Confidential. Only invited team members can access.'}
                </Text>
              </View>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ false: '#767577', true: ORANGE }}
                thumbColor="#FFFFFF"
              />
            </View>

            <TouchableOpacity style={styles.nextBtn} onPress={handleNextStep} activeOpacity={0.85}>
              <Text style={styles.nextBtnText}>Next: Genre & Roles →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 2: GENRE & REQUIRED ROLES */}
        {step === 2 && (
          <View style={[styles.card, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
            <View style={styles.stepTitleRow}>
              <Icon name="users" size={20} color={ORANGE} />
              <Text style={[styles.cardTitle, { color: themeColors.textPrimary }]}>2. Genre & Crew Requirements</Text>
            </View>
            <Text style={[styles.cardSub, { color: themeColors.textSecondary }]}>
              Select film genres and open key crew positions to recruit talent.
            </Text>

            <Text style={[styles.label, { color: themeColors.textSecondary }]}>PROJECT GENRES *</Text>
            <View style={styles.badgeGrid}>
              {AVAILABLE_GENRES.map((g) => {
                const isSelected = selectedGenres.includes(g);
                return (
                  <TouchableOpacity
                    key={g}
                    style={[
                      styles.badgeChip,
                      {
                        backgroundColor: isSelected ? ORANGE : themeColors.inputBg,
                        borderColor: isSelected ? ORANGE : themeColors.border,
                      },
                    ]}
                    onPress={() => toggleGenre(g)}
                  >
                    <Text style={[styles.badgeText, { color: isSelected ? '#FFFFFF' : themeColors.textPrimary }]}>
                      {isSelected ? '✓ ' : ''}{g}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.label, { color: themeColors.textSecondary, marginTop: 14 }]}>REQUIRED CREW ROLES</Text>
            <View style={styles.badgeGrid}>
              {AVAILABLE_ROLES.map((r) => {
                const isSelected = selectedRoles.includes(r);
                return (
                  <TouchableOpacity
                    key={r}
                    style={[
                      styles.badgeChip,
                      {
                        backgroundColor: isSelected ? '#1D72F2' : themeColors.inputBg,
                        borderColor: isSelected ? '#1D72F2' : themeColors.border,
                      },
                    ]}
                    onPress={() => toggleRole(r)}
                  >
                    <Text style={[styles.badgeText, { color: isSelected ? '#FFFFFF' : themeColors.textPrimary }]}>
                      {isSelected ? '✓ ' : ''}{r}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.btnRow}>
              <TouchableOpacity style={[styles.prevBtn, { borderColor: themeColors.border }]} onPress={handlePrevStep}>
                <Text style={[styles.prevBtnText, { color: themeColors.textPrimary }]}>← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.nextBtn, { flex: 1 }]} onPress={handleNextStep} activeOpacity={0.85}>
                <Text style={styles.nextBtnText}>Next: Budget & Dates →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* STEP 3: BUDGET & TIMELINE */}
        {step === 3 && (
          <View style={[styles.card, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
            <View style={styles.stepTitleRow}>
              <Icon name="calendar" size={20} color={ORANGE} />
              <Text style={[styles.cardTitle, { color: themeColors.textPrimary }]}>3. Budget & Timeline</Text>
            </View>
            <Text style={[styles.cardSub, { color: themeColors.textSecondary }]}>
              Set production budget range, target shooting schedule, and status.
            </Text>

            <Text style={[styles.label, { color: themeColors.textSecondary }]}>PRODUCTION STATUS</Text>
            <View style={styles.statusGrid}>
              {STATUS_OPTIONS.map((st) => {
                const isSelected = status === st.id;
                return (
                  <TouchableOpacity
                    key={st.id}
                    style={[
                      styles.statusChip,
                      {
                        backgroundColor: isSelected ? ORANGE : themeColors.inputBg,
                        borderColor: isSelected ? ORANGE : themeColors.border,
                      },
                    ]}
                    onPress={() => setStatus(st.id)}
                  >
                    <Text style={[styles.statusText, { color: isSelected ? '#FFFFFF' : themeColors.textPrimary }]}>
                      {st.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.rowTwoCol}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: themeColors.textSecondary }]}>MIN BUDGET (₹)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                  placeholder="e.g. 500000"
                  placeholderTextColor={themeColors.textMuted}
                  keyboardType="numeric"
                  value={budgetMin}
                  onChangeText={setBudgetMin}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: themeColors.textSecondary }]}>MAX BUDGET (₹)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                  placeholder="e.g. 2500000"
                  placeholderTextColor={themeColors.textMuted}
                  keyboardType="numeric"
                  value={budgetMax}
                  onChangeText={setBudgetMax}
                />
              </View>
            </View>

            <View style={styles.rowTwoCol}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: themeColors.textSecondary }]}>START DATE</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={themeColors.textMuted}
                  value={startDate}
                  onChangeText={setStartDate}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: themeColors.textSecondary }]}>END DATE</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={themeColors.textMuted}
                  value={endDate}
                  onChangeText={setEndDate}
                />
              </View>
            </View>

            <View style={styles.btnRow}>
              <TouchableOpacity style={[styles.prevBtn, { borderColor: themeColors.border }]} onPress={handlePrevStep}>
                <Text style={[styles.prevBtnText, { color: themeColors.textPrimary }]}>← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createBtn, loading && styles.btnDisabled, { flex: 1 }]}
                onPress={handleCreate}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.createBtnText}>Initialize ProjectSpace ✨</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  stepIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepTabActive: {},
  stepTabNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E5E7EB',
    color: '#374151',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 22,
  },
  stepTabNumberActive: {
    backgroundColor: ORANGE,
    color: '#FFFFFF',
  },
  stepTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  stepConnector: {
    flex: 1,
    height: 2,
    marginHorizontal: 8,
  },
  content: {
    padding: 14,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  cardSub: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 16,
    lineHeight: 16,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    marginBottom: 12,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
  },
  switchTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  switchSub: {
    fontSize: 11,
    marginTop: 2,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  badgeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  rowTwoCol: {
    flexDirection: 'row',
    gap: 10,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  prevBtn: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  prevBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  nextBtn: {
    backgroundColor: ORANGE,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  createBtn: {
    backgroundColor: ORANGE,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});

export default CreateProjectScreen;
