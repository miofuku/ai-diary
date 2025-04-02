import React, { useState, useEffect } from 'react';
import '../styles/TopicThreads.css';

const TopicThreads = () => {
  const [topicThreads, setTopicThreads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedTopic, setExpandedTopic] = useState(null);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    const fetchTopicThreads = async () => {
      try {
        setIsLoading(true);
        console.log("Fetching topic threads...");
        const response = await fetch('http://localhost:3001/api/topic-threads');
        
        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Topic threads received:", data);
        setTopicThreads(data.topics || []);
        setLastUpdate(new Date());
      } catch (error) {
        console.error('Failed to fetch topic threads:', error);
        setError('Could not load topic threads. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTopicThreads();
  }, []);

  const toggleTopic = (topicId) => {
    if (expandedTopic === topicId) {
      setExpandedTopic(null);
    } else {
      setExpandedTopic(topicId);
    }
  };

  const refreshTopics = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('http://localhost:3001/api/topic-threads');
      if (response.ok) {
        const data = await response.json();
        setTopicThreads(data.topics || []);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Failed to refresh topics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="topic-threads-container loading">Loading topic threads...</div>;
  }

  if (error) {
    return <div className="topic-threads-container error">{error}</div>;
  }

  return (
    <div className="topic-threads-container">
      <div className="topic-header-section">
        <h2>Topic Threads</h2>
        <button className="refresh-button" onClick={refreshTopics}>
          Refresh Topics
        </button>
      </div>
      <p className="topic-description">
        Recurring themes and their progression in your diary
        {lastUpdate && <span className="last-update"> · Updated: {lastUpdate.toLocaleTimeString()}</span>}
      </p>
      
      {topicThreads.length === 0 ? (
        <div className="no-topics">
          No recurring topics found yet. Keep adding more entries to see connections.
          <div className="tips">
            <p>Tips:</p>
            <ul>
              <li>Add at least 2-3 entries to start seeing connections</li>
              <li>Mention the same topics across different entries</li>
              <li>Click "Refresh Topics" after adding new entries</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="topic-list">
          {topicThreads.map((topic, index) => (
            <div 
              key={index} 
              className={`topic-card ${expandedTopic === index ? 'expanded' : ''}`}
            >
              <div 
                className="topic-header" 
                onClick={() => toggleTopic(index)}
              >
                <h3>{topic.name}</h3>
                <div className="topic-summary">{topic.summary}</div>
                <div className="expand-icon">{expandedTopic === index ? '▼' : '►'}</div>
              </div>
              
              {expandedTopic === index && (
                <div className="topic-timeline">
                  <div className="progression-summary">
                    <h4>Progression</h4>
                    <p>{topic.progression}</p>
                  </div>
                  
                  <div className="timeline">
                    {(topic.mentions || []).map((mention, mIndex) => (
                      <div key={mIndex} className="timeline-entry">
                        <div className="timeline-date">
                          {new Date(mention.date).toLocaleDateString()}
                        </div>
                        <div className="timeline-connector">
                          <div className="connector-dot"></div>
                          <div className="connector-line"></div>
                        </div>
                        <div className="timeline-content">
                          <div className="entry-preview">
                            {mention.excerpt}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TopicThreads; 