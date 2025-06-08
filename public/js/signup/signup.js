const signupParams = new URLSearchParams(window.location.search);
const signupAlertBox = document.getElementById('alert');

/**
 * Échappe les caractères spéciaux pour prévenir les XSS
 * @param {string} str — chaîne à échapper
 * @returns {string} — chaîne échappée
 */
function escapeHTML(str) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;'
  };
  return String(str).replace(/[&<>"'/]/g, (char) => map[char]);
}

if (signupParams.has('error')) {
  let txt;
  switch (signupParams.get('error')) {
    case 'missing': txt = '❌ Veuillez remplir tous les champs.'; break;
    case 'exists': txt = '❌ Ce pseudo est déjà pris.'; break;
    case 'server': txt = '❌ Erreur serveur, réessayez.'; break;
    case 'length': txt = '❌ Pseudo trop long (8 char max)'; break;
    default: txt = '❌ Une erreur est survenue.'; break;
  }
  signupAlertBox.textContent = escapeHTML(txt);
} else if (signupParams.get('success') === 'created') {
  signupAlertBox.textContent = escapeHTML('✅ Compte créé avec succès !');
  signupAlertBox.style.color = '#080';
}