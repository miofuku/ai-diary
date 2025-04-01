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
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editContent, setEditContent] = useState('');

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
  const createRecognitionInstance = useCallback((lang) => {
    if (!window.webkitSpeechRecognition) return null;
    
    const instance = new window.webkitSpeechRecognition();
    instance.continuous = true;
    instance.interimResults = true;
    instance.lang = lang;
    
    // Configure handlers immediately when creating instance
    instance.onresult = (event) => {
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

    instance.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      if (event.error === 'no-speech') {
        if (isRecording) {
          instance.stop();
          setTimeout(() => {
            if (isRecording) instance.start();
          }, 100);
        }
      }
    };
    
    return instance;
  }, [isRecording]);

  // Initialize recognition on component mount and language change
  useEffect(() => {
    // Clean up any existing recognition instance
    if (recognition) {
      recognition.stop();
    }
    
    // Create new instance with current language
    const newRecognition = createRecognitionInstance(language);
    setRecognition(newRecognition);
    
    // Start if we should be recording
    if (isRecording && newRecognition) {
      try {
        newRecognition.start();
        console.log("Recognition started with language:", language);
      } catch (error) {
        console.error("Failed to start recognition:", error);
      }
    }
    
    // Cleanup function
    return () => {
      if (newRecognition) {
        try {
          newRecognition.stop();
          console.log("Recognition stopped during cleanup");
        } catch (error) {
          console.error("Error stopping recognition during cleanup:", error);
        }
      }
    };
  }, [language, createRecognitionInstance]);

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

  // Handle the recording toggle
  const toggleRecording = () => {
    if (!recognition) {
      console.warn("No recognition instance available");
      return;
    }

    if (isRecording) {
      recognition.stop();
      clearInterval(recordingTimer);
      setRecordingTimer(null);
      setInterimTranscript('');
      console.log("Recording stopped");
    } else {
      try {
        recognition.start();
        setRecordingTime(0);
        const timer = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
        setRecordingTimer(timer);
        console.log("Recording started");
      } catch (error) {
        console.error("Failed to start recording:", error);
      }
    }
    setIsRecording(!isRecording);
  };

  // Language switching
  const switchLanguage = () => {
    const newLanguage = language === 'zh-CN' ? 'en-US' : 'zh-CN';
    console.log(`Switching language from ${language} to ${newLanguage}`);
    
    // Stop recording if active
    if (isRecording && recognition) {
      recognition.stop();
    }
    
    // Update language
    setLanguage(newLanguage);
  };

  const formatRecordingTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startEditing = (entry) => {
    setEditingEntryId(entry.id);
    setEditContent(entry.content);
  };

  const cancelEditing = () => {
    setEditingEntryId(null);
    setEditContent('');
  };

  const saveEditedEntry = async () => {
    if (!editContent.trim() || !editingEntryId) return;

    try {
      const response = await fetch(`http://localhost:3001/api/entries/${editingEntryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: editContent
        }),
      });

      if (response.ok) {
        setEditingEntryId(null);
        setEditContent('');
        fetchEntries();
      }
    } catch (error) {
      console.error('Update entry failed:', error);
    }
  };

  const insertFormatting = (type) => {
    const textarea = document.getElementById('edit-textarea');
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = editContent.substring(start, end);
    let formattedText = '';
    
    switch (type) {
      case 'bold':
        formattedText = `**${selectedText}**`;
        break;
      case 'italic':
        formattedText = `*${selectedText}*`;
        break;
      case 'heading':
        formattedText = `\n## ${selectedText}\n`;
        break;
      case 'list':
        formattedText = selectedText.split('\n').map(line => `- ${line}`).join('\n');
        break;
      default:
        formattedText = selectedText;
    }
    
    const newContent = editContent.substring(0, start) + formattedText + editContent.substring(end);
    setEditContent(newContent);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + formattedText.length, start + formattedText.length);
    }, 0);
  };
  
  const renderMarkdown = (markdownText) => {
    let html = markdownText;
    
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    html = html.replace(/## (.*)/g, '<h2>$1</h2>');
    
    html = html.replace(/- (.*)/g, '<li>$1</li>');
    html = html.replace(/<li>(.*)<\/li>/g, '<ul><li>$1</li></ul>');
    
    html = html.replace(/\n\n/g, '</p><p>');
    
    return { __html: `<p>${html}</p>` };
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
          {!editingEntryId && (
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
          )}
          
          {editingEntryId && (
            <div className="edit-form">
              <h3>Edit Entry</h3>
              <div className="markdown-toolbar">
                <button type="button" onClick={() => insertFormatting('bold')} title="Bold">
                  <strong>B</strong>
                </button>
                <button type="button" onClick={() => insertFormatting('italic')} title="Italic">
                  <em>I</em>
                </button>
                <button type="button" onClick={() => insertFormatting('heading')} title="Heading">
                  H
                </button>
                <button type="button" onClick={() => insertFormatting('list')} title="List">
                  • List
                </button>
              </div>
              
              <div className="edit-container">
                <div className="edit-pane">
                  <textarea
                    id="edit-textarea"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder="Edit your entry..."
                  />
                </div>
                
                <div className="preview-pane">
                  <div className="markdown-preview" dangerouslySetInnerHTML={renderMarkdown(editContent)} />
                </div>
              </div>
              
              <div className="button-group">
                <button type="button" onClick={saveEditedEntry}>
                  Save Changes
                </button>
                <button type="button" onClick={cancelEditing} className="cancel-button">
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="entries">
            <h2>Entries for {selectedDate.toLocaleDateString()}</h2>
            {filteredEntries.length > 0 ? (
              filteredEntries.map(entry => (
                <div key={entry.id} className="entry">
                  {editingEntryId === entry.id ? (
                    null
                  ) : (
                    <>
                      <div dangerouslySetInnerHTML={renderMarkdown(entry.content)} />
                      <small>
                        {new Date(entry.createdAt).toLocaleString()} 
                        ({entry.type === 'voice' ? 'Voice input' : 'Text input'})
                      </small>
                      <button 
                        className="edit-button" 
                        onClick={() => startEditing(entry)}
                      >
                        Edit
                      </button>
                    </>
                  )}
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
