import { callbacks, elms, data } from './global_state.js';
import { BufferReader, BufferWriter } from './io.js';
import { zones, zonesId } from './global_state.js';
import { storageIndex, deleteValue, deleteOccurrences, storeValue } from './data_manager.js';
import * as Api from './api.js';
import * as SideMenu from './side_menu.js';
import * as Utils from './utils.js';
import * as SearchDisplay from './search_display.js';
import * as EventInfo from './event_info.js';
import { numeric_input } from './num_input.js';
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

function endOfUserInputs(b, w, inputs) {
  b.addEventListener('click', SideMenu.buttonClickCallback);
  w.writeInt32(Number(inputs.matricule.value));
  w.writeString(inputs.name.value);
  w.writeString(inputs.surname.value);
  inputs.name.remove();
  inputs.name = null;
  inputs.surname.remove();
  inputs.surname = null;
  inputs.matricule.remove();
  inputs.matricule = null;
}

function userInputsAreNotEmpty(inputs) {
  return inputs.name.value !== '' &&
      inputs.surname.value !== '' &&
      inputs.matricule.value !== '';
}

function getValuesFromUserInputs(inputs) {
  return [inputs.name.value, inputs.surname.value, Number(inputs.matricule.value)];
}

function escOrCreateOnEnter(e, b, inputs, next = null) {
  if (e.key === 'Enter') {
    if (userInputsAreNotEmpty(inputs)) {
      e.preventDefault();
      const [name, surname, matricule] = getValuesFromUserInputs(inputs);

      if (data.usersId.has(matricule)) {
        Utils.setBgColor(inputs.matricule, palette.red);
        return;
      }
      SideMenu.setUserButton(b, name, surname, matricule);
      let w = Api.createBufferWriter(Api.CREATE, Api.USERS_ID_MAP_ID);

      endOfUserInputs(b, w, inputs);
      Api.request(w)
      .then(resp => {
        Utils.throwIfNotOk(resp);

        let idx = storageIndex(data.usersId, data.usersFreeList);
        data.usersId.set(matricule, idx);
        storeValue(data.usersName, idx, name);
        storeValue(data.usersSurname, idx, surname);
        b._dataId = matricule;
      })
      .catch(e => {
        b.remove();
        console.error("Could not store ", name, e);
      });
    }
    if (next) { next.focus(); }
  } else if (e.key === 'Escape') {
    e.preventDefault();
    b.remove();
  }
}

