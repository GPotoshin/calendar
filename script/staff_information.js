import * as Io from './io.js';
import * as Api from './api.js';
import * as Global from './global.js';
import * as SearchDisplay from './search_display.js';
import * as Utilities from './utilities.js';
import { numeric_input } from './numeric_input.js';
import { public_key, privilege } from './login.js';

const PRIVILEGE_LEVEL_ADMIN = Global.PRIVILEGE_LEVEL_ADMIN;
const PRIVILEGE_LEVEL_USER  = Global.PRIVILEGE_LEVEL_USER;

export let dom = document.createElement('div');

const gsi_admin_button = document.createElement('button');
const gsi_user_button  = document.createElement('button');
const gsi_chef_button  = document.createElement('button');

let gsi_privilege_button = null;
let gsi_station_button = null;
let gsi_application_list = null;
let gsi_candidature_list = null;

let gsi_click_for_options_is_disabled = false;

const gsi_tick = document.createElement('div');
gsi_tick.innerHTML = `
<svg height="100%" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <circle cx="100" cy="100" r="72" class="svg-circle fill-green"/>
  <polyline points="65,102 92,129 137,74" class="svg-line"/>
</svg>`;

const gsi_cross = document.createElement('div');
gsi_cross.innerHTML = `
<svg height="100%" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <circle cx="100" cy="100" r="72" class="svg-circle fill-red"/>
  <line x1="68" y1="68" x2="132" y2="132" class="svg-line"/>
  <line x1="132" y1="68" x2="68" y2="132" class="svg-line"/>
</svg>`;


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
    Global.bundleVenuesNames(),
    false,
  );
  // loc_search_display._container.parentElement.classList.add('min-height-0');
  Global.elements.option_menu.replaceChildren(loc_search_display);
  for (const b of loc_search_display._container._button_list) {
    b.addEventListener('click', handleCenterButtonClick)
  }
});

