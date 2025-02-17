import { OpenAI } from 'openai';
import formidable from 'formidable';
import { createReadStream } from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = formidable();
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve([fields, files]);
      });
    });

    if (!files.file || !fields.title || !fields.business_description || !fields.participants) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const participants = JSON.parse(fields.participants);

    // Process with Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: createReadStream(files.file[0].filepath),
      model: "whisper-1",
    });

    // Generate GPT prompt and get response
    const gptResponse = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are a helpful assistant that always responds with valid JSON." },
        { role: "user", content: generateGptPrompt(fields.business_description, participants, transcription.text) }
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

    res.status(200).json({
      whisper_output: { text: transcription.text },
      gpt_output: gptOutput
    });
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({
      error: 'An error occurred while processing your request.'
    });
  }
} 