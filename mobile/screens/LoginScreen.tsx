import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { authEvents } from '../events';

interface Props {
  navigation: any;
}

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [initialCheckComplete, setInitialCheckComplete] = useState(false);

  // Check if user is already logged in
  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        const savedEmail = await AsyncStorage.getItem('userEmail');
        
        if (token && savedEmail) {
          setEmail(savedEmail);
          setRememberMe(true);
          
          // Don't auto-navigate - App.js will handle this
        }
      } catch (error) {
        console.error('Error checking login status:', error);
      } finally {
        setInitialCheckComplete(true);
      }
    };
    
    checkLoginStatus();
  }, []);

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
  
    if (!trimmedEmail || !trimmedPassword) {
      Alert.alert('Validation Error', 'Email and password are required.');
      return;
    }
  
    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(trimmedEmail)) {
      Alert.alert('Validation Error', 'Please enter a valid email address.');
      return;
    }
  
    setLoading(true);
  
    try {
      // Login API call
      const response = await api.post('/auth/login', {
        email: trimmedEmail,
        password: trimmedPassword,
      });
  
      const { token, user } = response.data;
      
      // Save token to AsyncStorage
      await AsyncStorage.setItem('authToken', token);
      
      // Save user info
      await AsyncStorage.setItem('userId', user.id.toString());
      await AsyncStorage.setItem('userName', user.name || '');
      
      // If "Remember Me" is checked, save the email
      if (rememberMe) {
        await AsyncStorage.setItem('userEmail', trimmedEmail);
      } else {
        await AsyncStorage.removeItem('userEmail');
      }
      
      // Signal completion
      setLoading(false);
      
      // Update the app's auth state using the global login function
      if (typeof global !== 'undefined' && 'login' in global) {
        console.log("Login successful - triggering app state refresh");
        (global as any).login(token);
      } else {
        // Fallback - emit event through auth events system
        if (authEvents) {
          authEvents.emit('login', token);
          console.log("Login successful - emitted login event");
        }
      }
    } catch (error) {
      setLoading(false);
      Alert.alert(
        'Login Error', 
        'Invalid credentials or server error. Please try again.',
        [{ text: 'OK' }]
      );
      console.error('Login error:', error);
    }
  };

  const handleForgotPassword = () => {
    // For now, just show an alert
    Alert.alert(
      'Reset Password',
      'This feature will be implemented soon. Please contact support if you need immediate assistance.',
      [{ text: 'OK' }]
    );
  };

  if (!initialCheckComplete) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <View style={styles.container}>
        {/* Logo or App Name */}
        <View style={styles.logoContainer}>
          <Text style={styles.appName}>TONTINE</Text>
          <Text style={styles.tagline}>Community Savings Made Simple</Text>
        </View>
        
        {/* Form Container */}
        <View style={styles.formContainer}>
          <Text style={styles.header}>Welcome Back</Text>
          
          {/* Email Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Your email address"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>
          </View>
          
          {/* Password Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Your password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>
          </View>
          
          {/* Remember Me & Forgot Password */}
          <View style={styles.optionsContainer}>
            <TouchableOpacity 
              style={styles.rememberMeContainer} 
              onPress={() => setRememberMe(!rememberMe)}
            >
              {rememberMe ? 
                <Ionicons name="checkbox" size={20} color="#4CAF50" style={styles.checkboxIcon} /> : 
                <Ionicons name="square-outline" size={20} color="#666" style={styles.checkboxIcon} />
              }
              <Text style={styles.rememberMeText}>Remember Me</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={handleForgotPassword}>
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>
          
          {/* Login Button */}
          <TouchableOpacity 
            style={styles.loginButton} 
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.loginButtonText}>Login</Text>
            )}
          </TouchableOpacity>
          
          {/* Sign Up Link */}
          <View style={styles.signUpContainer}>
            <Text style={styles.signUpText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
              <Text style={styles.signUpLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4CAF50',
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 25,
    textAlign: 'center',
    color: '#333',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 6,
    color: '#333',
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: '#f9f9f9',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    color: '#333',
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxIcon: {
    marginRight: 5,
  },
  rememberMeText: {
    fontSize: 14,
    color: '#666',
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  signUpText: {
    color: '#666',
  },
  signUpLink: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
});