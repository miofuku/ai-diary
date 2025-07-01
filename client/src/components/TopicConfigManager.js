import React, { useState, useEffect } from 'react';
import '../styles/TopicConfigManager.css';

const TopicConfigManager = ({ onTopicsUpdated }) => {
  const [config, setConfig] = useState(null);
  const [allTopics, setAllTopics] = useState([]);
  const [visibleTopics, setVisibleTopics] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('visible');
  const [newCustomTopic, setNewCustomTopic] = useState({
    name: '',
    keywords: '',
    category: 'custom',
    color: '#ff6b6b'
  });

  useEffect(() => {
    loadTopicData();
  }, []);

  const loadTopicData = async () => {
    try {
      setIsLoading(true);
      
      // Load configuration
      const configResponse = await fetch('http://localhost:3001/api/topic-config');
      const configData = await configResponse.json();
      
      // Load all topics
      const topicsResponse = await fetch('http://localhost:3001/api/topics/all');
      const topicsData = await topicsResponse.json();
      
      // Load visible topics
      const visibleResponse = await fetch('http://localhost:3001/api/topics/visible');
      const visibleData = await visibleResponse.json();
      
      if (configData.status === 'success') {
        setConfig(configData.config);
      }
      
      if (topicsData.status === 'success') {
        setAllTopics(topicsData.topics);
      }
      
      if (visibleData.status === 'success') {
        setVisibleTopics(visibleData.topics);
      }
      
    } catch (err) {
      console.error('Error loading topic data:', err);
      setError('Failed to load topic data');
    } finally {
      setIsLoading(false);
    }
  };

  const updateTopicVisibility = async (topicId, visible) => {
    try {
      const response = await fetch('http://localhost:3001/api/topics/visibility', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic_id: topicId,
          visible: visible
        })
      });
      
      const data = await response.json();
      if (data.status === 'success') {
        // Reload data to reflect changes
        loadTopicData();
        // Notify parent component to refresh topics
        if (onTopicsUpdated) {
          onTopicsUpdated();
        }
      } else {
        setError('Failed to update topic visibility');
      }
    } catch (err) {
      console.error('Error updating topic visibility:', err);
      setError('Failed to update topic visibility');
    }
  };

  const updateTopicPriority = async (topicId, priority) => {
    try {
      const response = await fetch('http://localhost:3001/api/topics/priority', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic_id: topicId,
          priority: priority
        })
      });
      
      const data = await response.json();
      if (data.status === 'success') {
        loadTopicData();
        if (onTopicsUpdated) {
          onTopicsUpdated();
        }
      } else {
        setError('Failed to update topic priority');
      }
    } catch (err) {
      console.error('Error updating topic priority:', err);
      setError('Failed to update topic priority');
    }
  };

  const createCustomTopic = async () => {
    if (!newCustomTopic.name.trim()) {
      setError('Topic name is required');
      return;
    }
    
    try {
      const response = await fetch('http://localhost:3001/api/topics/custom', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newCustomTopic.name,
          keywords: newCustomTopic.keywords.split(',').map(k => k.trim()).filter(k => k),
          category: newCustomTopic.category,
          color: newCustomTopic.color
        })
      });
      
      const data = await response.json();
      if (data.status === 'success') {
        setNewCustomTopic({
          name: '',
          keywords: '',
          category: 'custom',
          color: '#ff6b6b'
        });
        loadTopicData();
        if (onTopicsUpdated) {
          onTopicsUpdated();
        }
      } else {
        setError('Failed to create custom topic');
      }
    } catch (err) {
      console.error('Error creating custom topic:', err);
      setError('Failed to create custom topic');
    }
  };

  const deleteCustomTopic = async (topicId) => {
    try {
      const response = await fetch(`http://localhost:3001/api/topics/custom/${topicId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      if (data.status === 'success') {
        loadTopicData();
        if (onTopicsUpdated) {
          onTopicsUpdated();
        }
      } else {
        setError('Failed to delete custom topic');
      }
    } catch (err) {
      console.error('Error deleting custom topic:', err);
      setError('Failed to delete custom topic');
    }
  };

  const getCategoryIcon = (category) => {
    const icons = {
      'people': '👤',
      'projects': '📁',
      'activities': '🎯',
      'places': '📍',
      'custom': '⭐',
      'concepts': '💡',
      'technologies': '⚙️',
      'skills': '🎓'
    };
    return icons[category] || '📝';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      1: '#ff6b6b',
      2: '#ffa726',
      3: '#66bb6a',
      4: '#42a5f5',
      5: '#ab47bc'
    };
    return colors[priority] || '#66bb6a';
  };

  if (isLoading) {
    return <div className="topic-config-loading">Loading topic configuration...</div>;
  }

  if (error) {
    return <div className="topic-config-error">{error}</div>;
  }

  return (
    <div className="topic-config-manager">
      <div className="topic-config-header">
        <h2>主题管理</h2>
        <p>管理您的日记主题显示和优先级设置</p>
      </div>

      <div className="topic-config-tabs">
        <button 
          className={`tab-button ${activeTab === 'visible' ? 'active' : ''}`}
          onClick={() => setActiveTab('visible')}
        >
          显示的主题 ({visibleTopics.length})
        </button>
        <button 
          className={`tab-button ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          所有主题 ({allTopics.length})
        </button>
        <button 
          className={`tab-button ${activeTab === 'custom' ? 'active' : ''}`}
          onClick={() => setActiveTab('custom')}
        >
          自定义主题
        </button>
        <button 
          className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          设置
        </button>
      </div>

      <div className="topic-config-content">
        {activeTab === 'visible' && (
          <div className="visible-topics-tab">
            <h3>当前显示的主题</h3>
            <div className="topics-grid">
              {visibleTopics.map(topic => (
                <div key={topic.id} className="topic-card visible">
                  <div className="topic-header">
                    <span className="topic-icon">{getCategoryIcon(topic.category)}</span>
                    <span className="topic-name">{topic.name}</span>
                    <span 
                      className="topic-priority"
                      style={{ backgroundColor: getPriorityColor(topic.user_priority) }}
                    >
                      {topic.user_priority}
                    </span>
                  </div>
                  <div className="topic-category">{topic.category}</div>
                  <div className="topic-actions">
                    <select 
                      value={topic.user_priority || 3}
                      onChange={(e) => updateTopicPriority(topic.id, parseInt(e.target.value))}
                      className="priority-select"
                    >
                      <option value={1}>优先级 1</option>
                      <option value={2}>优先级 2</option>
                      <option value={3}>优先级 3</option>
                      <option value={4}>优先级 4</option>
                      <option value={5}>优先级 5</option>
                    </select>
                    <button 
                      onClick={() => updateTopicVisibility(topic.id, false)}
                      className="hide-button"
                    >
                      隐藏
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'all' && (
          <div className="all-topics-tab">
            <h3>所有可用主题</h3>
            <div className="topics-grid">
              {allTopics.map(topic => (
                <div key={topic.id} className={`topic-card ${topic.is_visible ? 'visible' : 'hidden'}`}>
                  <div className="topic-header">
                    <span className="topic-icon">{getCategoryIcon(topic.category)}</span>
                    <span className="topic-name">{topic.name}</span>
                    <span 
                      className="topic-priority"
                      style={{ backgroundColor: getPriorityColor(topic.user_priority) }}
                    >
                      {topic.user_priority}
                    </span>
                  </div>
                  <div className="topic-category">{topic.category}</div>
                  <div className="topic-actions">
                    <button 
                      onClick={() => updateTopicVisibility(topic.id, !topic.is_visible)}
                      className={topic.is_visible ? 'hide-button' : 'show-button'}
                    >
                      {topic.is_visible ? '隐藏' : '显示'}
                    </button>
                    {topic.type === 'custom' && (
                      <button 
                        onClick={() => deleteCustomTopic(topic.id)}
                        className="delete-button"
                      >
                        删除
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'custom' && (
          <div className="custom-topics-tab">
            <h3>创建自定义主题</h3>
            <div className="custom-topic-form">
              <div className="form-group">
                <label>主题名称</label>
                <input 
                  type="text"
                  value={newCustomTopic.name}
                  onChange={(e) => setNewCustomTopic({...newCustomTopic, name: e.target.value})}
                  placeholder="输入主题名称"
                />
              </div>
              <div className="form-group">
                <label>关键词 (用逗号分隔)</label>
                <input 
                  type="text"
                  value={newCustomTopic.keywords}
                  onChange={(e) => setNewCustomTopic({...newCustomTopic, keywords: e.target.value})}
                  placeholder="关键词1, 关键词2, 关键词3"
                />
              </div>
              <div className="form-group">
                <label>分类</label>
                <select 
                  value={newCustomTopic.category}
                  onChange={(e) => setNewCustomTopic({...newCustomTopic, category: e.target.value})}
                >
                  <option value="custom">自定义</option>
                  <option value="projects">项目</option>
                  <option value="activities">活动</option>
                  <option value="concepts">概念</option>
                </select>
              </div>
              <div className="form-group">
                <label>颜色</label>
                <input 
                  type="color"
                  value={newCustomTopic.color}
                  onChange={(e) => setNewCustomTopic({...newCustomTopic, color: e.target.value})}
                />
              </div>
              <button onClick={createCustomTopic} className="create-button">
                创建主题
              </button>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="settings-tab">
            <h3>主题设置</h3>
            {config && (
              <div className="settings-form">
                <div className="setting-group">
                  <label>
                    <input 
                      type="checkbox"
                      checked={config.auto_detection_settings?.enabled || false}
                      onChange={(e) => {
                        // Update auto detection setting
                        // This would need to call the API to update the config
                      }}
                    />
                    启用自动主题检测
                  </label>
                </div>
                <div className="setting-group">
                  <label>检测频率</label>
                  <select value={config.auto_detection_settings?.frequency || 'weekly'}>
                    <option value="daily">每日</option>
                    <option value="weekly">每周</option>
                    <option value="monthly">每月</option>
                  </select>
                </div>
                <div className="setting-group">
                  <label>最少提及次数</label>
                  <input 
                    type="number"
                    min="1"
                    max="10"
                    value={config.auto_detection_settings?.min_mentions || 3}
                  />
                </div>
                <div className="setting-group">
                  <label>最多显示主题数</label>
                  <input 
                    type="number"
                    min="5"
                    max="50"
                    value={config.display_settings?.max_topics_shown || 15}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TopicConfigManager;
