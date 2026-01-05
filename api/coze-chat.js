// Vercel后端 api/coze-chat.js（适配Coze v3异步轮询）
export default async function handler(req, res) {
  // 1. 跨域配置
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
    // 从请求体获取参数
    const { query, bot_id, conversation_id, user_id } = req.body;

    // 4. 必传参数校验
    if (!query || !bot_id) {
      return res.status(400).json({
        answer: "缺少必要参数：query（对话内容）或 bot_id（Coze智能体ID）",
        conversation_id: "",
        coze_raw_data: { code: 400, msg: "Missing required parameters" }
      });
    }

    // 5. 第一步：调用Coze v3 chat接口（触发对话）
    const cozeChatResponse = await fetch('https://api.coze.cn/v3/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer pat_GRf38ScCi8TRt3OJoKuE8MbdBr71t5ncfDq2mk5ShZagiRTqV67VUHA69RLzXEgX`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        bot_id: bot_id,
        user_id: user_id || `user_${Date.now()}`,
        query: query,
        conversation_id: conversation_id || "",
        stream: false
      })
    });

    const cozeChatData = await cozeChatResponse.json();
    console.log("Coze触发对话返回：", cozeChatData);

    // 6. 第二步：轮询获取对话结果（直到status=completed）
    let cozeResultData = null;
    let maxRetries = 10; // 最大轮询次数（避免无限循环）
    let retryCount = 0;
    const chatId = cozeChatData.data?.id; // 对话ID（用于轮询）
    const newConversationId = cozeChatData.data?.conversation_id || "";

    if (!chatId) {
      return res.status(200).json({
        answer: "抱歉，未获取到对话ID，无法获取回复",
        conversation_id: newConversationId,
        coze_raw_data: cozeChatData
      });
    }

    // 轮询逻辑：每隔500ms请求一次，直到完成或达到最大次数
    while (retryCount < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 500)); // 等待500ms
      retryCount++;

      // 调用Coze v3获取对话结果接口
      const resultResponse = await fetch(`https://api.coze.cn/v3/chat/retrieve?chat_id=${chatId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer pat_GRf38ScCi8TRt3OJoKuE8MbdBr71t5ncfDq2mk5ShZagiRTqV67VUHA69RLzXEgX`,
          'Accept': 'application/json'
        }
      });

      cozeResultData = await resultResponse.json();
      console.log(`轮询第${retryCount}次：`, cozeResultData);

      // 状态为completed，说明回复生成完成，退出轮询
      if (cozeResultData.data?.status === "completed") {
        break;
      }

      // 状态为failed，说明生成失败，退出轮询
      if (cozeResultData.data?.status === "failed") {
        break;
      }
    }

    // 7. 提取有效回复
    let answer = "抱歉，我暂时无法提供相关回应，请尝试其他话题。";

    // 轮询成功且状态为completed
    if (cozeResultData && cozeResultData.code === 0 && cozeResultData.data?.status === "completed") {
      if (cozeResultData.data.messages && Array.isArray(cozeResultData.data.messages)) {
        const botMsg = cozeResultData.data.messages.find(msg => msg.role === "assistant");
        if (botMsg && botMsg.content) {
          answer = botMsg.content;
        }
      }
    }
    // 轮询失败（状态为failed）
    else if (cozeResultData && cozeResultData.data?.status === "failed") {
      answer = `Coze生成回复失败：${cozeResultData.data.last_error?.msg || '未知错误'}`;
    }
    // 轮询超时
    else if (retryCount >= maxRetries) {
      answer = "Coze回复生成超时，请稍后再试";
    }

    // 8. 返回给前端
    res.status(200).json({
      answer: answer,
      conversation_id: newConversationId,
      coze_raw_data: cozeResultData || cozeChatData
    });

  } catch (error) {
    console.error("后端执行错误：", error);
    res.status(500).json({
      answer: `后端异常：${error.message}`,
      conversation_id: "",
      coze_raw_data: { code: 500, msg: error.message }
    });
  }
}
