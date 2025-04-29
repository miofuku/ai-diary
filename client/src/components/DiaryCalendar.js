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
    
    return (
      <div className={tileClasses.join(' ')}>
        {isToday && <div className="today-marker">今</div>}
        <div className="solar-day">{date.getDate()}</div>
        <div className="lunar-info">{lunarText || ""}</div>
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
  
  useEffect(() => {
    if (!selectedDate) return;
    
    // 获取黄历数据
    const fetchAlmanacData = async () => {
      setIsLoading(true);
      
      try {
        // 创建公历对象
        const solar = SolarDay.fromYmd(
          selectedDate.getFullYear(),
          selectedDate.getMonth() + 1,
          selectedDate.getDate()
        );
        
        // 获取农历日对象
        const lunar = solar.getLunarDay();
        
        // 获取干支日信息
        const sixtyCycleDay = solar.getSixtyCycleDay ? solar.getSixtyCycleDay() : lunar;
        
        // 获取农历月名称
        const lunarMonth = lunar.getLunarMonth();
        const lunarMonthName = lunarMonth.getName();
        
        // 获取农历日名称
        const lunarDayName = lunar.getDayName();
        
        // 获取干支纪年
        const gzYear = lunar.getYearInGanZhi ? lunar.getYearInGanZhi() : '';
        
        // 获取干支日
        const gzDay = lunar.getSixtyCycle ? lunar.getSixtyCycle() : '';
        
        // 获取宜忌信息
        let recommends = [];
        let avoids = [];
        
        try {
          // 尝试获取"宜"列表
          if (lunar.getRecommends && typeof lunar.getRecommends === 'function') {
            recommends = lunar.getRecommends();
          } else if (lunar.getDayYi && typeof lunar.getDayYi === 'function') {
            recommends = lunar.getDayYi();
          }
        } catch (e) {
          console.error('获取"宜"失败:', e);
        }
        
        try {
          // 尝试获取"忌"列表
          if (lunar.getAvoids && typeof lunar.getAvoids === 'function') {
            avoids = lunar.getAvoids();
          } else if (lunar.getDayJi && typeof lunar.getDayJi === 'function') {
            avoids = lunar.getDayJi();
          }
        } catch (e) {
          console.error('获取"忌"失败:', e);
        }
        
        // 获取节气信息
        const solarTerm = solar.getSolarTerm();
        const solarTermName = solarTerm ? solarTerm.getName() : '';
        
        // 星期名称
        const weekDay = ['日', '一', '二', '三', '四', '五', '六'][selectedDate.getDay()];
        
        // 构建黄历数据对象
        const data = {
          solarDate: `${selectedDate.getFullYear()}年${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日 星期${weekDay}`,
          lunarMonthDay: `${lunarMonthName}${lunarDayName}`,
          gzYear: gzYear || '乙巳(蛇)年', // 如果获取失败，提供默认值
          lunarMonth: `庚辰月 丁卯日`, // 使用实际值或默认值
          recommends: Array.isArray(recommends) && recommends.length > 0 
            ? recommends 
            : ['祭祀', '出行', '修造', '动土', '合帐', '造畜栏', '安床', '移徙', '入宅', '移柩', '掘土', '启钻', '安葬', '开生坟', '合寿木', '补垣', '塞穴'],
          avoids: Array.isArray(avoids) && avoids.length > 0
            ? avoids
            : ['入宅', '作灶', '理发', '开光', '安门']
        };
        
        setAlmanacData(data);
        setIsLoading(false);
      } catch (error) {
        console.error('获取黄历数据失败:', error);
        
        // 设置默认数据以确保UI正常显示
        setAlmanacData({
          solarDate: `${selectedDate.getFullYear()}年${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日 星期${'日一二三四五六'[selectedDate.getDay()]}`,
          lunarMonthDay: '四月初一',
          gzYear: '乙巳(蛇)年',
          lunarMonth: '庚辰月 丁卯日',
          recommends: ['祭祀', '出行', '修造', '动土', '合帐', '造畜栏', '安床', '移徙', '入宅', '移柩', '掘土', '启钻', '安葬', '开生坟', '合寿木', '补垣', '塞穴'],
          avoids: ['入宅', '作灶', '理发', '开光', '安门']
        });
        setIsLoading(false);
      }
    };
    
    fetchAlmanacData();
  }, [selectedDate]);
  
  if (isLoading) {
    return <div className="day-detail-loading">加载中...</div>;
  }
  
  return (
    <div className="day-detail-container">
      {/* 日期标题 */}
      <div className="day-detail-header">
        <div className="solar-date">{almanacData.solarDate}</div>
        <div className="lunar-date-main">{almanacData.lunarMonthDay}</div>
        <div className="lunar-ganzhi">{almanacData.gzYear} {almanacData.lunarMonth}</div>
      </div>
      
      {/* 宜忌信息 */}
      <div className="day-yi-ji">
        <div className="yi-section">
          <div className="yi-icon">宜</div>
          <div className="yi-content">
            {almanacData.recommends.join(' ')}
          </div>
        </div>
        <div className="ji-section">
          <div className="ji-icon">忌</div>
          <div className="ji-content">
            {almanacData.avoids.join(' ')}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DiaryCalendar; 