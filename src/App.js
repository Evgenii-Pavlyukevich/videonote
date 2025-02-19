import React, { useState } from 'react';
import FileUpload from './components/FileUpload';
import ParticipantInput from './components/ParticipantInput';
import ResultTabs from './components/ResultTabs';
import './App.css';

function App() {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [participants, setParticipants] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const API_URL = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3000/api/process-meeting'
    : 'https://videonote-beta.vercel.app/api/process-meeting';

  const handleSubmit = async () => {
    if (!file || !title || !participants || !businessDescription) {
      alert('Пожалуйста, заполните все поля');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('business_description', businessDescription);
    
    try {
      const participantsArray = participants.split(',').map(p => {
        const [name, position] = p.trim().split('-').map(s => s.trim());
        if (!name || !position) throw new Error('Неверный формат участников');
        return { name, position };
      });
      
      formData.append('participants', JSON.stringify(participantsArray));

      console.log('Sending request to:', API_URL);
      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error response:', errorText);
        let errorMessage = 'Ошибка сервера';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error?.message || errorData.error || errorMessage;
        } catch (e) {
          console.error('Failed to parse error response:', e);
        }
        throw new Error(errorMessage);
      }

      const responseText = await response.text();
      console.log('Raw response:', responseText);

      if (!responseText) {
        throw new Error('Пустой ответ от сервера');
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse response:', e);
        throw new Error('Ошибка сервера: неверный формат ответа');
      }

      console.log('Response data:', data);
      setResults(data);
    } catch (error) {
      console.error('Error details:', error);
      alert(`Ошибка: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Автоматизация видеоконференций</h1>
      
      <FileUpload onFileSelect={setFile} />
      
      <ParticipantInput
        participants={participants}
        setParticipants={setParticipants}
        title={title}
        setTitle={setTitle}
        businessDescription={businessDescription}
        setBusinessDescription={setBusinessDescription}
      />

      <button 
        className="process-button" 
        onClick={handleSubmit}
        disabled={loading}
      >
        {loading ? 'Обработка...' : '➤ Обработать'}
      </button>

      {results && <ResultTabs whisperOutput={results.whisper_output} gptOutput={results.gpt_output} />}
    </div>
  );
}

export default App; 