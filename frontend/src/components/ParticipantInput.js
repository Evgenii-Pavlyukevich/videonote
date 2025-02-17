import React from 'react';

const ParticipantInput = ({ 
  participants, 
  setParticipants, 
  title, 
  setTitle, 
  businessDescription, 
  setBusinessDescription 
}) => {
  return (
    <div className="input-section">
      <input
        type="text"
        placeholder="Название встречи"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="input-field"
      />
      
      <textarea
        placeholder="Участники (Например: Иванов Иван - фронтенд разработчик, Петров Петр - бизнес аналитик)"
        value={participants}
        onChange={(e) => setParticipants(e.target.value)}
        className="input-field"
      />
      
      <textarea
        placeholder="Описание бизнеса"
        value={businessDescription}
        onChange={(e) => setBusinessDescription(e.target.value)}
        className="input-field"
      />
    </div>
  );
};

export default ParticipantInput; 