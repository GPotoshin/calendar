import * as Global from './global_state.js';

export let dom = document.createElement('div');

// this function is called, when data from server is loaded, so that is
// generated with correct setting numbers right away
export function loadTemplate() {
  dom.innerHTML = `
    <div class="v-container">
    <div class="js-select row-selection">
    Nombre maximal d'employés impliqués par jour:
      <button class="editable hover std-min no-padding txt-center tiny-button">
      ${Global.data.employees_limit}
      </button>
    <div>
    </div>
  `;

  let row = dom.querySelector('.js-select');
  row.classList.remove('js-select');
  row._identifier = Global.zones_identifier.EMPLOYEES_LIMIT;
}
