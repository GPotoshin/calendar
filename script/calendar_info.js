import { data, zonesId } from './global_state.js';

export let dom = document.createElement('div');

// this function is called, when data from server is loaded, so that is
// generated with correct setting numbers right away
export function loadTemplate() {
  dom.innerHTML = `
    <div class="v-container">
    <div class="js-select row-selection">
    Nombre maximal d'employés impliqués par jour: <button class="editable hover std-min no-padding txt-center tiny-button">${data.employeesLimit}</button>
    <div>
    </div>
  `;

  let row = dom.querySelector('.js-select');
  row.classList.remove('js-select');
  row._id = zonesId.EMPLOYEESLIMIT;
}
