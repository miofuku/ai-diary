import React, { useState, useEffect } from 'react';
import '../styles/TopicThreads.css';

const TopicThreads = () => {
  const [topicThreads, setTopicThreads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedTopic, setExpandedTopic] = useState(null);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  // 预定义的主题分类
  const categories = [
    { id: 'all', name: '全部主题' },
    { id: 'projects', name: '项目' },
    { id: 'people', name: '人物' },
    { id: 'places', name: '地点' },
    { id: 'activities', name: '活动' }
  ];

  useEffect(() => {
    fetchTopicThreads();
  }, []);

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
      
      // 为每个主题分配一个分类
      const processedTopics = (data.topics || []).map(topic => {
        // 这里可以根据主题名称或内容来确定分类
        // 简单示例：根据关键词分类
        let category = 'activities';
        if (topic.name.includes('项目') || topic.name.includes('工作')) {
          category = 'projects';
        } else if (topic.name.includes('人') || topic.name.includes('朋友') || topic.name.includes('家人')) {
          category = 'people';
        } else if (topic.name.includes('地点') || topic.name.includes('旅行') || topic.name.includes('城市')) {
          category = 'places';
        }
        
        return {
          ...topic,
          category
        };
      });
      
      setTopicThreads(processedTopics);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to fetch topic threads:', error);
      setError('无法加载主题线索。请稍后再试。');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTopic = (topicId) => {
    if (expandedTopic === topicId) {
      setExpandedTopic(null);
    } else {
      setExpandedTopic(topicId);
    }
  };

  const refreshTopics = async () => {
    await fetchTopicThreads();
  };

  const handleCategoryClick = (categoryId) => {
    setSelectedCategory(categoryId === 'all' ? null : categoryId);
  };

  const filteredTopics = selectedCategory
    ? topicThreads.filter(topic => topic.category === selectedCategory)
    : topicThreads;

  if (isLoading) {
    return <div className="topic-threads-container loading">正在加载主题线索...</div>;
  }

  if (error) {
    return <div className="topic-threads-container error">{error}</div>;
  }

  return (
    <div className="topic-threads-container">
      <div className="topic-header-section">
        <h2>日记主题</h2>
        <button className="refresh-button" onClick={refreshTopics}>
          刷新主题
        </button>
      </div>
      <p className="topic-description">
        您日记中的重复主题及其发展
        {lastUpdate && <span className="last-update"> · 更新于: {lastUpdate.toLocaleTimeString()}</span>}
      </p>
      
      <div className="category-filters">
        {categories.map(category => (
          <button 
            key={category.id}
            className={`category-button ${selectedCategory === category.id || (category.id === 'all' && !selectedCategory) ? 'active' : ''}`}
            onClick={() => handleCategoryClick(category.id)}
          >
            {category.name}
          </button>
        ))}
      </div>
      
      {filteredTopics.length === 0 ? (
        <div className="no-topics">
          {selectedCategory ? '该分类下暂无主题。' : '暂未找到重复主题。继续添加更多日记条目以查看关联。'}
          <div className="tips">
            <p>提示:</p>
            <ul>
              <li>添加至少2-3个条目开始查看关联</li>
              <li>在不同条目中提及相同的主题</li>
              <li>添加新条目后点击"刷新主题"</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="topic-list">
          {filteredTopics.map((topic, index) => (
            <div 
              key={index} 
              className={`topic-card ${expandedTopic === index ? 'expanded' : ''}`}
            >
              <div 
                className="topic-header" 
                onClick={() => toggleTopic(index)}
              >
                <div className="topic-header-content">
                  <h3>{topic.name}</h3>
                  <span className="topic-category-tag">{categories.find(c => c.id === topic.category)?.name || '其他'}</span>
                </div>
                <div className="topic-summary">{topic.summary}</div>
                <div className="expand-icon">{expandedTopic === index ? '▼' : '►'}</div>
              </div>
              
              {expandedTopic === index && (
                <div className="topic-timeline">
                  <div className="progression-summary">
                    <h4>发展历程</h4>
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