import React, { useState, useEffect, useCallback } from 'react';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { StyleSheet, FlatList, View, Platform, Alert, TouchableOpacity, TextInput, Modal, Button, ScrollView, Text } from 'react-native';
import { initDb, fetchDreams, Dream, FetchDreamsOptions } from '@/services/db';
import { useRouter, useFocusEffect, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

export default function JournalScreen() {
  const router = useRouter();
  const [dbInitialized, setDbInitialized] = useState(false);
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);

  // States for active filters and sort
  const [activeFilters, setActiveFilters] = useState<Partial<FetchDreamsOptions>>({});
  const [activeSort, setActiveSort] = useState<Partial<FetchDreamsOptions>>({ sortBy: 'date', sortOrder: 'DESC' });

  // Temporary states for modal
  const [tempSearchQuery, setTempSearchQuery] = useState(''); // For search bar inside modal if we move it
  const [tempDateFilter, setTempDateFilter] = useState<string | { startDate: string; endDate: string } | undefined>(undefined);
  const [tempLucidityLevelFilter, setTempLucidityLevelFilter] = useState<string | undefined>(undefined);
  const [tempTagsFilter, setTempTagsFilter] = useState<string[] | undefined>(undefined); // Store as array
  const [tempTagsInput, setTempTagsInput] = useState(''); // For comma-separated input
  const [tempSortBy, setTempSortBy] = useState<'date' | 'title'>('date');
  const [tempSortOrder, setTempSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  // For DateTimePicker
  const [showDatePicker, setShowDatePicker] = useState<'startDate' | 'endDate' | 'singleDate' | false>(false);
  const [selectedDateType, setSelectedDateType] = useState<'singleDate' | 'range'>('singleDate'); // Changed 'specific' to 'singleDate' for consistency
  const [specificDate, setSpecificDate] = useState<Date | undefined>(new Date());
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());


  const loadDreams = useCallback(async (options: FetchDreamsOptions = {}) => {
    if (!dbInitialized) return;
    try {
      console.log("Loading dreams with options:", options);
      const fetchedDreams = await fetchDreams(options);
      setDreams(fetchedDreams);
    } catch (error) {
      console.error("Failed to fetch dreams:", error);
      Alert.alert("Error", "Failed to load dreams.");
    }
  }, [dbInitialized]);

  useEffect(() => {
    // Initial load and load on filter/sort/search change
    const currentOptions: FetchDreamsOptions = {
      searchQuery: searchQuery || undefined, // Ensure undefined if empty
      ...activeFilters,
      ...activeSort,
    };
    if (dbInitialized) {
        loadDreams(currentOptions);
    }
  }, [dbInitialized, searchQuery, activeFilters, activeSort, loadDreams]);


  useEffect(() => {
    const initialize = async () => {
      try {
        await initDb();
        setDbInitialized(true);
        console.log("Database initialized successfully from JournalScreen");
      } catch (error) {
        console.error("Failed to initialize database:", error);
        Alert.alert("Database Error", "Failed to initialize the database.");
      }
    };
    initialize();
  }, []);

  useEffect(() => {
    if (dbInitialized) {
      loadDreams();
    }
  }, [dbInitialized, loadDreams]);

  // Refetch dreams when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (dbInitialized) {
        console.log("Journal screen focused, reloading dreams with current filters.");
        const currentOptions: FetchDreamsOptions = {
          searchQuery: searchQuery || undefined,
          ...activeFilters,
          ...activeSort,
        };
        loadDreams(currentOptions);
      }
    }, [dbInitialized, loadDreams, searchQuery, activeFilters, activeSort])
  );

  const handleAddNewDream = () => {
    router.push('/dream/new' as any);
  };

  const openFilterModal = () => {
    // Initialize temp states from active states
    setTempDateFilter(activeFilters.dateFilter);
    if (activeFilters.dateFilter) {
        if (typeof activeFilters.dateFilter === 'string') {
            setSelectedDateType('singleDate');
            setSpecificDate(new Date(activeFilters.dateFilter));
        } else {
            setSelectedDateType('range');
            setStartDate(new Date(activeFilters.dateFilter.startDate));
            setEndDate(new Date(activeFilters.dateFilter.endDate));
        }
    } else {
        setSelectedDateType('singleDate'); // Default
        setSpecificDate(new Date());
        setStartDate(new Date());
        setEndDate(new Date());
    }

    setTempLucidityLevelFilter(activeFilters.lucidityLevelFilter);
    setTempTagsInput(activeFilters.tagsFilter ? activeFilters.tagsFilter.join(', ') : '');
    setTempTagsFilter(activeFilters.tagsFilter);
    setTempSortBy(activeSort.sortBy || 'date');
    setTempSortOrder(activeSort.sortOrder || 'DESC');
    setIsModalVisible(true);
  };

  const handleApplyFiltersAndSort = () => {
    const newFilters: Partial<FetchDreamsOptions> = {};
    if (tempDateFilter) newFilters.dateFilter = tempDateFilter;
    if (tempLucidityLevelFilter) newFilters.lucidityLevelFilter = tempLucidityLevelFilter;
    if (tempTagsFilter && tempTagsFilter.length > 0) newFilters.tagsFilter = tempTagsFilter;
    
    setActiveFilters(newFilters);
    setActiveSort({ sortBy: tempSortBy, sortOrder: tempSortOrder });
    setIsModalVisible(false);
    // loadDreams will be called by useEffect watching activeFilters and activeSort
  };

  const handleClearFiltersAndSort = () => {
    setSearchQuery('');
    setActiveFilters({});
    setActiveSort({ sortBy: 'date', sortOrder: 'DESC' });
    // Reset temp states for modal as well
    setTempDateFilter(undefined);
    setSpecificDate(new Date());
    setStartDate(new Date());
    setEndDate(new Date());
    setSelectedDateType('singleDate');
    setTempLucidityLevelFilter(undefined);
    setTempTagsFilter(undefined);
    setTempTagsInput('');
    setTempSortBy('date');
    setTempSortOrder('DESC');
    setIsModalVisible(false);
     // loadDreams will be called by useEffect
  };

  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(false); // Hide picker
    if (selectedDate) {
        const isoDate = selectedDate.toISOString().split('T')[0]; // Format to YYYY-MM-DD
        if (showDatePicker === 'singleDate') {
            setSpecificDate(selectedDate);
            setTempDateFilter(isoDate);
        } else if (showDatePicker === 'startDate') {
            setStartDate(selectedDate);
            if (endDate) {
                 setTempDateFilter({ startDate: isoDate, endDate: endDate.toISOString().split('T')[0] });
            }
        } else if (showDatePicker === 'endDate') {
            setEndDate(selectedDate);
            if (startDate) {
                setTempDateFilter({ startDate: startDate.toISOString().split('T')[0], endDate: isoDate });
            }
        }
    }
  };

  const lucidityLevels = ["Non-lucid", "Semi-lucid", "Fully lucid", "1", "2", "3", "4", "5"];


  return (
    <>
      <Stack.Screen
        options={{
          title: 'Dream Journal',
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity onPress={openFilterModal} style={{ marginRight: 15 }}>
                <Ionicons name="filter-outline" size={26} color={Platform.OS === 'ios' ? '#007AFF' : 'black'} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAddNewDream} style={{ marginRight: 15 }}>
                <Ionicons name="add-circle-outline" size={28} color={Platform.OS === 'ios' ? '#007AFF' : 'black'} />
              </TouchableOpacity>
            </View>
          )
        }}
      />
      <ThemedView style={styles.container}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search dreams by title or description..."
          value={searchQuery}
          onChangeText={setSearchQuery} // useEffect will trigger loadDreams
        />

        {dreams.length === 0 && dbInitialized && (
          <ThemedText style={styles.emptyMessage}>No dreams found. Try adjusting filters or add a new dream!</ThemedText>
        )}
        {!dbInitialized && (
           <ThemedText style={styles.emptyMessage}>Initializing database...</ThemedText>
        )}
        <FlatList
          data={dreams}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => router.push({ pathname: `../dream/[id]`, params: { id: item.id.toString() } })}>
              <View style={styles.dreamItem}>
                <ThemedText type="defaultSemiBold">{item.title || "Untitled Dream"}</ThemedText>
                <ThemedText style={styles.dateText}>{new Date(item.date).toLocaleDateString()} - Lucidity: {item.lucidityLevel || 'N/A'}</ThemedText>
                {item.description ? <ThemedText style={styles.descriptionText} numberOfLines={2} ellipsizeMode="tail">{item.description}</ThemedText> : null}
                {item.tags && item.tags.length > 0 && <ThemedText style={styles.tagsText}>Tags: {item.tags.join(', ')}</ThemedText>}
              </View>
            </TouchableOpacity>
          )}
          style={styles.list}
        />
      </ThemedView>

      {/* Floating "+" Button */}
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={handleAddNewDream}
        activeOpacity={0.8}
        accessibilityLabel="Add new dream"
      >
        <Ionicons name="add" size={36} color="#fff" />
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
            <ThemedText style={styles.modalTitle}>Filter & Sort</ThemedText>

            {/* Date Filter */}
            <ThemedText style={styles.label}>Filter by Date:</ThemedText>
            <View style={styles.radioContainer}>
                <TouchableOpacity onPress={() => setSelectedDateType('singleDate')} style={styles.radioButton}>
                    <Ionicons name={selectedDateType === 'singleDate' ? "radio-button-on" : "radio-button-off"} size={20} />
                    <Text> Single Date</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSelectedDateType('range')} style={styles.radioButton}>
                    <Ionicons name={selectedDateType === 'range' ? "radio-button-on" : "radio-button-off"} size={20} />
                    <Text> Date Range</Text>
                </TouchableOpacity>
            </View>

            {selectedDateType === 'singleDate' && (
                <Button onPress={() => setShowDatePicker('singleDate')} title={`Date: ${specificDate ? specificDate.toLocaleDateString() : 'Select Date'}`} />
            )}
            {selectedDateType === 'range' && (
                <>
                    <Button onPress={() => setShowDatePicker('startDate')} title={`Start: ${startDate ? startDate.toLocaleDateString() : 'Select Start Date'}`} />
                    <Button onPress={() => setShowDatePicker('endDate')} title={`End: ${endDate ? endDate.toLocaleDateString() : 'Select End Date'}`} />
                </>
            )}
             {showDatePicker && (
                <DateTimePicker
                    value={(showDatePicker === 'singleDate' ? specificDate : (showDatePicker === 'startDate' ? startDate : endDate)) || new Date()}
                    mode="date"
                    display="default"
                    onChange={onDateChange}
                />
            )}
            <Button title="Clear Date Filter" onPress={() => { setTempDateFilter(undefined); setSpecificDate(new Date()); setStartDate(new Date()); setEndDate(new Date()); setSelectedDateType('singleDate');}} />


            {/* Lucidity Filter */}
            <ThemedText style={styles.label}>Filter by Lucidity Level:</ThemedText>
            <View style={styles.optionsContainer}>
              {lucidityLevels.map(level => (
                <TouchableOpacity
                  key={level}
                  style={[styles.optionButton, tempLucidityLevelFilter === level && styles.optionButtonSelected]}
                  onPress={() => setTempLucidityLevelFilter(level === tempLucidityLevelFilter ? undefined : level)}
                >
                  <ThemedText style={tempLucidityLevelFilter === level && styles.optionButtonSelectedText}>{level}</ThemedText>
                </TouchableOpacity>
              ))}
            </View>
             <Button title="Clear Lucidity Filter" onPress={() => setTempLucidityLevelFilter(undefined)} />


            {/* Tags Filter */}
            <ThemedText style={styles.label}>Filter by Tags (comma-separated):</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="e.g., flying, exam, recurring"
              value={tempTagsInput}
              onChangeText={(text) => {
                setTempTagsInput(text);
                setTempTagsFilter(text.split(',').map(tag => tag.trim()).filter(tag => tag));
              }}
            />
            <Button title="Clear Tags Filter" onPress={() => {setTempTagsInput(''); setTempTagsFilter(undefined);}} />


            {/* Sort Options */}
            <ThemedText style={styles.label}>Sort by:</ThemedText>
            <View style={styles.radioContainer}>
                <TouchableOpacity onPress={() => setTempSortBy('date')} style={styles.radioButton}>
                    <Ionicons name={tempSortBy === 'date' ? "radio-button-on" : "radio-button-off"} size={20} />
                    <Text> Date</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setTempSortBy('title')} style={styles.radioButton}>
                    <Ionicons name={tempSortBy === 'title' ? "radio-button-on" : "radio-button-off"} size={20} />
                    <Text> Title</Text>
                </TouchableOpacity>
            </View>

            <ThemedText style={styles.label}>Sort Order:</ThemedText>
             <View style={styles.radioContainer}>
                <TouchableOpacity onPress={() => setTempSortOrder('ASC')} style={styles.radioButton}>
                    <Ionicons name={tempSortOrder === 'ASC' ? "radio-button-on" : "radio-button-off"} size={20} />
                    <Text> Ascending</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setTempSortOrder('DESC')} style={styles.radioButton}>
                    <Ionicons name={tempSortOrder === 'DESC' ? "radio-button-on" : "radio-button-off"} size={20} />
                    <Text> Descending</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <Button title="Apply" onPress={handleApplyFiltersAndSort} />
              <Button title="Clear All Filters & Sort" onPress={handleClearFiltersAndSort} color="orange"/>
              <Button title="Cancel" onPress={() => setIsModalVisible(false)} color="gray" />
            </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Platform.OS === 'web' ? 20 : 10,
  },
  searchInput: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 20,
    marginHorizontal: 15,
    marginTop: 50,
    marginBottom: 10,
    backgroundColor: 'white', // For better visibility
  },
  list: {
    width: '100%',
    // maxWidth: 600, // Max width for larger screens
    // alignSelf: 'center',
  },
  dreamItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: "#000", // Basic shadow for depth
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.20,
    shadowRadius: 1.41,
    elevation: 2,
  },
  dateText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  descriptionText: {
    fontSize: 14,
    color: '#333',
    marginTop: 4,
    marginBottom: 4,
  },
   tagsText: {
    fontSize: 12,
    color: '#007AFF', // Blue color for tags
    marginTop: 4,
    fontStyle: 'italic',
  },
  emptyMessage: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#777',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 15,
    marginBottom: 5,
  },
  input: { // Re-added for modal inputs
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  optionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 20,
    margin: 5,
  },
  optionButtonSelected: {
      backgroundColor: '#007AFF',
  },
  floatingButton: {
      position: 'absolute',
      right: 24,
      bottom: 100, // Move above tab bar
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: '#007AFF',
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      zIndex: 100,
  },
  radioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  optionButtonSelectedText: {
      color: 'white',
  },
  radioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
    paddingVertical: 5,
  }
});