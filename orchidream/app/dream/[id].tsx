import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Dream, fetchDreamById, deleteDream } from '@/services/db'; // Assuming deleteDream is also in db.ts
import { Ionicons } from '@expo/vector-icons'; // For icons
import MarkdownDisplay from 'react-native-markdown-display';

export default function DreamDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [dream, setDream] = useState<Dream | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setDream(fetchedDream);
      if (!fetchedDream) {
        setError('Dream not found.');
      }
    } catch (e: any) {
      console.error('Failed to fetch dream:', e);
      setError(`Failed to load dream: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDream();
  }, [id]);

  const handleEdit = () => {
    if (dream) {
      router.push({ pathname: '/dream/edit/[id]', params: { id: dream.id.toString() } } as any);
    }
  };

  const handleDelete = () => {
    if (!dream) return;
    const dreamObj: Dream = dream; // Explicitly cast to Dream

    Alert.alert(
      'Delete Dream',
      'Are you sure you want to delete this dream entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDream(dream.id);
              Alert.alert('Success', 'Dream deleted successfully.');
              router.replace({ pathname: '/(tabs)/journal' } as any);
            } catch (e: any) {
              console.error('Failed to delete dream:', e);
              Alert.alert('Error', `Failed to delete dream: ${e.message}`);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Loading dream details...</ThemedText>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.errorText}>{error}</ThemedText>
      </ThemedView>
    );
  }

  if (!dream) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Dream not found.</ThemedText>
      </ThemedView>
    );
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch (e) {
      return dateString; // fallback to original string if parsing fails
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: dream.title || 'Dream Details' }} />
      <ScrollView style={styles.scrollContainer}>
        <ThemedView style={styles.container}>
          <ThemedText style={styles.title}>{dream.title}</ThemedText>
          <ThemedText style={styles.date}>
            Date: {formatDate(dream.date)}
          </ThemedText>
          
          <ThemedText style={styles.label}>Description:</ThemedText>
          {dream.description ? (
            <MarkdownDisplay style={{ body: styles.content }}>
              {dream.description}
            </MarkdownDisplay>
          ) : (
            <ThemedText style={styles.content}>No description provided.</ThemedText>
          )}

          {dream.lucidityLevel && (
            <>
              <ThemedText style={styles.label}>Lucidity Level:</ThemedText>
              <ThemedText style={styles.content}>{dream.lucidityLevel}</ThemedText>
            </>
          )}

          {dream.tags && dream.tags.length > 0 && (
            <>
              <ThemedText style={styles.label}>Tags:</ThemedText>
              <ThemedText style={styles.content}>{dream.tags.join(', ')}</ThemedText>
            </>
          )}

          {dream.emotions && dream.emotions.length > 0 && (
            <>
              <ThemedText style={styles.label}>Emotions:</ThemedText>
              <ThemedText style={styles.content}>{dream.emotions.join(', ')}</ThemedText>
            </>
          )}

          {dream.lucidityTriggers && dream.lucidityTriggers.length > 0 && (
            <>
              <ThemedText style={styles.label}>Lucidity Triggers:</ThemedText>
              <ThemedText style={styles.content}>{dream.lucidityTriggers.join(', ')}</ThemedText>
            </>
          )}

          {dream.realityChecks && dream.realityChecks.length > 0 && (
            <>
              <ThemedText style={styles.label}>Reality Checks:</ThemedText>
              {dream.realityChecks.map((rc, index) => (
                <ThemedText key={index} style={styles.content}>
                  - {rc.type}: {rc.outcome}
                </ThemedText>
              ))}
            </>
          )}
          
          <ThemedView style={styles.buttonContainer}>
            <TouchableOpacity style={[styles.button, styles.editButton]} onPress={handleEdit}>
              <Ionicons name="pencil" size={20} color="white" />
              <ThemedText style={styles.buttonText}> Edit</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.deleteButton]} onPress={handleDelete}>
              <Ionicons name="trash-bin" size={20} color="white" />
              <ThemedText style={styles.buttonText}> Delete</ThemedText>
            </TouchableOpacity>
          </ThemedView>

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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  date: {
    fontSize: 16,
    color: '#888',
    marginBottom: 20,
  },
  label: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 5,
  },
  content: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 10,
  },
  errorText: {
    color: 'red',
    fontSize: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 30,
    marginBottom: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
    elevation: 2, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  editButton: {
    backgroundColor: '#007bff', // A nice blue
  },
  deleteButton: {
    backgroundColor: '#dc3545', // A standard red for delete
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 5,
  },
});