import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { McpToolsDemoApp } from './McpToolsDemoApp';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <McpToolsDemoApp />
  </StrictMode>,
);
