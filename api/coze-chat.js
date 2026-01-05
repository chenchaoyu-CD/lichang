// Vercel后端 api/coze-chat.js 完整代码（强制调用Coze智能体）
export default async function handler(req, res) {
  // 1. 跨域配置（必须）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 2. 处理OPTIONS预检请求
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 3. 仅允许POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({
      answer: "当前接口仅支持POST请求",
      conversation_id: ""
    });
  }

  try {
    // 从请求体中获取参数
    const { query, bot_id, conversation_id, user_id } = req.body;

    // 4. 必传参数校验（缺少则直接返回错误）
    if (!query || !bot_id) {
      return res.status(400).json({
        answer: "缺少必要参数：query（对话内容）或 bot_id（Coze智能体ID）",
        conversation_id: ""
      });
    }

    // 5. 调用Coze官方API（核心步骤：必须确保此请求能成功）
    const cozeResponse = await fetch('https://api.coze.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.COZE_API_KEY}`, // 必须在Vercel配置此环境变量
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        bot_id: bot_id, // 你的Coze智能体ID：7590306952543633435
        user_id: user_id || `user_${Date.now()}`, // 必填，随机生成避免重复
        query: query, // 用户输入的内容
        conversation_id: conversation_id || "", // 会话ID，保持上下文
        stream: false, // 非流式响应（前端更易处理）
        auto_save_history: true // 自动保存对话历史
      })
    });

    // 6. 解析Coze返回的原始数据
    const cozeData = await cozeResponse.json();
    console.log("Coze API返回原始数据：", cozeData); // Vercel日志可查看

    // 7. 从Coze数据中提取有效回复
    let answer = "抱歉，我暂时无法提供相关回应，请尝试其他话题。";
    let newConversationId = conversation_id || "";

    // 正常情况：Coze返回messages数组，提取assistant的回复
    if (cozeData && cozeData.messages && Array.isArray(cozeData.messages)) {
      const botMsg = cozeData.messages.find(msg => msg.role === "assistant");
      if (botMsg && botMsg.content) {
        answer = botMsg.content;
      }
      // 同时获取Coze返回的会话ID（保持多轮对话）
      if (cozeData.conversation_id) {
        newConversationId = cozeData.conversation_id;
      }
    }
    // 异常情况：显示Coze返回的错误信息
    else if (cozeData.error) {
      answer = `Coze调用失败：${cozeData.error}（${cozeData.message || '无详细信息'}）`;
    }

    // 8. 返回给前端（包含有效回复和会话ID）
    res.status(200).json({
      answer: answer,
      conversation_id: newConversationId,
      coze_raw_data: cozeData // 可选：返回Coze原始数据，方便调试
    });

  } catch (error) {
    console.error("Vercel后端执行错误：", error);
    res.status(500).json({
      answer: `后端执行异常：${error.message}`,
      conversation_id: ""
    });
  }
}
