import * as Io from './io.js';
import * as Api from './api.js';
import * as Global from './global.js';
import * as SearchDisplay from './search_display.js';
import * as Utilities from './utilities.js';
import { numeric_input } from './numeric_input.js';
import { public_key } from './login.js';

const PRIVILEGE_LEVEL_ADMIN = Global.PRIVILEGE_LEVEL_ADMIN;
const PRIVILEGE_LEVEL_USER  = Global.PRIVILEGE_LEVEL_USER;

export let dom = document.createElement('div');

const gsi_admin_button = document.createElement('button');
const gsi_user_button  = document.createElement('button');
const gsi_chef_button  = document.createElement('button');

let gsi_click_for_options_is_disabled = false;

function handlePrivilegeLevel(privilege_level) {
  const user_identifier = Global.getZoneUserIdentifier();
  if (user_identifier === undefined) { throw new Error("[handlePrivilegeLevel] no user selected"); }
  const user_index = Global.data.users_map.get(user_identifier);
  if (user_index === undefined) { throw new Error("[handlePrivilegeLevel] cannot resolve user index"); }
  const w = Api.createBufferWriter(Api.UPDATE, Api.USERS_PRIVILEGE_LEVEL);
  Io.writeInt32(w, user_identifier);
  Io.writeInt32(w, privilege_level);
  Api.request(w)
  .then(response => {
    Utilities.throwIfNotOk(response);
    Global.data.users_privilege_level[user_index] = privilege_level;
    update();
  })
  .catch(e => {
    console.error("Could not update privilege level ", e);
  });
}

gsi_admin_button.addEventListener('click', () => {
  handlePrivilegeLevel(PRIVILEGE_LEVEL_ADMIN);
});

gsi_user_button.addEventListener('click', () => {
  handlePrivilegeLevel(PRIVILEGE_LEVEL_USER);
});

function handleCenterButtonClick(e) {
  const p_level = e.target.closest('button')._data_identifier;  
  if (p_level === undefined || p_level < 0) {
    throw new Error("incorrect data identifier on centre de secours button")
  }
  handlePrivilegeLevel(p_level);
  gsi_click_for_options_is_disabled = false;
}

gsi_chef_button.addEventListener('click', () => {
  gsi_click_for_options_is_disabled = true;
  const loc_search_display = SearchDisplay.create(
    "Centres",
    undefined,
    Global.data.bundleVenuesNames(),
    false,
  );
  loc_search_display._container.parentElement.classList.add('min-height-0');
  Global.elements.option_menu.replaceChildren(loc_search_display);
  for (const b of loc_search_display._container._button_list) {
    b.addEventListener('click', handleCenterButtonClick)
  }
});

function createPrivilegeLevel() {
  let pl_div = document.createElement('div');
  pl_div.className = 'h-container';
  pl_div.innerHTML = `
    <div class="row-selection">
    Niveau de privilège: <button id="privilege-level" class="hover std-min no-padding txt-center tiny-button editable">\u00A0</button>
    </div>
    `;
  pl_div.children[0]._identifier = Global.zones_identifier.PRIVILEGE_LEVEL;
  return pl_div;
}

function handleClickForPasswordChange(e) {
  const button = e.target;
  const [div, input] = Utilities.createBorderedTextInput('Nouveau Mot de Passe');
  input.type = 'password';
  input.addEventListener('keydown', async (event) => {
    if (event.key === 'Enter') {
      const value = input.value;

      const user_identifier = Global.getZoneUserIdentifier();
      const hashed = await Io.hashText(value);

      let inner_writer = new Io.BufferWriter();
      Io.writeString(inner_writer, 'magic');
      Io.writeInt32(inner_writer, user_identifier);
      Io.writeHash(inner_writer, hashed);

      const w = await Io.encryptAndPackage(inner_writer.getBuffer(), public_key);

      let writer = Api.createBufferWriter(Api.UPDATE, Api.USERS_PASSWORD);
      Io.writeArrayBufferNoLength(writer, w.getBuffer());
      Api.request(writer)
      .then(response => {
        Utilities.throwIfNotOk(response);
        div.replaceWith(button);
      })
      .catch(e => {
        console.error("failed to update password:", e);
      });

    } else if (event.key === 'Escape') {
      div.replaceWith(button);
    }
  });
  button.replaceWith(div);
  input.focus();
}

function createPasswordButton() {
  let button = document.createElement('button');
  button.classList = "hover disp-flex align-items-center justify-content-center with-border";
  button.textContent = "Changer le Mot de Passe";
  button.addEventListener('click', handleClickForPasswordChange);
  return button;
}

function handleClickForOptions() {
  if (!gsi_click_for_options_is_disabled) {
    Global.elements.option_menu.classList.replace('disp-flex', 'disp-none');
    document.removeEventListener('click', handleClickForOptions);
  }
}

export function openOptions(x, y) {
  const menu = Global.elements.option_menu;
  menu.replaceChildren(
    gsi_user_button,
    gsi_chef_button,
    gsi_admin_button,
  );
  menu.classList.replace('disp-none', 'disp-flex');
  menu.style.setProperty('--menu-left', x+'px');
  menu.style.setProperty('--menu-top',  y+'px');
  setTimeout(() => {
    document.addEventListener('click', handleClickForOptions);
  });
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
    createPrivilegeLevel(),
    createPasswordButton(),
  );
}

export function update() {
  const user_index = Global.getZoneUserIndex();
  if (user_index === undefined) { throw new Error("[update] no user selected"); }

  let user_privilege_level = Global.data.users_privilege_level[user_index];
  if (user_privilege_level === undefined) {
    Global.data.users_privilege_level[user_index] = undefined;
    user_privilege_level = PRIVILEGE_LEVEL_USER;
  }

  const button = dom.querySelector('#privilege-level');
  if (user_privilege_level === PRIVILEGE_LEVEL_USER) {
    button.textContent = 'Utilisateur';
  } else if (user_privilege_level == PRIVILEGE_LEVEL_ADMIN)  {
    button.textContent = 'Admin';
  } else if (user_privilege_level >= 0) {
    const venue_index = Global.data.venues_map.get(user_privilege_level);
    const venue_name  = Global.data.venues_name[venue_index];
    button.textContent = 'Chef de '+venue_name; 
  } else {
    throw new Error("unreachable: unknown privilege level");
  }
}
