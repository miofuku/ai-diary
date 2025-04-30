import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import { SolarDay } from 'tyme4ts';
import 'react-calendar/dist/Calendar.css';
import '../styles/DiaryCalendar.css';

function DiaryCalendar({ entries, onDateSelect, selectedDate }) {
  // 创建日期条目的映射
  const datesWithEntries = entries.reduce((acc, entry) => {
    if (entry && entry.createdAt) {
      try {
        const entryDate = new Date(entry.createdAt);
        const dateKey = `${entryDate.getFullYear()}-${entryDate.getMonth() + 1}-${entryDate.getDate()}`;
        acc[dateKey] = true;
      } catch (error) {
        console.error('处理日期条目时出错:', error);
      }
    }
    return acc;
  }, {});
  
  // 获取农历日期和干支文本
  const getLunarDayText = (date) => {
    try {
      // 创建公历对象
      const solar = SolarDay.fromYmd(
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate()
      );
      
      // 获取农历对象
      const lunar = solar.getLunarDay();
      
      // 获取农历日期（如 "初一"）
      const day = lunar.getDay();
      const chineseDayNames = [
        "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
        "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
        "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十"
      ];
      
      // 获取干支日
      let gzDay = '';
      try {
        if (lunar.getSixtyCycle) {
          gzDay = lunar.getSixtyCycle();
        }
      } catch (e) {
        console.error('获取干支日失败', e);
      }
      
      // 确保day在有效范围内
      if (day >= 1 && day <= 30) {
        const lunarDayName = chineseDayNames[day - 1];
        return `${lunarDayName}${gzDay ? gzDay : ''}`;
      }
      return "";
    } catch (error) {
      console.error('获取农历信息失败:', error, date);
      return "";
    }
  };

  // 自定义日期内容
  const tileContent = ({ date, view }) => {
    if (view !== 'month') return null;
    
    // 获取公历日期的键
    const dateKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    const hasEntries = datesWithEntries[dateKey];
    
    // 获取农历信息 (流日和干支)
    const lunarText = getLunarDayText(date);
    
    // 获取节气信息
    let solarTermText = "";
    try {
      const solar = SolarDay.fromYmd(
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate()
      );
      
      const term = solar.getTerm();
      if (term) {
        // 获取节气天数信息
        const termDay = solar.getTermDay();
        if (termDay && termDay.getDayIndex() === 0) {
          // 只在节气的第一天显示节气名称
          solarTermText = term.getName();
        }
      }
    } catch (e) {
      console.error('获取节气信息失败:', e, date);
    }
    
    // 判断是否属于当前月份
    const isCurrentMonth = date.getMonth() === selectedDate.getMonth();
    
    // 判断是否是周末 (周六或周日)
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    
    // 判断是否是今天
    const today = new Date();
    const isToday = 
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
    
    // 判断是否是选中的日期
    const isSelected = 
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear();
    
    // 构建类名
    let tileClasses = ['tile-content'];
    if (!isCurrentMonth) tileClasses.push('other-month');
    if (isWeekend) tileClasses.push('weekend');
    if (isToday) tileClasses.push('today');
    if (isSelected && !isToday) tileClasses.push('selected');
    if (solarTermText) tileClasses.push('has-solar-term');
    
    return (
      <div className={tileClasses.join(' ')}>
        {isToday && <div className="today-marker">今</div>}
        <div className="solar-day">{date.getDate()}</div>
        <div className="lunar-info">{lunarText || ""}</div>
        {solarTermText && <div className="tile-solar-term">{solarTermText}</div>}
        {hasEntries && <div className="diary-entry-dot"></div>}
      </div>
    );
  };

  // 覆盖默认的日期显示
  const tileClassName = ({ date, view }) => {
    if (view === 'month') {
      const classes = ['custom-tile'];
      
      // 检查是否是今天
      const today = new Date();
      const isToday = 
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();
      
      // 检查是否是选中的日期
      const isSelected = 
        date.getDate() === selectedDate.getDate() &&
        date.getMonth() === selectedDate.getMonth() &&
        date.getFullYear() === selectedDate.getFullYear();
      
      if (isToday) {
        classes.push('today-tile');
      }
      
      if (isSelected && !isToday) {
        classes.push('selected-tile');
      }
      
      return classes.join(' ');
    }
    return null;
  };

  return (
    <div className="diary-calendar-container">
      <Calendar 
        onChange={onDateSelect}
        value={selectedDate}
        tileContent={tileContent}
        tileClassName={tileClassName}
        formatShortWeekday={(locale, date) => ['日', '一', '二', '三', '四', '五', '六'][date.getDay()]}
        formatMonthYear={(locale, date) => `${date.getFullYear()}年 ${date.getMonth() + 1}月`}
        locale="zh-CN"
        showNeighboringMonth={true}
      />
      
      <HardcodedYiJi selectedDate={selectedDate} />
    </div>
  );
}

