import React, { useState, useEffect, useRef } from 'react';
import { ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { StyleSheet, View, TextInput, Button, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';
import { fetchConversationForDisplay } from '@/services/aiService';
import { ConversationMessage, insertConversationMessage } from '@/services/db';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_API_KEY } from '@/config/apiKeys';

interface Message extends ConversationMessage {
  id: string;
  sender: 'user' | 'model' | 'typing';
}

export default function AiAssistantScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    const loadHistory = async () => {
      // Retry loading conversation history with exponential backoff
      let retries = 3;
      let delay = 100; // Start with 100ms delay
      
      while (retries > 0) {
        try {
          const history = await fetchConversationForDisplay();
          setMessages(history.map((msg, index) => ({
            ...msg,
            id: `${msg.timestamp.getTime()}_${msg.role}_${index}`,
            sender: msg.role === 'user' ? 'user' : 'model',
          })));
          return; // Success, exit retry loop
        } catch (error) {
          console.error(`Failed to load conversation history (${4 - retries}/3):`, error);
          retries--;
          
          if (retries > 0) {
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
          }
        }
      }
      
      // If all retries failed, set empty conversation
      console.warn("Could not load conversation history after 3 attempts. Starting with empty conversation.");
      setMessages([]);
    };
    
    loadHistory();
  }, []);

  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || isTyping) return;
    const userMessage: Message = {
      id: `${Date.now()}_user`,
      sender: 'user',
      content: inputText,
      timestamp: new Date(),
      role: 'user',
    };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    // Log user message (fire-and-forget, do not block UI)
    (async () => {
      try {
        await insertConversationMessage('user', userMessage.content, userMessage.timestamp);
      } catch (e) {
        console.error('Failed to log user message:', e);
      }
    })();

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(inputText);
      const response = result.response?.text() || "No response from Gemini.";
      const aiMessage: Message = {
        id: `${Date.now()}_model`,
        sender: 'model',
        content: response,
        timestamp: new Date(),
        role: 'model',
      };
      setMessages(prev => [...prev, aiMessage]);
      // Log AI message (fire-and-forget, do not block UI)
      (async () => {
        try {
          await insertConversationMessage('model', aiMessage.content, aiMessage.timestamp);
        } catch (e) {
          console.error('Failed to log AI message:', e);
        }
      })();
    } catch (error: any) {
      const errorMessage: Message = {
        id: `${Date.now()}_error`,
        sender: 'model',
        content: "Error: " + (error?.message || "Failed to get response from Gemini."),
        timestamp: new Date(),
        role: 'model',
      };
      setMessages(prev => [...prev, errorMessage]);
      // Log error as AI message (fire-and-forget, do not block UI)
      (async () => {
        try {
          await insertConversationMessage('model', errorMessage.content, errorMessage.timestamp);
        } catch (e) {
          console.error('Failed to log AI error message:', e);
        }
      })();
    } finally {
      setIsTyping(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.sender === 'user';
    return (
      <View
        style={[
          styles.messageContainer,
          isUser ? styles.userContainer : styles.aiContainer,
        ]}
      >
        <View
          style={[
            styles.bubble,
            isUser ? styles.userBubble : styles.aiBubble,
          ]}
        >
          <ThemedText style={isUser ? styles.userText : styles.aiText}>
            {item.content}
          </ThemedText>
        </View>
      </View>
    );
  };

  const backgroundColor = useThemeColor({}, 'background');
  const primaryColor = useThemeColor({}, 'tint');

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
        />
        {isTyping && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#888" />
            <ThemedText style={styles.loadingText}>Gemini is thinking...</ThemedText>
          </View>
        )}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type your message..."
            placeholderTextColor="#888"
            onSubmitEditing={handleSend}
            returnKeyType="send"
            editable={!isTyping}
          />
          <Button title="Send" onPress={handleSend} color={primaryColor} disabled={isTyping} />
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {},
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-end',
  },
  aiContainer: {
    alignSelf: 'flex-start',
    marginVertical: 4,
    marginRight: 40,
  },
  userContainer: {
    alignSelf: 'flex-end',
    marginVertical: 4,
    marginLeft: 40,
  },
  bubble: {
    borderRadius: 16,
    padding: 12,
    maxWidth: '80%',
  },
  aiBubble: {
    backgroundColor: '#e0e0e0',
    alignSelf: 'flex-start',
  },
  userBubble: {
    backgroundColor: '#007AFF',
    alignSelf: 'flex-end',
  },
  aiText: {
    color: '#333',
  },
  userText: {
    color: '#fff',
  },
  chatContent: {
    padding: 16,
    paddingBottom: 80,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderTopWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: '#f9f9f9',
    color: '#333',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    marginBottom: 8,
  },
  loadingText: {
    marginLeft: 8,
    color: '#888',
  },
});