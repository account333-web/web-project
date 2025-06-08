// nav.js
import { wallet, blackTrigger } from './constants.js';

// on attend le DOM
document.addEventListener('DOMContentLoaded', () => {
  // profil
  wallet.addEventListener('click', () => {
    window.location.href = 'profile.html';
  });

  // mode secret
  blackTrigger.addEventListener('click', e => {
    e.stopPropagation();
    e.preventDefault();
    document.body.classList.add('game-mode');
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.body.classList.remove('game-mode');
    }
  });

  // autres boutons
  document.getElementById('trade').addEventListener('click', () => {
    window.location.href = 'trade.html';
  });
  document.getElementById('snakeGameBtn').addEventListener('click', () => {
    window.location.href = './snake.html';
  });
  document.getElementById('gnopGameBtn').addEventListener('click', () => {
    window.location.href = './pong.html';
  });
});
