import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  FlatList,
  Image,
  TextInput,
  AlertButton
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { Linking } from 'react-native';
import InviteModal from '../components/InviteModal';
import { SharingService } from '../services/sharingService';

type RootStackParamList = {
  Groups: undefined;
  GroupDetail: { groupId: number; groupName: string };
  CreateCycle: { groupId: number; groupName: string };
  ManageMembers: { groupId: number; groupName: string };
  CycleDetail: { cycleId: number; groupId: number; groupName: string };
  EditGroup: { groupId: number };
};

type GroupDetailScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'GroupDetail'
>;

type GroupDetailScreenRouteProp = RouteProp<
  RootStackParamList,
  'GroupDetail'
>;

interface Props {
  navigation: GroupDetailScreenNavigationProp;
  route: GroupDetailScreenRouteProp;
}

interface GroupDetails {
  id: number;
  name: string;
  description: string;
  contribution: number;
  frequency: string;
  maxMembers: number;
  createdAt: string;
}

interface Member {
  id: number;
  userId: number;
  groupId: number;
  role: string;
  joinedAt: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
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

const GroupDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { groupId, groupName } = route.params;
  const [group, setGroup] = useState<GroupDetails | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [currentCycle, setCurrentCycle] = useState<Cycle | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');

  
  const fetchData = useCallback(async () => {
    setLoading(true);
    
    try {
      // Get the user's ID
      const currentUserId = await AsyncStorage.getItem('userId');
      setUserId(currentUserId);
      
      // Fetch group details
      const groupResponse = await api.get(`/groups/${groupId}`);
      setGroup(groupResponse.data);
      
      // Fetch members
      const membersResponse = await api.get('/memberships', {
        params: { groupId }
      });
      const fetchedMembers = membersResponse.data;
      setMembers(fetchedMembers);
      
      // Check if current user is admin
      const userMembership = fetchedMembers.find(
        (m: Member) => m.userId === parseInt(currentUserId || '0', 10)
      );
      setIsAdmin(userMembership?.role === 'admin');
      
      // Fetch cycles
      const cyclesResponse = await api.get(`/groups/${groupId}/cycles`);
      const fetchedCycles = cyclesResponse.data;
      setCycles(fetchedCycles);
      
      // Determine current/latest cycle
      if (fetchedCycles.length > 0) {
        // Sort by cycleIndex descending to get the latest
        const sortedCycles = [...fetchedCycles].sort((a, b) => b.cycleIndex - a.cycleIndex);
        const latestCycle = sortedCycles[0];
        setCurrentCycle(latestCycle);
        
        // Fetch payments for current cycle
        if (latestCycle.id) {
          const paymentsResponse = await api.get(`/cycles/${latestCycle.id}/payments`);
          setPayments(paymentsResponse.data);
        }
      }
    } catch (error) {
      console.error('Error fetching group data:', error);
      Alert.alert('Error', 'Failed to load group details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [groupId]);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleAddMember = async () => {
    if (!invitePhone.trim() || invitePhone.length < 10) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }
    
    try {
      // First, try to find the user by phone number
      const userResponse = await api.get('/users', {
        params: { phone: invitePhone.trim() }
      });
      
      if (!userResponse.data || !userResponse.data.id) {
        // User not found, send WhatsApp invitation
        const success = await SharingService.inviteViaWhatsApp({
          groupId: group?.id || 0,
          groupName: group?.name || '',
          recipientPhone: invitePhone
        });
        
        if (!success) {
          // If WhatsApp fails, ask if they want to try SMS
          Alert.alert(
            'WhatsApp Not Available',
            'Would you like to send an SMS invitation instead?',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Send SMS', 
                onPress: async () => {
                  await SharingService.inviteViaSMS({
                    groupId: group?.id || 0,
                    groupName: group?.name || '',
                    recipientPhone: invitePhone
                  });
                }
              }
            ]
          );
        } else {
          setModalVisible(false);
          setInvitePhone('');
          Alert.alert(
            'Invitation Sent', 
            'A message has been sent to invite the user to join the app and this group.'
          );
        }
        return;
      }
      
      // Rest of the original function remains the same
      const user = userResponse.data;
      
      // Check if user is already a member
      const isMember = members.some(member => member.userId === user.id);
      if (isMember) {
        Alert.alert('Already a Member', 'This user is already a member of this group');
        return;
      }
      
      // Add the user to the group
      await api.post('/memberships', {
        userId: user.id,
        groupId: groupId,
        role: 'member'
      });
      
      Alert.alert('Success', 'Member added successfully');
      setModalVisible(false);
      setInvitePhone('');
      fetchData(); // Refresh data
      
    } catch (error) {
      console.error('Error adding member:', error);
      Alert.alert('Error', 'Failed to add member');
    }
  };

