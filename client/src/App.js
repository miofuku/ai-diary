import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import DiaryCalendar from './components/DiaryCalendar';
import TopicThreads from './components/TopicThreads';

function App() {
  const [entries, setEntries] = useState([]);
  const [content, setContent] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filteredEntries, setFilteredEntries] = useState([]);
  // eslint-disable-next-line no-unused-vars
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

  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording
      if (audioRecorder && audioRecorder.state !== 'inactive') {
        audioRecorder.stop();
      }
      clearInterval(recordingTimer);
      setRecordingTimer(null);
      setIsRecording(false);
    } else {
      // Initialize recorder if we don't have one yet
      if (!audioRecorder) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { 
              echoCancellation: true,
              noiseSuppression: true,
              sampleRate: 16000
            } 
          });
          
          // Use a more compressed audio format if supported
          const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
            ? 'audio/webm;codecs=opus' 
            : 'audio/webm';
          
          const mediaRecorder = new MediaRecorder(stream, { 
            mimeType: mimeType,
            audioBitsPerSecond: 32000
          });
          
          let chunks = [];
          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              chunks.push(e.data);
            }
          };
          
          mediaRecorder.onstop = async () => {
            setIsProcessing(true);
            const audioBlob = new Blob(chunks, { type: mimeType });
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
          return;
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

  // 格式化日期为中文格式
  const formatDate = (date) => {
    if (!date) return '';
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
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
            选中日期: {formatDate(selectedDate)}
          </p>
        </div>

        <div className="content-container">
          {!editingEntryId && (
            <form onSubmit={handleSubmit} className="input-form">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={`Write your diary for ${formatDate(selectedDate)}...`}
              />
              
              <div className="button-group">
                <button 
                  type="button" 
                  onClick={toggleRecording} 
                  className={isRecording ? "recording-active" : ""}
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Processing...' : isRecording ? 'Stop recording' : 'Start recording'}
                </button>
                
                <button type="submit" disabled={!content.trim() || isRecording}>
                  Save
                </button>
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
            <h2>Entries for {formatDate(selectedDate)}</h2>
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
                          className="entry-edit-button" 
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
              <p>No entries for this date. {console.log('No entries for date:', formatDate(selectedDate))}</p>
            )}
          </div>

          <TopicThreads />

          {isRecording && (
            <div className="recording-indicator">
              <div className="recording-pulse"></div>
              <span>Recording... {formatRecordingTime(recordingTime)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
