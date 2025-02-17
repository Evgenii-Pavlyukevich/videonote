const { OpenAI } = require('openai');
const busboy = require('busboy');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const corsHeaders = {
  'Access-Control-Allow-Credentials': true,
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
  'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
};

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
${transcription}`;
};

const parseMultipartForm = async (req) => {
  return new Promise((resolve, reject) => {
    const fields = {};
    let fileBuffer = null;
    let fileName = '';

    const bb = busboy({ headers: req.headers });

    bb.on('file', (name, file, info) => {
      fileName = info.filename;
      const chunks = [];
      file.on('data', (data) => chunks.push(data));
      file.on('end', () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });

    bb.on('field', (name, val) => {
      fields[name] = val;
    });

    bb.on('close', () => {
      resolve({ fields, fileBuffer, fileName });
    });

    bb.on('error', (err) => {
      reject(err);
    });

    req.pipe(bb);
  });
};

module.exports = async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }

  // Add CORS headers to all responses
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Processing request...');
    const { fields, fileBuffer, fileName } = await parseMultipartForm(req);
    console.log('Form parsed:', { fields: Object.keys(fields), hasFile: !!fileBuffer });

    if (!fileBuffer || !fields.title || !fields.business_description || !fields.participants) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const participants = JSON.parse(fields.participants);

    // Process with Whisper
    console.log('Processing with Whisper...');
    const transcription = await openai.audio.transcriptions.create({
      file: {
        buffer: fileBuffer,
        name: fileName || 'audio.mp3',
      },
      model: "whisper-1",
    });
    console.log('Transcription complete');

    // Generate GPT prompt and get response
    console.log('Generating GPT response...');
    const gptResponse = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are a helpful assistant that always responds with valid JSON." },
        { role: "user", content: generateGptPrompt(fields.business_description, participants, transcription.text) }
      ],
      temperature: 0.7
    });
    console.log('GPT response received');

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

    res.status(200).json({
      whisper_output: { text: transcription.text },
      gpt_output: gptOutput
    });
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({
      error: error.message || 'An error occurred while processing your request.'
    });
  }
}; 