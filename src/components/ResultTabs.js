import React, { useState } from 'react';

const ResultTabs = ({ whisperOutput, gptOutput }) => {
  const [activeTab, setActiveTab] = useState('transcription');

  return (
    <div className="results-container">
      <div className="tabs">
        <a 
          href="#" 
          className={activeTab === 'transcription' ? 'active' : ''} 
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('transcription');
          }}
        >
          Расшифровка
        </a>
        <a 
          href="#" 
          className={activeTab === 'analysis' ? 'active' : ''} 
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('analysis');
          }}
        >
          Анализ
        </a>
      </div>

      <div className="content-section">
        {activeTab === 'transcription' && whisperOutput && (
          <div>
            <h2>Расшифровка</h2>
            <p>{whisperOutput.text}</p>
          </div>
        )}

        {activeTab === 'analysis' && gptOutput && (
          <>
            <div>
              <h2>Резюме</h2>
              <div dangerouslySetInnerHTML={{ __html: gptOutput.summary }} />
            </div>
            
            <div>
              <h2>Задачи</h2>
              <div dangerouslySetInnerHTML={{ __html: gptOutput.tasks }} />
            </div>
            
            <div>
              <h2>Таймкоды</h2>
              <div dangerouslySetInnerHTML={{ __html: gptOutput.timecodes }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ResultTabs; 