import * as SQLite from 'expo-sqlite';

// Define the interface for a Dream document
export interface Dream {
  id: number;
  date: string;
  title: string;
  description: string;
  lucidityLevel?: string;
  tags?: string[];
  emotions?: string[];
  realityChecks?: { type: string; outcome: string }[];
  lucidityTriggers?: string[];
}

// Interface for data required to create a new dream
export interface NewDreamData {
  date: string;
  title: string;
  description: string;
  lucidityLevel?: string;
  tags?: string[];
  emotions?: string[];
  realityChecks?: { type: string; outcome: string }[];
  lucidityTriggers?: string[];
}

// Define the interface for a Conversation Message
export interface ConversationMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
}

// Interface for conversation document
export interface Conversation {
  id: number;
  role: 'user' | 'model';
  content: string;
  timestamp: string; // SQLite stores as string
}

// Interface for fetch options
export interface FetchDreamsOptions {
  searchQuery?: string;
  dateFilter?: string | { startDate: string; endDate: string };
  lucidityLevelFilter?: string;
  tagsFilter?: string[];
  sortBy?: 'date' | 'title';
  sortOrder?: 'ASC' | 'DESC';
}

let db: SQLite.SQLiteDatabase;

// Initialize the database
export const initDb = async (): Promise<void> => {
  try {
    db = await SQLite.openDatabaseAsync('orchidream.db');
    
    // Create Dreams table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS dreams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        lucidityLevel TEXT,
        tags TEXT,
        emotions TEXT,
        realityChecks TEXT,
        lucidityTriggers TEXT
      );
    `);

    // Create Conversations table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
};

// Insert a new dream
export const insertDream = async (dreamData: NewDreamData): Promise<number> => {
  try {
    const result = await db.runAsync(
      `INSERT INTO dreams (date, title, description, lucidityLevel, tags, emotions, realityChecks, lucidityTriggers)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dreamData.date,
        dreamData.title,
        dreamData.description,
        dreamData.lucidityLevel || null,
        dreamData.tags ? JSON.stringify(dreamData.tags) : null,
        dreamData.emotions ? JSON.stringify(dreamData.emotions) : null,
        dreamData.realityChecks ? JSON.stringify(dreamData.realityChecks) : null,
        dreamData.lucidityTriggers ? JSON.stringify(dreamData.lucidityTriggers) : null,
      ]
    );
    return result.lastInsertRowId;
  } catch (error) {
    console.error('Failed to insert dream:', error);
    throw error;
  }
};

// Fetch dreams with options
export const fetchDreams = async (options: FetchDreamsOptions = {}): Promise<Dream[]> => {
  try {
    let query = 'SELECT * FROM dreams WHERE 1=1';
    const params: any[] = [];

    // Add search filter
    if (options.searchQuery) {
      query += ' AND (title LIKE ? OR description LIKE ?)';
      const searchPattern = `%${options.searchQuery}%`;
      params.push(searchPattern, searchPattern);
    }

    // Add date filter
    if (options.dateFilter) {
      if (typeof options.dateFilter === 'string') {
        query += ' AND date = ?';
        params.push(options.dateFilter);
      } else {
        query += ' AND date BETWEEN ? AND ?';
        params.push(options.dateFilter.startDate, options.dateFilter.endDate);
      }
    }

    // Add lucidity level filter
    if (options.lucidityLevelFilter) {
      query += ' AND lucidityLevel = ?';
      params.push(options.lucidityLevelFilter);
    }

    // Add tags filter
    if (options.tagsFilter && options.tagsFilter.length > 0) {
      const tagConditions = options.tagsFilter.map(() => 'tags LIKE ?').join(' OR ');
      query += ` AND (${tagConditions})`;
      options.tagsFilter.forEach(tag => {
        params.push(`%"${tag}"%`);
      });
    }

    // Add sorting
    const sortBy = options.sortBy || 'date';
    const sortOrder = options.sortOrder || 'DESC';
    query += ` ORDER BY ${sortBy} ${sortOrder}`;

    const rows = await db.getAllAsync(query, params);
    
    return rows.map((row: any) => ({
      id: row.id,
      date: row.date,
      title: row.title,
      description: row.description,
      lucidityLevel: row.lucidityLevel,
      tags: row.tags ? JSON.parse(row.tags) : [],
      emotions: row.emotions ? JSON.parse(row.emotions) : [],
      realityChecks: row.realityChecks ? JSON.parse(row.realityChecks) : [],
      lucidityTriggers: row.lucidityTriggers ? JSON.parse(row.lucidityTriggers) : [],
    }));
  } catch (error) {
    console.error('Failed to fetch dreams:', error);
    throw error;
  }
};
// Insert a conversation message
export const insertConversationMessage = async (role: 'user' | 'model', content: string, timestamp: Date): Promise<void> => {
  try {
    await db.runAsync(
      `INSERT INTO conversations (role, content, timestamp) VALUES (?, ?, ?)`,
      [role, content, timestamp.toISOString()]
    );
  } catch (error) {
    console.error('Failed to insert conversation message:', error);
    // Do not throw, to allow graceful error handling in UI
  }
};

