import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

const ALLOWED_EXTENSIONS = ['.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm'];

const FileUpload = ({ onFileSelect }) => {
  const [selectedFile, setSelectedFile] = useState(null);

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const extension = '.' + file.name.split('.').pop().toLowerCase();
    const isValidExtension = ALLOWED_EXTENSIONS.includes(extension);
    
    if (isValidExtension) {
      setSelectedFile(file);
      onFileSelect(file);
    } else {
      alert('Пожалуйста, загрузите файл в одном из поддерживаемых форматов');
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ['.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm'],
      'video/*': ['.mp4', '.webm']
    },
    maxSize: 500 * 1024 * 1024,
    multiple: false
  });

  return (
    <div 
      className="upload-box" 
      {...getRootProps()}
      style={{ 
        borderColor: selectedFile ? '#4caf50' : '#d1d5db',
        backgroundColor: isDragActive ? '#e8f5e9' : '#f9fafb'
      }}
    >
      <input {...getInputProps()} />
      {isDragActive ? (
        <span>Перетащите файл сюда...</span>
      ) : selectedFile ? (
        <>
          <p>Выбранный файл: {selectedFile.name}</p>
          <span>Нажмите или перетащите, чтобы выбрать другой файл</span>
        </>
      ) : (
        <>
          <p>Поддерживаемые форматы: {ALLOWED_EXTENSIONS.join(', ')}<br/>Размер файла до 500 MB</p>
          <span>Перетащите файл сюда или нажмите, чтобы выбрать</span>
        </>
      )}
    </div>
  );
};

export default FileUpload; 