// 黄历信息展示组件
function HardcodedYiJi({ selectedDate }) {
  const [almanacData, setAlmanacData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // 获取黄历数据
  useEffect(() => {
    setIsLoading(true);
    setError(null);
    
    const fetchData = async () => {
      if (!selectedDate) {
        setIsLoading(false);
        return;
      }
      
      console.log('正在获取日期黄历数据:', selectedDate.toISOString());
      
      try {
        // 创建公历对象
        const solar = SolarDay.fromYmd(
          selectedDate.getFullYear(), 
          selectedDate.getMonth() + 1, 
          selectedDate.getDate()
        );
        
        console.log('创建公历对象成功:', solar);
        
        // 获取农历日对象
        const lunarDay = solar.getLunarDay();
        console.log('获取农历对象成功:', lunarDay);
        
        // 打印所有可用的方法
        console.log('农历对象方法:', 
          Object.getOwnPropertyNames(Object.getPrototypeOf(lunarDay))
            .filter(method => typeof lunarDay[method] === 'function')
        );
        
        // 获取农历日期文本（直接使用getDay方法和映射表）
        let lunarDayName = "";
        try {
          const day = lunarDay.getDay();
          const chineseDayNames = [
            "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
            "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
            "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十"
          ];
          
          if (day >= 1 && day <= 30) {
            lunarDayName = chineseDayNames[day - 1];
          }
        } catch (e) {
          console.error('获取农历日名失败:', e);
        }
        
        // 获取农历月
        let lunarMonthName = "";
        try {
          const lunarMonth = lunarDay.getLunarMonth();
          lunarMonthName = lunarMonth.getName();
        } catch (e) {
          console.error('获取农历月名失败:', e);
        }
        
        // 获取干支信息 - 使用正确的方法从 tyme4ts 获取
        let ganZhiInfo = "";
        try {
          // 从公历日获取干支日
          const sixtyCycleDay = solar.getSixtyCycleDay();
          
          // 从干支日获取干支月
          const sixtyCycleMonth = sixtyCycleDay.getSixtyCycleMonth();
          
          // 从干支月获取干支年
          const sixtyCycleYear = sixtyCycleMonth.getSixtyCycleYear();
          
          // 组合年月日干支信息
          ganZhiInfo = `${sixtyCycleYear.getName()} ${sixtyCycleMonth.getName()} ${sixtyCycleDay.getName()}`;
        } catch (e) {
          console.error('获取干支信息失败:', e);
          ganZhiInfo = "无法获取干支信息";
        }
        
        // 获取节气信息
        let solarTerm = null;
        let termDayIndex = null;
        try {
          // 从公历日获取所在节气
          const term = solar.getTerm();
          if (term) {
            solarTerm = term.getName();
            
            // 获取节气天数信息
            const termDay = solar.getTermDay();
            if (termDay) {
              termDayIndex = termDay.getDayIndex();
            }
            
            // 如果是节气的第一天，特别标注
            if (termDayIndex === 0) {
              solarTerm = `${solarTerm}`;
            }
            
            console.log('获取节气成功:', solarTerm, '天数索引:', termDayIndex);
          }
        } catch (e) {
          console.error('获取节气信息失败:', e);
        }
        
        // 宜忌信息
        let recommends = [];
        let avoids = [];
        
        // 获取"宜"列表 - 使用您代码示例中的方法
        try {
          if (typeof lunarDay.getRecommends === 'function') {
            const taboos = lunarDay.getRecommends();
            console.log('getRecommends结果:', taboos);
            
            if (Array.isArray(taboos)) {
              recommends = taboos.map(taboo => {
                if (typeof taboo === 'string') return taboo;
                if (taboo && typeof taboo.getName === 'function') return taboo.getName();
                return String(taboo);
              });
            }
          }
        } catch (e) {
          console.error('获取"宜"失败:', e);
        }
        
        // 获取"忌"列表 - 使用您代码示例中的方法
        try {
          if (typeof lunarDay.getAvoids === 'function') {
            const taboos = lunarDay.getAvoids();
            console.log('getAvoids结果:', taboos);
            
            if (Array.isArray(taboos)) {
              avoids = taboos.map(taboo => {
                if (typeof taboo === 'string') return taboo;
                if (taboo && typeof taboo.getName === 'function') return taboo.getName();
                return String(taboo);
              });
            }
          }
        } catch (e) {
          console.error('获取"忌"失败:', e);
        }
        
        // 获取星期
        const weekDay = ['日', '一', '二', '三', '四', '五', '六'][selectedDate.getDay()];
        
        // 构建黄历数据对象
        const data = {
          solarDate: `${selectedDate.getFullYear()}年${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日 星期${weekDay}`,
          lunarMonthDay: `${lunarMonthName}${lunarDayName}`,
          ganZhiInfo: ganZhiInfo,
          solarTerm: solarTerm,
          recommends: recommends,
          avoids: avoids
        };
        
        console.log('最终黄历数据:', data);
        setAlmanacData(data);
      } catch (err) {
        console.error('获取黄历数据时出错:', err);
        setError(err.message || '无法获取黄历数据');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [selectedDate]); // 确保selectedDate更改时会重新获取数据
  
  if (isLoading) {
    return <div className="day-detail-loading">加载黄历数据中...</div>;
  }
  
  if (error) {
    return <div className="day-detail-error">获取黄历数据失败: {error}</div>;
  }
  
  if (!almanacData) {
    return <div className="day-detail-error">暂无黄历数据</div>;
  }
  
  return (
    <div className="day-detail-container">
      {/* 添加时间戳，用于确认组件是否重新渲染 */}
      <div className="debug-info" style={{fontSize: '10px', color: '#999', textAlign: 'right'}}>
        {new Date().toLocaleTimeString()}
      </div>
      
      {/* 日期标题 */}
      <div className="day-detail-header">
        <div className="solar-date">{almanacData.solarDate}</div>
        <div className="lunar-date-main">{almanacData.lunarMonthDay}</div>
        <div className="lunar-ganzhi">
          {almanacData.ganZhiInfo}
          {almanacData.solarTerm && (
            <span className="solar-term-inline">节气：{almanacData.solarTerm}</span>
          )}
        </div>
      </div>
      
      {/* 宜忌信息 */}
      <div className="day-yi-ji">
        <div className="yi-section">
          <div className="yi-icon">宜</div>
          <div className="yi-content">
            {almanacData.recommends && almanacData.recommends.length > 0 
              ? almanacData.recommends.join(' ') 
              : '无'}
          </div>
        </div>
        <div className="ji-section">
          <div className="ji-icon">忌</div>
          <div className="ji-content">
            {almanacData.avoids && almanacData.avoids.length > 0 
              ? almanacData.avoids.join(' ') 
              : '无'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DiaryCalendar; 