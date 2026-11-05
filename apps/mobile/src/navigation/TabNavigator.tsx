import React, { useState, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  DeviceEventEmitter,
  InteractionManager,
} from 'react-native';
import type { I18nKey } from '@cinecraft/core';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { FeedScreen } from '../screens/feed/FeedScreen';
import { ProjectsScreen } from '../screens/projects/ProjectsScreen';
import { DiscussionRoomsScreen } from '../screens/discussions/DiscussionRoomsScreen';
import { JobsScreen } from '../screens/jobs/JobsScreen';
import { NetworkScreen } from '../screens/network/NetworkScreen';
import { Icon } from '../components/common/Icon';
import { useResponsive } from '../hooks/useResponsive';
import { useUserSettings } from '../hooks/useUserSettings';
import { useAccountType } from '../hooks/useAccountType';
import { useT } from '../hooks/useT';

import { PitchScreen } from '../screens/pitch/PitchScreen';
import { RatingsScreen } from '../screens/ratings/RatingsScreen';
import { CategoryScreen } from '../screens/ratings/CategoryScreen';
import { AnnouncementsScreen } from '../screens/announcements/AnnouncementsScreen';
import { MarketplaceScreen } from '../screens/marketplace/MarketplaceScreen';
import { VendorsScreen } from '../screens/vendors/VendorsScreen';
import { CompanyPagesScreen } from '../screens/pages/CompanyPagesScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { PublicProfileScreen } from '../screens/profile/PublicProfileScreen';
import { withTabletColumn } from '../components/common/TabletContainer';
import { getCurrentUserIdSync } from '../services/offlineCache';

const Tab = createBottomTabNavigator();
// on a tablet the profile sits in a centred column; on a phone it is unchanged
// The Profile tab shows MY profile. Some screens (PitchDetail, PitchScreen) call navigate('Profile', { userId }) for another person:
// when a userId other than mine is given, show that person's public profile instead of my own.
const ProfileScreenTablet = (props: any) => {
  const targetId = props?.route?.params?.userId;
  const me = getCurrentUserIdSync();
  if (targetId && targetId !== me) {
    return <PublicProfileScreen {...props} />;
  }
  return <ProfileScreen {...props} />;
};
let lastHomePress = 0;

const DummyScreen = () => <View style={{ flex: 1, backgroundColor: 'transparent' }} />;

interface TabNavigatorProps {
  navigation: any;
}

const moreMenuItems: { label: string; key: I18nKey; iconName: string; route: string }[] = [
  { label: 'Pitch', key: 'nav.pitch', iconName: 'Lightbulb', route: 'Pitch' },
  { label: 'Ratings', key: 'nav.ratings', iconName: 'Star', route: 'Ratings' },
  { label: 'Announcements', key: 'nav.announcements', iconName: 'Megaphone', route: 'Announcements' },
  { label: 'Marketplace', key: 'nav.marketplace', iconName: 'ShoppingBag', route: 'Marketplace' },
  { label: 'Pages', key: 'nav.pages', iconName: 'StudioPageIcon', route: 'CompanyPages' },
];

