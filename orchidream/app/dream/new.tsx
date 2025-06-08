import React, { useState, useCallback, useRef } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity, Platform, View, KeyboardAvoidingView, Switch, Animated, ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Stack, useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Dream, insertDream, NewDreamData } from '@/services/db'; // Use insertDream
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
// Audio/Transcription dependencies
import * as Permissions from 'expo-permissions';
import { Audio } from 'expo-av';

const LUCIDITY_LEVEL_OPTIONS = ["Non-lucid", "Semi-lucid", "Fully lucid"] as const;
type LucidityLevelOption = typeof LUCIDITY_LEVEL_OPTIONS[number];

export default function NewDreamScreen() {
    const router = useRouter();

    // --- Audio Recording & Transcription State ---
    const [isRecording, setIsRecording] = useState(false);
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [transcribing, setTranscribing] = useState(false);
    const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
    const [amplitude, setAmplitude] = useState(1);

    // Placeholder: Replace with your Google Cloud Speech-to-Text API key
    const GOOGLE_SPEECH_API_KEY = 'YOUR_GOOGLE_SPEECH_API_KEY_HERE';

    // Ref for polling amplitude
    const amplitudeInterval = useRef<number | null>(null);

    // --- Audio Recording Handlers ---
    const requestMicrophonePermission = async () => {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Microphone Permission', 'Microphone access is required to record audio.');
        return false;
      }
      return true;
    };

    const startRecording = async () => {
      setTranscriptionError(null);
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) return;
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        const rec = new Audio.Recording();
        await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        await rec.startAsync();
        setRecording(rec);
        setIsRecording(true);

        // Start polling amplitude for animation
        amplitudeInterval.current = setInterval(async () => {
          try {
            const status = await rec.getStatusAsync();
            // Amplitude is not directly available, so use metering if supported
            if (status.metering) {
              setAmplitude(Math.max(1, status.metering / -160)); // Normalize
            } else {
              setAmplitude(isRecording ? 1.2 : 1);
            }
          } catch {
            setAmplitude(1);
          }
        }, 200);
      } catch (err: any) {
        setTranscriptionError('Failed to start recording.');
        setIsRecording(false);
      }
    };

    const stopRecording = async () => {
      if (!recording) return;
      setIsRecording(false);
      clearInterval(amplitudeInterval.current as any);
      try {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setRecording(null);
        if (uri) {
          await transcribeAudio(uri);
        }
      } catch (err: any) {
        setTranscriptionError('Failed to stop recording.');
      }
    };

    // --- Transcription Handler ---
    const transcribeAudio = async (uri: string) => {
      setTranscribing(true);
      setTranscriptionError(null);
      try {
        // Read audio file as base64
        const response = await fetch(uri);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          // Google Speech-to-Text API request
          const apiUrl = `https://speech.googleapis.com/v1/speech:recognize?key=${GOOGLE_SPEECH_API_KEY}`;
          const body = {
            config: {
              encoding: 'LINEAR16',
              sampleRateHertz: 44100,
              languageCode: 'en-US',
            },
            audio: {
              content: base64Audio,
            },
          };
          try {
            const apiRes = await fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            const apiJson = await apiRes.json();
            if (apiJson.results && apiJson.results[0]?.alternatives[0]?.transcript) {
              setDescription(prev => prev + (prev ? ' ' : '') + apiJson.results[0].alternatives[0].transcript);
            } else {
              setTranscriptionError('No transcription result.');
            }
          } catch (err: any) {
            setTranscriptionError('Transcription failed.');
          }
          setTranscribing(false);
        };
        reader.readAsDataURL(blob);
      } catch (err: any) {
        setTranscriptionError('Audio processing failed.');
        setTranscribing(false);
      }
    };

  // Form state initialized for a new dream
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [lucidityLevel, setLucidityLevel] = useState<LucidityLevelOption | null>(null);

  const [method, setMethod] = useState<string | null>(null);
  const METHOD_OPTIONS = [
    "MILD",
    "WILD",
    "DILD",
    "SSILD",
    "FILD",
    "DEILD",
    "Other"
  ];

  // Animation for "Live" button
  const [isLivePressed, setIsLivePressed] = useState(false);
  const Animated = require('react-native').Animated;
  const liveAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (isLivePressed) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(liveAnim, { toValue: 1.2, duration: 600, useNativeDriver: true }),
          Animated.timing(liveAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      liveAnim.setValue(1);
    }
  }, [isLivePressed]);

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
  const [date, setDate] = useState(new Date()); // Default to current date
  const [showDatePicker, setShowDatePicker] = useState(false);

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

  const handleSaveDream = async () => {
    // Require at least dream content (description)
    if (!description.trim()) {
      Alert.alert("Missing Dream Content", "Please provide dream content.");
      return;
    }

    // Only save fields supported by the current DB schema
    const newDream: NewDreamData = {
      title: title.trim(),
      description: description.trim(),
      date: date.toISOString(),
      lucidityLevel: lucidityLevel || undefined,
      tags: tags.length > 0 ? tags : undefined,
      emotions: emotions.length > 0 ? emotions : undefined,
      lucidityTriggers: lucidityTriggers.length > 0 ? lucidityTriggers : undefined,
      realityChecks: realityChecks.length > 0 ? realityChecks : undefined,
      // method: method || undefined, // Note: method field not yet in database schema
    };

    try {
      await insertDream(newDream);
      Alert.alert('Success', 'Dream saved successfully.');
      // Navigate back to journal list, which should refresh
      router.back();
    } catch (e: any) {
      console.error('Failed to save new dream:', e);
      Alert.alert('Error', `Failed to save dream: ${e.message}`);
    }
  };

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
      <Stack.Screen options={{ title: 'New Dream Entry' }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={{ paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          <ThemedView style={styles.container}>
          <ThemedText style={styles.label}>Title</ThemedText>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Dream title"
          />

          {/* Method/Technique Selector */}
          <ThemedText style={styles.label}>Method/Technique</ThemedText>
          <View style={styles.methodContainer}>
            {METHOD_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt}
                style={[
                  styles.methodButton,
                  method === opt && styles.methodButtonSelected,
                ]}
                onPress={() => setMethod(opt)}
              >
                <ThemedText
                  style={[
                    styles.methodButtonText,
                    method === opt && styles.methodButtonTextSelected
                  ]}
                >
                  {opt}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          {/* Live Button with Animated Gradient Circle */}
          <View style={styles.liveButtonContainer}>
            <Animated.View
              style={[
                styles.liveCircle,
                {
                  transform: [{ scale: isRecording ? amplitude : liveAnim }],
                  backgroundColor: isRecording ? '#ff4081' : '#e0e0e0',
                  shadowColor: isRecording ? '#ff4081' : '#000',
                  shadowOpacity: isRecording ? 0.6 : 0.2,
                  shadowRadius: isRecording ? 16 : 8,
                },
              ]}
            >
              <TouchableOpacity
                style={styles.liveButton}
                onPressIn={startRecording}
                onPressOut={stopRecording}
                activeOpacity={0.7}
                disabled={transcribing}
              >
                {isRecording ? (
                  <ThemedText style={styles.liveButtonText}>Recording...</ThemedText>
                ) : transcribing ? (
                  <ActivityIndicator color="#ff4081" />
                ) : (
                  <ThemedText style={styles.liveButtonText}>Live</ThemedText>
                )}
              </TouchableOpacity>
            </Animated.View>
            {transcriptionError && (
              <ThemedText style={{ color: 'red', marginTop: 4 }}>{transcriptionError}</ThemedText>
            )}
          </View>

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


          <TouchableOpacity style={styles.saveButton} onPress={handleSaveDream}>
            <Ionicons name="save-outline" size={20} color="white" />
            <ThemedText style={styles.saveButtonText}> Save Dream</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ScrollView>
      </KeyboardAvoidingView>
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
  pickerContainer: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    backgroundColor: '#f8f8f8',
    overflow: 'hidden',
  },
  picker: {
    width: '100%',
    height: 44,
    color: '#333',
    backgroundColor: '#f8f8f8',
    marginBottom: 8,
    borderRadius: 8,
  },
  pickerInput: {
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  pickerDropdown: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    backgroundColor: '#f0f0f0',
  },
  pickerOption: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#e0e0e0',
    margin: 4,
  },
  pickerOptionSelected: {
    backgroundColor: '#007bff',
  },
  pickerOptionText: {
    color: '#333',
    fontSize: 15,
  },
  pickerOptionTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  methodContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  methodButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    margin: 4,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  methodButtonSelected: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  methodButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
  },
  methodButtonTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
    justifyContent: 'space-between',
  },
  toggleButton: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ccc',
    justifyContent: 'center',
    padding: 2,
  },
  toggleButtonActive: {
    backgroundColor: '#007bff',
  },
  toggleCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  toggleCircleActive: {
    alignSelf: 'flex-end',
    backgroundColor: '#fff',
  },
  liveButtonContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  liveCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'linear-gradient(135deg, #ff5f6d 0%, #ffc371 100%)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff5f6d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  liveButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveButtonText: {
    color: '#ff5f6d',
    fontWeight: 'bold',
    fontSize: 16,
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
    flex: 1, 
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#007bff', // Blue for save new
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
    paddingLeft: 10, 
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
    marginRight: 5, 
  },
});