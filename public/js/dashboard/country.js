// public/js/country.js
import { loadUserInfo } from './userInfo.js';

export function loadCountries() {
  csrfFetch('/api/countries')
    .then(r => r.json())
    .then(cs => {
      // 1) On cible bien le <ul id="country-track"> du carousel
      const track = document.getElementById('country-track');
      track.innerHTML = ''; // on vide les skeletons / anciens items

      cs.forEach(c => {
        // 2) Pour chaque pays, on crée la <li> avec la classe "carousel-item"
        const li = document.createElement('li');
        li.className = 'carousel-item';

        // 3) À l’intérieur, on crée la <div class="country-card">
        const card = document.createElement('div');
        card.className = 'country-card';

        // --- a) Titre du pays ---
        const title = document.createElement('h3');
        title.textContent = c.name;
        card.appendChild(title);

        // --- b) Bloc “country-details” avec les infos (impôts, logement, etc.) ---
        const details = document.createElement('div');
        details.className = 'country-details';
        [
          `Impôts : ${(c.tax_rate * 100).toFixed(0)}%`,
          `Logement : ${c.housing_cost} CC/mois`,
          `Taxe d'entrée : ${c.entry_fee} CC`,
          `Trésorerie : ${c.revenue} CC`
        ].forEach(text => {
          const p = document.createElement('p');
          p.textContent = text;
          details.appendChild(p);
        });
        card.appendChild(details);

        // --- c) Bloc “actions” avec le bouton “Déménager” ---
        const actions = document.createElement('div');
        actions.className = 'actions';
        const btn = document.createElement('button');
        btn.classList.add('btn')
        btn.dataset.id = c.id;
        btn.textContent = 'Déménager';
        btn.addEventListener('click', () => {
          csrfFetch('/api/user/country', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ countryId: c.id })
          })
          .then(res => {
            if (!res.ok) {
              if (res.status === 429) {
                showErrorToast('Vous ne pouvez changer de pays qu\'une fois toutes les 30 minutes.');
              } else {
                showErrorToast(`Erreur ${res.status} : ${res.statusText}`);
              }
              throw new Error(`HTTP ${res.status}`);
            }
            return res.json();
          })
          .then(() => {
            // Recharger les infos utilisateur et la liste des pays
            loadUserInfo();
            loadCountries();
            window.removeSkeletons && window.removeSkeletons();
          })
          .catch(err => {
            console.error('Erreur inconnue', err);
          });
        });
        actions.appendChild(btn);
        card.appendChild(actions);

        // 4) On assemble : <li> ← <div.country-card> ← (titre, détails, bouton)
        li.appendChild(card);
        track.appendChild(li);
      });

      // 5) (Optionnel) Si vous voulez mettre à jour le fonctionnement du carousel immédiatement
      //    (items, boutons “prev/next”, etc.), vous pouvez dispatcher un événement personnalisé
      //    ou appeler directement la logique `updateButtons()` / `items = [...]` définie dans main.js.
      //    Par exemple :
      //
      //    document.dispatchEvent(new CustomEvent('countries:loaded'));
      //
      //    et dans main.js, écouter ce nouvel event pour recalculer `items` et réactiver les flèches.
    })
    .catch(err => {
      console.error('Erreur en récupérant les pays :', err);
    });
}
