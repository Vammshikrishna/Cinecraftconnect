import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TabNavigator } from './TabNavigator';
import { ConversationScreen } from '../screens/messages/ConversationScreen';
import { MessagesSplitScreen } from '../screens/messages/MessagesSplitScreen';
import { CreatePostScreen } from '../screens/feed/CreatePostScreen';
import { ProjectSpaceScreen } from '../screens/projects/ProjectSpaceScreen';
import { JoinProjectInviteScreen } from '../screens/projects/JoinProjectInviteScreen';
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
import { withTabletColumn } from '../components/common/TabletContainer';
import { withStaffBlock } from '../components/governance/StaffBlock';
import { PlansScreen } from '../screens/billing/PlansScreen';
import { MarketplaceDisputesScreen } from '../screens/marketplace/MarketplaceDisputesScreen';
import { GiftsScreen } from '../screens/billing/GiftsScreen';
import { MyPaymentsScreen } from '../screens/billing/MyPaymentsScreen';


// On a tablet these screens sit in a centred column (see TabletContainer); on a phone they are unchanged.
// Create post is full width on a tablet (its own screen lays out the editor); a narrow wrapper made the header a small box
const CreatePostScreenTablet = CreatePostScreen;
const SuspendedScreenTablet = withTabletColumn(SuspendedScreen, 560);
const NotificationsScreenTablet = withTabletColumn(NotificationsScreen, 'content');
const SettingsScreenTablet = withTabletColumn(SettingsScreen, 'content');
const SettingsDetailScreenTablet = withTabletColumn(SettingsDetailScreen, 'content');
// these screens centre their own content column and draw a full-width header, so no outer column
const PublicProfileScreenTablet = PublicProfileScreen;
const AvailabilityCalendarScreenTablet = AvailabilityCalendarScreen;
const ProjectDetailScreenTablet = withTabletColumn(ProjectDetailScreen, 'content');
const LandingScreenTablet = withTabletColumn(LandingScreen, 'content');
const SearchScreenTablet = withTabletColumn(SearchScreen, 'content');

// Screens for the social side of the app are not available to staff accounts (see docs/STAFF_ACCOUNT_RULES.md)
const MessagesSplitScreenStaff = withStaffBlock(MessagesSplitScreen as any);
const ConversationScreenStaff = withStaffBlock(ConversationScreen as any);
const CreatePostScreenTabletStaff = withStaffBlock(CreatePostScreenTablet as any);
const CreateProjectScreenStaff = withStaffBlock(CreateProjectScreen as any);
const JoinProjectInviteScreenStaff = withStaffBlock(JoinProjectInviteScreen as any);
const SubmitPitchScreenStaff = withStaffBlock(SubmitPitchScreen as any);
const PitchReviewDetailScreenStaff = withStaffBlock(PitchReviewDetailScreen as any);
const MyApplicationsScreenStaff = withStaffBlock(MyApplicationsScreen as any);
const ManagePostingsScreenStaff = withStaffBlock(ManagePostingsScreen as any);
const MyBookingsScreenStaff = withStaffBlock(MyBookingsScreen as any);
const MyQuotesScreenStaff = withStaffBlock(MyQuotesScreen as any);
const SellerHubScreenStaff = withStaffBlock(SellerHubScreen as any);
const PlansScreenStaff = withStaffBlock(PlansScreen as any);
const MarketplaceDisputesScreenStaff = withStaffBlock(MarketplaceDisputesScreen as any);
const GiftsScreenStaff = withStaffBlock(GiftsScreen as any);
const MyPaymentsScreenStaff = withStaffBlock(MyPaymentsScreen as any);
const WishlistScreenStaff = withStaffBlock(WishlistScreen as any);
const MyRatingsScreenStaff = withStaffBlock(MyRatingsScreen as any);
const ShortlistsScreenStaff = withStaffBlock(ShortlistsScreen as any);

import InfoPagesScreen from '../screens/landing/InfoPagesScreen';
const Stack = createNativeStackNavigator();

