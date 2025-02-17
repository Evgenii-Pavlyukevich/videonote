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

function parseMultipartForm(req) {
  return new Promise((resolve, reject) => {
    const data = {
      fields: {},
      file: null,
      fileName: null
    };

    const bb = busboy({ headers: req.headers });

    bb.on('file', (name, file, info) => {
      console.log('Processing file:', info.filename);
      const chunks = [];
      data.fileName = info.filename;

      file.on('data', (chunk) => chunks.push(chunk));
      file.on('end', () => {
        data.file = Buffer.concat(chunks);
        console.log('File processing complete');
      });
    });

    bb.on('field', (name, val) => {
      console.log('Processing field:', name);
      data.fields[name] = val;
    });

    bb.on('finish', () => {
      console.log('Form parsing complete');
      resolve(data);
    });

    bb.on('error', (error) => {
      console.error('Form parsing error:', error);
      reject(new Error('Error parsing form data'));
    });

    req.pipe(bb);
  });
}

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Processing request...');
    const formData = await parseMultipartForm(req);
    console.log('Form data parsed successfully');

    if (!formData.file) {
      throw new Error('No file uploaded');
    }

    const { title, participants, business_description } = formData.fields;
    
    if (!title || !participants || !business_description) {
      throw new Error('Missing required fields');
    }

    console.log('Creating transcription with Whisper...');
    const transcriptionResponse = await openai.audio.transcriptions.create({
      file: {
        data: formData.file,
        name: formData.fileName || 'audio.mp3'
      },
      model: 'whisper-1',
    });

    if (!transcriptionResponse.text) {
      throw new Error('Failed to transcribe audio');
    }

    console.log('Transcription complete, processing with GPT...');
    const gptResponse = await openai.chat.completions.create({
      model: 'gpt-4-1106-preview',
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant that helps analyze business meetings. 
          The meeting title is: ${title}
          The participants are: ${participants}
          Business context: ${business_description}`
        },
        {
          role: 'user',
          content: `Please analyze this meeting transcript and provide:
          1. A brief summary
          2. Key decisions made
          3. Action items with assigned responsibilities
          4. Follow-up tasks
          5. Important deadlines mentioned
          
          Transcript: ${transcriptionResponse.text}`
        }
      ],
      temperature: 0.7,
    });

    if (!gptResponse.choices?.[0]?.message?.content) {
      throw new Error('Failed to analyze transcript');
    }

    console.log('Analysis complete, sending response');
    return res.status(200).json({
      whisper_output: transcriptionResponse.text,
      gpt_output: gptResponse.choices[0].message.content
    });

  } catch (error) {
    console.error('Error processing request:', error);
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      error: {
        message: error.message || 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
}; 