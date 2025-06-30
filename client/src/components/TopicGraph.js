import React, { useState, useEffect, useRef } from 'react';
import { request } from 'graphql-request';
import '../styles/TopicGraph.css';

// D3 imports for visualization
import * as d3 from 'd3';

const TopicGraph = () => {
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
  
  const svgRef = useRef();
  const tooltipRef = useRef();
  
  // GraphQL query
  const TOPIC_GRAPH_QUERY = `
    query {
      topicGraph {
        nodes {
          __typename
          ... on TopicNode {
            id
            name
            type
            topicType
            importance
            sentiment
            context
          }
          ... on PersonNode {
            id
            name
            type
            role
            importance
          }
        }
        edges {
          source
          target
          type
          strength
        }
      }
    }
  `;

  useEffect(() => {
    const fetchTopicGraph = async () => {
      try {
        setIsLoading(true);
        const data = await request('http://localhost:3001/graphql', TOPIC_GRAPH_QUERY);
        console.log('Graph data:', data);
        setGraphData({
          nodes: data.topicGraph.nodes || [],
          edges: data.topicGraph.edges || []
        });
      } catch (err) {
        console.error('Error fetching topic graph:', err);
        setError('Failed to load topic graph data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTopicGraph();
  }, []);

  // Function to extract topics from diary entries
  const extractTopics = async () => {
    try {
      setIsExtracting(true);
      setError(null);
      
      const response = await fetch('http://localhost:3001/api/extract-topics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to extract topics: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Topics extraction result:', result);
      
      // Refresh the graph data after extraction
      const data = await request('http://localhost:3001/graphql', TOPIC_GRAPH_QUERY);
      setGraphData({
        nodes: data.topicGraph.nodes || [],
        edges: data.topicGraph.edges || []
      });
      
    } catch (err) {
      console.error('Error extracting topics:', err);
      setError(`提取主题失败: ${err.message}`);
    } finally {
      setIsExtracting(false);
    }
  };

  // Function to deduplicate and merge similar topics
  const deduplicateTopics = async () => {
    try {
      setIsDeduplicating(true);
      setError(null);

      const response = await fetch('http://localhost:3001/api/deduplicate-topics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to deduplicate topics: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Topic deduplication result:', result);

      // Refresh the graph data after deduplication
      const data = await request('http://localhost:3001/graphql', TOPIC_GRAPH_QUERY);
      setGraphData({
        nodes: data.topicGraph.nodes || [],
        edges: data.topicGraph.edges || []
      });

    } catch (err) {
      console.error('Error deduplicating topics:', err);
      setError(`去重主题失败: ${err.message}`);
    } finally {
      setIsDeduplicating(false);
    }
  };

  // Function to rebuild all topics from scratch
  const rebuildTopics = async () => {
    try {
      setIsRebuilding(true);
      setError(null);

      const response = await fetch('http://localhost:3001/api/rebuild-topics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to rebuild topics: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Topic rebuild result:', result);

      // Refresh the graph data after rebuild
      const data = await request('http://localhost:3001/graphql', TOPIC_GRAPH_QUERY);
      setGraphData({
        nodes: data.topicGraph.nodes || [],
        edges: data.topicGraph.edges || []
      });

    } catch (err) {
      console.error('Error rebuilding topics:', err);
      setError(`重建主题失败: ${err.message}`);
    } finally {
      setIsRebuilding(false);
    }
  };

  useEffect(() => {
    if (isLoading || !graphData.nodes.length) return;
    
    // Filter nodes based on type filter
    const filteredNodes = filterType === 'all' 
      ? graphData.nodes 
      : graphData.nodes.filter(node => {
          if (filterType === 'person') return node.type === 'person';
          if (filterType === 'topic') return node.type === 'topic';
          if (node.type === 'topic' && node.topicType) {
            return node.topicType === filterType;
          }
          return false;
        });
    
    // Filter edges to only include connections between filtered nodes
    const filteredNodeIds = new Set(filteredNodes.map(node => node.id));
    const filteredEdges = graphData.edges.filter(edge => 
      filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target)
    );
    
    renderGraph(filteredNodes, filteredEdges);
  }, [graphData, filterType, isLoading]);

  const renderGraph = (nodes, edges) => {
    // Clear previous graph
    d3.select(svgRef.current).selectAll('*').remove();
    
    if (!nodes.length) return;
    
    const width = 800;
    const height = 500;
    
    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height]);
    
    // Create tooltip
    const tooltip = d3.select(tooltipRef.current)
      .style('opacity', 0)
      .attr('class', 'topic-tooltip');
    
    // Create a force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(edges).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(30));
    
    // Create links
    const link = svg.append('g')
      .selectAll('line')
      .data(edges)
      .join('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => Math.sqrt(d.strength || 1));
    
    // Create nodes
    const node = svg.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .call(drag(simulation));
    
    // Add circles for nodes
    node.append('circle')
      .attr('r', d => getNodeRadius(d))
      .attr('fill', d => getNodeColor(d))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5);
    
    // Add text labels
    node.append('text')
      .text(d => d.name)
      .attr('x', 0)
      .attr('y', d => -getNodeRadius(d) - 5)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', '#333');
    
    // Add interactivity
    node.on('mouseover', (event, d) => {
      tooltip.transition()
        .duration(200)
        .style('opacity', .9);
      
      let tooltipContent = `
        <div class="tooltip-title">${d.name}</div>
        <div class="tooltip-type">${d.type === 'person' ? '人物' : '主题'}</div>
      `;
      
      if (d.type === 'topic') {
        tooltipContent += `
          <div class="tooltip-detail">类型: ${d.topicType || '一般'}</div>
          <div class="tooltip-detail">重要性: ${d.importance || 3}/5</div>
          <div class="tooltip-detail">情感: ${getSentimentText(d.sentiment)}</div>
        `;
        if (d.context) {
          tooltipContent += `<div class="tooltip-context">${d.context}</div>`;
        }
      } else {
        tooltipContent += `
          <div class="tooltip-detail">角色: ${d.role || '未知'}</div>
          <div class="tooltip-detail">重要性: ${d.importance || 3}/5</div>
        `;
      }
      
      tooltip.html(tooltipContent)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 28) + 'px');
    })
    .on('mouseout', () => {
      tooltip.transition()
        .duration(500)
        .style('opacity', 0);
    })
    .on('click', (event, d) => {
      setSelectedNode(d);
      event.stopPropagation();
    });
    
    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
      
      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });
    
    // Drag functionality
    function drag(simulation) {
      function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }
      
      function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }
      
      function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }
      
      return d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);
    }
  };
  
  // Helper functions
  const getNodeRadius = (node) => {
    const baseSize = 10;
    const importanceFactor = node.importance ? node.importance : 3;
    return baseSize + (importanceFactor - 1) * 2;
  };
  
  const getNodeColor = (node) => {
    if (node.type === 'person') {
      return '#4299e1'; // Blue for people
    }
    
    // Topics colored by sentiment
    if (node.type === 'topic') {
      if (node.sentiment > 0.5) return '#48bb78'; // Green for positive
      if (node.sentiment < -0.5) return '#f56565'; // Red for negative
      return '#ed8936'; // Orange for neutral
    }
    
    return '#a0aec0'; // Default gray
  };
  
  const getSentimentText = (sentiment) => {
    if (!sentiment && sentiment !== 0) return '中性';
    if (sentiment > 1) return '非常积极';
    if (sentiment > 0.3) return '积极';
    if (sentiment < -1) return '非常消极';
    if (sentiment < -0.3) return '消极';
    return '中性';
  };
  
  const handleFilterChange = (e) => {
    setFilterType(e.target.value);
  };
  
  const closeNodeDetails = () => {
    setSelectedNode(null);
  };

  if (isLoading) {
    return <div className="topic-graph-container loading">加载主题图谱中...</div>;
  }

  if (error && !isExtracting) {
    return <div className="topic-graph-container error">{error}</div>;
  }

  return (
    <div className="topic-graph-container">
      <div className="topic-graph-controls">
        <div className="filter-controls">
          <label htmlFor="filter-type">筛选:</label>
          <select 
            id="filter-type" 
            value={filterType} 
            onChange={handleFilterChange}
            className="filter-select"
          >
            <option value="all">全部</option>
            <option value="topic">仅主题</option>
            <option value="person">仅人物</option>
            <option value="activity">活动</option>
            <option value="concept">概念</option>
            <option value="event">事件</option>
            <option value="location">地点</option>
            <option value="project">项目</option>
          </select>
        </div>
        
        <div className="action-buttons">
          <button
            className="extract-topics-button"
            onClick={extractTopics}
            disabled={isExtracting || isDeduplicating || isRebuilding}
          >
            {isExtracting ? '提取中...' : '从日记提取主题'}
          </button>

          <button
            className="deduplicate-topics-button"
            onClick={deduplicateTopics}
            disabled={isExtracting || isDeduplicating || isRebuilding}
          >
            {isDeduplicating ? '去重中...' : '智能去重主题'}
          </button>

          <button
            className="rebuild-topics-button"
            onClick={rebuildTopics}
            disabled={isExtracting || isDeduplicating || isRebuilding}
          >
            {isRebuilding ? '重建中...' : '重建所有主题'}
          </button>
        </div>
      </div>
      
      {error && (
        <div className="topic-graph-error">{error}</div>
      )}
      
      <div className="topic-graph-content">
        <svg ref={svgRef} className="topic-graph-svg"></svg>
        <div ref={tooltipRef} className="topic-tooltip"></div>
      </div>
      
      {selectedNode && (
        <div className="node-details-panel">
          <div className="node-details-header">
            <h3>{selectedNode.name}</h3>
            <button className="close-details-button" onClick={closeNodeDetails}>×</button>
          </div>
          
          <div className="node-details-content">
            <div className="node-detail-row">
              <span className="detail-label">类型:</span>
              <span className="detail-value">
                {selectedNode.type === 'person' ? '人物' : 
                 (selectedNode.topicType ? selectedNode.topicType : '主题')}
              </span>
            </div>
            
            {selectedNode.type === 'person' && selectedNode.role && (
              <div className="node-detail-row">
                <span className="detail-label">角色:</span>
                <span className="detail-value">{selectedNode.role}</span>
              </div>
            )}
            
            {selectedNode.importance && (
              <div className="node-detail-row">
                <span className="detail-label">重要性:</span>
                <span className="detail-value">{selectedNode.importance}/5</span>
              </div>
            )}
            
            {selectedNode.type === 'topic' && (
              <div className="node-detail-row">
                <span className="detail-label">情感倾向:</span>
                <span className="detail-value">{getSentimentText(selectedNode.sentiment)}</span>
              </div>
            )}
            
            {selectedNode.context && (
              <div className="node-detail-row context-row">
                <span className="detail-label">上下文:</span>
                <span className="detail-value">{selectedNode.context}</span>
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="topic-graph-legend">
        <div className="legend-title">图例</div>
        <div className="legend-item">
          <div className="legend-color" style={{backgroundColor: '#4299e1'}}></div>
          <div className="legend-label">人物</div>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{backgroundColor: '#48bb78'}}></div>
          <div className="legend-label">积极主题</div>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{backgroundColor: '#ed8936'}}></div>
          <div className="legend-label">中性主题</div>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{backgroundColor: '#f56565'}}></div>
          <div className="legend-label">消极主题</div>
        </div>
      </div>
    </div>
  );
};

export default TopicGraph; 