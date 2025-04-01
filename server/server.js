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
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a text optimization assistant, responsible for整理日记内容成优雅的格式，保持原意的同时提升表达。"
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

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 