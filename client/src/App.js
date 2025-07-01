import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import DiaryCalendar from './components/DiaryCalendar';

import TopicGraph from './components/TopicGraph';
import TopicConfigManager from './components/TopicConfigManager';

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
  const [activeTab, setActiveTab] = useState('home');
  const fileInputRef = useRef(null);
  // Add state for dynamic topics
  const [dynamicTopics, setDynamicTopics] = useState([]);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);
  // Add state for pagination and sort order
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage] = useState(5);
  const [sortNewestFirst, setSortNewestFirst] = useState(false);
  // Add state for theme entries pagination and sorting
  const [themeCurrentPage, setThemeCurrentPage] = useState(1);
  const [themeEntriesPerPage] = useState(3);
  const [themeSortNewestFirst, setThemeSortNewestFirst] = useState(true);
  // Add state for topic management modal
  const [showTopicManager, setShowTopicManager] = useState(false);
  
  // No static themes - all topics should come from actual diary entries

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
    // Reset to first page when entries change
    setCurrentPage(1);
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

  // Update fetchTopicThreads to use GraphQL topic_graph endpoint
  const fetchTopicThreads = async () => {
    setIsLoadingTopics(true);
    try {
      // Use the new topic configuration API to get user's visible topics
      const response = await fetch('http://localhost:3001/api/topics/visible');
      const data = await response.json();

      if (data.status === 'success') {
        console.log('Topics loaded from topic configuration API');
        setDynamicTopics(data.topics);
        setIsLoadingTopics(false);
        return;
      }

      // Fall back to GraphQL endpoint if topic config API fails
      console.log('Falling back to GraphQL endpoint for topics');
      const graphqlResponse = await fetch('http://localhost:3001/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            query {
              topicGraph {
                topics {
                  id
                  name
                  type
                  category
                  topicType
                  importance
                  sentiment
                  context
                }
                people {
                  id
                  name
                  type
                  category
                  role
                  importance
                }
                relations {
                  source
                  target
                  type
                  strength
                }
              }
            }
          `
        }),
      });

      const graphqlData = await graphqlResponse.json();

      if (graphqlData && graphqlData.data && graphqlData.data.topicGraph) {
        console.log('Topics loaded from GraphQL endpoint');

        // Process the topics and people data
        const topics = graphqlData.data.topicGraph.topics || [];
        const people = graphqlData.data.topicGraph.people || [];

        // Combine topics and people with proper formatting
        const formattedTopics = [
          ...topics.map(topic => ({
            id: topic.id,
            name: topic.name,
            type: 'topic',
            category: topic.category || 'general',
            importance: topic.importance || 3
          })),
          ...people.map(person => ({
            id: person.id,
            name: person.name,
            type: 'person',
            category: 'people',
            importance: person.importance || 3
          }))
        ];

        // Sort by importance (highest first) and then by name
        formattedTopics.sort((a, b) => {
          if (b.importance !== a.importance) {
            return b.importance - a.importance;
          }
          return a.name.localeCompare(b.name);
        });

        setDynamicTopics(formattedTopics);
        setIsLoadingTopics(false);
        return;
      }

      // Final fallback to the old API
      console.log('Falling back to topic-threads API endpoint');
      const fallbackResponse = await fetch('http://localhost:3001/api/topic-threads');
      const fallbackData = await fallbackResponse.json();
      setDynamicTopics(fallbackData.topics || []);
    } catch (error) {
      console.error('Error fetching topics:', error);
      // Try final fallback API
      try {
        const response = await fetch('http://localhost:3001/api/topic-threads');
        const data = await response.json();
        setDynamicTopics(data.topics || []);
      } catch (fallbackError) {
        console.error('Error with fallback topic fetch:', fallbackError);
        setDynamicTopics([]);
      }
    } finally {
      setIsLoadingTopics(false);
    }
  };



  // 在组件加载时获取主题
  useEffect(() => {
    fetchTopicThreads();
  }, []);

  const handleThemeClick = (themeId) => {
    if (selectedTheme === themeId) {
      // If clicking the same theme, unselect it
      setSelectedTheme(null);
      setThemeRelatedEntries([]);
    } else {
      // Select the theme and show related entries
      setSelectedTheme(themeId);
      setThemeCurrentPage(1); // Reset to first page when changing themes
      
      // All themes now come from API - fetch entries for this topic
      fetchTopicEntries(themeId);
    }
  };

  // 获取特定主题相关的日记条目
  const fetchTopicEntries = async (topicId) => {
    try {
      setIsLoadingTopics(true);
      const response = await fetch(`http://localhost:3001/api/topic-entries/${topicId}?concise=true`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Topic entries fetched:', data);
        
        if (data.status === 'success' && data.entries && data.entries.length > 0) {
          // Ensure each excerpt starts and ends with ellipsis if not already present
          const formattedEntries = data.entries.map(entry => {
            let excerpt = entry.excerpt;
            
            // Make sure excerpt starts with ellipsis if it doesn't already
            if (!excerpt.startsWith('...')) {
              excerpt = '...' + excerpt;
            }
            
            // Make sure excerpt ends with ellipsis if it doesn't already
            if (!excerpt.endsWith('...')) {
              excerpt = excerpt + '...';
            }
            
            return {
              ...entry,
              excerpt: excerpt
            };
          });
          
          setThemeRelatedEntries(formattedEntries);
        } else {
          setThemeRelatedEntries([]);
        }
      } else {
        console.error('Failed to fetch topic entries');
        setThemeRelatedEntries([]);
      }
    } catch (error) {
      console.error('Error fetching topic entries:', error);
      setThemeRelatedEntries([]);
    } finally {
      setIsLoadingTopics(false);
    }
  };

  // Toggle theme entries sort order
  const toggleThemeSortOrder = () => {
    setThemeSortNewestFirst(!themeSortNewestFirst);
    setThemeCurrentPage(1); // Reset to first page when changing sort order
  };

  // Get current theme entries for pagination
  const getCurrentThemeEntries = () => {
    // Sort entries based on sort order
    const sortedEntries = [...themeRelatedEntries].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return themeSortNewestFirst ? dateB - dateA : dateA - dateB;
    });
    
    // Get current page entries
    const indexOfLastEntry = themeCurrentPage * themeEntriesPerPage;
    const indexOfFirstEntry = indexOfLastEntry - themeEntriesPerPage;
    return sortedEntries.slice(indexOfFirstEntry, indexOfLastEntry);
  };

  // Change theme entries page
  const themeEntriesPaginate = (pageNumber) => setThemeCurrentPage(pageNumber);

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

  // Add a function to handle tab changes
  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };



  // Get current entries for pagination
  const getCurrentEntries = () => {
    // Sort entries based on sort order
    const sortedEntries = [...filteredEntries].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortNewestFirst ? dateB - dateA : dateA - dateB;
    });
    
    // Get current page entries
    const indexOfLastEntry = currentPage * entriesPerPage;
    const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
    return sortedEntries.slice(indexOfFirstEntry, indexOfLastEntry);
  };

  // Change page
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // Handle "查看全部相关日记" button click
  const handleViewAllTopicEntries = () => {
    if (selectedTheme) {
      setActiveTab('diary');
    }
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
            <a 
              href="#" 
              className={`nav-link ${activeTab === 'home' ? 'active' : ''}`}
              onClick={() => handleTabChange('home')}
            >首页</a>
            <a
              href="#"
              className={`nav-link ${activeTab === 'diary' ? 'active' : ''}`}
              onClick={() => handleTabChange('diary')}
            >主题</a>
            <a
              href="#"
              className={`nav-link ${activeTab === 'calendar' ? 'active' : ''}`}
              onClick={() => handleTabChange('calendar')}
            >日历</a>
          </nav>
        </div>

      </header>
      
      <div className="app-container">
        <main className="content-container">
          <div className="content-inner">
            <div className="page-header">
              <h1>{
                  activeTab === 'home' ? '首页' :
                  activeTab === 'diary' ? '主题' :
                  '日历'}</h1>
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

            {/* Edit form - keep this outside tab content as it's modal-like */}
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

            {/* Home tab content */}
            {activeTab === 'home' && !editingEntryId && (
              <>
                {/* Input form for new entries */}
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
                
                {/* Selected Date Entry Display */}
                <div className="selected-date-entry">
                  <div className="selected-date-header">
                    <div className="selected-date">{formatDate(selectedDate)}</div>
                  </div>
                  
                  {filteredEntries.length > 0 ? (
                    <>
                      <div className="entry-content-list">
                        {getCurrentEntries().map((entry) => (
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
                      
                      {/* Pagination */}
                      {filteredEntries.length > entriesPerPage && (
                        <div className="pagination">
                          {Array.from({ length: Math.ceil(filteredEntries.length / entriesPerPage) }).map((_, index) => (
                            <button
                              key={index}
                              onClick={() => paginate(index + 1)}
                              className={`page-button ${currentPage === index + 1 ? 'active' : ''}`}
                            >
                              {index + 1}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="no-entry-message">
                      这一天还没有日记内容
                    </div>
                  )}
                </div>

                <div className="themes-section">
                  <h2>日记主题</h2>
                  {isLoadingTopics ? (
                    <div className="loading-topics">正在加载主题...</div>
                  ) : (
                    <>
                      <div className="theme-display">
                        <div className="theme-header">
                          <span className="theme-count">{dynamicTopics.length} 个主题</span>
                          <div className="theme-quick-actions">
                            <button
                              className="quick-action-button"
                              onClick={() => setShowTopicManager(true)}
                              title="管理主题"
                            >
                              ⚙️
                            </button>
                            <button
                              className="quick-action-button"
                              onClick={fetchTopicThreads}
                              title="刷新主题"
                            >
                              🔄
                            </button>
                          </div>
                        </div>
                        <div className="theme-tags">
                          {/* 显示从实际日记条目中提取的主题 */}
                          {dynamicTopics.map(theme => (
                            <div
                              key={theme.id}
                              className={`theme-tag ${selectedTheme === theme.id ? 'active' : ''}`}
                              onClick={() => handleThemeClick(theme.id)}
                              title={`${theme.category} - 重要性: ${theme.importance || 3}`}
                            >
                              <span className="theme-icon">
                                {theme.category === 'people' ? '👤' :
                                 theme.category === 'projects' ? '📁' :
                                 theme.category === 'activities' ? '🎯' :
                                 theme.category === 'places' ? '📍' :
                                 theme.category === 'animals' ? '🐾' :
                                 theme.category === 'objects' ? '🔧' :
                                 theme.category === 'technologies' ? '💻' :
                                 theme.category === 'concepts' ? '💡' : '📝'}
                              </span>
                              <span className="theme-name">{theme.name}</span>
                              {theme.user_priority && theme.user_priority > 3 && (
                                <span className="theme-priority">⭐</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                    </>
                  )}

                  {selectedTheme && themeRelatedEntries.length > 0 && (
                    <div className="theme-related-entries">
                      <div className="theme-entries-header">
                        <h3>与"{dynamicTopics.find(t => t.id === selectedTheme)?.name}"相关的日记片段</h3>
                        <div className="sort-toggle">
                          <span className={!themeSortNewestFirst ? 'active' : ''}>最早</span>
                          <label className="switch">
                            <input 
                              type="checkbox" 
                              checked={themeSortNewestFirst}
                              onChange={toggleThemeSortOrder}
                            />
                            <span className="slider round"></span>
                          </label>
                          <span className={themeSortNewestFirst ? 'active' : ''}>最新</span>
                        </div>
                      </div>
                      <div className="theme-entries-list">
                        {getCurrentThemeEntries().map(entry => (
                          <div key={entry.id} className="theme-entry-item">
                            <div className="theme-entry-header">
                              <span className="theme-entry-date">{entry.date}</span>
                            </div>
                            <div 
                              className="theme-entry-excerpt"
                              dangerouslySetInnerHTML={{ __html: entry.excerpt }}
                            />
                          </div>
                        ))}
                      </div>
                      
                      {/* Theme entries pagination */}
                      {themeRelatedEntries.length > themeEntriesPerPage && (
                        <div className="pagination theme-pagination">
                          {Array.from({ length: Math.ceil(themeRelatedEntries.length / themeEntriesPerPage) }).map((_, index) => (
                            <button
                              key={index}
                              onClick={() => themeEntriesPaginate(index + 1)}
                              className={`page-button ${themeCurrentPage === index + 1 ? 'active' : ''}`}
                            >
                              {index + 1}
                            </button>
                          ))}
                        </div>
                      )}
                      
                      <div className="view-all-container">
                        <button 
                          className="view-all-button"
                          onClick={handleViewAllTopicEntries}
                        >
                          查看全部相关日记
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Topic Graph tab content */}
            {activeTab === 'diary' && !editingEntryId && (
              <TopicGraph />
            )}
          </div>
        </main>

        {/* Topic Management Modal */}
        {showTopicManager && (
          <div className="modal-overlay" onClick={() => setShowTopicManager(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>主题管理</h2>
                <button
                  className="modal-close-button"
                  onClick={() => setShowTopicManager(false)}
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <TopicConfigManager onTopicsUpdated={fetchTopicThreads} />
              </div>
            </div>
          </div>
        )}

        <aside className="calendar-container">
          <h2 className="calendar-title">日历</h2>
          <DiaryCalendar
            entries={entries}
            onDateSelect={handleDateSelect}
            selectedDate={selectedDate}
            onTabChange={handleTabChange}
          />
        </aside>
      </div>
    </div>
  );
}

export default App;
