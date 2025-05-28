import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import DiaryCalendar from './components/DiaryCalendar';

function App() {
  const [entries, setEntries] = useState([]);
  const [content, setContent] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filteredEntries, setFilteredEntries] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [language, setLanguage] = useState('zh-CN');
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [themeRelatedEntries, setThemeRelatedEntries] = useState([]);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const fileInputRef = useRef(null);

  const fetchEntries = async () => {
    try {
      console.log('Fetching entries...');
      let data = [];
      
      try {
        // First try the API endpoint
        const response = await fetch('http://localhost:3001/api/entries');
        
        if (response.ok) {
          data = await response.json();
          console.log('Entries fetched from API:', data.length);
        } else {
          throw new Error('API not available');
        }
      } catch (apiError) {
        console.log('API not available, using default entries');
        // Instead of loading from a file, we keep entries in the app's state
        // This would typically be populated from local storage or IndexedDB
        // For demo purposes, we'll use entries passed as props or an empty array
        data = window.entriesData || [];
        console.log('Using local entries:', data.length);
      }
      
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
        
        try {
          // First try the API endpoint
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
          } else {
            throw new Error('API not available');
          }
        } catch (apiError) {
          // Handle locally if API is not available
          console.log('API not available, saving locally');
          // Update the entry locally
          const updatedEntry = {
            ...latestEntry,
            content: latestEntry.content + '\n\n' + content,
            updatedAt: new Date().toISOString()
          };
          
          // Update the entry in the local array
          const updatedEntries = entries.map(entry => 
            entry.id === latestEntry.id ? updatedEntry : entry
          );
          
          // Save to local storage
          localStorage.setItem('diaryEntries', JSON.stringify(updatedEntries));
          window.entriesData = updatedEntries;
          
          // Update state
          setEntries(updatedEntries);
          setContent('');
        }
      } else {
        // No existing entries for this date, create a new one
        try {
          const response = await fetch('http://localhost:3001/api/entries', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              content: content,
              type: 'text',
              targetDate: selectedDate.toISOString()
            }),
          });

          if (response.ok) {
            setContent('');
            fetchEntries();
          } else {
            throw new Error('API not available');
          }
        } catch (apiError) {
          // Handle locally if API is not available
          console.log('API not available, saving locally');
          
          // Create a new entry locally
          const newEntry = {
            id: Date.now(), // Use timestamp as ID
            content: content,
            type: 'text',
            createdAt: selectedDate.toISOString()
          };
          
          // Add to the local array
          const updatedEntries = [...entries, newEntry];
          
          // Save to local storage
          localStorage.setItem('diaryEntries', JSON.stringify(updatedEntries));
          window.entriesData = updatedEntries;
          
          // Update state
          setEntries(updatedEntries);
          setContent('');
        }
      }
    } catch (error) {
      console.error('Save diary failed:', error);
    }
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
        } else {
          throw new Error('API not available');
        }
      } catch (apiError) {
        // Handle locally if API is not available
        console.log('API not available, saving edit locally');
        
        // Update the entry locally
        const updatedEntries = entries.map(entry => 
          entry.id === editingEntryId 
            ? { 
                ...entry, 
                content: editContent,
                updatedAt: new Date().toISOString()
              } 
            : entry
        );
        
        // Save to local storage
        localStorage.setItem('diaryEntries', JSON.stringify(updatedEntries));
        window.entriesData = updatedEntries;
        
        // Update state
        setEntries(updatedEntries);
        setEditingEntryId(null);
        setEditContent('');
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

  // 主题列表
  const themes = [
    { id: 1, name: '健康日记' },
    { id: 2, name: '今日感想' },
    { id: 3, name: '情绪变化' },
    { id: 4, name: '自由书写' }
  ];

  // 模拟主题相关的日记数据
  const themeEntryData = {
    1: [ // 健康日记
      { 
        id: 101, 
        date: '2023-05-15',
        title: '开始晨跑',
        excerpt: '...今天开始了我的<span class="highlight">健康</span>计划，清晨6点起床去<span class="highlight">跑步</span>，感觉精神焕发...'
      },
      { 
        id: 102, 
        date: '2023-05-20',
        title: '饮食调整',
        excerpt: '...决定调整<span class="highlight">饮食结构</span>，减少碳水摄入，增加蛋白质和蔬菜的比例，为了更好的<span class="highlight">健康</span>...'
      }
    ],
    2: [ // 今日感想
      { 
        id: 201, 
        date: '2023-06-01',
        title: '工作总结',
        excerpt: '...<span class="highlight">今日</span>项目终于完成了第一阶段，<span class="highlight">感到</span>非常有成就感，团队合作很顺利...'
      },
      { 
        id: 202, 
        date: '2023-06-05',
        title: '阅读心得',
        excerpt: '...<span class="highlight">今天</span>读完了那本书，<span class="highlight">感想</span>颇多，尤其是对主角的成长历程很有共鸣...'
      }
    ],
    3: [ // 情绪变化
      { 
        id: 301, 
        date: '2023-07-10',
        title: '起伏的一天',
        excerpt: '...早上<span class="highlight">情绪</span>低落，但下午收到好消息后<span class="highlight">心情</span>明显好转，这种<span class="highlight">变化</span>很有趣...'
      }
    ],
    4: [ // 自由书写
      { 
        id: 401, 
        date: '2023-08-01',
        title: '随想录',
        excerpt: '...<span class="highlight">自由</span>地记录下今天的所思所想，不受任何约束的<span class="highlight">书写</span>方式让我感到放松...'
      }
    ]
  };

  const handleThemeClick = (themeId) => {
    if (selectedTheme === themeId) {
      // If clicking the same theme, unselect it
      setSelectedTheme(null);
      setThemeRelatedEntries([]);
    } else {
      // Select the theme and show related entries
      setSelectedTheme(themeId);
      setThemeRelatedEntries(themeEntryData[themeId] || []);
    }
  };

  // Import entries from a local JSON file
  const importEntriesFromFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedEntries = JSON.parse(e.target.result);
        if (Array.isArray(importedEntries)) {
          // Merge with existing entries or replace them
          const updatedEntries = [...entries, ...importedEntries];
          
          // Save to local storage
          localStorage.setItem('diaryEntries', JSON.stringify(updatedEntries));
          window.entriesData = updatedEntries;
          
          // Update state
          setEntries(updatedEntries);
          console.log(`Imported ${importedEntries.length} entries successfully`);
          
          // Reset file input
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          
          // Close dialog
          setShowImportDialog(false);
        } else {
          console.error('Invalid entries format, expected an array');
        }
      } catch (error) {
        console.error('Failed to parse imported entries:', error);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="App">
      <header className="app-header">
        <div className="logo-nav">
          <div className="logo">
            <span className="logo-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 3H5C3.89 3 3 3.9 3 5V19C3 20.1 3.89 21 5 21H19C20.11 21 21 20.1 21 19V5C21 3.9 20.11 3 19 3ZM19 19H5V5H19V19ZM17 12H7V10H17V12ZM13 16H7V14H13V16ZM7 8H17V6H7V8Z" fill="#FF7A5C"/>
              </svg>
            </span>
            <span className="logo-text">Reflectly</span>
          </div>
          <nav className="app-nav">
            <a href="#" className="nav-link active">首页</a>
            <a href="#" className="nav-link">日记</a>
            <a href="#" className="nav-link">日历</a>
          </nav>
        </div>
        <button className="new-project-button">
          <span className="plus-icon">+</span>
          <span>新条目</span>
        </button>
      </header>
      
      <div className="app-container">
        <main className="content-container">
          <div className="content-inner">
            <div className="page-header">
              <h1>首页</h1>
            </div>

            {/* Import dialog */}
            {showImportDialog && (
              <div className="import-dialog">
                <p>选择本地的日记 JSON 文件导入（不会上传到服务器）</p>
                <input
                  type="file"
                  accept=".json"
                  onChange={importEntriesFromFile}
                  ref={fileInputRef}
                />
                <button 
                  className="close-button"
                  onClick={() => setShowImportDialog(false)}
                >
                  关闭
                </button>
              </div>
            )}

            {!editingEntryId && (
              <div className="input-card">
                <form onSubmit={handleSubmit} className="diary-form">
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="写下你的想法..."
                    className="diary-textarea"
                  />
                  
                  <div className="input-toolbar">
                    <div className="toolbar-icons">
                      <button type="button" className="icon-button">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM18 20H6V4H13V9H18V20ZM8 16H16V18H8V16ZM8 12H16V14H8V12Z" fill="#666"/>
                        </svg>
                      </button>
                      <button type="button" className="icon-button">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M19 5V19H5V5H19ZM19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM14.14 11.86L11.14 15.73L9 13.14L6 17H18L14.14 11.86Z" fill="#666"/>
                        </svg>
                      </button>
                      <button type="button" className="icon-button">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" fill="#666"/>
                        </svg>
                      </button>
                    </div>
                    <button type="submit" disabled={!content.trim()} className="save-button">
                      保存日记
                    </button>
                  </div>
                </form>
              </div>
            )}
            
            {editingEntryId && (
              <div className="edit-form">
                <div className="edit-header">
                  <h2>编辑日记</h2>
                </div>
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
                      placeholder="编辑日记内容..."
                      className="diary-textarea"
                    />
                  </div>
                  
                  <div className="preview-pane">
                    <div className="markdown-preview" dangerouslySetInnerHTML={renderMarkdown(editContent)} />
                  </div>
                </div>
                
                <div className="button-group">
                  <button type="button" onClick={saveEditedEntry} className="save-button">
                    保存更改
                  </button>
                  <button type="button" onClick={cancelEditing} className="cancel-button">
                    取消
                  </button>
                </div>
              </div>
            )}

            {/* Selected Date Entry Display */}
            <div className="selected-date-entry">
              <div className="selected-date-header">
                <div className="selected-date">{formatDate(selectedDate)}</div>
              </div>
              
              {filteredEntries.length > 0 ? (
                <div className="entry-content-list">
                  {filteredEntries.map((entry) => (
                    <div key={entry.id} className="entry-content-item">
                      <div 
                        className="entry-content"
                        dangerouslySetInnerHTML={renderMarkdown(entry.content)}
                      />
                      <div className="entry-actions">
                        <button 
                          onClick={() => startEditing(entry)} 
                          className="edit-button"
                        >
                          编辑
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-entry-message">
                  这一天还没有日记内容
                </div>
              )}
            </div>

            <div className="themes-section">
              <h2>日记主题</h2>
              <div className="theme-tags">
                {themes.map(theme => (
                  <div 
                    key={theme.id} 
                    className={`theme-tag ${selectedTheme === theme.id ? 'active' : ''}`}
                    onClick={() => handleThemeClick(theme.id)}
                  >
                    {theme.name}
                  </div>
                ))}
              </div>
              <button className="add-theme-button">
                <span className="plus-icon">+</span>
                <span>添加主题</span>
              </button>

              {selectedTheme && themeRelatedEntries.length > 0 && (
                <div className="theme-related-entries">
                  <h3>与"{themes.find(t => t.id === selectedTheme)?.name}"相关的日记片段</h3>
                  <div className="theme-entries-list">
                    {themeRelatedEntries.map(entry => (
                      <div key={entry.id} className="theme-entry-item">
                        <div className="theme-entry-header">
                          <h4>{entry.title}</h4>
                          <span className="theme-entry-date">{entry.date}</span>
                        </div>
                        <div 
                          className="theme-entry-excerpt"
                          dangerouslySetInnerHTML={{ __html: entry.excerpt }}
                        />
                        <div className="theme-entry-footer">
                          <button className="view-details-button">查看详细</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="view-all-container">
                    <button className="view-all-button">查看全部相关日记</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        <aside className="calendar-container">
          <h2 className="calendar-title">日历</h2>
          <DiaryCalendar 
            entries={entries} 
            onDateSelect={handleDateSelect} 
            selectedDate={selectedDate}
          />

        </aside>
      </div>
    </div>
  );
}

export default App;
