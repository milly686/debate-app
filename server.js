const express = require('express');
const path = require('path');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========== 环境变量 ==========
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// ========== 内存数据库 ==========
let debateConfig = null;    // 当前辩论配置
let messages = [];           // 消息列表
let nextMsgId = 1;           // 下一个消息ID

// ========== DeepSeek API 调用 ==========
async function callDeepSeek(msgs) {
  const res = await axios.post(DEEPSEEK_API_URL, {
    model: 'deepseek-chat',
    messages: msgs,
    max_tokens: 600,
    temperature: 0.7
  }, {
    headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
    timeout: 30000
  });
  return res.data.choices[0].message.content;
}

// ========== 生成总结 ==========
async function generateSummary(config, allMessages) {
  const studentMessages = allMessages
    .filter(m => m.role === 'user')
    .map(m => `[${m.sender || '同学'}]: ${m.content}`)
    .join('\n');

  const prompt = `你是传播学教师助手。请根据以下辩论过程生成教学总结。

【辩题】${config.topic}
【AI立场】${config.stance}
【人设】${config.persona || '无特定人设'}

【学生发言记录】
${studentMessages || '（无学生发言记录）'}

请按以下格式生成总结：

## 辩论总结

### 一、辩题与核心知识点
（说明本辩题涉及的核心传播学知识点，200字左右）

### 二、辩论过程回顾
（简要回顾辩论中的关键论点）

### 三、知识理解分析
（结合学生发言，分析他们对相关知识点的理解情况，指出亮点和可深入探讨的方向）

### 四、学习建议
（给出进一步理解该知识点的建议，可以推荐相关理论或案例）`;

  return await callDeepSeek([{ role: 'user', content: prompt }]);
}

// ========== API 路由 ==========

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// 获取当前辩论配置
app.get('/api/config', (req, res) => {
  res.json({ config: debateConfig });
});

// 初始化辩论（老师操作）
app.post('/api/init', (req, res) => {
  const { topic, stance, persona } = req.body;

  if (!topic) {
    return res.status(400).json({ error: '缺少辩题' });
  }

  // 重置辩论数据
  debateConfig = {
    topic,
    stance: stance || '正方',
    persona: persona || '',
    createdAt: new Date().toISOString()
  };
  messages = [];
  nextMsgId = 1;

  res.json({ success: true });
});

// 获取消息列表
app.get('/api/messages', (req, res) => {
  const since = parseInt(req.query.since) || 0;
  const filtered = since > 0 ? messages.filter(m => m.id > since) : messages;
  res.json({
    messages: filtered,
    latestId: filtered.length > 0 ? Math.max(...filtered.map(m => m.id)) : since
  });
});

// 发送消息（学生辩论）
app.post('/api/message', async (req, res) => {
  const { content, sender } = req.body;

  if (!content) {
    return res.status(400).json({ error: '消息不能为空' });
  }

  if (!debateConfig) {
    return res.status(400).json({ error: '辩论尚未初始化，请先设置辩题' });
  }

  if (!DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: '未配置DEEPSEEK_API_KEY' });
  }

  // 结束辩论
  if (content.trim() === '结束辩论') {
    const summary = await generateSummary(debateConfig, messages);
    const aiMsg = {
      id: nextMsgId++,
      role: 'assistant',
      content: summary,
      sender: 'AI助手',
      isSummary: true,
      time: Date.now()
    };
    messages.push(aiMsg);
    return res.json({
      success: true,
      summary: true,
      aiMsg
    });
  }

  // 添加用户消息
  const userMsg = {
    id: nextMsgId++,
    role: 'user',
    content,
    sender: sender || '同学',
    time: Date.now()
  };
  messages.push(userMsg);

  // 构建 DeepSeek 请求
  const systemPrompt = `你是一个辩论AI助手，正在与传播学课堂的学生进行辩论。

【辩题】${debateConfig.topic}
【你的立场】${debateConfig.stance}
【你的人设】${debateConfig.persona || '严谨的传播学学者'}

你的任务：
1. 坚定维护你的立场，用传播学理论知识支撑你的观点
2. 对学生提出的观点进行有理有据的反驳
3. 保持学术严谨，引用传播学概念
4. 语言风格要符合你的人设
5. 每次回复控制在100-200字
6. 回复时可以称呼发言的同学名字`;

  const history = messages.slice(0, -1).map(m => ({
    role: m.role,
    content: m.sender ? `[${m.sender}]: ${m.content}` : m.content
  }));

  try {
    const aiContent = await callDeepSeek([
      { role: 'system', content: systemPrompt },
      ...history.slice(-10)
    ]);

    const aiMsg = {
      id: nextMsgId++,
      role: 'assistant',
      content: aiContent,
      sender: 'AI助手',
      time: Date.now()
    };
    messages.push(aiMsg);

    res.json({
      success: true,
      userMsg,
      aiMsg
    });
  } catch (err) {
    res.status(500).json({
      error: 'AI服务调用失败',
      details: err.message
    });
  }
});

// 所有其他请求返回 index.html（前端路由）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== 启动服务器 ==========
app.listen(PORT, () => {
  console.log(`AI辩论教学平台已启动！`);
  console.log(`访问地址：http://localhost:${PORT}`);
  console.log(`API地址：http://localhost:${PORT}/api/config`);
});
