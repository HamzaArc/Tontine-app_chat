import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Switch,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import api from '../services/api';
import { authEvents } from '../events';

interface ProfileScreenProps {
  navigation: any;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const [user, setUser] = useState<{
    id: string;
    name: string;
    email: string;
    phone: string;
    avatar: string | null;
  }>({
    id: '',
    name: '',
    email: '',
    phone: '',
    avatar: null,
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedUser, setEditedUser] = useState({
    name: '',
    phone: '',
  });
  
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Fetch user data
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        
        // Get user ID from AsyncStorage
        const userId = await AsyncStorage.getItem('userId');
        if (!userId) {
          // Not logged in, redirect to login
          navigation.navigate('Login');
          return;
        }
        
        // Fetch user details
        const response = await api.get(`/users/${userId}`);
        const userData = response.data;
        
        setUser({
          id: userData.id.toString(),
          name: userData.name || '',
          email: userData.email || '',
          phone: userData.phone || '',
          avatar: userData.avatar || null,
        });
        
        // Initialize edited user data
        setEditedUser({
          name: userData.name || '',
          phone: userData.phone || '',
        });
        
        // Get notification settings from AsyncStorage
        const notificationSetting = await AsyncStorage.getItem('notificationsEnabled');
        if (notificationSetting !== null) {
          setNotificationsEnabled(notificationSetting === 'true');
        }
        
        // Get biometric settings from AsyncStorage
        const biometricSetting = await AsyncStorage.getItem('biometricEnabled');
        if (biometricSetting !== null) {
          setBiometricEnabled(biometricSetting === 'true');
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching user data:', error);
        setLoading(false);
        Alert.alert('Error', 'Failed to load user profile');
      }
    };
    
