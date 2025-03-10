import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import api from '../services/api';

type RootStackParamList = {
  GroupDetail: { groupId: number; groupName: string };
  CreateCycle: { groupId: number; groupName: string };
  CycleDetail: { cycleId: number; groupId: number; groupName: string };
};

type CreateCycleScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'CreateCycle'
>;

type CreateCycleScreenRouteProp = RouteProp<
  RootStackParamList,
  'CreateCycle'
>;

interface Props {
  navigation: CreateCycleScreenNavigationProp;
  route: CreateCycleScreenRouteProp;
}

interface Member {
  id: number;
  userId: number;
  groupId: number;
  role: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
}

const CreateCycleScreen: React.FC<Props> = ({ navigation, route }) => {
  const { groupId, groupName } = route.params;
  
  const [cycleIndex, setCycleIndex] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)); // Default to 30 days from now
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [recipientUserId, setRecipientUserId] = useState<number | null>(null);
  const [recipientName, setRecipientName] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [memberPickerVisible, setMemberPickerVisible] = useState(false);

  // Fetch group members
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        setLoading(true);
        const response = await api.get('/memberships', {
          params: { groupId }
        });
        setMembers(response.data);
        
        // Check if there are any existing cycles
        const cyclesResponse = await api.get(`/groups/${groupId}/cycles`);
        const cycles = cyclesResponse.data;
        
        // Set the cycle index based on existing cycles
        if (cycles.length > 0) {
          const maxCycleIndex = Math.max(...cycles.map((c: any) => c.cycleIndex));
          setCycleIndex((maxCycleIndex + 1).toString());
        } else {
          setCycleIndex('1');
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching members:', error);
        Alert.alert('Error', 'Failed to load members');
        setLoading(false);
      }
    };
    
    fetchMembers();
  }, [groupId]);

  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setStartDate(selectedDate);
      
      // If end date is before start date, update it
      if (endDate < selectedDate) {
        // Set end date to 30 days after start date
        const newEndDate = new Date(selectedDate);
        newEndDate.setDate(newEndDate.getDate() + 30);
        setEndDate(newEndDate);
      }
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setEndDate(selectedDate);
    }
  };

  const validateForm = () => {
    if (!cycleIndex || isNaN(parseInt(cycleIndex, 10))) {
      Alert.alert('Validation Error', 'Please enter a valid cycle number');
      return false;
    }
    
    if (endDate <= startDate) {
      Alert.alert('Validation Error', 'End date must be after start date');
      return false;
    }
    
    return true;
  };

  const handleCreateCycle = async () => {
    if (!validateForm()) return;
    
    setSubmitting(true);
    
    try {
      const response = await api.post(`/groups/${groupId}/cycles`, {
        cycleIndex: parseInt(cycleIndex, 10),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        recipientUserId: recipientUserId
      });
      
      setSubmitting(false);
      Alert.alert(
        'Success',
        'Cycle created successfully',
        [
          { 
            text: 'View Cycle', 
            onPress: () => navigation.replace('CycleDetail', {
              cycleId: response.data.cycle.id,
              groupId,
              groupName
            })
          }
        ]
      );
    } catch (error) {
      console.error('Error creating cycle:', error);
      setSubmitting(false);
      Alert.alert('Error', 'Failed to create cycle');
    }
  };

  const selectRecipient = (member: Member) => {
    setRecipientUserId(member.user.id);
    setRecipientName(member.user.name);
    setMemberPickerVisible(false);
  };

  const determineRecommendedRecipient = () => {
    // This would normally use a more sophisticated algorithm based on previous cycles
    // For now, just suggest a random member
    if (members.length > 0) {
      const randomIndex = Math.floor(Math.random() * members.length);
      return members[randomIndex];
    }
    return null;
  };

  const handleAutoAssign = () => {
    const recommendedMember = determineRecommendedRecipient();
    if (recommendedMember) {
      setRecipientUserId(recommendedMember.user.id);
      setRecipientName(recommendedMember.user.name);
    } else {
      Alert.alert('Notice', 'No members available for auto-assignment');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create New Cycle</Text>
        <View style={styles.emptySpace} />
      </View>
      
      <ScrollView style={styles.content}>
        <View style={styles.formContainer}>
          {/* Group Info */}
          <View style={styles.groupInfoContainer}>
            <Text style={styles.groupName}>{groupName}</Text>
            <Text style={styles.groupMembers}>{members.length} members</Text>
          </View>
          
          {/* Cycle Number */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Cycle Number</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={cycleIndex}
                onChangeText={setCycleIndex}
                keyboardType="numeric"
                placeholder="Enter cycle number"
              />
            </View>
          </View>
          
          {/* Date Range */}
          <Text style={styles.sectionTitle}>Cycle Duration</Text>
          <View style={styles.dateRangeContainer}>
            {/* Start Date */}
            <View style={styles.dateInputGroup}>
              <Text style={styles.label}>Start Date</Text>
              <TouchableOpacity 
                style={styles.datePickerButton}
                onPress={() => setShowStartDatePicker(true)}
              >
                <Text style={styles.dateText}>
                  {startDate.toLocaleDateString()}
                </Text>
                <Ionicons name="calendar-outline" size={20} color="#4CAF50" />
              </TouchableOpacity>
              
              {showStartDatePicker && (
                <DateTimePicker
                  value={startDate}
                  mode="date"
                  display="default"
                  onChange={handleStartDateChange}
                  minimumDate={new Date()}
                />
              )}
            </View>
            
            {/* End Date */}
            <View style={styles.dateInputGroup}>
              <Text style={styles.label}>End Date</Text>
              <TouchableOpacity 
                style={styles.datePickerButton}
                onPress={() => setShowEndDatePicker(true)}
              >
                <Text style={styles.dateText}>
                  {endDate.toLocaleDateString()}
                </Text>
                <Ionicons name="calendar-outline" size={20} color="#4CAF50" />
              </TouchableOpacity>
              
              {showEndDatePicker && (
                <DateTimePicker
                  value={endDate}
                  mode="date"
                  display="default"
                  onChange={handleEndDateChange}
                  minimumDate={new Date(startDate.getTime() + 24 * 60 * 60 * 1000)} // At least 1 day after start date
                />
              )}
            </View>
          </View>
          
          {/* Recipient Selection */}
          <Text style={styles.sectionTitle}>Recipient Selection</Text>
          <Text style={styles.sectionDescription}>
            Select the member who will receive the funds for this cycle
          </Text>
          
          <View style={styles.recipientContainer}>
            <TouchableOpacity 
              style={styles.selectRecipientButton}
              onPress={() => setMemberPickerVisible(true)}
            >
              <Ionicons name="person-outline" size={20} color="#4CAF50" style={styles.recipientIcon} />
              <Text style={styles.recipientPlaceholder}>
                {recipientUserId ? recipientName : 'Select recipient (optional)'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.autoAssignButton}
              onPress={handleAutoAssign}
            >
              <Ionicons name="shuffle" size={16} color="#4CAF50" />
              <Text style={styles.autoAssignText}>Auto Assign</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.recipientHint}>
            You can create the cycle without assigning a recipient now. You can assign one later.
          </Text>
          
          {/* Payment Schedule Info */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={20} color="#2196F3" style={styles.infoIcon} />
            <Text style={styles.infoText}>
              When you create this cycle, payment records will be automatically created for all members based on the contribution amount set for this group.
            </Text>
          </View>
          
          {/* Create Button */}
          <TouchableOpacity 
            style={styles.createButton}
            onPress={handleCreateCycle}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.createButtonText}>Create Cycle</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
      
      {/* Member Selection Modal */}
      <Modal
        visible={memberPickerVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setMemberPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Recipient</Text>
              <TouchableOpacity onPress={() => setMemberPickerVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.memberList}>
              {members.map(member => (
                <TouchableOpacity 
                  key={member.id}
                  style={[
                    styles.memberItem, 
                    member.user.id === recipientUserId && styles.selectedMemberItem
                  ]}
                  onPress={() => selectRecipient(member)}
                >
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberInitial}>
                      {member.user.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{member.user.name}</Text>
                    <Text style={styles.memberEmail}>{member.user.email}</Text>
                  </View>
                  
                  {member.user.id === recipientUserId && (
                    <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
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
  emptySpace: {
    width: 34,
  },
  content: {
    flex: 1,
  },
  formContainer: {
    padding: 16,
  },
  groupInfoContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  groupName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  groupMembers: {
    fontSize: 14,
    color: '#666',
  },
  inputGroup: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 6,
  },
  inputContainer: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  input: {
    fontSize: 16,
    color: '#333',
  },
  dateRangeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateInputGroup: {
    flex: 1,
    marginRight: 8,
  },
  datePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  dateText: {
    fontSize: 16,
    color: '#333',
  },
  recipientContainer: {
    marginBottom: 8,
  },
  selectRecipientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  recipientIcon: {
    marginRight: 8,
  },
  recipientPlaceholder: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  autoAssignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
  },
  autoAssignText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
    marginLeft: 6,
  },
  recipientHint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 20,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  infoIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#0D47A1',
    lineHeight: 20,
  },
  createButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
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
  memberList: {
    maxHeight: 400,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedMemberItem: {
    backgroundColor: '#F1F8E9',
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberInitial: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  memberEmail: {
    fontSize: 14,
    color: '#666',
  },
});

export default CreateCycleScreen;