export const TabNavigator: React.FC<TabNavigatorProps> = ({
  navigation,
}) => {
  const { isFan } = useAccountType();
  const menuItems = moreMenuItems;
  const { t } = useT();
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);
  const { isTablet } = useResponsive();
  // an explicit tab bar height does not include the bottom inset (gesture bar / 3-button navigation), so add it
  const bottomInset = useSafeAreaInsets().bottom;
  const { themeColors, isDark } = useUserSettings();
  const inactiveIconColor = isDark ? '#94A3B8' : '#64748B';

  // Memoized tab icons to prevent re-creation and touch responder drops
  const renderHomeIcon = useCallback(
    ({ focused }: { focused: boolean }) => (
      <View style={styles.tabItem}>
        <Icon
          name="Home"
          size={22}
          color={focused ? '#FF4B33' : inactiveIconColor}
          strokeWidth={focused ? 2.3 : 1.8}
        />
        {focused && <View style={styles.activeDot} />}
      </View>
    ),
    [inactiveIconColor]
  );

  const renderDiscussionsIcon = useCallback(
    ({ focused }: { focused: boolean }) => (
      <View style={styles.tabItem}>
        <Icon
          name="DiscussionRoomIcon"
          size={22}
          color={focused ? '#FF4B33' : inactiveIconColor}
        />
        {focused && <View style={styles.activeDot} />}
      </View>
    ),
    [inactiveIconColor]
  );

  const renderRatingsIcon = useCallback(
    ({ focused }: { focused: boolean }) => (
      <View style={styles.tabItem}>
        <Icon
          name="Star"
          size={22}
          color={focused ? '#FF4B33' : inactiveIconColor}
          strokeWidth={focused ? 2.3 : 1.8}
        />
        {focused && <View style={styles.activeDot} />}
      </View>
    ),
    [inactiveIconColor]
  );

  const renderAnnouncementsIcon = useCallback(
    ({ focused }: { focused: boolean }) => (
      <View style={styles.tabItem}>
        <Icon
          name="Megaphone"
          size={22}
          color={focused ? '#FF4B33' : inactiveIconColor}
          strokeWidth={focused ? 2.3 : 1.8}
        />
        {focused && <View style={styles.activeDot} />}
      </View>
    ),
    [inactiveIconColor]
  );

  const renderCompanyPagesIcon = useCallback(
    ({ focused }: { focused: boolean }) => (
      <View style={styles.tabItem}>
        <Icon
          name="StudioPageIcon"
          size={22}
          color={focused ? '#FF4B33' : inactiveIconColor}
        />
        {focused && <View style={styles.activeDot} />}
      </View>
    ),
    [inactiveIconColor]
  );

  const renderProjectsIcon = useCallback(
    ({ focused }: { focused: boolean }) => (
      <View style={styles.tabItem}>
        <Icon
          name="Film"
          size={22}
          color={focused ? '#FF4B33' : inactiveIconColor}
          strokeWidth={focused ? 2.3 : 1.8}
        />
        {focused && <View style={styles.activeDot} />}
      </View>
    ),
    [inactiveIconColor]
  );

  const renderJobsIcon = useCallback(
    ({ focused }: { focused: boolean }) => (
      <View style={styles.tabItem}>
        <Icon
          name="Briefcase"
          size={22}
          color={focused ? '#FF4B33' : inactiveIconColor}
          strokeWidth={focused ? 2.3 : 1.8}
        />
        {focused && <View style={styles.activeDot} />}
      </View>
    ),
    [inactiveIconColor]
  );

  const renderNetworkIcon = useCallback(
    ({ focused }: { focused: boolean }) => (
      <View style={styles.tabItem}>
        <Icon
          name="Users"
          size={22}
          color={focused ? '#FF4B33' : inactiveIconColor}
          strokeWidth={focused ? 2.3 : 1.8}
        />
        {focused && <View style={styles.activeDot} />}
      </View>
    ),
    [inactiveIconColor]
  );

  const renderMoreIcon = useCallback(
    ({ focused }: { focused: boolean }) => {
      const active = moreMenuVisible || focused;
      return (
        <View style={styles.tabItem}>
          <Icon
            name="MoreHorizontal"
            size={22}
            color={active ? '#FF4B33' : inactiveIconColor}
            strokeWidth={active ? 2.3 : 1.8}
          />
          {active && <View style={styles.activeDot} />}
        </View>
      );
    },
    [moreMenuVisible, inactiveIconColor]
  );

  const handleMoreItemPress = (item: (typeof moreMenuItems)[0]) => {
    setMoreMenuVisible(false);
    DeviceEventEmitter.emit('closeAllModals');
    navigation.navigate(item.route);
  };

  // Own tab bar so the highlight is decided here: only a visible tab can be highlighted. When a hidden route (Profile, or
  // Pitch / Ratings / Announcements for creators) is open, no tab is highlighted, except More for the routes it opens.
  const renderTabBar = ({ state, descriptors, navigation: nav }: any) => {
    const current = state.routes[state.index];
    const moreRoutes = ['Pitch', 'Ratings', 'Announcements', 'Marketplace', 'Vendors', 'CompanyPages'];
    const fullH = (isTablet ? 64 : 58) + bottomInset;
    return (
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: themeColors.bgCard,
          borderTopColor: themeColors.border,
          borderTopWidth: 1,
          height: fullH,
          paddingBottom: (isTablet ? 8 : 4) + bottomInset,
          paddingTop: isTablet ? 8 : 4,
          elevation: 8,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: isDark ? 0.35 : 0.06,
          shadowRadius: 4,
        }}
      >
        {state.routes.map((route: any) => {
          const { options } = descriptors[route.key];
          const hidden = (options.tabBarItemStyle as any)?.display === 'none';
          if (hidden) return null;
          const isFocused = current.key === route.key
            || (route.name === 'More' && !isFan && moreRoutes.includes(current.name));
          const onPress = () => {
            const event = nav.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) nav.navigate({ name: route.name, merge: true });
          };
          return (
            <TouchableOpacity
              key={route.key}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
              onPress={onPress}
              onLongPress={() => nav.emit({ type: 'tabLongPress', target: route.key })}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              activeOpacity={0.7}
            >
              {options.tabBarIcon ? (options.tabBarIcon as any)({ focused: isFocused, color: isFocused ? '#FF4B33' : inactiveIconColor, size: 22 }) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <>
      <Tab.Navigator
        detachInactiveScreens={false}
        tabBar={renderTabBar}
        screenOptions={{
          headerShown: false,
          lazy: true,
          freezeOnBlur: true,
          tabBarStyle: {
            backgroundColor: themeColors.bgCard,
            borderTopColor: themeColors.border,
            borderTopWidth: 1,
            height: (isTablet ? 64 : 58) + bottomInset,
            paddingBottom: (isTablet ? 8 : 4) + bottomInset,
            paddingTop: isTablet ? 8 : 4,
            elevation: 8,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: isDark ? 0.35 : 0.06,
            shadowRadius: 4,
          },
          tabBarShowLabel: false,
          tabBarActiveTintColor: '#FF4B33',
          tabBarInactiveTintColor: inactiveIconColor,
        }}
      >
        {/* Tab 1: Home / Feed (Common for all roles) */}
        <Tab.Screen
          name="Feed"
          component={FeedScreen}
          listeners={{
            tabPress: () => {
              const now = Date.now();
              if (now - lastHomePress < 400) {
                DeviceEventEmitter.emit('Feed.doubleClick');
              }
              lastHomePress = now;
            },
          }}
          options={{
            tabBarIcon: renderHomeIcon,
                tabBarAccessibilityLabel: 'Home',
          }}
        />

        {/* FAN ACCOUNT TABS: Feed, Discussions, Ratings, Announcements, Pages */}
        {isFan ? (
          <>
            {/* Fan Tab 2: Discussions */}
            <Tab.Screen
              name="Discussions"
              component={DiscussionRoomsScreen}
              options={{
                tabBarIcon: renderDiscussionsIcon,
                tabBarAccessibilityLabel: 'Discussions',
              }}
            />

            {/* Fan Tab 3: Ratings */}
            <Tab.Screen
              name="Ratings"
              component={RatingsScreen}
              options={{
                tabBarIcon: renderRatingsIcon,
                tabBarAccessibilityLabel: 'Ratings',
              }}
            />

            {/* Fan Tab 4: Announcements */}
            <Tab.Screen
              name="Announcements"
              component={AnnouncementsScreen}
              options={{
                tabBarIcon: renderAnnouncementsIcon,
                tabBarAccessibilityLabel: 'Announcements',
              }}
            />

            {/* Fan Tab 5: Company Pages */}
            <Tab.Screen
              name="CompanyPages"
              component={CompanyPagesScreen}
              options={{
                tabBarIcon: renderCompanyPagesIcon,
                tabBarAccessibilityLabel: 'Company pages',
              }}
            />
          </>
        ) : (
          /* CREATOR / STUDIO TABS: Feed, Projects, Discussions, Jobs, Network, More */
          <>
            {/* Tab 2: Projects */}
            <Tab.Screen
              name="Projects"
              component={ProjectsScreen}
              options={{
                tabBarIcon: renderProjectsIcon,
                tabBarAccessibilityLabel: 'Projects',
              }}
            />

            {/* Tab 3: Discussions */}
            <Tab.Screen
              name="Discussions"
              component={DiscussionRoomsScreen}
              options={{
                tabBarIcon: renderDiscussionsIcon,
                tabBarAccessibilityLabel: 'Discussions',
              }}
            />

            {/* Tab 4: Jobs */}
            <Tab.Screen
              name="Jobs"
              component={JobsScreen}
              options={{
                tabBarIcon: renderJobsIcon,
                tabBarAccessibilityLabel: 'Jobs',
              }}
            />

            {/* Tab 5: Network */}
            <Tab.Screen
              name="Network"
              component={NetworkScreen}
              options={{
                tabBarIcon: renderNetworkIcon,
                tabBarAccessibilityLabel: 'Network',
              }}
            />

            {/* Tab 6: More Menu */}
            <Tab.Screen
              name="More"
              component={DummyScreen}
              listeners={{
                tabPress: (e) => {
                  e.preventDefault();
                  setMoreMenuVisible(true);
                },
              }}
              options={{
                tabBarIcon: renderMoreIcon,
                tabBarAccessibilityLabel: 'More',
              }}
            />

            {/* Hidden Tabs for Creator More Menu Items */}
            <Tab.Screen name="Pitch" component={PitchScreen} options={{ tabBarItemStyle: { display: 'none' } }} />
            <Tab.Screen name="Ratings" component={RatingsScreen} options={{ tabBarItemStyle: { display: 'none' } }} />
            <Tab.Screen name="Announcements" component={AnnouncementsScreen} options={{ tabBarItemStyle: { display: 'none' } }} />
            <Tab.Screen name="Marketplace" component={MarketplaceScreen} options={{ tabBarItemStyle: { display: 'none' } }} />
            <Tab.Screen name="Vendors" component={VendorsScreen} options={{ tabBarItemStyle: { display: 'none' } }} />
            <Tab.Screen name="CompanyPages" component={CompanyPagesScreen} options={{ tabBarItemStyle: { display: 'none' } }} />
          </>
        )}

        {/* Global Hidden Tabs (for all roles) */}
        <Tab.Screen name="Profile" component={ProfileScreenTablet} options={{ tabBarItemStyle: { display: 'none' } }} />
      </Tab.Navigator>

      {/* Floating Popup More Menu matching Web MobileNav Dropdown */}
      <Modal
        visible={moreMenuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMoreMenuVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setMoreMenuVisible(false)}>
          <View style={[styles.modalOverlay, isTablet && { paddingBottom: 72, paddingRight: 24 }]}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.morePopupCard,
                  isTablet && { width: 260, borderRadius: 16 },
                  {
                    backgroundColor: themeColors.bgCard,
                    borderColor: themeColors.border,
                  },
                ]}
              >
                {menuItems.map((item, index) => {
                  return (
                    <TouchableOpacity
                      key={item.label}
                      style={[
                        styles.morePopupItem,
                        isTablet && { paddingVertical: 14, paddingHorizontal: 18 },
                        index !== menuItems.length - 1 && {
                          borderBottomWidth: 1,
                          borderBottomColor: themeColors.divider,
                        },
                      ]}
                      onPress={() => handleMoreItemPress(item)}
                      accessibilityRole="button"
                      accessibilityLabel={t(item.key)}
                    >
                      <Icon
                        name={item.iconName}
                        size={isTablet ? 22 : 18}
                        color={themeColors.iconSecondary}
                        strokeWidth={2}
                      />
                      <Text
                        style={[
                          styles.moreItemLabel,
                          isTablet && { fontSize: 16 },
                          { color: themeColors.textPrimary },
                        ]}
                      >
                        {t(item.key)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    position: 'relative',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FF4B33',
    marginTop: 2,
  },
  notifDot: {
    position: 'absolute',
    top: 4,
    right: -4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingBottom: 68,
    paddingRight: 12,
  },
  morePopupCard: {
    width: 195,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  morePopupItem: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 12,
  },
  morePopupItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  moreItemLabel: {
    color: '#1F2937',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default TabNavigator;