function createOptionLine(text, zone_id) {
  let div = document.createElement('div');
  div.className = 'h-container option-menu';
  div.innerHTML = `
    <span class="half-wide">${text}:</span><button class="hover std-min no-padding txt-center tiny-button editable">\u00A0</button>
    `;
  div._identifier = zone_id;
  return [div, div.querySelector('button')];
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
  button.classList = "hover password-button with-border";
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
    <div class="v-container option-menu">
    </div>
  `;
  if (privilege == Global.PRIVILEGE_LEVEL_ADMIN) {
    gsi_admin_button.textContent = 'Admin';
    gsi_chef_button.textContent = 'Chef';
    gsi_user_button.textContent = 'Utilisateur';

    const [privilege_line, pr_btn] = createOptionLine("Niveau de privilège", Global.zones_identifier.PRIVILEGE_LEVEL);
    const [station_line, st_btn] = createOptionLine("Centre d'affectation", Global.zones_identifier.DUTY_STATION);

    gsi_privilege_button = pr_btn;
    gsi_station_button = st_btn;

    dom.children[0].append(
      station_line,
      privilege_line,
    );
  }

  gsi_candidature_list = document.createElement('div');
  gsi_candidature_list.className = 'height-20 v-container align-items-center';
  gsi_candidature_list.innerHTML = `
    <h4 class="txt-center">Candidature</h4>
    <div class="h-container list-container">
    <div class="js-set text-box v-container scrollable-box scroll bordered grow half-wide"></div>
    </div>
    `;
  gsi_candidature_list._container = gsi_candidature_list.querySelector('.js-set');
  gsi_candidature_list._container.classList.remove('js-set');

  dom.children[0].append(
    gsi_candidature_list,
    createPasswordButton(),
  )
}

export function update() {
  const user_id = Global.getZoneUserIdentifier();
  if (user_id === undefined) {
    console.error("[si:update] user is not selected");
    return;
  }
  const user_index = Global.data.users_map.get(user_id);
  if (user_index === undefined) {
    console.error("[si:update] user does not exist");
    return;
  }
  
  if (privilege === PRIVILEGE_LEVEL_ADMIN) {
    const user_station = Global.data.users_duty_station[user_index];
    if (user_station >= 0) {
      const station_index = Global.data.venues_map.get(user_station);
      if (station_index === undefined) { throw new Error("[update] incorrect duty station"); }

      gsi_station_button.textContent = Global.data.venues_name[station_index];
    } else {
      gsi_station_button.textContent = '\u00A0';
    }

    let user_privilege_level = Global.data.users_privilege_level[user_index];
    if (user_privilege_level === undefined) {
      Global.data.users_privilege_level[user_index] = undefined;
      user_privilege_level = PRIVILEGE_LEVEL_USER;
    }

    if (user_privilege_level === PRIVILEGE_LEVEL_USER) {
      gsi_privilege_button.textContent = 'Utilisateur';
    } else if (user_privilege_level == PRIVILEGE_LEVEL_ADMIN)  {
      gsi_privilege_button.textContent = 'Admin';
    } else if (user_privilege_level >= 0) {
      const venue_index = Global.data.venues_map.get(user_privilege_level);
      const venue_name  = Global.data.venues_name[venue_index];
      gsi_privilege_button.textContent = 'Chef de '+venue_name; 
    } else {
      throw new Error("unreachable: unknown privilege level");
    }
  }

  const applications = Global.data.users_applications[user_index];
  let entry_index = 0;
  const frag = document.createDocumentFragment();
  for (const occurrence_id of applications) {
    const occurrence_index = Global.data.occurrences_map.get(occurrence_id);
    const participants = Global.data.occurrences_participants[occurrence_index];
    const participants_status = Global.data.occurrences_participants_status[occurrence_index];
    const participants_role = Global.data.occurrences_participants_role[occurrence_index];

    for (let participant_index = 0; participant_index < participants.length; participant_index += 1) {
      if (participants[participant_index] !== user_id) {
        continue;
      }

      if (participants_status[participant_index] === Global.PARTICIPATION_REQUESTED) {
        const role_id = participants_role[participant_index];
        let role_name = undefined;
        if (role_id === -1) {
          role_name = "Participant";
        } else {
          const role_index = Global.data.roles_map.get(role_id);
          if (role_index === undefined) {
            console.error('[si:update] unknown role');
            continue;
          }
          role_name = Global.data.roles_name[role_index];
        }
        const event_id = Global.data.occurrences_event_identifier[occurrence_index];
        const event_index = Global.data.events_map.get(event_id);

        const button = document.createElement('button');
        button.className = 'search-list-button';
        button._data_identifier = [role_id, occurrence_id];
        const role = document.createElement('span');
        role.className = 'width-45';
        role.textContent = role_name;
        const event = document.createElement('span');
        event.className = 'width-45';
        event.textContent = Global.data.events_name[event_index]+'#'+occurrence_id;

        const tick = gsi_tick.children[0].cloneNode(true);
        tick.addEventListener('click', acceptCandidature);
        const cross = gsi_cross.children[0].cloneNode(true);
        cross.addEventListener('click', rejectCandidature);

        button.replaceChildren(role, event, tick, cross);
        frag.appendChild(button);
      }
    }
  }
  gsi_candidature_list._container.replaceChildren(frag);
}

function acceptCandidature(e) {
  setParticipantStatus(e, Global.PARTICIPATION_APPROVED);
}

function rejectCandidature(e) {
  setParticipantStatus(e, Global.PARTICIPATION_DECLINED);
}

function setParticipantStatus(e, status) {
  const button = e.target.closest('button');
  const [role_id, occurrence_id] = button._data_identifier;
  // we just need to change the status and rerender
  const user_id = Global.getZoneUserIdentifier();
  if (user_id === undefined) {
    console.error("[si:update] user is not selected");
    return;
  }

  const writer = Api.createBufferWriter(Api.UPDATE, Api.OCCURRENCES_PARTICIPANTS_STATUS);
  Io.writeInt32(writer, occurrence_id);
  Io.writeInt32(writer, user_id);
  Io.writeInt32(writer, role_id);
  Io.writeInt32(writer, status);
  Api.request(writer)
  .then(response => {
    Utilities.throwIfNotOk(response);
    const occurrence_index = Global.data.occurrences_map.get(occurrence_id);
    if (occurrence_index === undefined) {
      console.error("user does not exist locally");
      return;
    }
    const participants = Global.data.occurrences_participants[occurrence_index];
    const roles = Global.data.occurrences_participants_role[occurrence_index];
    const statuses = Global.data.occurrences_participants_status[occurrence_index];
    for (let i = 0; i < participants.length; i += 1) {
      if (participants[i] == user_id && roles[i] == roles_id) {
        statuses[i] = status;
        break;
      }
    }
    update();
  })
  .catch(e => {
    console.error(e);
  });
}
