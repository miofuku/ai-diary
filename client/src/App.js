import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import DiaryCalendar from './components/DiaryCalendar';

function App() {
  const [entries, setEntries] = useState([]);
  const [content, setContent] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filteredEntries, setFilteredEntries] = useState([]);

  const fetchEntries = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/entries');
      const data = await response.json();
      setEntries(data);
    } catch (error) {
      console.error('Get diary failed:', error);
    }
  };

  // Define filterEntriesByDate BEFORE using it in useEffect
  const filterEntriesByDate = useCallback((date) => {
    const filtered = entries.filter(entry => {
      const entryDate = new Date(entry.createdAt);
      return (
        entryDate.getDate() === date.getDate() &&
        entryDate.getMonth() === date.getMonth() &&
        entryDate.getFullYear() === date.getFullYear()
      );
    });
    setFilteredEntries(filtered);
  }, [entries]);

  useEffect(() => {
    // Initialize speech recognition
    if (window.webkitSpeechRecognition) {
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'zh-CN';

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('');
        setContent(transcript);
      };

      setRecognition(recognition);
    }

    // Get existing diaries
    fetchEntries();
  }, []);

  // Filter entries when selected date or entries change
  useEffect(() => {
    filterEntriesByDate(selectedDate);
  }, [selectedDate, entries, filterEntriesByDate]);

  const handleDateSelect = (date) => {
    setSelectedDate(date);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    try {
      const response = await fetch('http://localhost:3001/api/entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          type: isRecording ? 'voice' : 'text',
          targetDate: selectedDate.toISOString()
        }),
      });

      if (response.ok) {
        setContent('');
        fetchEntries();
      }
    } catch (error) {
      console.error('Save diary failed:', error);
    }
  };

  const toggleRecording = () => {
    if (!recognition) return;

    if (isRecording) {
      recognition.stop();
    } else {
      recognition.start();
    }
    setIsRecording(!isRecording);
  };

  return (
    <div className="App">
      <h1>My Diary</h1>
      
      <div className="app-container">
        <div className="calendar-container">
          <DiaryCalendar 
            entries={entries} 
            onDateSelect={handleDateSelect} 
            selectedDate={selectedDate}
          />
          <p className="selected-date">
            Selected date: {selectedDate.toLocaleDateString()}
          </p>
        </div>

        <div className="content-container">
          <form onSubmit={handleSubmit} className="input-form">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`Write your diary for ${selectedDate.toLocaleDateString()}...`}
            />
            <div className="button-group">
              <button type="button" onClick={toggleRecording}>
                {isRecording ? 'Stop recording' : 'Start recording'}
              </button>
              <button type="submit">Save</button>
            </div>
          </form>

          <div className="entries">
            <h2>Entries for {selectedDate.toLocaleDateString()}</h2>
            {filteredEntries.length > 0 ? (
              filteredEntries.map(entry => (
                <div key={entry.id} className="entry">
                  <p>{entry.content}</p>
                  <small>
                    {new Date(entry.createdAt).toLocaleString()} 
                    ({entry.type === 'voice' ? 'Voice input' : 'Text input'})
                  </small>
                </div>
              ))
            ) : (
              <p>No entries for this date.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
