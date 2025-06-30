import React, { useState } from 'react';

const TopicCleanup = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleCleanup = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('http://localhost:3001/api/cleanup-topics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setResult(data.result);
    } catch (err) {
      console.error('Error cleaning up topics:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="topic-cleanup">
      <div className="cleanup-header">
        <h3>Topic Cleanup & Deduplication</h3>
        <p>Remove duplicate topics and people from the topic graph</p>
      </div>

      <button 
        onClick={handleCleanup}
        disabled={isLoading}
        className="cleanup-button"
        style={{
          padding: '10px 20px',
          backgroundColor: isLoading ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          fontSize: '16px',
          marginBottom: '20px'
        }}
      >
        {isLoading ? 'Cleaning up...' : 'Clean Up Topics'}
      </button>

      {error && (
        <div className="error-message" style={{
          backgroundColor: '#f8d7da',
          color: '#721c24',
          padding: '10px',
          borderRadius: '5px',
          marginBottom: '20px',
          border: '1px solid #f5c6cb'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="cleanup-result" style={{
          backgroundColor: '#d4edda',
          color: '#155724',
          padding: '15px',
          borderRadius: '5px',
          border: '1px solid #c3e6cb'
        }}>
          <h4>Cleanup Results:</h4>
          <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
            <li>
              <strong>Topics:</strong> {result.original_topics} → {result.merged_topics} 
              <span style={{ color: '#dc3545', fontWeight: 'bold' }}>
                {' '}(-{result.original_topics - result.merged_topics} duplicates)
              </span>
            </li>
            <li>
              <strong>People:</strong> {result.original_people} → {result.merged_people}
              <span style={{ color: '#dc3545', fontWeight: 'bold' }}>
                {' '}(-{result.original_people - result.merged_people} duplicates)
              </span>
            </li>
            <li>
              <strong>Relations:</strong> {result.final_edges} connections maintained
            </li>
          </ul>
          <p style={{ margin: '10px 0 0 0', fontSize: '14px', fontStyle: 'italic' }}>
            ✅ Cleanup completed successfully! The topic graph is now more organized.
          </p>
        </div>
      )}

      <div className="cleanup-info" style={{
        backgroundColor: '#f8f9fa',
        padding: '15px',
        borderRadius: '5px',
        border: '1px solid #dee2e6',
        marginTop: '20px'
      }}>
        <h4>What does cleanup do?</h4>
        <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
          <li>Merges duplicate topics with similar names</li>
          <li>Combines duplicate people entries</li>
          <li>Updates all relationships to use merged entities</li>
          <li>Removes orphaned connections</li>
          <li>Preserves all important information during merging</li>
        </ul>
        <p style={{ margin: '10px 0 0 0', fontSize: '14px', color: '#6c757d' }}>
          <strong>Note:</strong> This operation is safe and preserves all your data while making the topic graph more organized.
        </p>
      </div>
    </div>
  );
};

export default TopicCleanup;
