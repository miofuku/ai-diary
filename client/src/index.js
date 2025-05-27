import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Function to handle local diary entries
const loadLocalEntries = () => {
  try {
    // Check if entries exist in local storage
    const storedEntries = localStorage.getItem('diaryEntries');
    if (storedEntries) {
      window.entriesData = JSON.parse(storedEntries);
      console.log('Loaded entries from local storage:', window.entriesData.length);
    } else {
      window.entriesData = [];
      console.log('No entries found in local storage');
    }
  } catch (error) {
    console.error('Error loading entries from local storage:', error);
    window.entriesData = [];
  }
};

// Load entries before rendering the app
loadLocalEntries();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
