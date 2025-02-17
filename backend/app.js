const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
require('dotenv').config();

// Initialize OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Configure multer for memory storage (for Vercel)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    const allowedExtensions = new Set(['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm']);
    if (allowedExtensions.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

const generateGptPrompt = (businessDescription, participants, transcription) => {
  const participantsStr = participants
    .map(p => `- ${p.name} (${p.position})`)
    .join('\n');

  return `Please analyze this transcription and provide the response in the following JSON format:

{
    "summary": "A professionally written bullet-point list of the key discussion points from the meeting. Each bullet point should be concise and clearly state the essential point.",
    "tasks": "A professionally written, structured bullet-point list of action items assigned to each participant. Include the name of the partisipant and their respective tasks. Keep it clear and actionable.",
    "timecodes": "A professionally written bullet-point list of important moments, each starting with a timestamp in HH:MM:SS format, followed by a brief, clear description of what occurred or was decided at that moment."
}

Context:
This is a transcription of a video-call in a company that ${businessDescription}.

Language:
Provide the answer in the same language as the initial transcription.

Participants:
${participantsStr}

Transcription:
${transcription}

Constraints:
- Return ONLY valid JSON without any additional text or formatting.
- The content of the JSON values should maintain a professional and concise tone.
- Use bullet points within the strings by starting lines with a dash and a space ("- ") for clarity.
- The summary, tasks, and timecodes should each be contained in a single string, with line breaks between bullet points if desired.`;
};

// Create Express app for local development
const app = express();

// CORS middleware for local development
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? true 
    : 'http://localhost:3000',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true
}));

// Main processing function
async function processMeeting(req, res) {
  try {
    // For Vercel, we need to handle the file upload differently
    const uploadMiddleware = upload.single('file');
    
    await new Promise((resolve, reject) => {
      uploadMiddleware(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { title, business_description, participants } = req.body;
    
    if (!title || !business_description || !participants) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let parsedParticipants;
    try {
      parsedParticipants = JSON.parse(participants);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid participants format' });
    }

    // Create a temporary file for Whisper API
    const buffer = req.file.buffer;
    const tempFilePath = `/tmp/${Date.now()}-${req.file.originalname}`;
    fs.writeFileSync(tempFilePath, buffer);

    // Process with Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: "whisper-1",
      language: "ru"
    });

    // Clean up temp file
    fs.unlinkSync(tempFilePath);

    // Generate GPT prompt and get response
    const prompt = generateGptPrompt(
      business_description,
      parsedParticipants,
      transcription.text
    );

    const gptResponse = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are a helpful assistant that always responds with valid JSON." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7
    });

    let gptOutput;
    try {
      gptOutput = JSON.parse(gptResponse.choices[0].message.content);
    } catch (e) {
      console.error('Error parsing GPT response:', e);
      console.error('Raw GPT response:', gptResponse.choices[0].message.content);
      gptOutput = {
        summary: "Could not generate summary due to processing error.",
        tasks: "Could not generate tasks due to processing error.",
        timecodes: "Could not generate timecodes due to processing error."
      };
    }

    return res.json({
      whisper_output: { text: transcription.text },
      gpt_output: gptOutput
    });

  } catch (error) {
    console.error('Error processing request:', error);
    return res.status(500).json({
      error: 'An error occurred while processing your request. Please try again.'
    });
  }
}

// For local development
if (process.env.NODE_ENV !== 'production') {
  app.post('/api/process-meeting', processMeeting);
  app.listen(process.env.PORT || 5002, () => {
    console.log(`Server running on port ${process.env.PORT || 5002}`);
  });
}

// Export for Vercel
module.exports = {
  processMeeting
}; 