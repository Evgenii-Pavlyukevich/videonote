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

      const response = await fetch('/api/process-meeting', {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
        mode: 'cors',
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Server response:', errorData);
        throw new Error(
          errorData.startsWith('{') 
            ? JSON.parse(errorData).error 
            : 'Ошибка сервера'
        );
      }

      const data = await response.json();
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