// Fetch a single dream by ID
export const fetchDreamById = async (id: number): Promise<Dream | null> => {
  try {
    const row = await db.getFirstAsync('SELECT * FROM dreams WHERE id = ?', [id]);
    
    if (!row) return null;

    return {
      id: (row as any).id,
      date: (row as any).date,
      title: (row as any).title,
      description: (row as any).description,
      lucidityLevel: (row as any).lucidityLevel,
      tags: (row as any).tags ? JSON.parse((row as any).tags) : [],
      emotions: (row as any).emotions ? JSON.parse((row as any).emotions) : [],
      realityChecks: (row as any).realityChecks ? JSON.parse((row as any).realityChecks) : [],
      lucidityTriggers: (row as any).lucidityTriggers ? JSON.parse((row as any).lucidityTriggers) : [],
    };
  } catch (error) {
    console.error('Failed to fetch dream by ID:', error);
    throw error;
  }
};

// Update a dream
export const updateDream = async (id: number, dreamData: Partial<NewDreamData>): Promise<void> => {
  try {
    const updates: string[] = [];
    const params: any[] = [];

    if (dreamData.date !== undefined) {
      updates.push('date = ?');
      params.push(dreamData.date);
    }
    if (dreamData.title !== undefined) {
      updates.push('title = ?');
      params.push(dreamData.title);
    }
    if (dreamData.description !== undefined) {
      updates.push('description = ?');
      params.push(dreamData.description);
    }
    if (dreamData.lucidityLevel !== undefined) {
      updates.push('lucidityLevel = ?');
      params.push(dreamData.lucidityLevel);
    }
    if (dreamData.tags !== undefined) {
      updates.push('tags = ?');
      params.push(JSON.stringify(dreamData.tags));
    }
    if (dreamData.emotions !== undefined) {
      updates.push('emotions = ?');
      params.push(JSON.stringify(dreamData.emotions));
    }
    if (dreamData.realityChecks !== undefined) {
      updates.push('realityChecks = ?');
      params.push(JSON.stringify(dreamData.realityChecks));
    }
    if (dreamData.lucidityTriggers !== undefined) {
      updates.push('lucidityTriggers = ?');
      params.push(JSON.stringify(dreamData.lucidityTriggers));
    }

    if (updates.length === 0) return;

    params.push(id);
    const query = `UPDATE dreams SET ${updates.join(', ')} WHERE id = ?`;
    
    await db.runAsync(query, params);
  } catch (error) {
    console.error('Failed to update dream:', error);
    throw error;
  }
};

// Delete a dream
export const deleteDream = async (id: number): Promise<void> => {
  try {
    await db.runAsync('DELETE FROM dreams WHERE id = ?', [id]);
  } catch (error) {
    console.error('Failed to delete dream:', error);
    throw error;
  }
};


// Fetch conversation for display
export const fetchConversationForDisplay = async (): Promise<ConversationMessage[]> => {
  try {
    if (!db) {
      throw new Error('Database not initialized. Call initDb() first.');
    }
    const rows = await db.getAllAsync('SELECT * FROM conversations ORDER BY timestamp ASC');
    
    return rows.map((row: any) => ({
      role: row.role,
      content: row.content,
      timestamp: new Date(row.timestamp),
    }));
  } catch (error) {
    console.error('Failed to fetch conversation:', error);
    throw error;
  }
};

// Clear all conversation messages
export const clearConversation = async (): Promise<void> => {
  try {
    await db.runAsync('DELETE FROM conversations');
  } catch (error) {
    console.error('Failed to clear conversation:', error);
    throw error;
  }
};