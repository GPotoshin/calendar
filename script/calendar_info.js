export let dom = document.createElement('div');

// this function is called, when data from server is loaded, so that is
// generated with correct setting numbers right away
export function loadTemplate() {
  dom.innerHTML = `
    <div class="v-container">
    <div class="row-selection">
    Nombre maximal d'employés impliqués par jour: <button class="hover std-min no-padding txt-center tiny-button">10</button>
    <div>
    </div>
  `;
}
