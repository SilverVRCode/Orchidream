import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity, Platform, View } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Dream, fetchDreamById, updateDream } from '@/services/db';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

const LUCIDITY_LEVEL_OPTIONS = ["Non-lucid", "Semi-lucid", "Fully lucid"] as const;
type LucidityLevelOption = typeof LUCIDITY_LEVEL_OPTIONS[number];

export default function EditDreamScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [lucidityLevel, setLucidityLevel] = useState<LucidityLevelOption | null>(null);
  
  const [tags, setTags] = useState<string[]>([]);
  const [currentTag, setCurrentTag] = useState('');

  const [emotions, setEmotions] = useState<string[]>([]);
  const [currentEmotion, setCurrentEmotion] = useState('');

  const [lucidityTriggers, setLucidityTriggers] = useState<string[]>([]);
  const [currentLucidityTrigger, setCurrentLucidityTrigger] = useState('');

  const [realityChecks, setRealityChecks] = useState<{ type: string; outcome: string }[]>([]);
  const [currentRealityCheckType, setCurrentRealityCheckType] = useState('');
  const [currentRealityCheckOutcome, setCurrentRealityCheckOutcome] = useState('');

  // Date picker state
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    const loadDream = async () => {
      if (!id) {
        setError('Dream ID is missing.');
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        // ID is already a string from useLocalSearchParams
        const fetchedDream = await fetchDreamById(parseInt(id));
        if (fetchedDream) {
          setTitle(fetchedDream.title || '');
          setDescription(fetchedDream.description || '');
          setLucidityLevel((fetchedDream.lucidityLevel as LucidityLevelOption) || undefined); // Use undefined instead of null
          setTags(fetchedDream.tags || []);
          setEmotions(fetchedDream.emotions || []);
          setLucidityTriggers(fetchedDream.lucidityTriggers || []);
          setRealityChecks(fetchedDream.realityChecks || []);
          setDate(new Date(fetchedDream.date));
        } else {
          setError('Dream not found.');
        }
      } catch (e: any) {
        console.error('Failed to fetch dream for editing:', e);
        setError(`Failed to load dream: ${e.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    loadDream();
  }, [id]);

  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    const currentDate = selectedDate || date;
    setShowDatePicker(Platform.OS === 'ios');
    setDate(currentDate);
  };

  const showDatepicker = () => {
    setShowDatePicker(true);
  };

  // Generic handler for adding items to string arrays (tags, emotions, triggers)
  const handleAddItem = (
    item: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    currentSetter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    if (item.trim()) {
      setter(prev => [...prev, item.trim()]);
      currentSetter('');
    }
  };

  // Generic handler for removing items from string arrays
  const handleRemoveItem = (
    index: number,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter(prev => prev.filter((_, i) => i !== index));
  };

  // Handlers for Reality Checks
  const handleAddRealityCheck = () => {
    if (currentRealityCheckType.trim() && currentRealityCheckOutcome.trim()) {
      setRealityChecks(prev => [
        ...prev,
        { type: currentRealityCheckType.trim(), outcome: currentRealityCheckOutcome.trim() }
      ]);
      setCurrentRealityCheckType('');
      setCurrentRealityCheckOutcome('');
    }
  };

  const handleRemoveRealityCheck = (index: number) => {
    setRealityChecks(prev => prev.filter((_, i) => i !== index));
  };


  const handleSaveChanges = async () => {
    if (!id) {
      Alert.alert('Error', 'Dream ID is missing.');
      return;
    }
    // ID is already a string from useLocalSearchParams

    const dreamToSave: Partial<Omit<Dream, '_id' | 'id'>> = { // Use _id and id for Omit
      title,
      description,
      date: date.toISOString(),
      lucidityLevel: lucidityLevel || undefined, // Use undefined instead of null
      tags: tags.length > 0 ? tags : undefined, // Ensure undefined for empty arrays
      emotions: emotions.length > 0 ? emotions : undefined,
      lucidityTriggers: lucidityTriggers.length > 0 ? lucidityTriggers : undefined,
      realityChecks: realityChecks.length > 0 ? realityChecks : undefined,
    };
    
    // No need for this complex loop, as undefined values will be omitted by Mongoose update
    // Object.keys(dreamToSave).forEach(key => {
    //     const typedKey = key as keyof typeof dreamToSave;
    //     if (dreamToSave[typedKey] === undefined ||
    //         (Array.isArray(dreamToSave[typedKey]) && (dreamToSave[typedKey] as any[]).length === 0 && (key === 'tags' || key === 'emotions' || key === 'lucidityTriggers' || key === 'realityChecks'))) {
    //       // Ensure empty arrays are stored as null or empty JSON array based on db.ts logic
    //       // db.ts stringifies, so an empty array becomes '[]' which is fine.
    //       // For lucidityLevel, if it's null, it's fine.
    //     } else if (dreamToSave[typedKey] === undefined) {
    //          delete dreamToSave[typedKey];
    //     }
    // });

    try {
      await updateDream(parseInt(id), dreamToSave);
      Alert.alert('Success', 'Dream updated successfully.');
      router.replace({ pathname: `/dream/[id]`, params: { id: id, updated: 'true' } } as any); // Use id directly
    } catch (e: any) {
      console.error('Failed to update dream:', e);
      Alert.alert('Error', `Failed to update dream: ${e.message}`);
    }
  };

  if (isLoading) {
    return <ThemedView style={styles.container}><ThemedText>Loading dream for editing...</ThemedText></ThemedView>;
  }

  if (error) {
    return <ThemedView style={styles.container}><ThemedText style={styles.errorText}>{error}</ThemedText></ThemedView>;
  }

  // Removed the !dream check as individual states are now used.
  // if (!dream || Object.keys(dream).length === 0) {
  //   return <ThemedView style={styles.container}><ThemedText>Dream data not available.</ThemedText></ThemedView>;
  // }


  const renderStringArrayInput = (
    label: string,
    items: string[],
    setItems: React.Dispatch<React.SetStateAction<string[]>>,
    currentItem: string,
    setCurrentItem: React.Dispatch<React.SetStateAction<string>>,
    placeholder: string
  ) => (
    <>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <View style={styles.tagInputContainer}>
        <TextInput
          style={styles.input}
          value={currentItem}
          onChangeText={setCurrentItem}
          placeholder={placeholder}
          onSubmitEditing={() => handleAddItem(currentItem, setItems, setCurrentItem)}
        />
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => handleAddItem(currentItem, setItems, setCurrentItem)}
        >
          <Ionicons name="add-circle" size={28} color="#007bff" />
        </TouchableOpacity>
      </View>
      <View style={styles.tagListContainer}>
        {items.map((item, index) => (
          <View key={index} style={styles.tagItem}>
            <ThemedText style={styles.tagText}>{item}</ThemedText>
            <TouchableOpacity onPress={() => handleRemoveItem(index, setItems)}>
              <Ionicons name="close-circle" size={20} color="#dc3545" />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </>
  );


  return (
    <>
      <Stack.Screen options={{ title: 'Edit Dream' }} />
      <ScrollView style={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <ThemedView style={styles.container}>
          <ThemedText style={styles.label}>Title</ThemedText>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Dream title"
          />

          <ThemedText style={styles.label}>Date</ThemedText>
          <TouchableOpacity onPress={showDatepicker} style={styles.dateDisplay}>
            <ThemedText style={styles.dateText}>{date.toLocaleDateString()}</ThemedText>
            <Ionicons name="calendar" size={24} color="#007bff" />
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              testID="dateTimePicker"
              value={date}
              mode="date"
              is24Hour={true}
              display="default"
              onChange={onDateChange}
            />
          )}

          <ThemedText style={styles.label}>Description</ThemedText>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your dream..."
            multiline
            numberOfLines={4}
          />

          <ThemedText style={styles.label}>Lucidity Level</ThemedText>
          <View style={styles.luciditySelectorContainer}>
            {LUCIDITY_LEVEL_OPTIONS.map(level => (
              <TouchableOpacity
                key={level}
                style={[
                  styles.lucidityOption,
                  lucidityLevel === level && styles.lucidityOptionSelected,
                ]}
                onPress={() => setLucidityLevel(level)}
              >
                <ThemedText
                  style={[
                    styles.lucidityOptionText,
                    lucidityLevel === level && styles.lucidityOptionTextSelected
                  ]}
                >
                  {level}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          {renderStringArrayInput(
            "Tags",
            tags,
            setTags,
            currentTag,
            setCurrentTag,
            "Add a tag (e.g., flying)"
          )}

          {renderStringArrayInput(
            "Emotions",
            emotions,
            setEmotions,
            currentEmotion,
            setCurrentEmotion,
            "Add an emotion (e.g., happy)"
          )}
          
          {renderStringArrayInput(
            "Lucidity Triggers",
            lucidityTriggers,
            setLucidityTriggers,
            currentLucidityTrigger,
            setCurrentLucidityTrigger,
            "Add a trigger (e.g., saw hands)"
          )}

          <ThemedText style={styles.label}>Reality Checks</ThemedText>
          <View style={styles.realityCheckInputContainer}>
            <TextInput
              style={[styles.input, styles.realityCheckInput]}
              value={currentRealityCheckType}
              onChangeText={setCurrentRealityCheckType}
              placeholder="Type (e.g., Hand check)"
            />
            <TextInput
              style={[styles.input, styles.realityCheckInput]}
              value={currentRealityCheckOutcome}
              onChangeText={setCurrentRealityCheckOutcome}
              placeholder="Outcome (e.g., Normal)"
            />
            <TouchableOpacity style={styles.addButton} onPress={handleAddRealityCheck}>
              <Ionicons name="add-circle" size={28} color="#007bff" />
            </TouchableOpacity>
          </View>
          <View style={styles.tagListContainer}>
            {realityChecks.map((rc, index) => (
              <View key={index} style={styles.tagItem}>
                <ThemedText style={styles.tagText}>{`${rc.type}: ${rc.outcome}`}</ThemedText>
                <TouchableOpacity onPress={() => handleRemoveRealityCheck(index)}>
                  <Ionicons name="close-circle" size={20} color="#dc3545" />
                </TouchableOpacity>
              </View>
            ))}
          </View>


          <TouchableOpacity style={styles.saveButton} onPress={handleSaveChanges}>
            <Ionicons name="save" size={20} color="white" />
            <ThemedText style={styles.saveButtonText}> Save Changes</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
    marginBottom: 10,
    backgroundColor: 'white',
    flex: 1, // For use in tagInputContainer
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#28a745',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 8,
    marginTop: 30,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
    marginLeft: 8,
  },
  dateDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
    backgroundColor: 'white',
  },
  dateText: {
    fontSize: 16,
  },
  luciditySelectorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  lucidityOption: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#007bff',
  },
  lucidityOptionSelected: {
    backgroundColor: '#007bff',
  },
  lucidityOptionText: {
    color: '#007bff',
    fontSize: 14,
  },
  lucidityOptionTextSelected: {
    color: 'white',
  },
  tagInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  addButton: {
    paddingLeft: 10, // Space between input and button
  },
  tagListContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
    borderRadius: 15,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginRight: 5,
    marginBottom: 5,
  },
  tagText: {
    fontSize: 14,
    marginRight: 5,
  },
  realityCheckInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  realityCheckInput: {
    flex: 1,
    marginRight: 5, // Space between inputs
  },
});