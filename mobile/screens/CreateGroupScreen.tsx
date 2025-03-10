import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import api from '../services/api';

type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  Groups: undefined;
  CreateGroup: undefined;
  GroupDetail: { groupId: number; groupName: string };
};

type CreateGroupScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'CreateGroup'
>;

interface Props {
  navigation: CreateGroupScreenNavigationProp;
}

const FREQUENCY_OPTIONS = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Bi-weekly', value: 'bi-weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Custom', value: 'custom' }
];

const CreateGroupScreen: React.FC<Props> = ({ navigation }) => {
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [contribution, setContribution] = useState<string>('');
  const [frequency, setFrequency] = useState<string>('');
  const [customFrequency, setCustomFrequency] = useState<string>('');
  const [maxMembers, setMaxMembers] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [frequencyModalVisible, setFrequencyModalVisible] = useState<boolean>(false);
  
  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};
    
    if (!name.trim()) {
      newErrors.name = 'Group name is required';
    }
    
    if (contribution && isNaN(parseFloat(contribution))) {
      newErrors.contribution = 'Contribution must be a valid number';
    }
    
    if (!frequency) {
      newErrors.frequency = 'Please select a frequency';
    }
    
    if (frequency === 'custom' && !customFrequency.trim()) {
      newErrors.customFrequency = 'Please specify the custom frequency';
    }
    
    if (maxMembers && isNaN(parseInt(maxMembers))) {
      newErrors.maxMembers = 'Max members must be a valid number';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const createGroup = async () => {
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      const effectiveFrequency = frequency === 'custom' ? customFrequency : frequency;
      
      const response = await api.post('/groups', {
        name,
        description,
        contribution: contribution ? parseFloat(contribution) : null,
        frequency: effectiveFrequency,
        maxMembers: maxMembers ? parseInt(maxMembers, 10) : null,
      });
      
      setLoading(false);
      
      // Navigate to the newly created group
      Alert.alert(
        'Success!', 
        'Your group has been created successfully.',
        [
          { 
            text: 'Add Members', 
            onPress: () => navigation.navigate('GroupDetail', { 
              groupId: response.data.id,
              groupName: response.data.name
            })
          },
          { 
            text: 'Back to Groups', 
            onPress: () => navigation.navigate('Groups')
          }
        ]
      );
    } catch (error) {
      setLoading(false);
      console.error('Error creating group:', error);
      Alert.alert('Error', 'Failed to create group. Please try again.');
    }
  };

  const selectFrequency = (value: string) => {
    setFrequency(value);
    setFrequencyModalVisible(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create New Group</Text>
          <View style={styles.emptySpace} />
        </View>
        
        <View style={styles.formContainer}>
          <Text style={styles.sectionTitle}>Group Details</Text>
          
          {/* Group Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Group Name*</Text>
            <View style={[styles.inputContainer, errors.name ? styles.inputError : null]}>
              <TextInput
                style={styles.input}
                placeholder="e.g., Family Savings Group"
                value={name}
                onChangeText={setName}
              />
            </View>
            {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
          </View>
          
          {/* Description */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description (Optional)</Text>
            <View style={styles.textAreaContainer}>
              <TextInput
                style={styles.textArea}
                placeholder="Describe the purpose of your group..."
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>
          
          <Text style={styles.sectionTitle}>Contribution Settings</Text>
          
          {/* Contribution Amount */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Contribution Amount*</Text>
            <View style={[styles.inputContainer, errors.contribution ? styles.inputError : null]}>
              <TextInput
                style={styles.input}
                placeholder="e.g., 100"
                keyboardType="numeric"
                value={contribution}
                onChangeText={setContribution}
              />
              <Text style={styles.currencyLabel}>USD</Text>
            </View>
            {errors.contribution ? (
              <Text style={styles.errorText}>{errors.contribution}</Text>
            ) : (
              <Text style={styles.helperText}>
                The amount each member contributes per cycle
              </Text>
            )}
          </View>
          
          {/* Frequency */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Payment Frequency*</Text>
            <TouchableOpacity
              style={[styles.dropdownContainer, errors.frequency ? styles.inputError : null]}
              onPress={() => setFrequencyModalVisible(true)}
            >
              <Text style={frequency ? styles.dropdownText : styles.dropdownPlaceholder}>
                {frequency === 'custom' 
                  ? customFrequency 
                  : frequency 
                    ? FREQUENCY_OPTIONS.find(option => option.value === frequency)?.label 
                    : 'Select frequency'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
            {errors.frequency ? <Text style={styles.errorText}>{errors.frequency}</Text> : null}
            
            {frequency === 'custom' && (
              <View style={styles.customFrequencyContainer}>
                <TextInput
                  style={[
                    styles.customFrequencyInput, 
                    errors.customFrequency ? styles.inputError : null
                  ]}
                  placeholder="Specify custom frequency..."
                  value={customFrequency}
                  onChangeText={setCustomFrequency}
                />
                {errors.customFrequency ? (
                  <Text style={styles.errorText}>{errors.customFrequency}</Text>
                ) : null}
              </View>
            )}
          </View>
          
          {/* Max Members */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Maximum Members (Optional)</Text>
            <View style={[styles.inputContainer, errors.maxMembers ? styles.inputError : null]}>
              <TextInput
                style={styles.input}
                placeholder="e.g., 10"
                keyboardType="numeric"
                value={maxMembers}
                onChangeText={setMaxMembers}
              />
            </View>
            {errors.maxMembers ? (
              <Text style={styles.errorText}>{errors.maxMembers}</Text>
            ) : (
              <Text style={styles.helperText}>
                Leave blank for unlimited members
              </Text>
            )}
          </View>
          
          {/* Create Button */}
          <TouchableOpacity
            style={styles.createButton}
            onPress={createGroup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.createButtonText}>Create Group</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
      
      {/* Frequency Selection Modal */}
      <Modal
        visible={frequencyModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setFrequencyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Frequency</Text>
              <TouchableOpacity onPress={() => setFrequencyModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView>
              {FREQUENCY_OPTIONS.map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.frequencyOption,
                    frequency === option.value && styles.selectedFrequencyOption
                  ]}
                  onPress={() => selectFrequency(option.value)}
                >
                  <Text 
                    style={[
                      styles.frequencyOptionText,
                      frequency === option.value && styles.selectedFrequencyOptionText
                    ]}
                  >
                    {option.label}
                  </Text>
                  
                  {frequency === option.value && (
                    <Ionicons name="checkmark" size={20} color="#4CAF50" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  contentContainer: {
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
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
    width: 34, // Match the width of the back button
  },
  formContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 24,
    marginBottom: 16,
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
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    height: 50,
    color: '#333',
  },
  currencyLabel: {
    color: '#666',
    fontWeight: '500',
  },
  textAreaContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 100,
    color: '#333',
  },
  dropdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  dropdownText: {
    color: '#333',
  },
  dropdownPlaceholder: {
    color: '#999',
  },
  inputError: {
    borderColor: '#FF5252',
  },
  errorText: {
    color: '#FF5252',
    fontSize: 12,
    marginTop: 4,
  },
  helperText: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  customFrequencyContainer: {
    marginTop: 10,
  },
  customFrequencyInput: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  createButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
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
    paddingBottom: 20,
    maxHeight: '70%',
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
  frequencyOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedFrequencyOption: {
    backgroundColor: '#F1F8E9',
  },
  frequencyOptionText: {
    fontSize: 16,
    color: '#333',
  },
  selectedFrequencyOptionText: {
    fontWeight: '500',
    color: '#4CAF50',
  },
});

export default CreateGroupScreen;