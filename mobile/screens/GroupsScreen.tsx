import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  TouchableOpacity, 
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Image,
  StatusBar,
  Animated,
  Modal,
  Dimensions
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

interface Group {
  id: number;
  name: string;
  contribution: number;
  frequency: string;
  membersCount?: number;
  nextPaymentDue?: string;
  currentCycle?: number;
  isAdmin?: boolean;
}

interface GroupsScreenProps {
  navigation: any;
}

export default function GroupsScreen({ navigation }: GroupsScreenProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userName, setUserName] = useState('');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sortBy, setSortBy] = useState('name'); // 'name', 'newest', 'contribution'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc', 'desc'
  
  const scale = new Animated.Value(1);
  const windowWidth = Dimensions.get('window').width;

  useFocusEffect(
    useCallback(() => {
      fetchGroups();
      fetchUserName();
      
      return () => {
        // Cleanup if needed
      };
    }, [])
  );

  const fetchUserName = async () => {
    try {
      const name = await AsyncStorage.getItem('userName');
      if (name) {
        setUserName(name);
      }
    } catch (error) {
      console.error('Error fetching user name:', error);
    }
  };

  const fetchGroups = async () => {
    setLoading(true);
    try {
      // Fetch groups
      const groupsResponse = await api.get('/groups');
      const fetchedGroups = groupsResponse.data;
      
      // For each group, fetch membership info to determine if user is admin
      // and to get member counts
      const groupsWithDetails = await Promise.all(
        fetchedGroups.map(async (group: Group) => {
          try {
            // Get the user's ID
            const userId = await AsyncStorage.getItem('userId');
            
            // Fetch memberships for this group
            const membershipsResponse = await api.get('/memberships', {
              params: { groupId: group.id }
            });
            
            const memberships = membershipsResponse.data;
            const membersCount = memberships.length;
            
            // Check if current user is admin
            const userMembership = memberships.find(
              (m: any) => m.userId === parseInt(userId || '0', 10)
            );
            
            const isAdmin = userMembership ? userMembership.role === 'admin' : false;
            
            // Fetch cycles to determine current cycle and next payment
            let currentCycle = 0;
            let nextPaymentDue = 'Not set';
            
            try {
              const cyclesResponse = await api.get(`/groups/${group.id}/cycles`);
              const cycles = cyclesResponse.data;
              
              if (cycles.length > 0) {
                currentCycle = Math.max(...cycles.map((c: any) => c.cycleIndex));
                
                // Determine next payment due date (simplified for now)
                const latestCycle = cycles.sort((a: any, b: any) => 
                  new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
                )[0];
                
                if (latestCycle && latestCycle.startDate) {
                  const dueDate = new Date(latestCycle.startDate);
                  nextPaymentDue = dueDate.toLocaleDateString();
                }
              }
            } catch (error) {
              console.error(`Error fetching cycles for group ${group.id}:`, error);
            }
            
            return {
              ...group,
              membersCount,
              isAdmin,
              currentCycle,
              nextPaymentDue
            };
          } catch (error) {
            console.error(`Error fetching details for group ${group.id}:`, error);
            return group;
          }
        })
      );
      
      setGroups(groupsWithDetails);
      applyFilters(groupsWithDetails, searchQuery, sortBy, sortOrder);
    } catch (error) {
      console.error('Error fetching groups:', error);
      Alert.alert('Error', 'Failed to fetch groups');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchGroups();
  };

  const applyFilters = (
    groupsToFilter: Group[], 
    query: string, 
    sort: string, 
    order: string
  ) => {
    // First apply search query
    let filtered = [...groupsToFilter];
    
    if (query.trim()) {
      filtered = filtered.filter(group => 
        group.name.toLowerCase().includes(query.toLowerCase())
      );
    }
    
    // Then sort
    filtered.sort((a, b) => {
      if (sort === 'name') {
        return order === 'asc' 
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      } else if (sort === 'contribution') {
        return order === 'asc'
          ? (a.contribution || 0) - (b.contribution || 0)
          : (b.contribution || 0) - (a.contribution || 0);
      } else if (sort === 'newest') {
        // Using ID as a proxy for creation time
        return order === 'asc' ? a.id - b.id : b.id - a.id;
      }
      return 0;
    });
    
    setFilteredGroups(filtered);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    applyFilters(groups, query, sortBy, sortOrder);
  };

  const applySort = (sort: string, order: string) => {
    setSortBy(sort);
    setSortOrder(order);
    applyFilters(groups, searchQuery, sort, order);
    setFilterModalVisible(false);
  };

  const handleGroupPress = (group: Group) => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      navigation.navigate('GroupDetail', { groupId: group.id, groupName: group.name });
    });
  };

  const handleDeleteGroup = (groupId: number) => {
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
              fetchGroups(); // Refresh the list
              Alert.alert('Success', 'Group deleted successfully');
            } catch (error) {
              console.error('Error deleting group:', error);
              Alert.alert('Error', 'Failed to delete group');
            }
          }
        },
      ]
    );
  };

  const renderGroup = ({ item }: { item: Group }) => (
    <Animated.View style={[styles.groupCard, { transform: [{ scale }] }]}>
      <TouchableOpacity 
        style={styles.groupCardContent}
        onPress={() => handleGroupPress(item)}
        activeOpacity={0.8}
      >
        <View style={styles.groupHeader}>
          <View style={styles.groupHeaderLeft}>
            <View style={styles.groupIcon}>
              <Text style={styles.groupIconText}>{item.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={styles.groupName}>{item.name}</Text>
              <Text style={styles.groupFrequency}>
                {item.frequency || 'Monthly'} · {item.contribution || 0} per cycle
              </Text>
            </View>
          </View>
          
          {item.isAdmin && (
            <TouchableOpacity 
              style={styles.optionsButton}
              onPress={() => {
                Alert.alert(
                  'Group Options',
                  'Choose an action',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Edit Group', onPress: () => navigation.navigate('EditGroup', { groupId: item.id }) },
                    { text: 'Delete Group', onPress: () => handleDeleteGroup(item.id), style: 'destructive' }
                  ]
                );
              }}
            >
              <Ionicons name="ellipsis-vertical" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.divider} />
        
        <View style={styles.groupStats}>
          <View style={styles.statItem}>
            <Ionicons name="people-outline" size={18} color="#666" />
            <Text style={styles.statText}>{item.membersCount || 0} members</Text>
          </View>
          
          <View style={styles.statItem}>
            <Ionicons name="repeat-outline" size={18} color="#666" />
            <Text style={styles.statText}>Cycle {item.currentCycle || 0}</Text>
          </View>
          
          <View style={styles.statItem}>
            <Ionicons name="calendar-outline" size={18} color="#666" />
            <Text style={styles.statText}>Due: {item.nextPaymentDue}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <MaterialCommunityIcons name="account-group-outline" size={80} color="#ccc" />
      <Text style={styles.emptyStateTitle}>No Groups Found</Text>
      <Text style={styles.emptyStateText}>
        {searchQuery.trim() 
          ? "No groups match your search criteria." 
          : "You haven't created or joined any groups yet."}
      </Text>
      <TouchableOpacity 
        style={styles.createButton}
        onPress={() => navigation.navigate('CreateGroup')}
      >
        <Text style={styles.createButtonText}>Create Your First Group</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#f8f9fa" barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.userName}>{userName || 'User'}</Text>
        </View>
        <TouchableOpacity 
          style={styles.profileButton}
          onPress={() => navigation.navigate('Profile')}
        >
          <Ionicons name="person-circle-outline" size={32} color="#4CAF50" />
        </TouchableOpacity>
      </View>
      
      {/* Search and Filter */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search-outline" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search groups..."
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
        
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => setFilterModalVisible(true)}
        >
          <Ionicons name="options-outline" size={22} color="#4CAF50" />
        </TouchableOpacity>
      </View>
      
      {/* Group List */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading your groups...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredGroups}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderGroup}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#4CAF50']}
              tintColor="#4CAF50"
            />
          }
        />
      )}
      
      {/* Create Group FAB */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => navigation.navigate('CreateGroup')}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>
      
      {/* Filter Modal */}
      <Modal
        visible={filterModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setFilterModalVisible(false)}
        >
          <View 
            style={[styles.modalContainer, { width: windowWidth - 40 }]}
            onStartShouldSetResponder={() => true}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sort Groups</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.sortOptions}>
              <TouchableOpacity 
                style={[
                  styles.sortOption, 
                  sortBy === 'name' && sortOrder === 'asc' && styles.selectedSort
                ]}
                onPress={() => applySort('name', 'asc')}
              >
                <Text style={styles.sortText}>Name (A to Z)</Text>
                {sortBy === 'name' && sortOrder === 'asc' && (
                  <Ionicons name="checkmark" size={20} color="#4CAF50" />
                )}
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.sortOption, 
                  sortBy === 'name' && sortOrder === 'desc' && styles.selectedSort
                ]}
                onPress={() => applySort('name', 'desc')}
              >
                <Text style={styles.sortText}>Name (Z to A)</Text>
                {sortBy === 'name' && sortOrder === 'desc' && (
                  <Ionicons name="checkmark" size={20} color="#4CAF50" />
                )}
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.sortOption, 
                  sortBy === 'newest' && sortOrder === 'desc' && styles.selectedSort
                ]}
                onPress={() => applySort('newest', 'desc')}
              >
                <Text style={styles.sortText}>Newest First</Text>
                {sortBy === 'newest' && sortOrder === 'desc' && (
                  <Ionicons name="checkmark" size={20} color="#4CAF50" />
                )}
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.sortOption, 
                  sortBy === 'newest' && sortOrder === 'asc' && styles.selectedSort
                ]}
                onPress={() => applySort('newest', 'asc')}
              >
                <Text style={styles.sortText}>Oldest First</Text>
                {sortBy === 'newest' && sortOrder === 'asc' && (
                  <Ionicons name="checkmark" size={20} color="#4CAF50" />
                )}
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.sortOption, 
                  sortBy === 'contribution' && sortOrder === 'desc' && styles.selectedSort
                ]}
                onPress={() => applySort('contribution', 'desc')}
              >
                <Text style={styles.sortText}>Highest Contribution</Text>
                {sortBy === 'contribution' && sortOrder === 'desc' && (
                  <Ionicons name="checkmark" size={20} color="#4CAF50" />
                )}
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.sortOption, 
                  sortBy === 'contribution' && sortOrder === 'asc' && styles.selectedSort
                ]}
                onPress={() => applySort('contribution', 'asc')}
              >
                <Text style={styles.sortText}>Lowest Contribution</Text>
                {sortBy === 'contribution' && sortOrder === 'asc' && (
                  <Ionicons name="checkmark" size={20} color="#4CAF50" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 10,
  },
  welcomeText: {
    fontSize: 14,
    color: '#666',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  profileButton: {
    padding: 5,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 10,
    alignItems: 'center',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 44,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    color: '#333',
  },
  filterButton: {
    marginLeft: 10,
    height: 44,
    width: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
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
  listContainer: {
    padding: 16,
    paddingBottom: 80,
  },
  groupCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  groupCardContent: {
    padding: 16,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  groupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  groupIconText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  groupName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  groupFrequency: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  optionsButton: {
    padding: 5,
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 12,
  },
  groupStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 5,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#4CAF50',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  sortOptions: {
    paddingTop: 8,
  },
  sortOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  selectedSort: {
    backgroundColor: '#F1F8E9',
  },
  sortText: {
    fontSize: 16,
    color: '#333',
  },
});