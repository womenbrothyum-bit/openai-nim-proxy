// server.js - OpenAI to NVIDIA Function Invoke Proxy (Render Free Tier Optimized)
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Accel-Buffering'],
  credentials: true
}));

app.options('*', cors()); 
app.use(express.json({ limit: '100mb' })); 
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// NVIDIA Personal Developer Function API Endpoint configuration
const NIM_API_BASE = process.env.NIM_API_BASE || 'https://nvidia.com';
const NIM_API_KEY = process.env.NIM_API_KEY;

// Direct operational IDs for your personal account tier
const MODEL_MAPPING = {
  'gpt-3.5-turbo': '0c232230-0d30-4e33-911e-b873a4666f44', // Llama 3.1 8B Base Function ID
  'gpt-4o': '124e4d58-c9cb-4c28-98e3-05ecb1236802'       // Llama 3.3 70B Base Function ID
};

app.get(['/', '/health'], (req, res) => {
  res.json({ status: 'ok', tier: 'Personal Developer Bypassed' });
});

app.post(['/', '/v1/chat/completions'], async (req, res) => {
  try {
    const { model, messages, temperature, max_tokens, stream } = req.body;
    
    // Select the valid model hash string or fallback to safe Llama baseline
    let functionId = MODEL_MAPPING[model] || '0c232230-0d30-4e33-911e-b873a4666f44';
    
    const nimRequest = {
      messages: messages,
      temperature: temperature || 0.6,
      max_tokens: max_tokens || 1024,
      stream: stream || false
    };
    
    // Direct operational request routing bypassing the integrated 404 block
    const response = await axios.post(`${NIM_API_BASE}/${functionId}`, nimRequest, {
      headers: {
        'Authorization': `Bearer ${NIM_API_KEY?.trim()}`,
        'Content-Type': 'application/json',
        'Accept': stream ? 'text/event-stream' : 'application/json'
      },
      responseType: stream ? 'stream' : 'json'
    });
    
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); 
      
      response.data.on('data', (chunk) => {
        res.write(chunk);
      });
      response.data.on('end', () => res.end());
      response.data.on('error', () => res.end());
    } else {
      // Structure response payload to be OpenAI/Janitor compliant
      res.json({
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: response.data.choices?.[0]?.message?.content || response.data.text || ''
          },
          finish_reason: 'stop'
        }]
      });
    }
    
  } catch (error) {
    console.error('--- 🚨 DIRECT PROXY SNAG 🚨 ---');
    console.error('Message:', error.message);
    res.status(500).json({ error: { message: 'NVIDIA Direct Invoke Failure' } });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy running on port ${PORT}`);
});
