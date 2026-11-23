import React from 'react';
import {createRoot} from 'react-dom/client';
import Studio from './workbench/Studio';
import './workbench/workbench.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><div className="workbench" data-palette="navy-white" data-layout="worksheet"><Studio/></div></React.StrictMode>);
