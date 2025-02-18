const { OpenAI } = require('openai');
const busboy = require('busboy');

// Constants for file validation
const VALID_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/x-m4a',
  'video/mp4',
  'video/mpeg',
  'video/webm'
];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

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

function validateFile(file, fileName) {
  if (!file) {
    throw new Error('No file provided');
  }

  // Extract file extension and check MIME type
  const fileExtension = fileName.split('.').pop().toLowerCase();
  const isValidType = VALID_MIME_TYPES.some(type => 
    type.includes(fileExtension) || type.endsWith(fileExtension)
  );

  if (!isValidType) {
    throw new Error('Unsupported file type');
  }

  if (file.length > MAX_FILE_SIZE) {
    throw new Error('File size exceeds 25MB limit');
  }
}

function parseMultipartForm(req) {
  return new Promise((resolve, reject) => {
    const data = {
      fields: {},
      file: null,
      fileName: null
    };

    const bb = busboy({ 
      headers: req.headers,
      limits: {
        fileSize: MAX_FILE_SIZE,
        files: 1 // Allow only 1 file
      }
    });

    bb.on('file', (name, file, info) => {
      console.log('Processing file:', info.filename);
      const chunks = [];
      data.fileName = info.filename;

      file.on('data', (chunk) => chunks.push(chunk));
      file.on('end', () => {
        data.file = Buffer.concat(chunks);
        console.log('File processing complete, size:', data.file.length);
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
      reject(new Error('Error parsing form data: ' + error.message));
    });

    bb.on('limit', () => {
      reject(new Error('File size exceeds 25MB limit'));
    });

    req.pipe(bb);
  });
}

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: {
        message: 'Method not allowed',
        code: 'METHOD_NOT_ALLOWED'
      }
    });
  }

  try {
    console.log('Processing request...');
    const formData = await parseMultipartForm(req);
    console.log('Form data parsed successfully');

    // Validate file
    validateFile(formData.file, formData.fileName);

    // Validate required fields
    const { title, participants, business_description } = formData.fields;
    if (!title || !participants || !business_description) {
      throw new Error('Missing required fields');
    }

    let participantsArray;
    try {
      participantsArray = JSON.parse(participants);
    } catch (e) {
      throw new Error('Invalid participants format');
    }

    console.log('Creating transcription with Whisper...');
    const transcriptionResponse = await openai.audio.transcriptions.create({
      file: {
        data: formData.file,
        name: formData.fileName
      },
      model: 'whisper-1',
    }).catch(error => {
      console.error('Whisper API error:', error);
      throw new Error('Failed to transcribe audio: ' + error.message);
    });

    if (!transcriptionResponse?.text) {
      throw new Error('Failed to transcribe audio: No transcription returned');
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
    }).catch(error => {
      console.error('GPT API error:', error);
      throw new Error('Failed to analyze transcript: ' + error.message);
    });

    if (!gptResponse?.choices?.[0]?.message?.content) {
      throw new Error('Failed to analyze transcript: No analysis returned');
    }

    console.log('Analysis complete, sending response');
    return res.status(200).json({
      whisper_output: transcriptionResponse.text,
      gpt_output: gptResponse.choices[0].message.content
    });

  } catch (error) {
    console.error('Error processing request:', error);
    const statusCode = error.status || 500;
    const errorResponse = {
      error: {
        message: error.message || 'Internal server error',
        code: error.code || 'INTERNAL_SERVER_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    };
    
    // Log the error response being sent
    console.error('Sending error response:', errorResponse);
    
    return res.status(statusCode).json(errorResponse);
  }
}; 