    fetchUserData();
  }, [navigation]);
  
  const handleLogout = async () => {
    Alert.alert(
      'Confirm Logout',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          onPress: async () => {
            try {
              // Clear authentication token and user data
              await AsyncStorage.removeItem('authToken');
              await AsyncStorage.removeItem('userId');
              await AsyncStorage.removeItem('userName');
              
              // Add this line to emit the logout event
              authEvents.emit('logout');
              console.log('Logout event emitted');

              // Navigate to login screen
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            } catch (error) {
              console.error('Error during logout:', error);
              Alert.alert('Error', 'Failed to log out');
            }
          },
        },
      ]
    );
  };
  
  const handleUpdateProfile = async () => {
    if (!editedUser.name.trim()) {
      Alert.alert('Error', 'Name field cannot be empty');
      return;
    }
    
    try {
      setSaving(true);
      
      // Update user profile
      await api.put(`/users/${user.id}`, {
        name: editedUser.name,
        phone: editedUser.phone,
      });
      
      // Update local user state
      setUser(prevUser => ({
        ...prevUser,
        name: editedUser.name,
        phone: editedUser.phone,
      }));
      
      // Update AsyncStorage
      await AsyncStorage.setItem('userName', editedUser.name);
      
      setSaving(false);
      setEditMode(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      setSaving(false);
      Alert.alert('Error', 'Failed to update profile');
    }
  };
  
  const toggleNotifications = async (value: boolean) => {
    setNotificationsEnabled(value);
    await AsyncStorage.setItem('notificationsEnabled', value.toString());
    
    // In a real app, this would also update the server
    try {
      await api.put(`/users/${user.id}/settings`, {
        notifications_enabled: value,
      });
    } catch (error) {
      console.error('Error updating notification settings:', error);
    }
  };
  
  const toggleBiometric = async (value: boolean) => {
    setBiometricEnabled(value);
    await AsyncStorage.setItem('biometricEnabled', value.toString());
    
    // This would normally involve additional setup for biometric authentication
    if (value) {
      Alert.alert(
        'Biometric Authentication',
        'In a complete implementation, this would set up biometric authentication for secure login.'
      );
    }
  };
  
  const handlePickImage = async () => {
    // Request permission to access the image library
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Please allow access to your photo library to change your profile picture.');
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    
    if (!result.canceled) {
      // In a real app, this would upload the image to a server
      // For now, we'll just update the local state
      Alert.alert('Profile Picture', 'In a complete implementation, this would upload your new profile picture to the server.');
      
      setUser(prevUser => ({
        ...prevUser,
        avatar: result.assets[0].uri,
      }));
    }
  };
  
  const handleChangePassword = async () => {
    // Basic validation
    if (!currentPassword) {
      Alert.alert('Error', 'Please enter your current password');
      return;
    }
    
    if (!newPassword) {
      Alert.alert('Error', 'Please enter a new password');
      return;
    }
    
    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
    
    try {
      // In a real app, this would send the password update to the server
      await api.put(`/users/${user.id}/password`, {
        current_password: currentPassword,
        new_password: newPassword,
      });
      
      setPasswordModalVisible(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      Alert.alert('Success', 'Password updated successfully');
    } catch (error) {
      console.error('Error changing password:', error);
      Alert.alert('Error', 'Failed to update password. Please check your current password.');
    }
  };
  
  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirm Deletion',
              'Please type "DELETE" to confirm account deletion:',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Confirm',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      // In a real app, this would delete the user's account
                      await api.delete(`/users/${user.id}`);
                      
                      // Clear all local storage
                      await AsyncStorage.clear();
                      
                      // Navigate to login screen
                      navigation.reset({
                        index: 0,
                        routes: [{ name: 'Login' }],
                      });
                    } catch (error) {
                      console.error('Error deleting account:', error);
                      Alert.alert('Error', 'Failed to delete account');
                    }
                  },
                },
              ],
              { cancelable: false }
            );
          },
        },
      ],
      { cancelable: true }
    );
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <TouchableOpacity 
          style={styles.editButton}
          onPress={() => setEditMode(!editMode)}
        >
          <Text style={styles.editButtonText}>{editMode ? 'Cancel' : 'Edit'}</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.content}>
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <TouchableOpacity 
            style={styles.avatarContainer}
            onPress={handlePickImage}
          >
            {user.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {user.name ? user.name.charAt(0).toUpperCase() : '?'}
                </Text>
              </View>
            )}
            <View style={styles.cameraIconContainer}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
          
          {editMode ? (
            <View style={styles.editForm}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Name</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={editedUser.name}
                    onChangeText={(text) => setEditedUser({ ...editedUser, name: text })}
                    placeholder="Your full name"
                  />
                </View>
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <View style={[styles.inputContainer, styles.disabledInput]}>
                  <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={user.email}
                    editable={false}
                    placeholder="Your email address"
                  />
                </View>
                <Text style={styles.helperText}>Email cannot be changed</Text>
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Phone (Optional)</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="call-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={editedUser.phone}
                    onChangeText={(text) => setEditedUser({ ...editedUser, phone: text })}
                    placeholder="Your phone number"
                    keyboardType="phone-pad"
                  />
                </View>
              </View>
              
              <TouchableOpacity 
                style={styles.saveButton}
                onPress={handleUpdateProfile}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.profileInfo}>
              <Text style={styles.userName}>{user.name}</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
              {user.phone && <Text style={styles.userPhone}>{user.phone}</Text>}
            </View>
          )}
        </View>
        
        {!editMode && (
          <>
            {/* Settings Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Settings</Text>
              
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Ionicons name="notifications-outline" size={22} color="#333" style={styles.settingIcon} />
                  <Text style={styles.settingLabel}>Push Notifications</Text>
                </View>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={toggleNotifications}
                  trackColor={{ false: '#e0e0e0', true: '#AED581' }}
                  thumbColor={notificationsEnabled ? '#4CAF50' : '#f4f3f4'}
                />
              </View>
              
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Ionicons name="finger-print" size={22} color="#333" style={styles.settingIcon} />
                  <Text style={styles.settingLabel}>Biometric Authentication</Text>
                </View>
                <Switch
                  value={biometricEnabled}
                  onValueChange={toggleBiometric}
                  trackColor={{ false: '#e0e0e0', true: '#AED581' }}
                  thumbColor={biometricEnabled ? '#4CAF50' : '#f4f3f4'}
                />
              </View>
              
              <TouchableOpacity 
                style={styles.settingItem}
                onPress={() => setPasswordModalVisible(true)}
              >
                <View style={styles.settingInfo}>
                  <Ionicons name="lock-closed-outline" size={22} color="#333" style={styles.settingIcon} />
                  <Text style={styles.settingLabel}>Change Password</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#ccc" />
              </TouchableOpacity>
            </View>
            
            {/* Support Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Support</Text>
              
              <TouchableOpacity style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Ionicons name="help-circle-outline" size={22} color="#333" style={styles.settingIcon} />
                  <Text style={styles.settingLabel}>Help & FAQ</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#ccc" />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Ionicons name="mail-outline" size={22} color="#333" style={styles.settingIcon} />
                  <Text style={styles.settingLabel}>Contact Support</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#ccc" />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Ionicons name="document-text-outline" size={22} color="#333" style={styles.settingIcon} />
                  <Text style={styles.settingLabel}>Privacy Policy</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#ccc" />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Ionicons name="information-circle-outline" size={22} color="#333" style={styles.settingIcon} />
                  <Text style={styles.settingLabel}>Terms of Service</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#ccc" />
              </TouchableOpacity>
            </View>
            
            {/* Account Actions */}
            <View style={styles.section}>
              <TouchableOpacity 
                style={styles.logoutButton}
                onPress={handleLogout}
              >
                <Ionicons name="log-out-outline" size={20} color="#FF5252" />
                <Text style={styles.logoutText}>Log Out</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.deleteAccountButton}
                onPress={handleDeleteAccount}
              >
                <Text style={styles.deleteAccountText}>Delete Account</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.versionInfo}>
              <Text style={styles.versionText}>Tontine App v1.0.0</Text>
            </View>
          </>
        )}
      </ScrollView>
      
      {/* Change Password Modal */}
      <Modal
        visible={passwordModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setPasswordModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Current Password</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter current password"
                    secureTextEntry
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                  />
                </View>
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>New Password</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter new password"
                    secureTextEntry
                    value={newPassword}
                    onChangeText={setNewPassword}
                  />
                </View>
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm New Password</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm new password"
                    secureTextEntry
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                </View>
              </View>
              
              <TouchableOpacity 
                style={styles.changePasswordButton}
                onPress={handleChangePassword}
              >
                <Text style={styles.changePasswordButtonText}>Update Password</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  editButton: {
    padding: 5,
  },
  editButtonText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  profileSection: {
    backgroundColor: '#fff',
    paddingTop: 20,
    paddingBottom: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatarContainer: {
    marginBottom: 16,
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#4CAF50',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  profileInfo: {
    alignItems: 'center',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#666',
    marginBottom: 2,
  },
  userPhone: {
    fontSize: 14,
    color: '#666',
  },
  editForm: {
    width: '100%',
    paddingHorizontal: 16,
    marginTop: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
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
  disabledInput: {
    backgroundColor: '#f0f0f0',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    marginLeft: 4,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    margin: 16,
    marginBottom: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  logoutText: {
    fontSize: 16,
    color: '#FF5252',
    fontWeight: '500',
    marginLeft: 8,
  },
  deleteAccountButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  deleteAccountText: {
    fontSize: 14,
    color: '#999',
  },
  versionInfo: {
    alignItems: 'center',
    padding: 20,
  },
  versionText: {
    fontSize: 14,
    color: '#999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalContent: {
    padding: 16,
  },
  changePasswordButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  changePasswordButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ProfileScreen;