import React from 'react';
import {createRoot} from 'react-dom/client';
import CompanionApp from './CompanionApp';
import './companion.css';
import './refinements.css';
import './neon.css';
createRoot(document.getElementById('companion-root')!).render(<React.StrictMode><CompanionApp/></React.StrictMode>);
