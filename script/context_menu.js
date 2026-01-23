import { callbacks, elms, MetaData, data } from './global_state.js';
import { BufferReader, BufferWriter } from './io.js';
import { zones, zonesId, scopeId } from './global_state.js';
import { storageIndex, deleteValue, deleteOccurrences, storeValue } from './data_manager.js';
import * as Api from './api.js';
import * as SideMenu from './side_menu.js';
import * as Utils from './utils.js';
import * as SearchDisplay from './search_display.js';
import * as EventInfo from './event_info.js';
import { numInput } from './num_input.js';
import { palette } from './color.js';

let state = {
  delete_target: null,
  extend_target: null,
  edit_target: null,
  toggle_target: null,
};

function handleClickForContextMenu() {
  let menu = elms.rightClickMenu;
  menu.classList.replace('disp-flex', 'disp-none');
  document.removeEventListener('click', handleClickForContextMenu);
  for (const child of menu.children) {
    child.classList.replace('disp-block', 'disp-none');
  }
}

function createUserDataInputs() {
  const retval = {
    name:      Utils.createTextInput('Prenom'),
    surname:   Utils.createTextInput('Nom'),
    matricule: Utils.createTextInput('Matricule'),
  };
  retval.matricule.addEventListener('input', () => {
    retval.matricule.value = Utils.digitise(retval.matricule.value);
  });
  return retval;
}

function isEscOrCreateOnEnter(e, b, inputs, next = null) {
  if (e.key === 'Enter') {
    if (inputs.name.value !== '' &&
      inputs.surname.value !== '' &&
      inputs.matricule.value !== '') {
      e.preventDefault();
      const name = inputs.name.value;
      const surname = inputs.surname.value;
      const matricule = Number(inputs.matricule.value);

      if (data.usersId.has(matricule)) {
        Utils.setBgColor(inputs.matricule, palette.red);
        return;
      }
      SideMenu.setUserButton(b, name, surname, matricule);

      let w = Api.createBufferWriter(Api.CREATE, Api.USERS_ID_MAP_ID);
      b.addEventListener('click', SideMenu.sideListButtonClickCallback);
      w.writeInt32(matricule);
      w.writeString(name);
      w.writeString(surname);

      inputs.name.remove();
      inputs.surname.remove();
      inputs.matricule.remove();
      Api.request(w)
      .then(resp => {
        if (!resp.ok) {
          throw new Error(`HTTP error! status: ${resp.status}`);
          return;
        }
        let idx = storageIndex(data.usersId, data.usersFreeList);
        data.usersId.set(matricule, idx);
        storeValue(data.usersName, idx, name);
        storeValue(data.usersSurname, idx, surname);
        b._dataId = matricule;
      })
      .catch( e => {
        b.remove();
        console.error("Could not store ", name, e);
      });
    }
    if (next) { next.focus(); }
  } else if (e.key === 'Escape') {
    e.preventDefault();
    return true;
  }
  return false;
}

function isEscOrUpdateOnEnter(e, b, inputs, old) {
  if (e.key === 'Enter') {
    if (inputs.name.value !== '' &&
      inputs.surname.value !== '' &&
      inputs.matricule.value !== '') {
      e.preventDefault();
      const name = inputs.name.value;
      const surname = inputs.surname.value;
      const matricule = Number(inputs.matricule.value);

      if (matricule !== old.matricule && data.usersId.has(matricule)) {
        Utils.setBgColor(inputs.matricule, palette.red);
        return;
      }
      SideMenu.setUserButton(b, name, surname, matricule);

      let w = Api.createBufferWriter(Api.UPDATE, Api.USERS_ID_MAP_ID);
      w.writeInt32(old.matricule);
      b.addEventListener('click', SideMenu.sideListButtonClickCallback);
      w.writeInt32(matricule);
      w.writeString(name);
      w.writeString(surname);

      inputs.name.remove();
      inputs.surname.remove();
      inputs.matricule.remove();
      Api.request(w)
      .then(resp => {
        if (!resp.ok) {
          throw new Error(`HTTP error! status: ${resp.status}`);
          return;
        }
        const idx = data.usersId.get(old.matricule);
        if (!idx) {
          console.error("old matricule does not exist locally");
          return
        }
        if (old.matricule !== matricule) {
          data.usersId.delete(old.matricule);
          data.usersId.set(matricule, idx);
        }
        data.usersName[idx] = name;
        data.usersSurname[idx] = surname;
        b._dataId = matricule;
      })
      .catch( e => {
        SideMenu.setUserButton(b, old.name, old.surname, old.matricule);
        console.error("Could not store ", name, e);
      });
    }
  } else if (e.key === 'Escape') {
    e.preventDefault();
    return true;
  }
  return false;
}