  const sendWhatsAppInvite = async (phoneNumber: string, groupId: number, groupName: string) => {
    const result = await SharingService.inviteViaWhatsApp({
      groupId,
      groupName,
      recipientPhone: phoneNumber
    });
    
    if (!result) {
      Alert.alert(
        'WhatsApp Not Available', 
        'Please make sure WhatsApp is installed or try another sharing method.'
      );
    }
  };

  const handleCreateCycle = () => {
    // Check if we've reached the maximum number of cycles
    if (group?.maxMembers && cycles.length >= group.maxMembers) {
      Alert.alert(
        'Maximum Cycles Reached',
        `This group is configured for ${group.maxMembers} cycles, which matches the number of members. You can't create more cycles.`
      );
      return;
    }
    
    navigation.navigate('CreateCycle', { groupId, groupName });
  };

  const isCycleCreationDisabled = (): boolean => {
    if (!group || !group.maxMembers) {
      return false;
    }
    return cycles.length >= group.maxMembers;
  };

  const handleCyclePress = (cycle: Cycle) => {
    navigation.navigate('CycleDetail', { 
      cycleId: cycle.id, 
      groupId, 
      groupName 
    });
  };

  const handleMemberOptionsPress = (member: Member) => {
    if (!isAdmin) return;
    
    const options: AlertButton[] = [
      { text: 'Cancel', style: 'cancel' as 'cancel' },
      { 
        text: member.role === 'admin' ? 'Remove Admin Role' : 'Make Admin',
        onPress: () => updateMemberRole(member, member.role === 'admin' ? 'member' : 'admin')
      }
    ];
    
    // Only show remove option if the member is not the current user
    if (member.userId !== parseInt(userId || '0', 10)) {
      options.push({
        text: 'Remove from Group',
        style: 'destructive',
        onPress: () => removeMember(member.id)
      });
    }
    
    Alert.alert('Member Options', 'Choose an action', options);
  };

  const updateMemberRole = async (member: Member, newRole: string) => {
    try {
      await api.put(`/memberships/${member.id}`, { role: newRole });
      Alert.alert('Success', 'Member role updated');
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error updating member role:', error);
      Alert.alert('Error', 'Failed to update member role');
    }
  };

  const removeMember = async (membershipId: number) => {
    try {
      await api.delete(`/memberships/${membershipId}`);
      Alert.alert('Success', 'Member removed from group');
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error removing member:', error);
      Alert.alert('Error', 'Failed to remove member');
    }
  };

  const handleMarkPaid = async (paymentId: number) => {
    try {
      await api.put(`/payments/${paymentId}/pay`);
      Alert.alert('Success', 'Payment marked as paid');
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error marking payment:', error);
      Alert.alert('Error', 'Failed to mark payment as paid');
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading group details...</Text>
      </View>
    );
  }

