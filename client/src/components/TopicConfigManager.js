import React, { useState, useEffect, useCallback } from 'react';
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
  const [pipelineStatus, setPipelineStatus] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopics, setSelectedTopics] = useState(new Set());
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [topicStats, setTopicStats] = useState({});
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const loadTopicStats = useCallback(async () => {
    try {
      // Get topic usage statistics
      const response = await fetch('http://localhost:3001/api/topic-stats');
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success') {
          setTopicStats(data.stats);
        }
      }
    } catch (err) {
      console.error('Error loading topic stats:', err);
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    try {
      setLoadingAnalytics(true);
      const response = await fetch('http://localhost:3001/api/topic-analytics');
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success') {
          setAnalytics(data.analytics);
        }
      }
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  }, []);

  const loadTopicData = useCallback(async () => {
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

      // Load pipeline status
      const pipelineResponse = await fetch('http://localhost:3001/api/topic-pipeline/status');
      const pipelineData = await pipelineResponse.json();

      if (pipelineData.status === 'success') {
        setPipelineStatus(pipelineData.pipeline_status);
      }

      // Load topic suggestions
      const suggestionsResponse = await fetch('http://localhost:3001/api/topic-suggestions');
      const suggestionsData = await suggestionsResponse.json();

      if (suggestionsData.status === 'success') {
        setSuggestions(suggestionsData.suggestions);
      }

      // Load topic statistics
      await loadTopicStats();

      // Load analytics if on analytics tab
      if (activeTab === 'analytics') {
        await loadAnalytics();
      }

    } catch (err) {
      console.error('Error loading topic data:', err);
      setError('Failed to load topic data');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, loadAnalytics, loadTopicStats]);

  useEffect(() => {
    loadTopicData();
  }, [loadTopicData]);

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

  const deleteTopic = async (topicId, topicName) => {
    // Show confirmation dialog
    const confirmed = window.confirm(`确定要删除主题 "${topicName}" 吗？\n\n此操作将：\n- 从所有视图中移除该主题\n- 删除相关的连接关系\n- 无法撤销\n\n确定继续吗？`);

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3001/api/topics/${topicId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.status === 'success') {
        loadTopicData();
        if (onTopicsUpdated) {
          onTopicsUpdated();
        }
        // Show success message
        alert(`主题 "${topicName}" 已成功删除`);
      } else {
        setError('Failed to delete topic');
      }
    } catch (err) {
      console.error('Error deleting topic:', err);
      setError('Failed to delete topic');
    }
  };

  const deleteSelectedTopics = async () => {
    if (selectedTopics.size === 0) {
      alert('请先选择要删除的主题');
      return;
    }

    const topicNames = Array.from(selectedTopics).map(id => {
      const topic = [...allTopics, ...visibleTopics].find(t => t.id === id);
      return topic ? topic.name : id;
    });

    const confirmed = window.confirm(`确定要删除以下 ${selectedTopics.size} 个主题吗？\n\n${topicNames.join('\n')}\n\n此操作将：\n- 从所有视图中移除这些主题\n- 删除相关的连接关系\n- 无法撤销\n\n确定继续吗？`);

    if (!confirmed) {
      return;
    }

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const topicId of selectedTopics) {
        try {
          const response = await fetch(`http://localhost:3001/api/topics/${topicId}`, {
            method: 'DELETE'
          });

          const data = await response.json();
          if (data.status === 'success') {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (err) {
          console.error(`Error deleting topic ${topicId}:`, err);
          errorCount++;
        }
      }

      // Clear selection
      setSelectedTopics(new Set());

      // Reload data
      loadTopicData();
      if (onTopicsUpdated) {
        onTopicsUpdated();
      }

      // Show result message
      if (errorCount === 0) {
        alert(`成功删除 ${successCount} 个主题`);
      } else {
        alert(`删除完成：成功 ${successCount} 个，失败 ${errorCount} 个`);
      }
    } catch (err) {
      console.error('Error in bulk delete:', err);
      setError('批量删除失败');
    }
  };

  const triggerPipelineRun = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/topic-pipeline/run', {
        method: 'POST'
      });

      const data = await response.json();
      if (data.status === 'success') {
        loadTopicData(); // Refresh data
      } else {
        setError(data.message || 'Failed to trigger pipeline');
      }
    } catch (err) {
      console.error('Error triggering pipeline:', err);
      setError('Failed to trigger pipeline');
    }
  };

  const processAllEntries = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/topic-pipeline/process-all-entries', {
        method: 'POST'
      });

      const data = await response.json();
      if (data.status === 'success') {
        loadTopicData(); // Refresh data
      } else {
        setError(data.message || 'Failed to process entries');
      }
    } catch (err) {
      console.error('Error processing entries:', err);
      setError('Failed to process entries');
    }
  };

  const approveSuggestion = async (suggestionId) => {
    try {
      const response = await fetch(`http://localhost:3001/api/topic-suggestions/approve/${suggestionId}`, {
        method: 'POST'
      });

      const data = await response.json();
      if (data.status === 'success') {
        loadTopicData();
        if (onTopicsUpdated) {
          onTopicsUpdated();
        }
      } else {
        setError('Failed to approve suggestion');
      }
    } catch (err) {
      console.error('Error approving suggestion:', err);
      setError('Failed to approve suggestion');
    }
  };

  const rejectSuggestion = async (suggestionId) => {
    try {
      const response = await fetch(`http://localhost:3001/api/topic-suggestions/reject/${suggestionId}`, {
        method: 'POST'
      });

      const data = await response.json();
      if (data.status === 'success') {
        loadTopicData();
      } else {
        setError('Failed to reject suggestion');
      }
    } catch (err) {
      console.error('Error rejecting suggestion:', err);
      setError('Failed to reject suggestion');
    }
  };

  const toggleTopicSelection = (topicId) => {
    const newSelected = new Set(selectedTopics);
    if (newSelected.has(topicId)) {
      newSelected.delete(topicId);
    } else {
      newSelected.add(topicId);
    }
    setSelectedTopics(newSelected);
    setShowBulkActions(newSelected.size > 0);
  };

  const selectAllTopics = (topics) => {
    const allIds = topics.map(t => t.id);
    setSelectedTopics(new Set(allIds));
    setShowBulkActions(true);
  };

  const clearSelection = () => {
    setSelectedTopics(new Set());
    setShowBulkActions(false);
  };

  const bulkUpdateVisibility = async (visible) => {
    try {
      const updates = Array.from(selectedTopics).map(topicId => ({
        topic_id: topicId,
        visible: visible
      }));

      const response = await fetch('http://localhost:3001/api/topics/bulk-visibility', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
      });

      const data = await response.json();
      if (data.status === 'success') {
        loadTopicData();
        clearSelection();
        if (onTopicsUpdated) {
          onTopicsUpdated();
        }
      } else {
        setError('Failed to update topics');
      }
    } catch (err) {
      console.error('Error bulk updating topics:', err);
      setError('Failed to update topics');
    }
  };

  const filterTopics = (topics) => {
    let filtered = topics;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(topic =>
        topic.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        topic.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply category filter
    if (filterCategory !== 'all') {
      filtered = filtered.filter(topic => topic.category === filterCategory);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'category':
          return a.category.localeCompare(b.category);
        case 'priority':
          return (b.user_priority || 3) - (a.user_priority || 3);
        case 'usage':
          const aUsage = topicStats[a.id]?.mention_count || 0;
          const bUsage = topicStats[b.id]?.mention_count || 0;
          return bUsage - aUsage;
        default:
          return 0;
      }
    });

    return filtered;
  };

  const getUniqueCategories = (topics) => {
    const categories = [...new Set(topics.map(t => t.category))];
    return categories.sort();
  };

  const getCategoryIcon = (category) => {
    const icons = {
      'people': '👤',
      'projects': '📁',
      'activities': '🎯',
      'places': '📍',
      'animals': '🐾',
      'objects': '🔧',
      'technologies': '💻',
      'concepts': '💡',
      'custom': '⭐',
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
          className={`tab-button ${activeTab === 'suggestions' ? 'active' : ''}`}
          onClick={() => setActiveTab('suggestions')}
        >
          建议 {suggestions?.pending_review?.length > 0 && `(${suggestions.pending_review.length})`}
        </button>
        <button
          className={`tab-button ${activeTab === 'pipeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('pipeline')}
        >
          检测管道
        </button>
        <button
          className={`tab-button ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('analytics');
            if (!analytics) loadAnalytics();
          }}
        >
          分析洞察
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
            <div className="tab-header">
              <h3>当前显示的主题</h3>
              <div className="topic-controls">
                <div className="search-box">
                  <input
                    type="text"
                    placeholder="搜索主题..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                  />
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="sort-select"
                >
                  <option value="name">按名称排序</option>
                  <option value="priority">按优先级排序</option>
                  <option value="category">按分类排序</option>
                  <option value="usage">按使用频率排序</option>
                </select>
              </div>
            </div>

            {showBulkActions && (
              <div className="bulk-actions">
                <span className="selection-count">已选择 {selectedTopics.size} 个主题</span>
                <div className="bulk-buttons">
                  <button onClick={() => bulkUpdateVisibility(false)} className="bulk-hide-button">
                    批量隐藏
                  </button>
                  <button onClick={deleteSelectedTopics} className="bulk-delete-button">
                    批量删除
                  </button>
                  <button onClick={clearSelection} className="clear-selection-button">
                    取消选择
                  </button>
                </div>
              </div>
            )}

            <div className="topics-grid">
              {filterTopics(visibleTopics).map(topic => (
                <div key={topic.id} className={`topic-card visible ${selectedTopics.has(topic.id) ? 'selected' : ''}`}>
                  <div className="topic-header">
                    <input
                      type="checkbox"
                      checked={selectedTopics.has(topic.id)}
                      onChange={() => toggleTopicSelection(topic.id)}
                      className="topic-checkbox"
                    />
                    <span className="topic-icon">{getCategoryIcon(topic.category)}</span>
                    <span className="topic-name">{topic.name}</span>
                    <span
                      className="topic-priority"
                      style={{ backgroundColor: getPriorityColor(topic.user_priority) }}
                    >
                      {topic.user_priority}
                    </span>
                  </div>
                  <div className="topic-meta">
                    <span className="topic-category">{topic.category}</span>
                    {topicStats[topic.id] && (
                      <span className="topic-usage">
                        使用 {topicStats[topic.id].mention_count} 次
                      </span>
                    )}
                  </div>
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
                    <button
                      onClick={() => deleteTopic(topic.id, topic.name)}
                      className="delete-button"
                      title="删除主题"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'all' && (
          <div className="all-topics-tab">
            <div className="tab-header">
              <h3>所有可用主题</h3>
              <div className="topic-controls">
                <div className="search-box">
                  <input
                    type="text"
                    placeholder="搜索主题..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                  />
                </div>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="category-filter"
                >
                  <option value="all">所有分类</option>
                  {getUniqueCategories(allTopics).map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="sort-select"
                >
                  <option value="name">按名称排序</option>
                  <option value="priority">按优先级排序</option>
                  <option value="category">按分类排序</option>
                  <option value="usage">按使用频率排序</option>
                </select>
              </div>
            </div>

            {showBulkActions && (
              <div className="bulk-actions">
                <span className="selection-count">已选择 {selectedTopics.size} 个主题</span>
                <div className="bulk-buttons">
                  <button onClick={() => bulkUpdateVisibility(true)} className="bulk-show-button">
                    批量显示
                  </button>
                  <button onClick={() => bulkUpdateVisibility(false)} className="bulk-hide-button">
                    批量隐藏
                  </button>
                  <button onClick={deleteSelectedTopics} className="bulk-delete-button">
                    批量删除
                  </button>
                  <button onClick={clearSelection} className="clear-selection-button">
                    取消选择
                  </button>
                </div>
              </div>
            )}

            <div className="topic-actions-bar">
              <button
                onClick={() => selectAllTopics(filterTopics(allTopics))}
                className="select-all-button"
              >
                全选当前页
              </button>
              <span className="topic-count">
                显示 {filterTopics(allTopics).length} / {allTopics.length} 个主题
              </span>
            </div>

            <div className="topics-grid">
              {filterTopics(allTopics).map(topic => (
                <div key={topic.id} className={`topic-card ${topic.is_visible ? 'visible' : 'hidden'} ${selectedTopics.has(topic.id) ? 'selected' : ''}`}>
                  <div className="topic-header">
                    <input
                      type="checkbox"
                      checked={selectedTopics.has(topic.id)}
                      onChange={() => toggleTopicSelection(topic.id)}
                      className="topic-checkbox"
                    />
                    <span className="topic-icon">{getCategoryIcon(topic.category)}</span>
                    <span className="topic-name">{topic.name}</span>
                    <span
                      className="topic-priority"
                      style={{ backgroundColor: getPriorityColor(topic.user_priority) }}
                    >
                      {topic.user_priority}
                    </span>
                    <span className={`visibility-badge ${topic.is_visible ? 'visible' : 'hidden'}`}>
                      {topic.is_visible ? '显示' : '隐藏'}
                    </span>
                  </div>
                  <div className="topic-meta">
                    <span className="topic-category">{topic.category}</span>
                    {topicStats[topic.id] && (
                      <span className="topic-usage">
                        使用 {topicStats[topic.id].mention_count} 次
                      </span>
                    )}
                    {topic.type && (
                      <span className="topic-type">{topic.type === 'person' ? '人物' : '主题'}</span>
                    )}
                  </div>
                  <div className="topic-actions">
                    <button
                      onClick={() => updateTopicVisibility(topic.id, !topic.is_visible)}
                      className={topic.is_visible ? 'hide-button' : 'show-button'}
                    >
                      {topic.is_visible ? '隐藏' : '显示'}
                    </button>
                    <button
                      onClick={() => deleteTopic(topic.id, topic.name)}
                      className="delete-button"
                      title="删除主题"
                    >
                      删除
                    </button>
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

        {activeTab === 'suggestions' && (
          <div className="suggestions-tab">
            <h3>主题建议</h3>
            {suggestions?.pending_review?.length > 0 ? (
              <div className="suggestions-list">
                {suggestions.pending_review.map(suggestion => (
                  <div key={suggestion.id} className="suggestion-card">
                    <div className="suggestion-header">
                      <span className="suggestion-icon">{getCategoryIcon(suggestion.category)}</span>
                      <span className="suggestion-name">{suggestion.name}</span>
                      <span className="suggestion-confidence">
                        置信度: {Math.round(suggestion.confidence * 100)}%
                      </span>
                    </div>
                    <div className="suggestion-details">
                      <p>类型: {suggestion.type === 'person' ? '人物' : '主题'}</p>
                      <p>提及次数: {suggestion.mention_count}</p>
                      <p>首次检测: {new Date(suggestion.first_detected).toLocaleDateString()}</p>
                    </div>
                    <div className="suggestion-actions">
                      <button
                        onClick={() => approveSuggestion(suggestion.id)}
                        className="approve-button"
                      >
                        批准
                      </button>
                      <button
                        onClick={() => rejectSuggestion(suggestion.id)}
                        className="reject-button"
                      >
                        拒绝
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-suggestions">
                <p>暂无待审核的主题建议</p>
                <button onClick={processAllEntries} className="process-button">
                  处理所有条目以生成建议
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'pipeline' && (
          <div className="pipeline-tab">
            <h3>主题检测管道</h3>
            {pipelineStatus && (
              <div className="pipeline-status">
                <div className="status-grid">
                  <div className="status-item">
                    <label>运行状态</label>
                    <span className={`status-badge ${pipelineStatus.is_running ? 'running' : 'idle'}`}>
                      {pipelineStatus.is_running ? '运行中' : '空闲'}
                    </span>
                  </div>
                  <div className="status-item">
                    <label>队列大小</label>
                    <span>{pipelineStatus.queue_size}</span>
                  </div>
                  <div className="status-item">
                    <label>待处理</label>
                    <span>{pipelineStatus.unprocessed_count}</span>
                  </div>
                  <div className="status-item">
                    <label>上次运行</label>
                    <span>
                      {pipelineStatus.last_run
                        ? new Date(pipelineStatus.last_run).toLocaleString()
                        : '从未运行'
                      }
                    </span>
                  </div>
                </div>

                <div className="pipeline-actions">
                  <button
                    onClick={triggerPipelineRun}
                    disabled={pipelineStatus.is_running || pipelineStatus.unprocessed_count === 0}
                    className="trigger-button"
                  >
                    {pipelineStatus.is_running ? '运行中...' : '立即运行'}
                  </button>
                  <button
                    onClick={processAllEntries}
                    disabled={pipelineStatus.is_running}
                    className="process-all-button"
                  >
                    处理所有条目
                  </button>
                  <button
                    onClick={loadTopicData}
                    className="refresh-button"
                  >
                    刷新状态
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="analytics-tab">
            <div className="analytics-header">
              <h3>主题分析洞察</h3>
              <button
                onClick={loadAnalytics}
                disabled={loadingAnalytics}
                className="refresh-analytics-button"
              >
                {loadingAnalytics ? '分析中...' : '刷新分析'}
              </button>
            </div>

            {loadingAnalytics && (
              <div className="analytics-loading">
                <div className="loading-spinner"></div>
                <p>正在分析您的主题数据...</p>
              </div>
            )}

            {analytics && !loadingAnalytics && (
              <div className="analytics-content">
                {/* Overview Section */}
                <div className="analytics-section">
                  <h4>📊 总览统计</h4>
                  <div className="overview-grid">
                    <div className="overview-card">
                      <div className="overview-number">{analytics.overview.total_topics}</div>
                      <div className="overview-label">总主题数</div>
                    </div>
                    <div className="overview-card">
                      <div className="overview-number">{analytics.overview.active_topics}</div>
                      <div className="overview-label">活跃主题</div>
                    </div>
                    <div className="overview-card">
                      <div className="overview-number">{analytics.overview.total_mentions}</div>
                      <div className="overview-label">总提及次数</div>
                    </div>
                    <div className="overview-card">
                      <div className="overview-number">{Math.round(analytics.overview.avg_mentions_per_topic)}</div>
                      <div className="overview-label">平均提及次数</div>
                    </div>
                  </div>
                </div>

                {/* Insights Section */}
                {analytics.insights && analytics.insights.length > 0 && (
                  <div className="analytics-section">
                    <h4>💡 智能洞察</h4>
                    <div className="insights-list">
                      {analytics.insights.map((insight, index) => (
                        <div key={index} className={`insight-card ${insight.type}`}>
                          <div className="insight-header">
                            <span className="insight-title">{insight.title}</span>
                          </div>
                          <div className="insight-description">{insight.description}</div>
                          {insight.topics && (
                            <div className="insight-topics">
                              {insight.topics.map((topic, i) => (
                                <span key={i} className="insight-topic">
                                  {topic.name} ({topic.mentions}次)
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trends Section */}
                {analytics.trends && analytics.trends.topic_trends && (
                  <div className="analytics-section">
                    <h4>📈 主题趋势</h4>
                    <div className="trends-list">
                      {analytics.trends.topic_trends.slice(0, 5).map((trend, index) => (
                        <div key={index} className="trend-card">
                          <div className="trend-header">
                            <span className="trend-name">{trend.topic_name}</span>
                            <span className={`trend-direction ${trend.trend_direction}`}>
                              {trend.trend_direction === 'up' ? '📈' :
                               trend.trend_direction === 'down' ? '📉' : '➡️'}
                            </span>
                          </div>
                          <div className="trend-stats">
                            <span className="trend-category">{trend.category}</span>
                            <span className="trend-mentions">{trend.total_mentions} 次提及</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations Section */}
                {analytics.recommendations && analytics.recommendations.length > 0 && (
                  <div className="analytics-section">
                    <h4>🎯 优化建议</h4>
                    <div className="recommendations-list">
                      {analytics.recommendations.map((rec, index) => (
                        <div key={index} className={`recommendation-card priority-${rec.priority}`}>
                          <div className="recommendation-header">
                            <span className="recommendation-title">{rec.title}</span>
                            <span className={`priority-badge ${rec.priority}`}>
                              {rec.priority === 'high' ? '高' : rec.priority === 'medium' ? '中' : '低'}
                            </span>
                          </div>
                          <div className="recommendation-description">{rec.description}</div>
                          {rec.type === 'create_topics' && rec.suggestions && (
                            <div className="topic-suggestions">
                              {rec.suggestions.map((suggestion, i) => (
                                <span key={i} className="suggested-topic">
                                  {suggestion.phrase} ({suggestion.count}次)
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Activity Patterns */}
                {analytics.activity_patterns && (
                  <div className="analytics-section">
                    <h4>⏰ 活动模式</h4>
                    <div className="patterns-grid">
                      {analytics.activity_patterns.peak_hour && (
                        <div className="pattern-card">
                          <div className="pattern-title">最活跃时间</div>
                          <div className="pattern-value">
                            {analytics.activity_patterns.peak_hour[0]}:00
                            ({analytics.activity_patterns.peak_hour[1]} 条记录)
                          </div>
                        </div>
                      )}
                      {analytics.activity_patterns.peak_day && (
                        <div className="pattern-card">
                          <div className="pattern-title">最活跃日期</div>
                          <div className="pattern-value">
                            {analytics.activity_patterns.peak_day[0]}
                            ({analytics.activity_patterns.peak_day[1]} 条记录)
                          </div>
                        </div>
                      )}
                      {analytics.activity_patterns.peak_month && (
                        <div className="pattern-card">
                          <div className="pattern-title">最活跃月份</div>
                          <div className="pattern-value">
                            {analytics.activity_patterns.peak_month[0]}
                            ({analytics.activity_patterns.peak_month[1]} 条记录)
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Topic Relationships */}
                {analytics.topic_relationships && analytics.topic_relationships.length > 0 && (
                  <div className="analytics-section">
                    <h4>🔗 主题关联</h4>
                    <div className="relationships-list">
                      {analytics.topic_relationships.slice(0, 5).map((rel, index) => (
                        <div key={index} className="relationship-card">
                          <div className="relationship-topics">
                            <span className="topic-name">{rel.topic1.name}</span>
                            <span className="relationship-connector">↔️</span>
                            <span className="topic-name">{rel.topic2.name}</span>
                          </div>
                          <div className="relationship-count">
                            共同出现 {rel.cooccurrence_count} 次
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
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