document.getElementById('edit-button').addEventListener('click', function() {
  const b = state.edit_target;
  const id = Number(state.edit_target._dataId);
  if (id == undefined) {
    throw new Error('delete-target should have a property `_dataId` which infers to which piece of data the element is associated with');
  }

  let w = new BufferWriter();
  switch (state.edit_target.parentElement._id) {
    case zonesId.STAFFLIST: {
      b.removeEventListener('click', SideMenu.sideListButtonClickCallback);
      const idx = data.usersId.get(id);
      if (idx === undefined) {
        console.error('user index is not found');
        return;
      }
      const old = {
        name: data.usersName[idx],
        surname: data.usersSurname[idx],
        matricule: id,
      };

      let inputs = createUserDataInputs();
      inputs.name.value = old.name;
      inputs.surname.value = old.surname;
      inputs.matricule.value = old.matricule;
      inputs.name.addEventListener('keydown', (e) => {
        if (isEscOrUpdateOnEnter(e, b, inputs, old)) {
          SideMenu.setUserButton(b, old.name, old.surname, old.matricule);
        }
      });
      inputs.surname.addEventListener('keydown', (e) => {
        if (isEscOrUpdateOnEnter(e, b, inputs, old)) {
          SideMenu.setUserButton(b, old.name, old.surname, old.matricule);
        }
      });
      inputs.matricule.addEventListener('keydown', (e) => {
        if (isEscOrUpdateOnEnter(e, b, inputs, old)) {
          SideMenu.setUserButton(b, old.name, old.surname, old.matricule);
        }
      });
      b.replaceChildren(inputs.name, inputs.surname, inputs.matricule);
      break;
    }

    case zonesId.EVENTLIST: {
      b.removeEventListener('click', SideMenu.sideListButtonClickCallback);
      const idx = data.eventsId.get(id);
      if (idx === undefined) {
        console.error('event index is not found');
        return;
      }
      const old_name = data.eventsName[idx];
      addInputForEventOrVenue(
        b,
        null,
        'Nom d\'Événement',
        Api.UPDATE,
        Api.EVENTS_ID_MAP_IS,
        MetaData.events_name,
      );
      break;
    }
  }
});


