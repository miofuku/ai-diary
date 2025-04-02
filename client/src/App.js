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
  const [audioRecorder, setAudioRecorder] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchEntries = async () => {
    try {
      console.log('Fetching entries...');
      const response = await fetch('http://localhost:3001/api/entries');
      
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Entries fetched:', data.length);
      setEntries(data);
    } catch (error) {
      console.error('Failed to fetch entries:', error);
      // Optionally show an error message to the user
    }
  };

  const filterEntriesByDate = useCallback((date) => {
    console.log('Filtering entries for date:', date.toISOString().split('T')[0]);
    const filtered = entries.filter(entry => {
      const entryDate = new Date(entry.createdAt);
      const match = (
        entryDate.getDate() === date.getDate() &&
        entryDate.getMonth() === date.getMonth() &&
        entryDate.getFullYear() === date.getFullYear()
      );
      return match;
    });
    console.log('Filtered entries:', filtered.length);
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
  }, [language, createRecognitionInstance, isRecording, recognition]);

  // Replace the existing audio recorder useEffect with this lazy-loading approach
  useEffect(() => {
    // Just initialize empty state values, don't access the microphone yet
    return () => {
      // Cleanup if needed
      if (audioRecorder && audioRecorder.state !== 'inactive') {
        audioRecorder.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Initialize data fetch
    fetchEntries();
  }, []);

  useEffect(() => {
    if (entries.length > 0) {
      filterEntriesByDate(selectedDate);
    }
  }, [entries, selectedDate, filterEntriesByDate]);

  const handleDateSelect = (date) => {
    setSelectedDate(date);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    try {
      // Check if entries already exist for this date
      if (filteredEntries.length > 0) {
        // Get the most recent entry for this date
        const latestEntry = filteredEntries[filteredEntries.length - 1];
        
        // Send both the existing content and new content to the server
        // Let the server handle the intelligent merging
        const response = await fetch(`http://localhost:3001/api/entries/${latestEntry.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            existingContent: latestEntry.content,
            newContent: content,
            appendMode: true
          }),
        });

        if (response.ok) {
          setContent('');
          fetchEntries();
        }
      } else {
        // No existing entries for this date, create a new one
        const response = await fetch('http://localhost:3001/api/entries', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: content,
            type: isRecording ? 'voice' : 'text',
            targetDate: selectedDate.toISOString()
          }),
        });

        if (response.ok) {
          setContent('');
          fetchEntries();
        }
      }
    } catch (error) {
      console.error('Save diary failed:', error);
    }
  };

  // Update the toggleRecording function to initialize the recorder on demand
  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording
      if (audioRecorder && audioRecorder.state !== 'inactive') {
        audioRecorder.stop();
      }
      clearInterval(recordingTimer);
      setRecordingTimer(null);
      setInterimTranscript('');
      setIsRecording(false);
    } else {
      // Initialize recorder if we don't have one yet
      if (!audioRecorder) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
          
          let chunks = [];
          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              chunks.push(e.data);
            }
          };
          
          mediaRecorder.onstop = async () => {
            setIsProcessing(true);
            const audioBlob = new Blob(chunks, { type: 'audio/webm' });
            chunks = [];
            
            // Send to local Whisper service
            const formData = new FormData();
            formData.append('audio', audioBlob);
            formData.append('language', language === 'zh-CN' ? 'zh' : 'en');
            
            try {
              const response = await fetch('http://localhost:3001/transcribe', {
                method: 'POST',
                body: formData
              });
              
              if (response.ok) {
                const result = await response.json();
                setContent(prevContent => prevContent + result.text);
              } else {
                console.error('Transcription failed');
              }
            } catch (error) {
              console.error('Error sending audio for transcription:', error);
            } finally {
              setIsProcessing(false);
            }
          };
          
          setAudioRecorder(mediaRecorder);
          
          // Start recording immediately
          mediaRecorder.start(1000);
        } catch (error) {
          console.error('Error accessing microphone:', error);
          return; // Exit if we can't access the microphone
        }
      } else {
        // Use existing recorder
        audioRecorder.start(1000);
      }
      
      // Setup timer
      setRecordingTime(0);
      const timer = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      setRecordingTimer(timer);
      setIsRecording(true);
    }
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
  
  const renderMarkdown = (markdown) => {
    if (!markdown) return { __html: '' };
    
    try {
      // For now, just return the raw HTML
      // You can add a markdown processor library later if needed
      return { __html: markdown.replace(/\n/g, '<br/>') };
    } catch (error) {
      console.error('Error rendering content:', error);
      return { __html: markdown };
    }
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
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Processing...' : isRecording ? 'Stop recording' : 'Start recording'}
                </button>
                
                <button 
                  type="button" 
                  onClick={switchLanguage}
                  className="language-toggle"
                >
                  {language === 'zh-CN' ? '中文' : 'English'}
                </button>
                
                <button type="submit" disabled={isProcessing}>Save</button>
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
              filteredEntries.map(entry => {
                console.log('Rendering entry:', entry.id, entry.content.substring(0, 50) + '...');
                return (
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
                );
              })
            ) : (
              <p>No entries for this date. {console.log('No entries for date:', selectedDate.toLocaleDateString())}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
