import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import './admin.css';
import './customer.css';
import './readability.css';
import './premium.css';
import './atelier.css';
import './experience.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
