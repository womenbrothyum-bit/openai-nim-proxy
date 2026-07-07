// server.js - OpenAI to NVIDIA Developer API Proxy
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - Configured specifically to open CORS headers for Janitor AI
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

app.options('*', cors()); 

app.use(express.json({ limit: '100mb' })); 
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// NVIDIA API configuration - Set to the official developer hub endpoint
const NIM_API_BASE = process.env.NIM_API_BASE || 'https://nvidia.com';
const NIM_API_KEY = process.env.NIM_API_KEY;

// 🔥 REASONING DISPLAY TOGGLE - Shows/hides reasoning in output
const SHOW_REASONING = false; 

// 🔥 THINKING MODE TOGGLE - Enables thinking for specific models that support it
const ENABLE_THINKING_MODE = false; 

// Model mapping - Realigned with verified, high-availability free tier identifiers
const MODEL_MAPPING = {
  'gpt-3.5-turbo': 'meta/llama-3.1-8b-instruct',
  'gpt-4': 'meta/llama-3.3-70b-instruct',
  'gpt-4-turbo': 'meta/llama-3.1-405b-instruct',
  'gpt-4o': 'meta/llama-3.3-70b-instruct',
  'claude-3-opus': 'meta/llama-3.3-70b-instruct',
  'claude-3-sonnet': 'meta/llama-3.3-70b-instruct',
  'gemini-pro': 'meta/llama-3.1-8b-instruct' 
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'OpenAI to NVIDIA Proxy' });
});

// Chat completions endpoint
app.post('/v1/chat/completions', async (req, res) => {
  try {
    const { model, messages, temperature, max_tokens, stream } = req.body;
    
    let nimModel = MODEL_MAPPING[model] || 'meta/llama-3.1-8b-instruct';
    
    // Transform OpenAI request to standard layout parameters
    const nimRequest = {
      model: nimModel,
      messages: messages,
      temperature: temperature || 0.6,
      max_tokens: max_tokens || 2048,
      stream: stream || false
    };
    
    // Make request directly to NVIDIA Developer catalog nodes
    const response = await axios.post(`${NIM_API_BASE}`, nimRequest, {
      headers: {
        'Authorization': `Bearer ${NIM_API_KEY?.trim()}`,
        'Content-Type': 'application/json',
        'Accept': stream ? 'text/event-stream' : 'application/json'
      },
      responseType: stream ? 'stream' : 'json'
    });
    
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      response.data.pipe(res); // Straight-pipe stream pass-through for stability
    } else {
      res.json(response.data);
    }
    
  } catch (error) {
    console.error('--- 🚨 CRITICAL PROXY BREAKDOWN 🚨 ---');
    console.error('Proxy Error Message:', error.message);
    if (error.response) {
      console.error('Upstream Server Status:', error.response.status);
      console.dir(error.response.data, { depth: 1, colors: true });
    }
    console.error('--------------------------------------');
    
    res.status(error.response?.status || 500).json({
      error: { message: error.message || 'Internal server error', code: error.response?.status || 500 }
    });
  }
});

app.listen(PORT, () => {
  console.log(`OpenAI to NVIDIA Proxy running on port ${PORT}`);
});
