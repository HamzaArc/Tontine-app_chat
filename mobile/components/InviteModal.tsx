import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SharingService } from '../services/sharingService';

interface InviteModalProps {
  visible: boolean;
  onClose: () => void;
  groupId: number;
  groupName: string;
}

const InviteModal: React.FC<InviteModalProps> = ({ visible, onClose, groupId, groupName }) => {
  const [contactInfo, setContactInfo] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'phone' | 'email' | 'link'>('phone');
  
  const handleShare = async () => {
    setIsProcessing(true);
    
    try {
      let success = false;
      
      if (activeTab === 'phone' && contactInfo) {
        // Attempt to share via WhatsApp first
        success = await SharingService.inviteViaWhatsApp({
          groupId,
          groupName,
          recipientPhone: contactInfo
        });
        
        // If WhatsApp fails or isn't available, fallback to SMS
        if (!success) {
          success = await SharingService.inviteViaSMS({
            groupId,
            groupName,
            recipientPhone: contactInfo
          });
        }
        
        if (!success) {
          Alert.alert(
            'Sharing Failed',
            'Unable to share via messaging apps. Would you like to use the general share dialog instead?',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Share', 
                onPress: () => SharingService.shareGroupInvite({ groupId, groupName })
              }
            ]
          );
        }
      } else if (activeTab === 'email' && contactInfo) {
        success = await SharingService.inviteViaEmail({
          groupId,
          groupName
        }, contactInfo);
        
        if (!success) {
          Alert.alert('Error', 'Unable to open email client');
        }
      } else if (activeTab === 'link') {
        success = await SharingService.shareGroupInvite({
          groupId,
          groupName
        });
      }
      
      if (success) {
        // Reset form and close modal on success
        setContactInfo('');
        onClose();
      }
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Invite to Group</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.tabs}>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'phone' && styles.activeTab]}
              onPress={() => setActiveTab('phone')}
            >
              <Ionicons 
                name="call-outline" 
                size={20} 
                color={activeTab === 'phone' ? '#4CAF50' : '#666'} 
              />
              <Text style={[styles.tabText, activeTab === 'phone' && styles.activeTabText]}>
                Phone
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'email' && styles.activeTab]}
              onPress={() => setActiveTab('email')}
            >
              <Ionicons 
                name="mail-outline" 
                size={20} 
                color={activeTab === 'email' ? '#4CAF50' : '#666'} 
              />
              <Text style={[styles.tabText, activeTab === 'email' && styles.activeTabText]}>
                Email
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'link' && styles.activeTab]}
              onPress={() => setActiveTab('link')}
            >
              <Ionicons 
                name="share-social-outline" 
                size={20} 
                color={activeTab === 'link' ? '#4CAF50' : '#666'} 
              />
              <Text style={[styles.tabText, activeTab === 'link' && styles.activeTabText]}>
                Share Link
              </Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalContent}>
            {activeTab !== 'link' && (
              <>
                <Text style={styles.inputLabel}>
                  {activeTab === 'phone' ? 'Phone Number' : 'Email Address'}
                </Text>
                <View style={styles.inputContainer}>
                  <Ionicons 
                    name={activeTab === 'phone' ? 'call-outline' : 'mail-outline'} 
                    size={20} 
                    color="#666" 
                    style={styles.inputIcon} 
                  />
                  <TextInput
                    style={styles.input}
                    placeholder={activeTab === 'phone' 
                      ? 'Enter phone number with country code' 
                      : 'Enter email address'
                    }
                    value={contactInfo}
                    onChangeText={setContactInfo}
                    keyboardType={activeTab === 'phone' ? 'phone-pad' : 'email-address'}
                    autoCapitalize="none"
                  />
                </View>
              </>
            )}
            
            {activeTab === 'link' && (
              <View style={styles.shareInfoContainer}>
                <Ionicons name="information-circle-outline" size={24} color="#2196F3" />
                <Text style={styles.shareInfoText}>
                  This will open your device's share menu to invite friends via any app.
                </Text>
              </View>
            )}
            
            <Text style={styles.groupInfoText}>
              Group: <Text style={styles.groupNameText}>{groupName}</Text>
            </Text>
            
            <TouchableOpacity 
              style={styles.shareButton}
              onPress={handleShare}
              disabled={isProcessing || (activeTab !== 'link' && !contactInfo)}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="share-outline" size={20} color="#fff" style={styles.shareIcon} />
                  <Text style={styles.shareButtonText}>
                    {activeTab === 'phone' ? 'Send Invitation' :
                     activeTab === 'email' ? 'Email Invitation' : 'Share Link'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 12,
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
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#4CAF50',
  },
  tabText: {
    marginLeft: 4,
    color: '#666',
  },
  activeTabText: {
    color: '#4CAF50',
    fontWeight: '500',
  },
  modalContent: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 50,
    color: '#333',
  },
  shareInfoContainer: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  shareInfoText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#0D47A1',
  },
  groupInfoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  groupNameText: {
    fontWeight: '500',
    color: '#333',
  },
  shareButton: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareIcon: {
    marginRight: 8,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default InviteModal;