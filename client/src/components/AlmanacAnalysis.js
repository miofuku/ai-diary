import React from 'react';
import '../styles/AlmanacAnalysis.css';

function AlmanacAnalysis() {
    return (
        <div className="almanac-analysis-container">
            <div className="empty-analysis-message" style={{ textAlign: 'center', padding: '4rem 2rem', color: '#666' }}>
                <div style={{ fontSize: '3.5rem', marginBottom: '1.5rem' }}>📊</div>
                <h2 style={{ marginBottom: '0.75rem', color: '#333' }}>分析功能调整中</h2>
                <p style={{ color: '#888', maxWidth: '400px', margin: '0 auto', lineHeight: '1.6' }}>
                    分析模型正在重构。未来分析将不再与黄历宜忌绑定，而是紧握流年、流月、流日属性，为您呈现更深层的心情图谱，敬请期待。
                </p>
            </div>
        </div>
    );
}

export default AlmanacAnalysis;
