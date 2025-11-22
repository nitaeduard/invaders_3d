import React from 'react';
import { createRoot } from 'react-dom/client';
import SpaceInvaders3D from './space-invaders-3d';
import './styles.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container not found');
}
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <SpaceInvaders3D />
  </React.StrictMode>
);