function escOrUpdateOnEnter(e, b, inputs, old) {
  if (e.key === 'Enter') {
    if (userInputsAreNotEmpty(inputs)) {
      e.preventDefault();
      const [name, surname, matricule] = getValuesFromUserInputs(inputs);

      if (matricule !== old.matricule && data.usersId.has(matricule)) {
        Utils.setBgColor(inputs.matricule, palette.red);
        return;
      }
      SideMenu.setUserButton(b, name, surname, matricule);
      let w = Api.createBufferWriter(Api.UPDATE, Api.USERS_ID_MAP_ID);
      w.writeInt32(old.matricule);

      endOfUserInputs(b, w, inputs);
      Api.request(w)
      .then(resp => {
        Utils.throwIfNotOk(resp);
        const idx = data.usersId.get(old.matricule);
        if (idx === undefined) {
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
    SideMenu.setUserButton(b, old.name, old.surname, old.matricule);
  }
}

document.getElementById('edit-button').addEventListener('click', function() {
  const b = state.edit_target;
  const id = Number(state.edit_target._dataId);
  if (id == undefined) {
    throw new Error('delete-target should have a property `_dataId` which infers to which piece of data the element is associated with');
  }

  let w = new BufferWriter();
  switch (state.edit_target.parentElement._id) {
    case zonesId.STAFF: {
      b.removeEventListener('click', SideMenu.buttonClickCallback);
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
        escOrUpdateOnEnter(e, b, inputs, old)
      });
      inputs.surname.addEventListener('keydown', (e) => {
        escOrUpdateOnEnter(e, b, inputs, old)
      });
      inputs.matricule.addEventListener('keydown', (e) => {
        escOrUpdateOnEnter(e, b, inputs, old)
      });
      b.replaceChildren(inputs.name, inputs.surname, inputs.matricule);
      break;
    }

    case zonesId.EVENT: {
      updateEventOrVenue(
        b,
        'Nom d\'Événement',
        Api.EVENTS_ID_MAP_ID,
        data.bundleEventsNames(),
      );
      break;
    }
    case zonesId.VENUE: {
      updateEventOrVenue(
        b,
        'Nom de Lieu',
        Api.VENUES_ID_MAP_ID,
        data.bundleVenuesNames(),
      );
      break;
    }
    case zonesId.DURATION: {
      const event_id = zones[zonesId.EVENT].selection._dataId;
      const event_index = data.eventsId.get(event_id);
      if (event_index === undefined) { throw new Error('[updating duration]: event_id does not exist'); }
      const old_duration = data.eventsDuration[event_index];

      numeric_input.endOfWriting = () => {
        if (numeric_input.elm.value === '') {
          numeric_input.elm.replaceWith(b);
          return;
        }
        const duration = Number(numeric_input.elm.value);
        b.textContent = numeric_input.elm.value;
        numeric_input.elm.replaceWith(b);
        const w = EventInfo.createDurationBuffer(duration, Api.UPDATE, event_id);
        Api.request(w)
        .then(response => {
          Utils.throwIfNotOk(response);
          data.eventsDuration[event_index] = duration;
        })
        .catch(e => {
          b.textContent = old_duration;
        });
      };
      numeric_input.elm.value = old_duration;
      const width = Utils.measureText(window.getComputedStyle(numeric_input.elm), numeric_input.elm.value)+2;
      Utils.setWidthPx(numeric_input.elm, width);
      numeric_input.replace(b);
      break;
    }
  }
});


document.getElementById('delete-button').addEventListener('click', function() {
  const id = state.delete_target._dataId;
  if (id == undefined) {
    throw new Error('delete-target should have a property `_dataId` which infers with which piece of data the element is associated');
  }
  state.delete_target.classList.add('disp-none');

  let w = new BufferWriter();
  switch (state.delete_target.parentElement._id) {
    case zonesId.STAFF:
      Api.writeHeader(w, Api.DELETE, Api.USERS_ID_MAP_ID);
      break;
    case zonesId.VENUE:
      Api.writeHeader(w, Api.DELETE, Api.VENUES_ID_MAP_ID);
      break;
    case zonesId.EVENT:
      Api.writeHeader(w, Api.DELETE, Api.EVENTS_ID_MAP_ID);
      break;
    case zonesId.EVENTSTAFF:
      Api.writeHeader(w, Api.DELETE, Api.ROLES_ID_MAP_ID);
      break;
    case zonesId.NUMMAP:
      Api.writeHeader(w, Api.DELETE, Api.EVENTS_PERSONAL_NUM_MAP_ID);
      w.writeInt32(zones[zonesId.EVENT].selection._dataId);
      break;
    default:
      state.delete_target.classList.remove('disp-none');
      throw new Error('delete_target\'s parent should have `_id` property with a value from `zonesId`');
  }
  w.writeInt32(Number(id));
  Api.request(w)
  .then(resp => {
    Utils.throwIfNotOk(resp);
    switch (state.delete_target.parentElement._id) {
      case zonesId.STAFF:
        deleteValue(data.usersId, data.usersFreeList, id);
        deleteOccurrences(data.occurrencesParticipant, id);
        break;
      case zonesId.VENUE:
        deleteValue(data.venuesId, data.venuesFreeList, id);
        deleteOccurrences(data.eventsVenues, id);
        break;
      case zonesId.EVENT:
        deleteValue(data.eventsId, data.eventsFreeList, id);
        break;
      case zonesId.EVENTSTAFF: // we should here remove the button from a backing array
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
      case zonesId.NUMMAP:
        data.eventsPersonalNumMap[zones[zonesId.EVENT].selection._dataId].splice(Number(id), 1)
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

function endOfStandardInput(e, input, b, val) {
  Utils.setBgColor(input, 'transparent');
  e.preventDefault();
  input.remove();
  b.textContent = val;
}

function setCreateInput(b, input, api, meta_data) {
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = input.value;
      for (const [id, idx] of meta_data.map) {
        if (meta_data.arr[idx] === val) {
          Utils.setBgColor(input, palette.red);
          return
        }
      }

      endOfStandardInput(e, input, b, val);
      let w = Api.createBufferWriter(Api.CREATE, api);
      w.writeString(val);
      Api.request(w)
      .then(resp => {
        Utils.throwIfNotOk(resp);
        resp.arrayBuffer()
        .then(bin => {
          let r = new BufferReader(bin);
          let id = r.readInt32();
          let idx = storageIndex(meta_data.map, meta_data.free_list);
          meta_data.map.set(id, idx);
          meta_data.arr[idx] = val;
          b.textContent = '';
          Utils.setNameAndId(b, val, id);
          b.addEventListener('click', SideMenu.buttonClickCallback);
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
  input.focus();
}

function createEventOrVenue(parent, placeholder, api, meta_data) {
  let b = SideMenu.createTmplButton();
  const input = Utils.createTextInput(placeholder)
  b.replaceChildren(input);
  parent.appendChild(b);
  setCreateInput(b, input, api, meta_data);
}

function updateEventOrVenue(b, placeholder, api, meta_data) {
  const id = Number(state.edit_target._dataId);
  const idx = meta_data.map.get(id);
  if (idx === undefined) { throw new Error('[updateEventOrVenue]: id does not exist'); }
  const old_name = meta_data.arr[idx];

  b.removeEventListener('click', SideMenu.buttonClickCallback);

  const input = Utils.createTextInput(placeholder)
  input.value = old_name;
  b.replaceChildren(input);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = input.value;
      for (const [_id, _idx] of meta_data.map) {
        const name = meta_data.arr[_idx];
        if (name !== old_name && name === val) {
          Utils.setBgColor(input, palette.red);
          return
        }
      }

      endOfStandardInput(e, input, b, val);
      let w = Api.createBufferWriter(Api.UPDATE, api);
      w.writeInt32(id);
      w.writeString(val);
      Api.request(w)
      .then(resp => {
        Utils.throwIfNotOk(resp);
        meta_data.arr[idx] = val;
        b.textContent = '';
        b.addEventListener('click', SideMenu.buttonClickCallback);
        Utils.setNameAndId(b, val, id);
      })
      .catch(e => {
        b.textContent = '';
        Utils.setNameAndId(b, old_name, id);
        b.addEventListener('click', SideMenu.buttonClickCallback);
        console.error("Could not store ", val, e);
      });
    } else if (e.key === 'Escape') {
      b.textContent = '';
      b.addEventListener('click', SideMenu.buttonClickCallback);
      Utils.setNameAndId(b, old_name, id);
      b.remove();
    }
  });
  input.focus();
}

document.getElementById('create-button').addEventListener('click', () => {
  switch (state.extend_target._id) {
    case zonesId.STAFF: {
      const target = zones[zonesId.STAFF].eList;
      let b = SideMenu.createTmplButton(); 
      const inputs = createUserDataInputs();
      inputs.name.addEventListener('keydown', (e) => {
        escOrCreateOnEnter(e, b, inputs, inputs.surname)
      });
      inputs.surname.addEventListener('keydown', (e) => {
        escOrCreateOnEnter(e, b, inputs, inputs.matricule)
      });
      inputs.matricule.addEventListener('keydown', (e) => {
        escOrCreateOnEnter(e, b, inputs)
      });
      target.appendChild(b);
      b.appendChild(inputs.name);
      b.appendChild(inputs.surname);
      b.appendChild(inputs.matricule);
      inputs.name.focus();
      break;
    }
    case zonesId.EVENT: {
      createEventOrVenue(
        zones[zonesId.EVENT].eList, 
        'Nouvel Événement',
        Api.EVENTS_ID_MAP_ID,
        data.bundleEventsNames(),
      );
      break;
    }
    case zonesId.VENUE: {
      createEventOrVenue(
        zones[zonesId.VENUE].eList, 
        'Nouveau Lieu',
        Api.VENUES_ID_MAP_ID,
        data.bundleVenuesNames(),
      );
      break;
    }
    case zonesId.EVENTSTAFF: {
      let b = SearchDisplay.createButton();
      const input = Utils.createTextInput('Nouveau Rôle');
      b.appendChild(input);
      state.extend_target.appendChild(b);
      input.focus();

      setCreateInput(
        b,
        input,
        Api.ROLES_ID_MAP_ID,
        data.bundleRolesNames(),
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
    case zonesId.EVENTSTAFF:
      const event_id = zones[zonesId.EVENT].selection._dataId; 
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
        Utils.throwIfNotOk(resp);
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