document.getElementById('delete-button').addEventListener('click', function() {
  const id = state.delete_target._dataId;
  if (id == undefined) {
    throw new Error('delete-target should have a property `_dataId` which infers to which piece of data the element is associated with');
  }
  state.delete_target.classList.add('disp-none');

  let w = new BufferWriter();
  switch (state.delete_target.parentElement._id) {
    case zonesId.STAFFLIST:
      Api.writeHeader(w, Api.DELETE, Api.USERS_ID_MAP_ID);
      break;
    case zonesId.VENUELIST:
      Api.writeHeader(w, Api.DELETE, Api.VENUES_ID_MAP_ID);
      break;
    case zonesId.EVENTLIST:
      Api.writeHeader(w, Api.DELETE, Api.EVENTS_ID_MAP_ID);
      break;
    case zonesId.EVENTSTAFFLIST:
      Api.writeHeader(w, Api.DELETE, Api.ROLES_ID_MAP_ID);
      break;
    case zonesId.NUMMAPLIST:
      Api.writeHeader(w, Api.DELETE, Api.EVENTS_PERSONAL_NUM_MAP_ID);
      w.writeInt32(zones[zonesId.EVENTLIST].selection._dataId);
      break;
    default:
      state.delete_target.classList.remove('disp-none');
      throw new Error('delete_target\'s parent should have `_id` property with a value from `zonesId`');
  }
  w.writeInt32(Number(id));
  Api.request(w)
  .then(resp => {
    if (!resp.ok) {
      throw new Error(`HTTP error! status: ${resp.status}`);
    }
    switch (state.delete_target.parentElement._id) {
      case zonesId.STAFFLIST:
        deleteValue(data.usersId, data.usersFreeList, id);
        deleteOccurrences(data.occurrencesParticipant, id);
        break;
      case zonesId.VENUELIST:
        deleteValue(data.venuesId, data.venuesFreeList, id);
        deleteOccurrences(data.eventsVenues, id);
        break;
      case zonesId.EVENTLIST:
        deleteValue(data.eventsId, data.eventsFreeList, id);
        break;
      case zonesId.EVENTSTAFFLIST: // we should here remove the button from a backing array
        EventInfo.elms.event_role_list._btnList =
          EventInfo.elms.event_role_list._btnList.filter(b => b !== state.delete_target);

        deleteValue(data.rolesId, data.rolesFreeList, id);
        for (let i = 0; i < data.eventsRole.length; i++) {
          let eventsRoles = data.eventsRole[i];
          let idx = eventsRoles.indexOf(id);
          eventsRoles.splice(Number(id), 1);
          let nummap = data.eventsPersonalNumMap[i];
          for (let j = 0; j < nummap.length; j++) {
            nummap.splice(idx, 1);
          }
        }
        EventInfo.update();
        break;
      case zonesId.NUMMAPLIST:
        data.eventsPersonalNumMap[zones[zonesId.EVENTLIST].selection._dataId].splice(Number(id), 1)
        EventInfo.update();
        break;
      default:
        throw new Error('that zonesId does not support local storage');
    }
  })
  .catch(e => {
    state.delete_target.classList.remove('disp-none');
    console.error("Could not delete ", e);
    return;
  });
});

function setStandardInputCallback(b, input, op, api, meta_data) {
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = input.value;
      for (const [id, idx] of meta_data.map) {
        if (meta_data.arr[idx] === val) {
          setBgColor(input, palette.red);
          return
        }
      }

      e.preventDefault();
      input.remove();
      b.textContent = val;

      let w = Api.createBufferWriter(Api.CREATE, api);
      w.writeString(val);
      Api.request(w)
      .then(resp => {
        if (!resp.ok) {
          throw new Error(`HTTP error! status: ${resp.status}`);
        }
        resp.arrayBuffer()
        .then(bin => {
          let r = new BufferReader(bin);
          let id = r.readInt32();
          let idx = storageIndex(meta_data.map, meta_data.freeList);
          meta_data.map.set(id, idx);
          meta_data.arr[idx] = val;
          b.textContent = '';
          Utils.setNameAndId(b, val, id);
        });
      })
      .catch(e => {
        b.remove();
        console.error("Could not store ", val, e);
      });
    } else if (e.key === 'Escape') {
      e.preventDefault();
      b.remove();
    }
  });
}

function createEventOrVenue(placeholder, op, api, meta_data) {
  let b = SideMenu.createListButton();
  addInputForEventOrVenue(b, state_extend_target, placeholder, api, meta_data);
}

function addInputForEventOrVenue(b, parent, placeholder, op, api, meta_data) {
  const input = Utils.createTextInput(placeholder)
  b.replaceChildren(input);
  if (parent) {
    parent.appendChild(b);
  }
  setStandardInputCallback(b, input, op, api, meta_data);
  input.focus();
}

