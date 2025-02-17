# VideoNotes

A web application that transcribes and analyzes video/audio meetings using OpenAI's Whisper and GPT-4.

## Features

- Audio/video file upload
- Transcription using Whisper API
- Meeting analysis using GPT-4
- Summary generation
- Task extraction
- Timecode marking

## Tech Stack

- Frontend: React.js
- Backend: Node.js with Express
- APIs: OpenAI (Whisper & GPT-4)
- Deployment: Vercel

## Setup

1. Clone the repository:
```bash
git clone <your-repo-url>
cd videonotes
```

2. Install dependencies:
```bash
# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install
```

3. Create a `.env` file in the backend directory:
```
OPENAI_API_KEY=your_openai_api_key
NODE_ENV=development
```

4. Run the development servers:
```bash
# Start backend (from backend directory)
npm run dev

# Start frontend (from frontend directory)
npm start
```

## Deployment

This project is configured for deployment on Vercel:

1. Push your code to GitHub
2. Connect your GitHub repository to Vercel
3. Configure the following environment variables in Vercel:
   - `OPENAI_API_KEY`
   - `NODE_ENV=production`
4. Deploy! 