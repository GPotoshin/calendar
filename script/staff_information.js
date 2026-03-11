import * as Global from './global.js';
import * as SearchDisplay from './search_display.js';
import * as Utilities from './utilities.js';
import { numeric_input } from './numeric_input.js';
import * as Io from './io.js';
import * as Api from './api.js';

const PRIVILAGE_LEVEL_ADMIN = -2;
const PRIVILAGE_LEVEL_USER  = -1

export let dom = document.createElement('div');

const gsi_admin_button = document.createElement('button');
const gsi_user_button  = document.createElement('button');
const gsi_chef_button  = document.createElement('button');

function createPrivilageLevel() {
  let pl_div = document.createElement('div');
  pl_div.className = 'h-container';
  pl_div.innerHTML = `
    <div class="row-selection">
    Privilage level: <button id="privilage-level" class="hover std-min no-padding txt-center tiny-button editable">\u00A0</button>
    </div>
    `;
  pl_div.children[0]._identifier = Global.zones_identifier.PRIVILAGE_LEVEL;
  return pl_div;
}

export function openOptions(x, y) {
  const menu = Global.elements.option_menu;
  menu.replaceChildren(
    gsi_user_button,
    gsi_chef_button,
    gsi_admin_button,
  );
  menu.classList.replace('disp-none', 'disp-flex');
  menu.style.setProperty('--menu-left', x + 'px');
  menu.style.setProperty('--menu-top', y + 'px');
}

export function loadTemplate() {
  dom.innerHTML = `
    <div class="v-container">
    </div>
  `;
  gsi_admin_button.textContent = 'Admin';
  gsi_chef_button.textContent = 'Chef';
  gsi_user_button.textContent = 'Utilisateur';

  dom.children[0].append(
    createPrivilageLevel(),
  );
}

export function update() {
  // scoped functions
  const zone = Global.zones[Global.zones_identifier.STAFF];
  if (zone.selection == null) { // we need to show general setting
    return;
  }
  const user_identifier = zone.selection._data_identifier;
  const user_index = Global.data.users_map.get(user_identifier);
  if (user_index === undefined) { throw new Error("[update] no entry for user_identifier"); }

  let user_privilage_level = Global.data.users_privilage_level[user_index];
  if (user_privilage_level === undefined) {
    Global.data.users_privilage_level[user_index] = undefined;
    user_privilage_level = PRIVILAGE_LEVEL_USER;
  }

  const button = dom.querySelector('#privilage-level');
  // @idea: we should have on a right click menu no chose from User, Admin, Chef.
  // And then a search menu for a agence the chef is a chef of...
  if (user_privilage_level === PRIVILAGE_LEVEL_USER) {
    button.textContent = 'Utilisateur';
  } else if (user_privilage_level == PRIVILAGE_LEVEL_ADMIN)  {
    button.textContent = 'Admin';
  } else if (user_privilage_level >= 0) {
    const venue_index = Global.data.venues_map.get(user_privilage_level);
    const venue_name  = Global.data.venues_names[venue_index];
    button.textContent = 'Chef de '+venue_name; 
  } else {
    throw new Error("unreachable: unknown privilage level");
  }
}