export const AppNavigator = ({ initialRoute = 'Landing' }: { initialRoute?: string }) => {
  const NavigatorCast = Stack.Navigator as any;
  return (
    <NavigatorCast initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
      {/* Landing & Authentication */}
      <Stack.Screen name="Landing" component={LandingScreenTablet} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="InfoPage" component={InfoPagesScreen} />
      <Stack.Screen name="CompleteProfile" component={CompleteProfileScreen} />
      <Stack.Screen name="Suspended" component={SuspendedScreenTablet} />

      {/* Main Tabs */}
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen name="Search" component={SearchScreenTablet} />
      <Stack.Screen name="Notifications" component={NotificationsScreenTablet} />
      <Stack.Screen name="Messages" component={MessagesSplitScreenStaff} />
      <Stack.Screen name="Conversation" component={ConversationScreenStaff} />
      <Stack.Screen name="CreatePost" component={CreatePostScreenTabletStaff} />
      <Stack.Screen name="CreateProject" component={CreateProjectScreenStaff} />
      <Stack.Screen name="ProjectSpace" component={ProjectSpaceScreen} />
      <Stack.Screen name="JoinProjectInvite" component={JoinProjectInviteScreenStaff} />
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
      <Stack.Screen name="AvailabilityCalendar" component={AvailabilityCalendarScreenTablet} />
      <Stack.Screen name="Settings" component={SettingsScreenTablet} />
      <Stack.Screen name="SettingsDetail" component={SettingsDetailScreenTablet} />
      <Stack.Screen name="Support" component={SupportScreen} />

      {/* Hub & Parity Screens */}
      <Stack.Screen name="Projects" component={ProjectsScreen} />
      <Stack.Screen name="Discussions" component={DiscussionRoomsScreen} />
      <Stack.Screen name="Jobs" component={JobsScreen} />
      <Stack.Screen name="Network" component={NetworkScreen} />

      {/* Inside Detail Pages */}
      <Stack.Screen name="PitchDetail" component={PitchDetailScreen} />
      <Stack.Screen name="SubmitPitch" component={SubmitPitchScreenStaff} />
      <Stack.Screen name="PitchReviewDetail" component={PitchReviewDetailScreenStaff} />
      <Stack.Screen name="JobDetail" component={JobDetailScreen} />
      <Stack.Screen name="MyApplications" component={MyApplicationsScreenStaff} />
      <Stack.Screen name="ManagePostings" component={ManagePostingsScreenStaff} />
      <Stack.Screen name="MarketplaceDetail" component={MarketplaceDetailScreen} />
      <Stack.Screen name="MyBookings" component={MyBookingsScreenStaff} />
      <Stack.Screen name="MyQuotes" component={MyQuotesScreenStaff} />
      <Stack.Screen name="SellerHub" component={SellerHubScreenStaff} />
      <Stack.Screen name="Plans" component={PlansScreenStaff} />
      <Stack.Screen name="MarketplaceDisputes" component={MarketplaceDisputesScreenStaff} />
      <Stack.Screen name="Gifts" component={GiftsScreenStaff} />
      <Stack.Screen name="MyPayments" component={MyPaymentsScreenStaff} />
      <Stack.Screen name="Wishlist" component={WishlistScreenStaff} />
      <Stack.Screen name="VendorDetail" component={VendorDetailScreen} />
      <Stack.Screen name="VendorServiceDetail" component={VendorServiceDetailScreen} />
      <Stack.Screen name="CompanyPageDetail" component={CompanyPageDetailScreen} />
      <Stack.Screen name="ContentDetail" component={ContentDetailScreen} />
      <Stack.Screen name="MyRatings" component={MyRatingsScreenStaff} />
      <Stack.Screen name="FilmList" component={FilmListScreen} />
      <Stack.Screen name="Shortlists" component={ShortlistsScreenStaff} />
      <Stack.Screen name="CategoryPage" component={CategoryScreen} />
      <Stack.Screen name="CategoryScreen" component={CategoryScreen} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} />
      <Stack.Screen name="ProjectDetail" component={ProjectDetailScreenTablet} />
      <Stack.Screen name="PublicProfile" component={PublicProfileScreenTablet} />
    </NavigatorCast>
  );
};

export default AppNavigator;
