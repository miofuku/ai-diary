require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const OpenAI = require('openai');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Ensure the data file exists
const dataPath = path.join(__dirname, '../data/entries.json');
async function ensureDataFile() {
  try {
    await fs.access(dataPath);
  } catch {
    await fs.writeFile(dataPath, '[]');
  }
}

// Optimize text format
async function optimizeText(text) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a text optimization assistant, responsible for optimizing the diary content to be more elegant, while keeping the original meaning and improving the expression."
        },
        {
          role: "user",
          content: text
        }
      ]
    });
    return completion.choices[0].message.content;
  } catch (error) {
    console.error('Text optimization failed:', error);
    return text; // If API call fails, return the original text
  }
}

// Save diary
app.post('/api/entries', async (req, res) => {
  try {
    await ensureDataFile();
    const { content, type, targetDate } = req.body;
    
    // Optimize text
    const optimizedContent = await optimizeText(content);
    
    // Use the provided targetDate or current date
    const createdAt = targetDate || new Date().toISOString();
    
    const entry = {
      id: Date.now(),
      content: optimizedContent,
      type, // 'text' or 'voice'
      createdAt
    };

    const entries = JSON.parse(await fs.readFile(dataPath, 'utf8'));
    entries.push(entry);
    await fs.writeFile(dataPath, JSON.stringify(entries, null, 2));

    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all diaries
app.get('/api/entries', async (req, res) => {
  try {
    await ensureDataFile();
    const entries = JSON.parse(await fs.readFile(dataPath, 'utf8'));
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get entries by date
app.get('/api/entries/:date', async (req, res) => {
  try {
    await ensureDataFile();
    const targetDate = new Date(req.params.date);
    const entries = JSON.parse(await fs.readFile(dataPath, 'utf8'));
    
    const filteredEntries = entries.filter(entry => {
      const entryDate = new Date(entry.createdAt);
      return (
        entryDate.getDate() === targetDate.getDate() &&
        entryDate.getMonth() === targetDate.getMonth() &&
        entryDate.getFullYear() === targetDate.getFullYear()
      );
    });
    
    res.json(filteredEntries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update entry
app.put('/api/entries/:id', async (req, res) => {
  try {
    await ensureDataFile();
    const { existingContent, newContent, appendMode, content } = req.body;
    const entryId = parseInt(req.params.id);
    
    // Read existing entries
    const entries = JSON.parse(await fs.readFile(dataPath, 'utf8'));
    const entryIndex = entries.findIndex(entry => entry.id === entryId);
    
    if (entryIndex === -1) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    
    let finalContent;
    
    // Handle intelligent content merging when in append mode
    if (appendMode && existingContent && newContent) {
      finalContent = await integrateDiaryContent(existingContent, newContent);
    } else {
      // For manual edits, use the content as provided
      finalContent = content;
    }
    
    // Update the entry with the new content
    entries[entryIndex].content = finalContent;
    await fs.writeFile(dataPath, JSON.stringify(entries, null, 2));
    
    res.json(entries[entryIndex]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to intelligently merge diary content using LLM
async function integrateDiaryContent(existingContent, newContent) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a diary integration assistant. Your task is to integrate new diary content with existing content. 
          If the new content is related to the existing content, integrate it seamlessly, enhancing the narrative and connecting the ideas.
          If the new content is about a different topic, start a new paragraph. 
          Enhance the writing style to be cohesive and engaging, while preserving the original meaning.
          Never add timestamps or date markers.`
        },
        {
          role: "user",
          content: `Existing diary content: "${existingContent}"\nNew diary content to integrate: "${newContent}"`
        }
      ]
    });
    
    return completion.choices[0].message.content;
  } catch (error) {
    console.error('Content integration failed:', error);
    // Fallback to simple concatenation if API fails
    return `${existingContent}\n\n${newContent}`;
  }
}

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 