  const renderOverviewTab = () => (
    <ScrollView 
      style={styles.tabContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4CAF50']} />
      }
    >
      {/* Group Info Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Group Information</Text>
          
          {isAdmin && (
            <TouchableOpacity 
              style={styles.editButton}
              onPress={() => navigation.navigate('EditGroup', { groupId })}
            >
              <Ionicons name="pencil" size={16} color="#4CAF50" />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.groupInfoRow}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Contribution</Text>
            <Text style={styles.infoValue}>${group?.contribution || 0}</Text>
          </View>
          
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Frequency</Text>
            <Text style={styles.infoValue}>{group?.frequency || 'N/A'}</Text>
          </View>
          
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Members</Text>
            <Text style={styles.infoValue}>{members.length}</Text>
          </View>
        </View>
        
        {group?.description && (
          <View style={styles.descriptionContainer}>
            <Text style={styles.descriptionLabel}>Description</Text>
            <Text style={styles.descriptionText}>{group.description}</Text>
          </View>
        )}
      </View>
      
      {/* Current Cycle Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Current Cycle</Text>
          
          {isAdmin && (
            <TouchableOpacity 
              style={styles.createButton}
              onPress={handleCreateCycle}
            >
              <Ionicons name="add" size={16} color="#4CAF50" />
              <Text style={styles.createButtonText}>New Cycle</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {currentCycle ? (
          <TouchableOpacity 
            style={styles.cycleContainer}
            onPress={() => handleCyclePress(currentCycle)}
          >
            <View style={styles.cycleHeader}>
              <Text style={styles.cycleTitle}>Cycle #{currentCycle.cycleIndex}</Text>
              <View style={[
                styles.statusBadge, 
                currentCycle.status === 'active' ? styles.activeStatus : 
                currentCycle.status === 'completed' ? styles.completedStatus : 
                styles.pendingStatus
              ]}>
                <Text style={styles.statusText}>
                  {currentCycle.status || 'Active'}
                </Text>
              </View>
            </View>
            
            <View style={styles.cycleDetails}>
              <View style={styles.cycleDetail}>
                <Ionicons name="calendar-outline" size={16} color="#666" />
                <Text style={styles.cycleDetailText}>
                  {currentCycle.startDate ? new Date(currentCycle.startDate).toLocaleDateString() : 'N/A'}
                  {currentCycle.endDate ? ` - ${new Date(currentCycle.endDate).toLocaleDateString()}` : ''}
                </Text>
              </View>
              
              <View style={styles.cycleDetail}>
                <Ionicons name="person-outline" size={16} color="#666" />
                <Text style={styles.cycleDetailText}>
                  Recipient: {currentCycle.recipient ? currentCycle.recipient.name : 'Not assigned'}
                </Text>
              </View>
              
              <View style={styles.paymentProgress}>
                <Text style={styles.progressLabel}>Payment Progress</Text>
                <View style={styles.progressBarContainer}>
                  <View 
                    style={[
                      styles.progressBar, 
                      { width: `${(payments.filter(p => p.paid).length / payments.length) * 100}%` }
                    ]} 
                  />
                </View>
                <Text style={styles.progressText}>
                  {payments.filter(p => p.paid).length} / {payments.length} payments received
                </Text>
              </View>
            </View>
            
            <View style={styles.viewMoreContainer}>
              <Text style={styles.viewMoreText}>View cycle details</Text>
              <Ionicons name="chevron-forward" size={16} color="#4CAF50" />
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.emptyCycleContainer}>
            <MaterialCommunityIcons name="calendar-clock" size={40} color="#ccc" />
            <Text style={styles.emptyCycleText}>No cycles have been created yet</Text>
            {isAdmin && (
              <TouchableOpacity 
                style={styles.emptyCycleButton}
                onPress={handleCreateCycle}
              >
                <Text style={styles.emptyCycleButtonText}>Create First Cycle</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
      
      {/* Recent Activity */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Activity</Text>
        
        {/* This would typically be populated with recent events */}
        {payments.length > 0 ? (
          payments.filter(p => p.paid).slice(0, 3).map(payment => (
            <View key={payment.id} style={styles.activityItem}>
              <View style={styles.activityIcon}>
                <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityText}>
                  <Text style={styles.activityName}>{payment.user.name}</Text> made a payment of ${payment.amount}
                </Text>
                <Text style={styles.activityDate}>
                  {payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : 'Recently'}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.noActivityText}>No recent activity</Text>
        )}
        
        <TouchableOpacity style={styles.viewAllButton}>
          <Text style={styles.viewAllText}>View All Activity</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderMembersTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.membersHeader}>
      {group?.maxMembers && (
  <View style={styles.memberProgressContainer}>
    <View style={styles.memberProgressTextContainer}>
      <Text style={styles.memberProgressText}>
        {members.length} of {group.maxMembers} members
      </Text>
      <Text style={styles.memberProgressPercentage}>
        {Math.round((members.length / group.maxMembers) * 100)}%
      </Text>
    </View>
    <View style={styles.memberProgressBarBackground}>
      <View 
        style={[
          styles.memberProgressBar, 
          { width: `${(members.length / group.maxMembers) * 100}%` }
        ]} 
      />
    </View>
  </View>
 )}
        <Text style={styles.membersTitle}>Group Members ({members.length})</Text>
        
        {isAdmin && (
          <TouchableOpacity 
            style={styles.addMemberButton}
            onPress={() => setInviteModalVisible(true)} 
          >
            <Ionicons name="person-add" size={16} color="#4CAF50" />
            <Text style={styles.addMemberText}>Add Member</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <FlatList
        data={members}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.memberItem}
            onPress={() => isAdmin && handleMemberOptionsPress(item)}
          >
            <View style={styles.memberAvatarContainer}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberInitial}>
                  {item.user.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            </View>
            
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{item.user.name}</Text>
              <Text style={styles.memberEmail}>{item.user.email}</Text>
              {item.role === 'admin' && (
                <View style={styles.adminBadge}>
                  <Text style={styles.adminText}>Admin</Text>
                </View>
              )}
            </View>
            
            {isAdmin && (
              <TouchableOpacity 
                style={styles.memberOptionsButton}
                onPress={() => handleMemberOptionsPress(item)}
              >
                <Ionicons name="ellipsis-vertical" size={20} color="#666" />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4CAF50']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyListContainer}>
            <MaterialCommunityIcons name="account-group-outline" size={40} color="#ccc" />
            <Text style={styles.emptyListText}>No members found</Text>
          </View>
        }
      />
    </View>
  );

 const renderCyclesTab = () => {
    // Calculate this value before the JSX
    const cycleCreationDisabled: boolean = 
      group?.maxMembers !== undefined && 
      group?.maxMembers !== null && 
      cycles.length >= group.maxMembers;
      
    return (
      <View style={styles.tabContent}>
        <View style={styles.cyclesHeader}>
          <Text style={styles.cyclesTitle}>Payment Cycles</Text>
          
          {isAdmin && (
            <TouchableOpacity 
              style={[
                styles.createCycleButton, 
                cycleCreationDisabled ? styles.disabledButton : {}
              ]}
              onPress={handleCreateCycle}
              disabled={cycleCreationDisabled}
            >
              <Ionicons name="add" size={16} color="#4CAF50" />
              <Text style={styles.createCycleText}>
                {cycleCreationDisabled ? "Max Cycles Created" : "New Cycle"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        
        <FlatList
          data={cycles}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.cycleItem}
              onPress={() => handleCyclePress(item)}
            >
              <View style={styles.cycleItemHeader}>
                <Text style={styles.cycleItemTitle}>Cycle #{item.cycleIndex}</Text>
                <View style={[
                  styles.statusBadge, 
                  item.status === 'active' ? styles.activeStatus : 
                  item.status === 'completed' ? styles.completedStatus : 
                  styles.pendingStatus
                ]}>
                  <Text style={styles.statusText}>
                    {item.status || 'Active'}
                  </Text>
                </View>
              </View>
              
              <View style={styles.cycleItemDetails}>
                <View style={styles.cycleItemDetail}>
                  <Ionicons name="calendar-outline" size={16} color="#666" />
                  <Text style={styles.cycleItemDetailText}>
                    {item.startDate ? new Date(item.startDate).toLocaleDateString() : 'N/A'}
                  </Text>
                </View>
                
                <View style={styles.cycleItemDetail}>
                  <Ionicons name="person-outline" size={16} color="#666" />
                  <Text style={styles.cycleItemDetailText}>
                    {item.recipientUserId ? 'Assigned' : 'Unassigned'}
                  </Text>
                </View>
              </View>
              
              <Ionicons name="chevron-forward" size={20} color="#ccc" style={styles.cycleItemArrow} />
            </TouchableOpacity>
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4CAF50']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyListContainer}>
              <MaterialCommunityIcons name="calendar-blank-outline" size={40} color="#ccc" />
              <Text style={styles.emptyListText}>No cycles found</Text>
              {isAdmin && (
                <TouchableOpacity 
                  style={styles.emptyListButton}
                  onPress={handleCreateCycle}
                  disabled={cycleCreationDisabled}
                >
                  <Text style={styles.emptyListButtonText}>
                    {cycleCreationDisabled ? "Max Cycles Created" : "Create First Cycle"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      </View>
    );
  };
  const renderPaymentsTab = () => (
    <View style={styles.tabContent}>
      {currentCycle ? (
        <>
          <View style={styles.paymentsHeader}>
            <Text style={styles.paymentsTitle}>
              Payments for Cycle #{currentCycle.cycleIndex}
            </Text>
            
            <View style={styles.paymentsSummary}>
              <Text style={styles.paidCount}>
                {payments.filter(p => p.paid).length} / {payments.length} Paid
              </Text>
              <View style={styles.progressBarContainer}>
                <View 
                  style={[
                    styles.progressBar, 
                    { width: `${(payments.filter(p => p.paid).length / payments.length) * 100}%` }
                  ]} 
                />
              </View>
            </View>
          </View>
          
          <FlatList
            data={payments}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <View style={styles.paymentItem}>
                <View style={styles.paymentMemberInfo}>
                  <View style={styles.paymentAvatar}>
                    <Text style={styles.paymentInitial}>
                      {item.user.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  
                  <View>
                    <Text style={styles.paymentName}>{item.user.name}</Text>
                    <Text style={styles.paymentAmount}>${item.amount}</Text>
                  </View>
                </View>
                
                {item.paid ? (
                  <View style={styles.paidBadge}>
                    <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                    <Text style={styles.paidText}>Paid</Text>
                  </View>
                ) : (
                  item.userId.toString() === userId ? (
                    <TouchableOpacity 
                      style={styles.payNowButton}
                      onPress={() => Alert.alert('Pay Now', 'This would open a payment flow')}
                    >
                      <Text style={styles.payNowText}>Pay Now</Text>
                    </TouchableOpacity>
                  ) : isAdmin ? (
                    <TouchableOpacity 
                      style={styles.markPaidButton}
                      onPress={() => handleMarkPaid(item.id)}
                    >
                      <Text style={styles.markPaidText}>Mark Paid</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingText}>Pending</Text>
                    </View>
                  )
                )}
              </View>
            )}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4CAF50']} />
            }
          />
        </>
      ) : (
        <View style={styles.emptyListContainer}>
          <MaterialCommunityIcons name="cash-multiple" size={40} color="#ccc" />
          <Text style={styles.emptyListText}>No payment data available</Text>
          <Text style={styles.emptyListSubtext}>
            Create a cycle to start tracking payments
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{groupName}</Text>
        {isAdmin && (
          <TouchableOpacity 
            style={styles.headerOptionButton}
            onPress={() => {
              Alert.alert(
                'Group Options', 
                'Choose an action',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Edit Group', onPress: () => navigation.navigate('EditGroup', { groupId }) },
                  { 
                    text: 'Delete Group', 
                    style: 'destructive',
                    onPress: () => {
                      Alert.alert(
                        'Delete Group',
                        'Are you sure you want to delete this group? This action cannot be undone.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { 
                            text: 'Delete', 
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                await api.delete(`/groups/${groupId}`);
                                Alert.alert('Success', 'Group deleted successfully');
                                navigation.navigate('Groups');
                              } catch (error) {
                                console.error('Error deleting group:', error);
                                Alert.alert('Error', 'Failed to delete group');
                              }
                            }
                          }
                        ]
                      );
                    }
                  }
                ]
              );
            }}
          >
            <Ionicons name="ellipsis-vertical" size={20} color="#333" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'overview' && styles.activeTabButton]}
          onPress={() => setActiveTab('overview')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'overview' && styles.activeTabButtonText]}>
            Overview
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'members' && styles.activeTabButton]}
          onPress={() => setActiveTab('members')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'members' && styles.activeTabButtonText]}>
            Members
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'cycles' && styles.activeTabButton]}
          onPress={() => setActiveTab('cycles')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'cycles' && styles.activeTabButtonText]}>
            Cycles
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'payments' && styles.activeTabButton]}
          onPress={() => setActiveTab('payments')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'payments' && styles.activeTabButtonText]}>
            Payments
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Tab Content */}
      {activeTab === 'overview' && renderOverviewTab()}
      {activeTab === 'members' && renderMembersTab()}
      {activeTab === 'cycles' && renderCyclesTab()}
      {activeTab === 'payments' && renderPaymentsTab()}

      {/* Invite Modal */}
