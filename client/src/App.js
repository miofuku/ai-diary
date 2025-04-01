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
  const [interimTranscript, setInterimTranscript] = useState('');
  const [language, setLanguage] = useState('zh-CN');
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingTimer, setRecordingTimer] = useState(null);

  const fetchEntries = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/entries');
      const data = await response.json();
      setEntries(data);
    } catch (error) {
      console.error('Get diary failed:', error);
    }
  };

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

  // Create recognition instance
  const createRecognitionInstance = (lang) => {
    if (!window.webkitSpeechRecognition) return null;
    
    const instance = new window.webkitSpeechRecognition();
    instance.continuous = true;
    instance.interimResults = true;
    instance.lang = lang;
    
    return instance;
  };

  useEffect(() => {
    const recognitionInstance = createRecognitionInstance(language);
    
    if (recognitionInstance) {
      recognitionInstance.onresult = (event) => {
        let interimText = '';
        let finalText = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalText += transcript + ' ';
          } else {
            interimText += transcript;
          }
        }

        setInterimTranscript(interimText);
        if (finalText) {
          setContent(prevContent => prevContent + finalText);
        }
      };

      recognitionInstance.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        if (event.error === 'no-speech') {
          if (isRecording) {
            recognitionInstance.stop();
            setTimeout(() => {
              if (isRecording) recognitionInstance.start();
            }, 100);
          }
        }
      };

      setRecognition(recognitionInstance);
    }

    return () => {
      if (recognitionInstance) {
        recognitionInstance.stop();
      }
    };
  }, [language, isRecording]);

  useEffect(() => {
    // Initialize data fetch
    fetchEntries();
  }, []);

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
      clearInterval(recordingTimer);
      setRecordingTimer(null);
      setInterimTranscript('');
    } else {
      recognition.start();
      setRecordingTime(0);
      const timer = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      setRecordingTimer(timer);
    }
    setIsRecording(!isRecording);
  };

  const switchLanguage = () => {
    const newLanguage = language === 'zh-CN' ? 'en-US' : 'zh-CN';
    setLanguage(newLanguage);
    
    // Restart recognition if it's running
    if (isRecording && recognition) {
      recognition.stop();
      setTimeout(() => {
        const newInstance = createRecognitionInstance(newLanguage);
        if (newInstance) {
          setRecognition(newInstance);
          newInstance.start();
        }
      }, 100);
    }
  };

  const formatRecordingTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
            
            {isRecording && (
              <div className="recording-indicator">
                <div className="recording-pulse"></div>
                <span>Recording... {formatRecordingTime(recordingTime)}</span>
                <div className="interim-text">{interimTranscript}</div>
              </div>
            )}
            
            <div className="button-group">
              <button 
                type="button" 
                onClick={toggleRecording} 
                className={isRecording ? "recording-active" : ""}
              >
                {isRecording ? 'Stop recording' : 'Start recording'}
              </button>
              
              <button 
                type="button" 
                onClick={switchLanguage}
                className="language-toggle"
              >
                {language === 'zh-CN' ? '中文' : 'English'}
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
