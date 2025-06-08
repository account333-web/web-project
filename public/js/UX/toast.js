// js/toast.js
// Définition directe de la fonction de toast d'erreur
window.showErrorToast = (message, duration = 3000) => {
  const toast = document.createElement('div');
  toast.className = 'toast toast-error';
  toast.textContent = message;
  document.body.appendChild(toast);
  // déclencher l'apparition
  requestAnimationFrame(() => toast.classList.add('show'));
  // masquage automatique après `duration`
  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove());
  }, duration);
};

window.showSuccessToast = (message, duration = 3000) => {
  const toast = document.createElement('div');
  toast.className = 'toast toast-success';
  toast.textContent = message;
  document.body.appendChild(toast);
  // apparition animée
  requestAnimationFrame(() => toast.classList.add('show'));
  // disparition après `duration`
  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove());
  }, duration);
};
