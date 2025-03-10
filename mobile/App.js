let globalLogout = null;
let globalLogin = null;
import React, { useState, useEffect } from 'react';
import { Platform, Alert, StatusBar, View, ActivityIndicator, Text, Button } from 'react-native';
import * as Notifications from 'expo-notifications';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import { authEvents } from './events';

// Import screens
import LoginScreen from './screens/LoginScreen';
import SignUpScreen from './screens/SignUpScreen';
import GroupsScreen from './screens/GroupsScreen';
import CreateGroupScreen from './screens/CreateGroupScreen';
import GroupDetailScreen from './screens/GroupDetailScreen';
import EditGroupScreen from './screens/EditGroupScreen';
import CreateCycleScreen from './screens/CreateCycleScreen';
import CycleDetailScreen from './screens/CycleDetailScreen';
import ProfileScreen from './screens/ProfileScreen';

// Initialize API service
import api from './services/api';

// Configure Sentry
Sentry.init({
  dsn: '', // Replace with your Sentry DSN in production
  enableInExpoDevelopment: true,
  debug: false, // Set to false in production
});

// Configure notification handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerForPushNotificationsAsync() {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;
    console.log('Expo push token:', token);

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    return token;
  } catch (error) {
    console.error('Error getting push token:', error);
    return null;
  }
}

const Stack = createStackNavigator();

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState(null);

  // Store function reference globally
  globalLogout = () => {
    console.log("GLOBAL LOGOUT CALLED");
    setUserToken(null);
  };

  // Add global login function
  globalLogin = (token) => {
    console.log("GLOBAL LOGIN CALLED");
    setUserToken(token);
  };

  // Auth token reset function
  const resetAuthToken = async () => {
    try {
      await AsyncStorage.removeItem('authToken');
      Alert.alert(
        'Success', 
        'Authentication token cleared. You will be redirected to login.',
        [{ text: 'OK' }]
      );
      console.log('Auth token cleared successfully');
      setUserToken(null);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to clear token:', error);
      Alert.alert('Error', 'Failed to clear authentication token');
      setIsLoading(false);
    }
  };

  // Check if user is already logged in
  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        console.log('Token found:', token ? 'Yes' : 'No');
        
        if (token) {
          // Verify token is valid with a lightweight API call
          try {
            const response = await api.get('/api/health');
            console.log('Token validation successful:', response.data);
            setUserToken(token);
          } catch (error) {
            console.log('Token validation failed:', error.message);
            // Token is invalid or expired, clear it
            await AsyncStorage.removeItem('authToken');
            setUserToken(null);
          }
        } else {
          // No token found
          console.log('No auth token found');
          setUserToken(null);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        setUserToken(null);
      } finally {
        // Always set loading to false when done
        setIsLoading(false);
      }
    };
    
    checkLoginStatus();
  }, []);

  // Register for push notifications when logged in
  useEffect(() => {
    if (userToken) {
      (async () => {
        try {
          const pushToken = await registerForPushNotificationsAsync();
          if (pushToken) {
            try {
              await api.put('/users/push-token', { pushToken });
              console.log('Push token saved to backend:', pushToken);
            } catch (error) {
              console.warn('Failed to update push token:', error);
            }
          }
        } catch (error) {
          console.error('Push notification registration error:', error);
        }
      })();
    }
  }, [userToken]);

  // Listen for incoming notifications
  useEffect(() => {
    let subscription;
    let responseSubscription;
    
    try {
      subscription = Notifications.addNotificationReceivedListener(notification => {
        console.log('Notification received:', notification);
        // Handle notification when app is in foreground
      });

      responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('Notification interaction:', response);
        // Handle user interaction with notification
      });
    } catch (error) {
      console.error('Error setting up notification listeners:', error);
    }

    return () => {
      if (subscription) subscription.remove();
      if (responseSubscription) responseSubscription.remove();
    };
  }, []);

  // Listen for logout events
  useEffect(() => {
    const handleLogout = () => {
      setUserToken(null);
      console.log('Auth state updated due to logout event');
    };
    
    authEvents.on('logout', handleLogout);
    
    return () => {
      authEvents.off('logout', handleLogout);
    };
  }, []);

  // Listen for login events
  useEffect(() => {
    const handleLogin = (token) => {
      setUserToken(token);
      console.log('Auth state updated due to login event');
    };
    
    authEvents.on('login', handleLogin);
    
    return () => {
      authEvents.off('login', handleLogin);
    };
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' }}>
        <StatusBar backgroundColor="#4CAF50" barStyle="light-content" />
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={{ marginTop: 10, marginBottom: 20, color: '#666' }}>Loading Tontine...</Text>
        
        {/* Keep the reset button for future troubleshooting */}
        <Button 
          title="Reset Authentication" 
          onPress={resetAuthToken} 
          color="#FF5722"  
        />
        <Text style={{ marginTop: 8, fontSize: 12, color: '#999', textAlign: 'center', paddingHorizontal: 30 }}>
          If you're stuck at loading, tap this button
        </Text>
      </View>
    );
  }

  // Log navigation state for debugging
  console.log('App navigation state:', userToken ? 'Authenticated' : 'Unauthenticated');

  return (
    <NavigationContainer>
      <StatusBar backgroundColor="#4CAF50" barStyle="light-content" />
      <Stack.Navigator
        initialRouteName={userToken ? 'Groups' : 'Login'}
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: '#f8f9fa' },
        }}
      >
        {userToken === null ? (
          // Auth Screens - only accessible when not logged in
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
          </>
        ) : (
          // Main App Screens - only accessible when logged in
          <>
            <Stack.Screen name="Groups" component={GroupsScreen} />
            <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
            <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
            <Stack.Screen name="EditGroup" component={EditGroupScreen} />
            <Stack.Screen name="CreateCycle" component={CreateCycleScreen} />
            <Stack.Screen name="CycleDetail" component={CycleDetailScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

global.logout = () => {
  console.log("GLOBAL OBJECT LOGOUT CALLED");
  if (globalLogout) globalLogout();
};

global.login = (token) => {
  console.log("GLOBAL OBJECT LOGIN CALLED");
  if (globalLogin) globalLogin(token);
};