<InviteModal
  visible={inviteModalVisible}
  onClose={() => setInviteModalVisible(false)}
  groupId={groupId}
  groupName={groupName}
/>
      
      {/* Add Member Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Member</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
  <Text style={styles.modalLabel}>
    Enter the phone number of the member you want to add:
  </Text>
  
  <View style={styles.inputContainer}>
    <Ionicons name="call-outline" size={20} color="#666" style={styles.inputIcon} />
    <TextInput
      style={styles.input}
      placeholder="Phone number with country code"
      keyboardType="phone-pad"
      autoCapitalize="none"
      value={invitePhone}
      onChangeText={setInvitePhone}
    />
  </View>
  
  <Text style={styles.modalHelperText}>
    They will receive a WhatsApp invitation to join this group
  </Text>
  
  <TouchableOpacity 
    style={styles.modalButton}
    onPress={handleAddMember}
  >
    <Text style={styles.modalButtonText}>Send Invitation</Text>
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
    flex: 1,
    textAlign: 'center',
  },
  headerOptionButton: {
    padding: 5,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: '#4CAF50',
  },
  tabButtonText: {
    fontSize: 14,
    color: '#666',
  },
  activeTabButtonText: {
    color: '#4CAF50',
    fontWeight: '500',
  },
  tabContent: {
    flex: 1,
  },
  
  // Overview Tab Styles
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 14,
    color: '#4CAF50',
    marginLeft: 4,
  },
  groupInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoItem: {
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  descriptionContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  descriptionLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 14,
    color: '#4CAF50',
    marginLeft: 4,
  },
  cycleContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
  },
  cycleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cycleTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#E8F5E9',
  },
  activeStatus: {
    backgroundColor: '#E8F5E9',
  },
  completedStatus: {
    backgroundColor: '#E3F2FD',
  },
  pendingStatus: {
    backgroundColor: '#FFF8E1',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4CAF50',
  },
  cycleDetails: {
    marginBottom: 8,
  },
  cycleDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  cycleDetailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
  paymentProgress: {
    marginTop: 8,
  },
  progressLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    marginBottom: 4,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#4CAF50',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
  },
  viewMoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  viewMoreText: {
    fontSize: 14,
    color: '#4CAF50',
    marginRight: 4,
  },
  emptyCycleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyCycleText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    marginBottom: 12,
  },
  emptyCycleButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  emptyCycleButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  activityIcon: {
    marginRight: 10,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    color: '#333',
  },
  activityName: {
    fontWeight: '500',
  },
  activityDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  noActivityText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    padding: 16,
  },
  viewAllButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  viewAllText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  
  // Members Tab Styles
  membersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  membersTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  addMemberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  addMemberText: {
    fontSize: 14,
    color: '#4CAF50',
    marginLeft: 4,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  memberAvatarContainer: {
    marginRight: 12,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
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
  adminBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  adminText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  memberOptionsButton: {
    padding: 6,
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyListText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    marginBottom: 8,
  },
  emptyListSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyListButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  emptyListButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  
  // Cycles Tab Styles
  cyclesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  cyclesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  createCycleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  createCycleText: {
    fontSize: 14,
    color: '#4CAF50',
    marginLeft: 4,
  },
  cycleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  cycleItemHeader: {
    flex: 1,
  },
  cycleItemTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  cycleItemDetails: {
    flex: 2,
  },
  cycleItemDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  cycleItemDetailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
  cycleItemArrow: {
    marginLeft: 10,
  },
  
  // Payments Tab Styles
  paymentsHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  paymentsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  paymentsSummary: {
    marginTop: 8,
  },
  paidCount: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  paymentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  paymentMemberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
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
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  paymentName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  paymentAmount: {
    fontSize: 14,
    color: '#666',
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

  disabledButton: {
    backgroundColor: '#E0E0E0',
    opacity: 0.7,
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
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
  modalLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
  },

  memberProgressContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  memberProgressTextContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  memberProgressText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  memberProgressPercentage: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  memberProgressBarBackground: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
  },
  memberProgressBar: {
    height: 6,
    backgroundColor: '#4CAF50',
    borderRadius: 3,
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 50,
    color: '#333',
  },
  modalHelperText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 16,
  },
  modalButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default GroupDetailScreen;