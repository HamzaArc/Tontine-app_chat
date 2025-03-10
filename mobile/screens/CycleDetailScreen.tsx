import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

type RootStackParamList = {
  GroupDetail: { groupId: number; groupName: string };
  CycleDetail: { cycleId: number; groupId: number; groupName: string };
};

type CycleDetailScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'CycleDetail'
>;

type CycleDetailScreenRouteProp = RouteProp<
  RootStackParamList,
  'CycleDetail'
>;

interface Props {
  navigation: CycleDetailScreenNavigationProp;
  route: CycleDetailScreenRouteProp;
}

interface Cycle {
  id: number;
  groupId: number;
  cycleIndex: number;
  startDate: string;
  endDate: string;
  recipientUserId: number | null;
  status: string;
  createdAt: string;
  recipient?: {
    id: number;
    name: string;
    email: string;
  };
}

interface Payment {
  id: number;
  cycleId: number;
  userId: number;
  amount: number;
  paid: boolean;
  paidAt: string | null;
  user: {
    id: number;
    name: string;
    email: string;
  };
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

const CycleDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { cycleId, groupId, groupName } = route.params;
  
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [recipientModalVisible, setRecipientModalVisible] = useState(false);
  const [paymentStats, setPaymentStats] = useState({
    totalAmount: 0,
    paidAmount: 0,
    paidCount: 0,
    totalCount: 0,
    percentPaid: 0
  });
  
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get user ID for permission checks
      const currentUserId = await AsyncStorage.getItem('userId');
      setUserId(currentUserId);
      
      // Fetch cycle details
      const cycleResponse = await api.get(`/cycles/${cycleId}`);
      setCycle(cycleResponse.data);
      
      // Fetch payments for this cycle
      const paymentsResponse = await api.get(`/cycles/${cycleId}/payments`);
      const fetchedPayments = paymentsResponse.data;
      setPayments(fetchedPayments);
      
      // Calculate payment statistics
      const totalAmount = fetchedPayments.reduce((sum: number, payment: Payment) => sum + payment.amount, 0);
      const paidPayments = fetchedPayments.filter((payment: Payment) => payment.paid);
      const paidAmount = paidPayments.reduce((sum: number, payment: Payment) => sum + payment.amount, 0);
      
      setPaymentStats({
        totalAmount,
        paidAmount,
        paidCount: paidPayments.length,
        totalCount: fetchedPayments.length,
        percentPaid: fetchedPayments.length > 0 
          ? (paidPayments.length / fetchedPayments.length) * 100 
          : 0
      });
      
      // Check if user is admin
      const membersResponse = await api.get('/memberships', {
        params: { groupId }
      });
      const fetchedMembers = membersResponse.data;
      setMembers(fetchedMembers);
      
