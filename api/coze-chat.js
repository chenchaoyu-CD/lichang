// Vercel后端 api/coze-chat.js 最终正确版本（适配Coze官方Open API）
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
      conversation_id: "",
      coze_raw_data: { code: 405, msg: "Method Not Allowed" }
    });
  }

  try {
    // 从请求体中获取参数
    const { query, bot_id, conversation_id, user_id } = req.body;

    // 4. 必传参数校验
    if (!query || !bot_id) {
      return res.status(400).json({
        answer: "缺少必要参数：query（对话内容）或 bot_id（Coze智能体ID）",
        conversation_id: "",
        coze_raw_data: { code: 400, msg: "Missing required parameters" }
      });
    }

    // 5. 调用Coze官方正确的Open API（核心修正：地址+参数格式）
    const cozeResponse = await fetch('https://api.coze.com/open_api/v3/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.COZE_API_KEY}`, // Vercel中配置的API密钥
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        bot_id: bot_id, // 你的Coze智能体ID：7590306952543633435
        user_id: user_id || `user_${Date.now()}`, // 必填，自定义用户ID
        query: query, // 用户输入的对话内容
        conversation_id: conversation_id || "", // 会话ID，保持多轮对话
        stream: false // 非流式响应
      })
    });

    // 6. 解析Coze返回的原始数据
    const cozeData = await cozeResponse.json();
    console.log("Coze API返回原始数据：", cozeData); // Vercel日志可查看

    // 7. 从Coze数据中提取有效回复（适配Coze Open API的返回格式）
    let answer = "抱歉，我暂时无法提供相关回应，请尝试其他话题。";
    let newConversationId = conversation_id || "";

    // 正常情况：Coze返回success=true，提取回复内容
    if (cozeData && cozeData.success === true) {
      // Coze Open API的回复在data.messages数组中
      if (cozeData.data && cozeData.data.messages && Array.isArray(cozeData.data.messages)) {
        const botMsg = cozeData.data.messages.find(msg => msg.role === "assistant");
        if (botMsg && botMsg.content) {
          answer = botMsg.content;
        }
      }
      // 获取Coze返回的会话ID（保持多轮对话）
      if (cozeData.data && cozeData.data.conversation_id) {
        newConversationId = cozeData.data.conversation_id;
      }
    }
    // 异常情况：显示Coze返回的错误信息
    else if (cozeData && cozeData.msg) {
      answer = `Coze调用失败：${cozeData.msg}（错误码：${cozeData.code || '未知'}）`;
    }

    // 8. 返回给前端
    res.status(200).json({
      answer: answer,
      conversation_id: newConversationId,
      coze_raw_data: cozeData // 保留原始数据，方便调试
    });

  } catch (error) {
    console.error("Vercel后端执行错误：", error);
    res.status(500).json({
      answer: `后端执行异常：${error.message}`,
      conversation_id: "",
      coze_raw_data: { code: 500, msg: error.message }
    });
  }
}
