export default function AboutPage() {
  return (
    <main className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">关于我们</h1>
      <div className="prose">
        <p className="mb-4">
          慧历是一款智能黄历助手，致力于将传统文化与现代科技相结合，
          为用户提供个性化的日程规划和生活建议。
        </p>
        <h2 className="text-xl font-bold mt-6 mb-4">我们的特色</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>精准的黄历信息查询</li>
          <li>专业的八字分析</li>
          <li>智能化的个性推荐</li>
          <li>便捷的日程规划工具</li>
        </ul>
        {/* 添加更多内容 */}
      </div>
    </main>
  )
} 