      const userMembership = fetchedMembers.find(
        (m: Member) => m.userId === parseInt(currentUserId || '0', 10)
      );
      setIsAdmin(userMembership?.role === 'admin');
      
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('Error fetching cycle data:', error);
      Alert.alert('Error', 'Failed to load cycle details');
      setLoading(false);
      setRefreshing(false);
    }
  }, [cycleId, groupId]);
  
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );
  
  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleMarkAsPaid = async (paymentId: number) => {
    try {
      await api.put(`/payments/${paymentId}/pay`);
      Alert.alert('Success', 'Payment marked as paid');
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error marking payment:', error);
      Alert.alert('Error', 'Failed to mark payment as paid');
    }
  };

  const handlePayNow = (payment: Payment) => {
    // This would normally open a payment gateway
    Alert.alert(
      'Payment',
      `You are about to pay $${payment.amount} for Cycle #${cycle?.cycleIndex}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm Payment', 
          onPress: () => {
            // Simulate payment process
            Alert.alert('Payment Processing', 'Please wait...');
            setTimeout(() => {
              handleMarkAsPaid(payment.id);
            }, 1500);
          }
        }
      ]
    );
  };

  const handleAssignRecipient = async (memberId: number) => {
    try {
      await api.put(`/cycles/${cycleId}`, {
        recipientUserId: memberId
      });
      
      setRecipientModalVisible(false);
      Alert.alert('Success', 'Recipient assigned successfully');
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error assigning recipient:', error);
      Alert.alert('Error', 'Failed to assign recipient');
    }
  };

  const handleCompleteCycle = async () => {
    if (paymentStats.paidCount < paymentStats.totalCount) {
      Alert.alert(
        'Warning',
        'Not all payments have been received. Are you sure you want to mark this cycle as complete?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Complete Anyway', 
            onPress: async () => {
              try {
                await api.put(`/cycles/${cycleId}`, {
                  status: 'completed'
                });
                
                Alert.alert('Success', 'Cycle marked as completed');
                fetchData(); // Refresh data
              } catch (error) {
                console.error('Error completing cycle:', error);
                Alert.alert('Error', 'Failed to complete cycle');
              }
            }
          }
        ]
      );
    } else {
      try {
        await api.put(`/cycles/${cycleId}`, {
          status: 'completed'
        });
        
        Alert.alert('Success', 'Cycle marked as completed');
        fetchData(); // Refresh data
      } catch (error) {
        console.error('Error completing cycle:', error);
        Alert.alert('Error', 'Failed to complete cycle');
      }
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading cycle details...</Text>
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
        <Text style={styles.headerTitle}>Cycle #{cycle?.cycleIndex}</Text>
        {isAdmin && (
          <TouchableOpacity 
            style={styles.optionsButton}
            onPress={() => {
              Alert.alert(
                'Cycle Options',
                'Choose an action',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Complete Cycle', 
                    onPress: handleCompleteCycle,
                    style: cycle?.status === 'completed' ? 'default' : 'default' 
                  },
                  { 
                    text: 'Delete Cycle', 
                    onPress: () => {
                      Alert.alert(
                        'Confirm Deletion',
                        'Are you sure you want to delete this cycle? All payment records will also be deleted.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { 
                            text: 'Delete', 
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                await api.delete(`/cycles/${cycleId}`);
                                Alert.alert('Success', 'Cycle deleted successfully');
                                navigation.goBack();
                              } catch (error) {
                                console.error('Error deleting cycle:', error);
                                Alert.alert('Error', 'Failed to delete cycle');
                              }
                            }
                          }
                        ]
                      );
                    },
                    style: 'destructive' 
                  }
                ]
              );
            }}
          >
            <Ionicons name="ellipsis-vertical" size={20} color="#333" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Cycle Info Card */}
      <View style={styles.cycleInfoCard}>
        <View style={styles.cycleHeaderRow}>
          <View style={styles.groupInfo}>
            <Text style={styles.groupName}>{groupName}</Text>
            <Text style={styles.cycleStatus}>
              Status: <Text style={[
                styles.statusText, 
                cycle?.status === 'completed' ? styles.completedText : styles.activeText
              ]}>
                {cycle?.status || 'Active'}
              </Text>
            </Text>
          </View>
          
          <View style={[
            styles.statusBadge, 
            cycle?.status === 'completed' ? styles.completedBadge : styles.activeBadge
          ]}>
            <Text style={styles.statusBadgeText}>
              {cycle?.status === 'completed' ? 'Completed' : 'Active'}
            </Text>
          </View>
        </View>
        
        <View style={styles.cycleInfo}>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Start Date</Text>
              <Text style={styles.infoValue}>{formatDate(cycle?.startDate || '')}</Text>
            </View>
            
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>End Date</Text>
              <Text style={styles.infoValue}>{formatDate(cycle?.endDate || '')}</Text>
            </View>
          </View>
          
          <View style={styles.recipientSection}>
            <Text style={styles.recipientLabel}>Recipient</Text>
            
            {cycle?.recipientUserId ? (
              <View style={styles.recipientInfo}>
                <View style={styles.recipientAvatar}>
                  <Text style={styles.recipientInitial}>
                    {cycle.recipient?.name.charAt(0).toUpperCase() || '?'}
                  </Text>
                </View>
                <View style={styles.recipientDetail}>
                  <Text style={styles.recipientName}>{cycle.recipient?.name || 'Unknown'}</Text>
                  <Text style={styles.recipientEmail}>{cycle.recipient?.email || ''}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.noRecipientContainer}>
                <Text style={styles.noRecipientText}>No recipient assigned</Text>
                {isAdmin && (
                  <TouchableOpacity 
                    style={styles.assignButton}
                    onPress={() => setRecipientModalVisible(true)}
                  >
                    <Text style={styles.assignButtonText}>Assign</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      </View>
      
      {/* Payment Progress Card */}
      <View style={styles.paymentProgressCard}>
        <Text style={styles.cardTitle}>Payment Progress</Text>
        
        <View style={styles.progressStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>${paymentStats.paidAmount.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Collected</Text>
          </View>
          
          <View style={styles.progressContainer}>
            <View style={styles.progressBarContainer}>
              <View 
                style={[
                  styles.progressBar, 
                  { width: `${paymentStats.percentPaid}%` }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {paymentStats.percentPaid.toFixed(0)}% Complete
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statValue}>${paymentStats.totalAmount.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>
        
        <View style={styles.countStats}>
          <Text style={styles.countText}>
            {paymentStats.paidCount} of {paymentStats.totalCount} payments received
          </Text>
        </View>
      </View>
      
      {/* Payments List */}
      <Text style={styles.sectionTitle}>Member Payments</Text>
      <FlatList
        data={payments}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.paymentItem}>
            <View style={styles.paymentUserInfo}>
              <View style={styles.paymentAvatar}>
                <Text style={styles.paymentInitial}>
                  {item.user.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              
              <View style={styles.paymentDetails}>
                <Text style={styles.paymentUserName}>{item.user.name}</Text>
                <Text style={styles.paymentAmount}>${item.amount.toFixed(2)}</Text>
                {item.paid && item.paidAt && (
                  <Text style={styles.paymentDate}>
                    Paid on {formatDate(item.paidAt)}
                  </Text>
                )}
              </View>
            </View>
            
            {item.paid ? (
              <View style={styles.paidBadge}>
                <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                <Text style={styles.paidText}>Paid</Text>
              </View>
            ) : (
              parseInt(userId || '0', 10) === item.userId ? (
                <TouchableOpacity 
                  style={styles.payNowButton}
                  onPress={() => handlePayNow(item)}
                >
                  <Text style={styles.payNowText}>Pay Now</Text>
                </TouchableOpacity>
              ) : (
                isAdmin ? (
                  <TouchableOpacity 
                    style={styles.markPaidButton}
                    onPress={() => handleMarkAsPaid(item.id)}
                  >
                    <Text style={styles.markPaidText}>Mark Paid</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingText}>Pending</Text>
                  </View>
                )
              )
            )}
          </View>
        )}
        contentContainerStyle={styles.paymentsList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4CAF50']} />
        }
      />
      
      {/* Recipient Selection Modal */}
      <Modal
        visible={recipientModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setRecipientModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Recipient</Text>
              <TouchableOpacity onPress={() => setRecipientModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView>
              {members.map(member => (
                <TouchableOpacity 
                  key={member.id}
                  style={[
                    styles.memberItem, 
                    member.user.id === cycle?.recipientUserId && styles.selectedMemberItem
                  ]}
                  onPress={() => handleAssignRecipient(member.user.id)}
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
                  
                  {member.user.id === cycle?.recipientUserId && (
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
    flex: 1,
    textAlign: 'center',
  },
  optionsButton: {
    padding: 5,
  },
  cycleInfoCard: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cycleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  cycleStatus: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  statusText: {
    fontWeight: '500',
  },
  activeText: {
    color: '#4CAF50',
  },
  completedText: {
    color: '#2196F3',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  activeBadge: {
    backgroundColor: '#E8F5E9',
  },
  completedBadge: {
    backgroundColor: '#E3F2FD',
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  cycleInfo: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  recipientSection: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  recipientLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  recipientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recipientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recipientInitial: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  recipientDetail: {
    flex: 1,
  },
  recipientName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  recipientEmail: {
    fontSize: 12,
    color: '#666',
  },
  noRecipientContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  noRecipientText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  assignButton: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  assignButtonText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  paymentProgressCard: {
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  progressStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  progressContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    width: '100%',
    marginBottom: 4,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
  },
  countStats: {
    alignItems: 'center',
    marginTop: 8,
  },
  countText: {
    fontSize: 14,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    margin: 16,
    marginBottom: 8,
  },
  paymentsList: {
    paddingBottom: 20,
  },
  paymentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  paymentUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paymentInitial: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  paymentDetails: {
    flex: 1,
  },
  paymentUserName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  paymentAmount: {
    fontSize: 14,
    color: '#666',
  },
  paymentDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  paidText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
    marginLeft: 4,
  },
  pendingBadge: {
    backgroundColor: '#FFF8E1',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  pendingText: {
    fontSize: 14,
    color: '#FFA000',
    fontWeight: '500',
  },
  payNowButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  payNowText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  markPaidButton: {
    backgroundColor: '#E8F5E9',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  markPaidText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  memberEmail: {
    fontSize: 14,
    color: '#666',
  },
});

export default CycleDetailScreen;