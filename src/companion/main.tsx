import {registerAppWorker} from '../appWorker';
import React from 'react';
import {createRoot} from 'react-dom/client';
import CompanionApp from './CompanionApp';
import './neon.css';
import './neonLegibility.css';
registerAppWorker();
createRoot(document.getElementById('companion-root')!).render(<React.StrictMode><CompanionApp/></React.StrictMode>);
