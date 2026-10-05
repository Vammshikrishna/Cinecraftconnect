/**
 * Navigation Utilities for CineCraft Connect Mobile
 * Provides robust back-navigation handling for deep links and push notifications.
 */

export const handleSmartBack = (
  navigation: any,
  fallbackTab: 'Feed' | 'Messages' | 'Projects' | 'Discussions' | 'Jobs' | 'Network' = 'Feed'
) => {
  if (!navigation) return;

  try {
    if (typeof navigation.canGoBack === 'function' && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    if (typeof navigation.reset === 'function') {
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'MainTabs',
            state: {
              routes: [{ name: fallbackTab }],
              index: 0,
            },
          },
        ],
      });
      return;
    }

    if (typeof navigation.navigate === 'function') {
      navigation.navigate('MainTabs', { screen: fallbackTab });
    }
  } catch (err) {
    console.warn('[NavigationUtils] handleSmartBack error:', err);
  }
};
