import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TabNavigator } from './TabNavigator';
import { ConversationScreen } from '../screens/messages/ConversationScreen';
import { MessagesListScreen } from '../screens/messages/MessagesListScreen';
import { CreatePostScreen } from '../screens/feed/CreatePostScreen';
import { ProjectSpaceScreen } from '../screens/projects/ProjectSpaceScreen';
import { DiscussionRoomDetailScreen } from '../screens/discussions/DiscussionRoomDetailScreen';
import { CallScreen } from '../screens/calling/CallScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { SettingsDetailScreen } from '../screens/settings/SettingsDetailScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';

// Auth & Landing Screens
import { LandingScreen } from '../screens/landing/LandingScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { CompleteProfileScreen } from '../screens/auth/CompleteProfileScreen';
import { SuspendedScreen } from '../screens/auth/SuspendedScreen';

// Inside Detail Pages
import { PitchDetailScreen } from '../screens/pitch/PitchDetailScreen';
import { SubmitPitchScreen } from '../screens/pitch/SubmitPitchScreen';
import { PitchReviewDetailScreen } from '../screens/pitch/PitchReviewDetailScreen';
import { JobDetailScreen } from '../screens/jobs/JobDetailScreen';
import { MarketplaceDetailScreen } from '../screens/marketplace/MarketplaceDetailScreen';
import { VendorDetailScreen } from '../screens/vendors/VendorDetailScreen';
import { VendorServiceDetailScreen } from '../screens/vendors/VendorServiceDetailScreen';
import { CompanyPageDetailScreen } from '../screens/pages/CompanyPageDetailScreen';
import { ContentDetailScreen } from '../screens/ratings/ContentDetailScreen';
import { CategoryScreen } from '../screens/ratings/CategoryScreen';
import { MyRatingsScreen } from '../screens/ratings/MyRatingsScreen';
import { FilmListScreen } from '../screens/ratings/FilmListScreen';
import { ShortlistsScreen } from '../screens/network/ShortlistsScreen';
import { PostDetailScreen } from '../screens/feed/PostDetailScreen';
import { ProjectDetailScreen } from '../screens/projects/ProjectDetailScreen';
import { PublicProfileScreen } from '../screens/profile/PublicProfileScreen';

// Additional Web Parity Screens
import { SearchScreen } from '../screens/search/SearchScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { CreateProjectScreen } from '../screens/projects/CreateProjectScreen';
import { MyApplicationsScreen } from '../screens/jobs/MyApplicationsScreen';
import { ManagePostingsScreen } from '../screens/jobs/ManagePostingsScreen';
import { MyBookingsScreen } from '../screens/marketplace/MyBookingsScreen';
import { MyQuotesScreen } from '../screens/marketplace/MyQuotesScreen';
import { SellerHubScreen } from '../screens/marketplace/SellerHubScreen';
import { WishlistScreen } from '../screens/marketplace/WishlistScreen';
import { SupportScreen } from '../screens/support/SupportScreen';
import { AvailabilityCalendarScreen } from '../screens/profile/AvailabilityCalendarScreen';
import { PitchScreen } from '../screens/pitch/PitchScreen';
import { RatingsScreen } from '../screens/ratings/RatingsScreen';
import { AnnouncementsScreen } from '../screens/announcements/AnnouncementsScreen';
import { MarketplaceScreen } from '../screens/marketplace/MarketplaceScreen';
import { VendorsScreen } from '../screens/vendors/VendorsScreen';
import { CompanyPagesScreen } from '../screens/pages/CompanyPagesScreen';
import { DiscussionRoomsScreen } from '../screens/discussions/DiscussionRoomsScreen';
import { ProjectsScreen } from '../screens/projects/ProjectsScreen';
import { JobsScreen } from '../screens/jobs/JobsScreen';
import { NetworkScreen } from '../screens/network/NetworkScreen';

const Stack = createNativeStackNavigator();

export const AppNavigator = ({ initialRoute = 'Landing' }: { initialRoute?: string }) => {
  const NavigatorCast = Stack.Navigator as any;
  return (
    <NavigatorCast initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
      {/* Landing & Authentication */}
      <Stack.Screen name="Landing" component={LandingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="CompleteProfile" component={CompleteProfileScreen} />
      <Stack.Screen name="Suspended" component={SuspendedScreen} />

      {/* Main Tabs */}
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Messages" component={MessagesListScreen} />
      <Stack.Screen name="Conversation" component={ConversationScreen} />
      <Stack.Screen name="CreatePost" component={CreatePostScreen} />
      <Stack.Screen name="CreateProject" component={CreateProjectScreen} />
      <Stack.Screen name="ProjectSpace" component={ProjectSpaceScreen} />
      <Stack.Screen name="DiscussionRoomDetail" component={DiscussionRoomDetailScreen} />
      <Stack.Screen
        name="Call"
        component={CallScreen}
        options={{
          presentation: 'transparentModal',
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="AvailabilityCalendar" component={AvailabilityCalendarScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="SettingsDetail" component={SettingsDetailScreen} />
      <Stack.Screen name="Support" component={SupportScreen} />

      {/* Hub & Parity Screens */}
      <Stack.Screen name="Projects" component={ProjectsScreen} />
      <Stack.Screen name="Discussions" component={DiscussionRoomsScreen} />
      <Stack.Screen name="Jobs" component={JobsScreen} />
      <Stack.Screen name="Network" component={NetworkScreen} />

      {/* Inside Detail Pages */}
      <Stack.Screen name="PitchDetail" component={PitchDetailScreen} />
      <Stack.Screen name="SubmitPitch" component={SubmitPitchScreen} />
      <Stack.Screen name="PitchReviewDetail" component={PitchReviewDetailScreen} />
      <Stack.Screen name="JobDetail" component={JobDetailScreen} />
      <Stack.Screen name="MyApplications" component={MyApplicationsScreen} />
      <Stack.Screen name="ManagePostings" component={ManagePostingsScreen} />
      <Stack.Screen name="MarketplaceDetail" component={MarketplaceDetailScreen} />
      <Stack.Screen name="MyBookings" component={MyBookingsScreen} />
      <Stack.Screen name="MyQuotes" component={MyQuotesScreen} />
      <Stack.Screen name="SellerHub" component={SellerHubScreen} />
      <Stack.Screen name="Wishlist" component={WishlistScreen} />
      <Stack.Screen name="VendorDetail" component={VendorDetailScreen} />
      <Stack.Screen name="VendorServiceDetail" component={VendorServiceDetailScreen} />
      <Stack.Screen name="CompanyPageDetail" component={CompanyPageDetailScreen} />
      <Stack.Screen name="ContentDetail" component={ContentDetailScreen} />
      <Stack.Screen name="MyRatings" component={MyRatingsScreen} />
      <Stack.Screen name="FilmList" component={FilmListScreen} />
      <Stack.Screen name="Shortlists" component={ShortlistsScreen} />
      <Stack.Screen name="CategoryPage" component={CategoryScreen} />
      <Stack.Screen name="CategoryScreen" component={CategoryScreen} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} />
      <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} />
      <Stack.Screen name="PublicProfile" component={PublicProfileScreen} />
    </NavigatorCast>
  );
};

export default AppNavigator;
