import { OpenAI } from 'openai';
import multer from 'multer';
import { promisify } from 'util';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = new Set(['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'video/mp4', 'video/webm']);
    if (allowedTypes.has(file.mimetype)) {
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

// Promisify multer middleware
const multerPromise = promisify(upload.single('file'));

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Handle file upload
    await multerPromise(req, res);
    
    const { title, business_description, participants } = req.body;
    
    if (!req.file || !title || !business_description || !participants) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let parsedParticipants;
    try {
      parsedParticipants = JSON.parse(participants);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid participants format' });
    }

    // Process with Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: req.file.buffer,
      model: "whisper-1",
    });

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
      gptOutput = {
        summary: "Could not generate summary due to processing error.",
        tasks: "Could not generate tasks due to processing error.",
        timecodes: "Could not generate timecodes due to processing error."
      };
    }

    return res.status(200).json({
      whisper_output: { text: transcription.text },
      gpt_output: gptOutput
    });

  } catch (error) {
    console.error('Error processing request:', error);
    return res.status(500).json({
      error: error.message || 'An error occurred while processing your request'
    });
  }
} 