import { Linking } from 'react-native';
import * as Notifications from 'expo-notifications';

type DeepLinkHandler = (url: string) => void;

export const DeepLinkService = {
  /**
   * Initialize deep link handling
   */
  init: (navigation: any): void => {
    // Handle incoming links when the app is already open
    Linking.addEventListener('url', ({ url }) => {
      DeepLinkService.handleDeepLink(url, navigation);
    });
    
    // Handle links that opened the app
    Linking.getInitialURL().then(url => {
      if (url) {
        DeepLinkService.handleDeepLink(url, navigation);
      }
    });
    
    // Handle notification open actions
    const lastNotificationResponse = Notifications.getLastNotificationResponseAsync();
    lastNotificationResponse.then(response => {
      if (response?.notification.request.content.data?.deepLink) {
        const deepLink = response.notification.request.content.data.deepLink as string;
        DeepLinkService.handleDeepLink(deepLink, navigation);
      }
    });
  },
  
  /**
   * Handle deep links
   */
  handleDeepLink: (url: string, navigation: any): void => {
    if (!url) return;
    
    console.log('Handling deep link:', url);
    
    try {
      // Parse the URL to get path and parameters
      const parsedUrl = new URL(url);
      
      // Check if it's a group invitation
      if (parsedUrl.pathname.includes('/invite')) {
        const params = new URLSearchParams(parsedUrl.search);
        const groupId = params.get('group');
        
        if (groupId) {
          // If the user is not logged in, we need to first navigate to Login
          // and pass the deep link data to handle after login
          const handleAfterAuth = async () => {
            try {
              // Get group details
              const response = await fetch(`https://my-tontine-backend-1-9f427c4ed62c.herokuapp.com/groups/${groupId}`);
              if (response.ok) {
                const groupData = await response.json();
                navigation.navigate('GroupDetail', { 
                  groupId: parseInt(groupId, 10), 
                  groupName: groupData.name 
                });
              } else {
                console.error('Failed to get group details');
              }
            } catch (error) {
              console.error('Error handling invite deep link:', error);
            }
          };

          // Store the handler for after login if needed
          if ((global as any).isAuthenticated) {
            handleAfterAuth();
          } else {
            // Store the pending action for after login
            (global as any).pendingDeepLink = {
              type: 'GROUP_INVITE',
              groupId: parseInt(groupId, 10),
              handler: handleAfterAuth
            };
            
            // Navigate to login
            navigation.navigate('Login');
          }
        }
      }
    } catch (error) {
      console.error('Error parsing deep link:', error);
    }
  }
};