import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [entries, setEntries] = useState([]);
  const [content, setContent] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState(null);

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

  const fetchEntries = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/entries');
      const data = await response.json();
      setEntries(data);
    } catch (error) {
      console.error('Get diary failed:', error);
    }
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
          type: isRecording ? 'voice' : 'text'
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
      
      <form onSubmit={handleSubmit} className="input-form">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your story today..."
        />
        <div className="button-group">
          <button type="button" onClick={toggleRecording}>
            {isRecording ? 'Stop recording' : 'Start recording'}
          </button>
          <button type="submit">Save</button>
        </div>
      </form>

      <div className="entries">
        {entries.map(entry => (
          <div key={entry.id} className="entry">
            <p>{entry.content}</p>
            <small>
              {new Date(entry.createdAt).toLocaleString()} 
              ({entry.type === 'voice' ? 'Voice input' : 'Text input'})
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
