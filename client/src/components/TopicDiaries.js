import React, { useState, useEffect } from 'react';
import '../styles/TopicDiaries.css';

const TopicDiaries = ({ topics, onTopicSelect, selectedTopicId, onBack }) => {
  const [topicEntries, setTopicEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage] = useState(5);
  const [sortNewestFirst, setSortNewestFirst] = useState(true);

  useEffect(() => {
    if (selectedTopicId) {
      fetchTopicEntries(selectedTopicId);
    }
  }, [selectedTopicId]);

  // Fetch entries for the selected topic
  const fetchTopicEntries = async (topicId) => {
    try {
      setIsLoading(true);
      const response = await fetch(`http://localhost:3001/api/topic-entries/${topicId}`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.status === 'success' && data.entries && data.entries.length > 0) {
          // Process entries to ensure proper formatting with highlights
          const formattedEntries = data.entries.map(entry => {
            let excerpt = entry.excerpt || '';
            const topicName = topics.find(t => t.id === topicId)?.name;
            
            // Ensure excerpt starts with ellipsis if not already
            if (!excerpt.startsWith('...')) {
              excerpt = '...' + excerpt;
            }
            
            // Find the topic name position in the excerpt
            if (topicName && excerpt.includes(topicName)) {
              // Find the position of the topic name
              const topicPos = excerpt.indexOf(topicName);
              
              // Get the part of the sentence containing the topic
              let sentenceStart = excerpt.lastIndexOf('。', topicPos);
              sentenceStart = sentenceStart === -1 ? 0 : sentenceStart + 1;
              
              // Find the first period after the topic name
              const periodPos = excerpt.indexOf('。', topicPos);
              const englishPeriodPos = excerpt.indexOf('.', topicPos);
              const commaPos = excerpt.indexOf('，', topicPos);
              
              // Determine which punctuation comes first (if any)
              let cutoffPos = -1;
              if (periodPos !== -1) {
                cutoffPos = periodPos;
              }
              if (englishPeriodPos !== -1 && (cutoffPos === -1 || englishPeriodPos < cutoffPos)) {
                cutoffPos = englishPeriodPos;
              }
              if (commaPos !== -1 && (cutoffPos === -1 || commaPos < cutoffPos)) {
                cutoffPos = commaPos;
              }
              
              // Truncate the excerpt if a punctuation was found
              if (cutoffPos !== -1) {
                excerpt = excerpt.substring(sentenceStart, cutoffPos + 1); // Include the punctuation
                if (!excerpt.endsWith('...')) {
                  excerpt = excerpt + '...';
                }
              }
              
              // Add highlighting to the topic name
              excerpt = excerpt.replace(
                new RegExp(topicName, 'g'), 
                `<span class="highlight">${topicName}</span>`
              );
            }
            
            return {
              ...entry,
              excerpt: excerpt
            };
          });
          
          setTopicEntries(formattedEntries);
        } else {
          setTopicEntries([]);
        }
      } else {
        console.error('Failed to fetch topic entries');
        setTopicEntries([]);
      }
    } catch (error) {
      console.error('Error fetching topic entries:', error);
      setTopicEntries([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Get current entries for pagination
  const getCurrentEntries = () => {
    // Sort entries based on the current sort setting
    const sortedEntries = [...topicEntries].sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return sortNewestFirst ? dateB - dateA : dateA - dateB;
    });
    
    // Calculate pagination indices
    const indexOfLastEntry = currentPage * entriesPerPage;
    const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
    
    // Return the current page of entries
    return sortedEntries.slice(indexOfFirstEntry, indexOfLastEntry);
  };

  // Change page
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div className="topic-diaries-container">
      {/* Left sidebar with topics */}
      <div className="topic-sidebar">
        <h2>日记主题</h2>
        <div className="topic-list">
          {topics.map(topic => (
            <div 
              key={topic.id}
              className={`topic-item ${selectedTopicId === topic.id ? 'active' : ''}`}
              onClick={() => onTopicSelect(topic.id)}
            >
              {topic.name}
            </div>
          ))}
        </div>
      </div>

      {/* Right content with entries */}
      <div className="topic-entries-content">
        {selectedTopicId ? (
          <>
            <div className="topic-entries-header">
              <h2>"{topics.find(t => t.id === selectedTopicId)?.name}" 相关日记</h2>
              <div className="sort-toggle">
                <span className={!sortNewestFirst ? 'active' : ''}>最早</span>
                <label className="switch">
                  <input 
                    type="checkbox" 
                    checked={sortNewestFirst}
                    onChange={() => {
                      setSortNewestFirst(!sortNewestFirst);
                      setCurrentPage(1); // Reset to first page when changing sort order
                    }}
                  />
                  <span className="slider round"></span>
                </label>
                <span className={sortNewestFirst ? 'active' : ''}>最新</span>
              </div>
            </div>

            {isLoading ? (
              <div className="loading-message">正在加载相关日记...</div>
            ) : topicEntries.length === 0 ? (
              <div className="no-entries-message">没有找到相关日记</div>
            ) : (
              <>
                <div className="topic-entries-list">
                  {getCurrentEntries().map(entry => (
                    <div key={entry.id} className="topic-entry-item">
                      <div className="topic-entry-header">
                        <span className="topic-entry-date">{entry.date}</span>
                      </div>
                      <div 
                        className="topic-entry-excerpt"
                        dangerouslySetInnerHTML={{ __html: entry.excerpt }}
                      />
                    </div>
                  ))}
                </div>
                
                {/* Pagination */}
                {topicEntries.length > entriesPerPage && (
                  <div className="pagination">
                    {Array.from({ length: Math.ceil(topicEntries.length / entriesPerPage) }).map((_, index) => (
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
            )}
          </>
        ) : (
          <div className="select-topic-message">请选择一个主题查看相关日记</div>
        )}
      </div>
    </div>
  );
};

export default TopicDiaries; 