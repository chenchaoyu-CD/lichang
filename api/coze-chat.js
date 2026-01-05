// 小白专用：Coze代理函数，无需修改代码
export default async function handler(req, res) {
  // 解决跨域，让前端能访问
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 只接受POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只支持POST请求哦' });
  }

  try {
    // 1. 拿到前端传的消息
    const { query, conversation_id } = req.body;
    if (!query) {
      return res.status(400).json({ error: '请输入要发送的消息' });
    }

    // 2. 从Vercel环境变量拿到Coze信息（不用写在代码里，安全）
    const COZE_BOT_ID = process.env.COZE_BOT_ID;
    const COZE_PAT = process.env.COZE_PAT;
    if (!COZE_BOT_ID || !COZE_PAT) {
      return res.status(500).json({ error: '还没配置Coze的bot_id或PAT哦' });
    }

    // 3. 调用Coze API
    const cozeRes = await fetch('https://api.coze.com/open_api/v2/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${COZE_PAT}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bot_id: COZE_BOT_ID,
        user_id: 'coze小白用户',
        query: query,
        conversation_id: conversation_id || undefined
      })
    });

    const cozeData = await cozeRes.json();
    // 4. 返回结果给前端
    return res.status(200).json(cozeData);
  } catch (error) {
    return res.status(500).json({ error: '服务出错了', detail: error.message });
  }
}
