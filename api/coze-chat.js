// Vercel 后端 api/coze-chat.js 完整代码（解决405错误）
export default async function handler(req, res) {
  // 1. 核心：设置跨域响应头，明确允许的方法（POST/OPTIONS）
  res.setHeader('Access-Control-Allow-Origin', '*'); // 生产环境可指定具体域名（如你的前端域名）
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); // 明确允许POST和OPTIONS方法
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); // 允许前端携带Content-Type请求头

  // 2. 处理 OPTIONS 跨域预检请求（浏览器先发OPTIONS，后端必须返回200，否则报错405）
  if (req.method === 'OPTIONS') {
    res.status(200).end(); // 预检请求直接返回成功，无需业务逻辑
    return;
  }

  // 3. 仅允许 POST 方法执行业务逻辑，其他方法（如GET）返回405提示
  if (req.method !== 'POST') {
    res.status(405).json({ 
      error: 'Method Not Allowed', 
      message: '当前接口仅支持 POST 请求' 
    });
    return;
  }

  // 4. 原有 Coze 对接业务逻辑（不变，仅补充上面的方法校验和OPTIONS处理）
  try {
    const { query, bot_id, conversation_id, user_id } = req.body;

    // 必传参数校验
    if (!query || !bot_id) {
      return res.status(400).json({ 
        error: 'Bad Request', 
        message: '缺少 query 或 bot_id 参数' 
      });
    }

    // 调用 Coze 官方 API
    const cozeResponse = await fetch('https://api.coze.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.COZE_API_KEY}` // 确保Vercel已配置该环境变量
      },
      body: JSON.stringify({
        bot_id: bot_id,
        user_id: user_id || `user_${Date.now()}`, // 兼容前端传递的user_id
        query: query,
        conversation_id: conversation_id || "",
        stream: false
      })
    });

    const cozeData = await cozeResponse.json();

    // 提取 Coze 回复内容
    let answer = "抱歉，我暂时无法提供相关回应，请尝试其他话题。";
    if (cozeData && cozeData.messages && Array.isArray(cozeData.messages)) {
      const botMessage = cozeData.messages.find(item => item.role === "assistant");
      if (botMessage && botMessage.content) {
        answer = botMessage.content;
      }
    }

    // 返回给前端
    res.status(200).json({
      answer: answer,
      conversation_id: cozeData.conversation_id || conversation_id
    });

  } catch (error) {
    console.error("Coze API 调用失败：", error);
    res.status(500).json({
      answer: "抱歉，服务暂时异常，请稍后再试。",
      conversation_id: req.body.conversation_id
    });
  }
}
