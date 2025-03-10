import React, { useState, useEffect } from 'react';
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
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import api from '../services/api';

type RootStackParamList = {
  GroupDetail: { groupId: number; groupName: string };
  EditGroup: { groupId: number };
};

type EditGroupScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'EditGroup'
>;

type EditGroupScreenRouteProp = RouteProp<
  RootStackParamList,
  'EditGroup'
>;

interface Props {
  navigation: EditGroupScreenNavigationProp;
  route: EditGroupScreenRouteProp;
}

const FREQUENCY_OPTIONS = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Bi-weekly', value: 'bi-weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Custom', value: 'custom' }
];

const EditGroupScreen: React.FC<Props> = ({ navigation, route }) => {
  const { groupId } = route.params;
  
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [contribution, setContribution] = useState<string>('');
  const [frequency, setFrequency] = useState<string>('');
  const [customFrequency, setCustomFrequency] = useState<string>('');
  const [maxMembers, setMaxMembers] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [frequencyModalVisible, setFrequencyModalVisible] = useState<boolean>(false);
  
  // Fetch group details
  useEffect(() => {
    const fetchGroupDetails = async () => {
      try {
        const response = await api.get(`/groups/${groupId}`);
        const group = response.data;
        
        setName(group.name || '');
        setDescription(group.description || '');
        setContribution(group.contribution ? group.contribution.toString() : '');
        
        // Handle frequency setting
        if (group.frequency) {
          const isStandardFrequency = FREQUENCY_OPTIONS.some(
            option => option.value === group.frequency
          );
          
          if (isStandardFrequency) {
            setFrequency(group.frequency);
          } else {
            setFrequency('custom');
            setCustomFrequency(group.frequency);
          }
        }
        
        setMaxMembers(group.maxMembers ? group.maxMembers.toString() : '');
        setLoading(false);
      } catch (error) {
        console.error('Error fetching group details:', error);
        Alert.alert('Error', 'Failed to load group details');
        setLoading(false);
      }
    };
    
    fetchGroupDetails();
  }, [groupId]);
  
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

  const handleUpdateGroup = async () => {
    if (!validateForm()) {
      return;
    }
    
    setSaving(true);
    
    try {
      const effectiveFrequency = frequency === 'custom' ? customFrequency : frequency;
      
      await api.put(`/groups/${groupId}`, {
        name,
        description,
        contribution: contribution ? parseFloat(contribution) : null,
        frequency: effectiveFrequency,
        maxMembers: maxMembers ? parseInt(maxMembers, 10) : null,
      });
      
      setSaving(false);
      Alert.alert(
        'Success', 
        'Group updated successfully',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      setSaving(false);
      console.error('Error updating group:', error);
      Alert.alert('Error', 'Failed to update group');
    }
  };

  const selectFrequency = (value: string) => {
    setFrequency(value);
    setFrequencyModalVisible(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading group details...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Group</Text>
          <View style={styles.emptySpace} />
        </View>
        
        <ScrollView style={styles.content}>
          <View style={styles.formContainer}>
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
            
            {/* Warning about existing cycles */}
            <View style={styles.warningBox}>
              <Ionicons name="warning-outline" size={20} color="#FFA000" style={styles.warningIcon} />
              <Text style={styles.warningText}>
                Changes to contribution amount will only affect future cycles. Existing cycles will maintain their original settings.
              </Text>
            </View>
            
            {/* Update Button */}
            <TouchableOpacity
              style={styles.updateButton}
              onPress={handleUpdateGroup}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.updateButtonText}>Update Group</Text>
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
      </View>
    </KeyboardAvoidingView>
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
  inputGroup: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 24,
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
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    padding: 12,
    marginVertical: 16,
  },
  warningIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#F57C00',
    lineHeight: 20,
  },
  updateButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  updateButtonText: {
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

export default EditGroupScreen;