document.getElementById('create-button').addEventListener('click', () => {
  switch (state.extend_target._id) {
    case zonesId.EVENTLIST: {
      createEventOrVenue(
        'Nouvel Événement',
        Api.CREATE,
        Api.EVENTS_ID_MAP_ID,
        MetaData.events_names,
      );
      break;
    }
    case zonesId.STAFFLIST: {
      const target = elms.scope[scopeId.STAFF];
      let b = SideMenu.createTmplButton(); 
      const inputs = createUserDataInputs();
      inputs.name.addEventListener('keydown', (e) => {
        if (isEscOrCreateOnEnter(e, b, inputs, inputs.surname)) {
          b.remove();
        }
      });
      inputs.surname.addEventListener('keydown', (e) => {
        if (isEscOrCreateOnEnter(e, b, inputs, inputs.matricule)) {
          b.remove();
        }
      });
      inputs.matricule.addEventListener('keydown', (e) => {
        if (isEscOrCreateOnEnter(e, b, inputs)) {
          b.remove();
        }
      });
      target.appendChild(b);
      b.appendChild(inputs.name);
      b.appendChild(inputs.surname);
      b.appendChild(inputs.matricule);
      inputs.name.focus();
      break;
    }
    case zonesId.VENUELIST: {
      createEventOrVenue(
        'Nouveau Lieu',
        Api.CREATE,
        Api.VENUES_ID_MAP_ID,
        MetaData.venues_name,
      );
      break;
    }
    case zonesId.EVENTSTAFFLIST: {
      let b = SearchDisplay.createButton();
      const input = Utils.createTextInput('Nouveau Rôle');
      b.appendChild(input);
      state.extend_target.appendChild(b);
      input.focus();

      setStandardInputCallback(
        b,
        input,
        Api.CREATE,
        Api.ROLES_ID_MAP_ID,
        MetaData.roles_name,
      );
      EventInfo.elms.event_role_list._btnList.push(b);
      break;
    }
    default:
  }
});

document.getElementById('toggle-button').addEventListener('click', () => {
  const target = state.toggle_target;
  const turning_on = target.classList.toggle('clicked');
  switch (state.toggle_target.parentElement._id) { // working
    case zonesId.EVENTSTAFFLIST:
      const event_id = zones[zonesId.EVENTLIST].selection._dataId; 
      const role_id = target._dataId;
      const idx = data.eventsId.get(event_id);
      const role_idx = data.rolesId.get(role_id);
      if (idx === undefined || role_idx === undefined) {
        console.error('[toggle-button:click] Incorrect event\'s or role\'s ids');
        return;
      }
      let w = new BufferWriter();

      if (turning_on) {
        Api.writeHeader(w, Api.CREATE, Api.EVENTS_ROLE_ID);
      } else {
        Api.writeHeader(w, Api.DELETE, Api.EVENTS_ROLE_ID);
      }

      w.writeInt32(event_id);
      w.writeInt32(role_id);

      Api.request(w)
      .then(resp => {
        if (!resp.ok) {
          throw new Error(`HTTP error! status: ${resp.status}`);
          return;
        }
        let num_map = data.eventsPersonalNumMap;

        if (turning_on) {
          data.eventsRole[idx].push(role_id);
          for (const arr of num_map[idx]) {
            arr.push(-1);
          }
        }
        else {
          const pos = data.eventsRole[idx].indexOf(role_id); 
          data.eventsRole[idx].splice(pos, 1);
          for (let arr of num_map[idx]) {
            arr.splice(pos+2, 1);
          }
        }
        EventInfo.update();
      })
      .catch( e => {
        target.classList.toggle('clicked');
        console.error("fail in [toggle-button:click]", name, e);
      });
      break;
  }
});

function display(s, btn_name) {
  document.getElementById(btn_name).classList.replace('disp-none', 'disp-block');
  s.show = true;
}

document.addEventListener('contextmenu', function(e) {
  const s = { show: false };
  const menu = elms.rightClickMenu;
  const target = e.target;

  if (state.delete_target = target.closest('.deletable')) {
    display(s, 'delete-button');
  }
  if (state.edit_target = target.closest('.editable')) {
    display(s, 'edit-button');
  }
  if (state.toggle_target = target.closest('.togglable')) {
    display(s, 'toggle-button');
  }
  if (state.extend_target = target.closest('.extendable')) {
    display(s, 'create-button');
  }

  if (s.show) {
    e.preventDefault();
    menu.classList.replace('disp-none', 'disp-flex');
    menu.style.setProperty('--menu-left', e.clientX + 'px');
    menu.style.setProperty('--menu-top', e.clientY + 'px');
    document.addEventListener('click', handleClickForContextMenu);
  }
});
