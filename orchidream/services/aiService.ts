import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { fetchConversationForDisplay, ConversationMessage } from './db'; // Import conversation functions

import Constants from 'expo-constants';

const GEMINI_API_KEY = Constants.expoConfig?.extra?.GEMINI_API_KEY as string;

if (!GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is not set in the .env file');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: 'gemini-pro',
  // safetySettings: [ // TODO: Configure safety settings as needed
  //   {
  //     category: HarmCategory.HARM_CATEGORY_HARASSMENT,
  //     threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  //   },
  // ],
});

const SYSTEM_PROMPT = `You are Orchidream, a helpful AI assistant specializing in lucid dreaming. You can answer questions about induction techniques (MILD, WILD, SSILD, WBTB), offer general interpretations of common dream symbols (with disclaimers about subjectivity), and provide motivational support. Keep your responses concise and helpful.`;

// This is a placeholder for a real user ID. In a production app, this would come from authentication.
const staticUserId = 'user123';

export const sendMessageToGemini = async (userMessage: string): Promise<string> => {
  try {
    // Fetch existing history from DB
    const historyFromDb = await fetchConversationForDisplay();

    // Convert DB history to Gemini's expected format
    const geminiHistory = historyFromDb.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }));

    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: SYSTEM_PROMPT }] }, // Prepend system prompt for context
        { role: 'model', parts: [{ text: "Okay, I understand. I'm ready to help with lucid dreaming." }] }, // Initial model response to system prompt
        ...geminiHistory, // Add actual conversation history
      ],
      generationConfig: {
        // temperature: 0.9, // Example: Adjust creativity
        // topK: 1,
        // topP: 1,
        maxOutputTokens: 2048,
      },
    });

    // Send user message and get response
    const result = await chat.sendMessage(userMessage);
    const aiResponseText = result.response.text();

    // Save user message and AI response to DB
    // await saveConversationMessage(staticUserId, 'user', userMessage);
    // await saveConversationMessage(staticUserId, 'model', aiResponseText);

    return aiResponseText;
  } catch (error) {
    console.error("Error sending message to Gemini:", error);
    if (error instanceof Error && error.message.includes('API key not valid')) {
      return "Error: Invalid API Key. Please ensure your API key is correct and has the necessary permissions.";
    }
    if (error instanceof Error && error.message.includes('quota')) {
        return "Error: API quota exceeded. Please check your Google Cloud project for billing and quota details.";
    }
    return "Sorry, I encountered an error trying to respond. Please try again.";
  }
};
// Re-export fetchConversationForDisplay for use by components
export { fetchConversationForDisplay } from './db';

// Function to fetch conversation history for display in the UI