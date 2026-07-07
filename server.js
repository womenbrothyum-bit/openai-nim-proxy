// server.js - OpenAI to NVIDIA NIM Proxy (Render Free Tier Optimized)
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Open CORS parameters for Janitor AI stability
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Accel-Buffering'],
  credentials: true
}));

app.options('*', cors()); 

app.use(express.json({ limit: '100mb' })); 
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// NVIDIA Cloud Registry Endpoint configuration
const NIM_API_BASE = process.env.NIM_API_BASE || 'https://nvidia.com';
const NIM_API_KEY = process.env.NIM_API_KEY;

// High-availability model array
const MODEL_MAPPING = {
  'gpt-3.5-turbo': 'meta/llama-3.1-8b-instruct',
  'gpt-4': 'meta/llama-3.3-70b-instruct',
  'gpt-4-turbo': 'meta/llama-3.1-405b-instruct',
  'gpt-4o': 'meta/llama-3.3-70b-instruct',
  'claude-3-opus': 'meta/llama-3.3-70b-instruct',
  'claude-3-sonnet': 'meta/llama-3.3-70b-instruct',
  'gemini-pro': 'meta/llama-3.1-8b-instruct' 
};

// Health Check Node
app.get(['/', '/health'], (req, res) => {
  res.json({ status: 'ok', platform: 'Render Free Tier' });
});

// Main Chat Routing Handler (Accepts raw roots or sub-folder routes seamlessly)
app.post(['/', '/v1/chat/completions'], async (req, res) => {
  try {
    const { model, messages, temperature, max_tokens, stream } = req.body;
    let nimModel = MODEL_MAPPING[model] || 'meta/llama-3.1-8b-instruct';
    
    const nimRequest = {
      model: nimModel,
      messages: messages,
      temperature: temperature || 0.6,
      max_tokens: max_tokens || 1024, // Kept light to stay within free API minute caps
      stream: stream || false
    };
    
    const response = await axios.post(`${NIM_API_BASE}/chat/completions`, nimRequest, {
      headers: {
        'Authorization': `Bearer ${NIM_API_KEY?.trim()}`,
        'Content-Type': 'application/json',
        'Accept': stream ? 'text/event-stream' : 'application/json'
      },
      responseType: stream ? 'stream' : 'json'
    });
    
    if (stream) {
      // 🚨 THE CRITICAL RENDER FREE TIER FIX 🚨
      // These headers force Render's load balancer to stop buffering chunks
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disables proxy chunk aggregation
      
      response.data.on('data', (chunk) => {
        res.write(chunk);
      });
      response.data.on('end', () => res.end());
      response.data.on('error', () => res.end());
    } else {
      res.json(response.data);
    }
    
  } catch (error) {
    console.error('--- 🚨 PROXY snag 🚨 ---');
    console.error('Message:', error.message);
    if (error.response) {
      console.dir(error.response.data, { depth: null, colors: true });
    }
    res.status(error.response?.status || 500).json({
      error: { message: error.message || 'Internal proxy snag' }
    });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy running on port ${PORT}`);
});
