import React, { useState, useEffect } from 'react';
import { SolarDay } from 'tyme4ts';
import '../styles/AlmanacAnalysis.css';

function AlmanacAnalysis() {
    const [analysisData, setAnalysisData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [minOccurrences, setMinOccurrences] = useState(3);

    // Mood emoji mapping
    const moodEmojis = {
        happy: '😊',
        relaxed: '😌',
        tired: '😴',
        anxious: '😰',
        sad: '😢',
        angry: '😡',
        thoughtful: '🤔',
        confident: '😎'
    };

    const moodLabels = {
        happy: '开心',
        relaxed: '放松',
        tired: '疲惫',
        anxious: '焦虑',
        sad: '难过',
        angry: '生气',
        thoughtful: '思考',
        confident: '自信'
    };

    useEffect(() => {
        fetchAnalysisData();
    }, [minOccurrences]);

    const fetchAnalysisData = async () => {
        setIsLoading(true);
        setError(null);

        try {
            // First, fetch all entries to get date range
            const entriesResponse = await fetch('http://localhost:3001/api/entries');
            const entries = await entriesResponse.json();

            if (!entries || entries.length === 0) {
                setError('没有足够的日记数据进行分析');
                setIsLoading(false);
                return;
            }

            // Generate almanac data for each entry date
            const almanacData = [];
            const processedDates = new Set();

            for (const entry of entries) {
                const entryDate = new Date(entry.createdAt);
                const dateKey = entryDate.toISOString().split('T')[0];

                // Skip if we've already processed this date
                if (processedDates.has(dateKey)) {
                    continue;
                }
                processedDates.add(dateKey);

                try {
                    const solar = SolarDay.fromYmd(
                        entryDate.getFullYear(),
                        entryDate.getMonth() + 1,
                        entryDate.getDate()
                    );

                    const lunarDay = solar.getLunarDay();

                    // Get recommends
                    let recommends = [];
                    if (typeof lunarDay.getRecommends === 'function') {
                        const taboos = lunarDay.getRecommends();
                        if (Array.isArray(taboos)) {
                            recommends = taboos.map(taboo =>
                                typeof taboo.getName === 'function' ? taboo.getName() : String(taboo)
                            );
                        }
                    }

                    // Get avoids
                    let avoids = [];
                    if (typeof lunarDay.getAvoids === 'function') {
                        const taboos = lunarDay.getAvoids();
                        if (Array.isArray(taboos)) {
                            avoids = taboos.map(taboo =>
                                typeof taboo.getName === 'function' ? taboo.getName() : String(taboo)
                            );
                        }
                    }

                    almanacData.push({
                        date: entry.createdAt,
                        recommends,
                        avoids
                    });
                } catch (e) {
                    console.error(`Error getting almanac for ${dateKey}:`, e);
                }
            }

            // Send analysis request to backend
            const response = await fetch('http://localhost:3001/api/almanac-analysis', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    almanac_data: almanacData,
                    min_occurrences: minOccurrences
                }),
            });

            const result = await response.json();

            if (result.status === 'success') {
                setAnalysisData(result.data);
            } else {
                setError('分析失败');
            }
        } catch (err) {
            console.error('Error fetching analysis:', err);
            setError('获取分析数据失败: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const renderAlmanacCard = (item, data, type) => {
        const typeLabel = type === 'recommends' ? '宜' : '忌';
        const typeClass = type === 'recommends' ? 'recommend' : 'avoid';

        return (
            <div key={item} className="almanac-card">
                <div className="card-header">
                    <span className={`almanac-type ${typeClass}`}>{typeLabel}</span>
                    <span className="almanac-item">{item}</span>
                    <span className="occurrence-count">{data.occurrences}次</span>
                </div>

                <div className="mood-section">
                    <h4>📊 心情分布</h4>
                    <div className="mood-bar good">
                        <span className="mood-label">😊 好心情</span>
                        <div className="progress-bar">
                            <div
                                className="progress-fill good"
                                style={{ width: `${data.mood_distribution.good * 100}%` }}
                            ></div>
                        </div>
                        <span className="percentage">{Math.round(data.mood_distribution.good * 100)}%</span>
                    </div>
                    <div className="mood-bar bad">
                        <span className="mood-label">😰 坏心情</span>
                        <div className="progress-bar">
                            <div
                                className="progress-fill bad"
                                style={{ width: `${data.mood_distribution.bad * 100}%` }}
                            ></div>
                        </div>
                        <span className="percentage">{Math.round(data.mood_distribution.bad * 100)}%</span>
                    </div>
                </div>

                <div className="mood-details-section">
                    <h4>🎭 具体心情</h4>
                    {Object.entries(data.mood_details)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5)
                        .map(([mood, percentage]) => (
                            <div key={mood} className="activity-item">
                                <span className="activity-label">
                                    {moodEmojis[mood]} {moodLabels[mood]}
                                </span>
                                <div className="progress-bar small">
                                    <div
                                        className="progress-fill neutral"
                                        style={{ width: `${percentage * 100}%` }}
                                    ></div>
                                </div>
                                <span className="percentage">{Math.round(percentage * 100)}%</span>
                            </div>
                        ))}
                </div>
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="almanac-analysis-container">
                <div className="loading-message">正在分析数据...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="almanac-analysis-container">
                <div className="error-message">{error}</div>
            </div>
        );
    }

    if (!analysisData) {
        return (
            <div className="almanac-analysis-container">
                <div className="error-message">没有分析数据</div>
            </div>
        );
    }

    const { summary, recommends, avoids } = analysisData;

    return (
        <div className="almanac-analysis-container">
            <div className="analysis-header">
                <h1>流日与心情分析</h1>
                <p className="analysis-subtitle">分析黄历宜忌与您的心情状态的关联</p>
            </div>

            <div className="analysis-summary">
                <div className="summary-item">
                    <span className="summary-label">分析日记数</span>
                    <span className="summary-value">{summary.total_entries}</span>
                </div>
                <div className="summary-item">
                    <span className="summary-label">日期范围</span>
                    <span className="summary-value">{summary.date_range}</span>
                </div>
                <div className="summary-item">
                    <span className="summary-label">宜事项</span>
                    <span className="summary-value">{summary.unique_recommends}</span>
                </div>
                <div className="summary-item">
                    <span className="summary-label">忌事项</span>
                    <span className="summary-value">{summary.unique_avoids}</span>
                </div>
            </div>

            <div className="analysis-filters">
                <label>
                    最少出现次数：
                    <input
                        type="number"
                        min="1"
                        max="10"
                        value={minOccurrences}
                        onChange={(e) => setMinOccurrences(parseInt(e.target.value))}
                    />
                </label>
            </div>

            <div className="analysis-sections">
                {Object.keys(recommends).length > 0 && (
                    <section className="recommends-section">
                        <h2>宜事项分析</h2>
                        <div className="almanac-cards">
                            {Object.entries(recommends)
                                .sort((a, b) => b[1].occurrences - a[1].occurrences)
                                .map(([item, data]) => renderAlmanacCard(item, data, 'recommends'))}
                        </div>
                    </section>
                )}

                {Object.keys(avoids).length > 0 && (
                    <section className="avoids-section">
                        <h2>忌事项分析</h2>
                        <div className="almanac-cards">
                            {Object.entries(avoids)
                                .sort((a, b) => b[1].occurrences - a[1].occurrences)
                                .map(([item, data]) => renderAlmanacCard(item, data, 'avoids'))}
                        </div>
                    </section>
                )}

                {Object.keys(recommends).length === 0 && Object.keys(avoids).length === 0 && (
                    <div className="no-data-message">
                        <p>没有足够的数据进行分析</p>
                        <p>请创建更多带有心情标记的日记，并确保最少出现次数设置合理</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default AlmanacAnalysis;
