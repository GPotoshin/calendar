import * as Global from './global_state.js';
import { BufferReader, BufferWriter } from './io.js';
import { zones, zones_identifier } from './global_state.js';
import { storageIndex, deleteValue, deleteOccurrences, storeValue } from './data_manager.js';
import * as Api from './api.js';
import * as SideMenu from './side_menu.js';
import * as Utils from './utils.js';
import * as SearchDisplay from './search_display.js';
import * as EventInformation from './event_information.js';
import { numeric_input } from './numeric_input.js';
import { palette } from './color.js';

let state = {
  delete_target: null,
  extend_target: null,
  edit_target: null,
  toggle_target: null,
};

function handleClickForContextMenu() {
  let menu = Global.elements.right_click_menu;
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

      if (Global.data.users_identifier.has(matricule)) {
        Utils.setBackgroundColor(inputs.matricule, palette.red);
        return;
      }
      SideMenu.setUserButton(b, name, surname, matricule);
      let w = Api.createBufferWriter(Api.CREATE, Api.USERS_ID_MAP_ID);

      endOfUserInputs(b, w, inputs);
      Api.request(w)
      .then(resp => {
        Utils.throwIfNotOk(resp);

        let idx = storageIndex(Global.data.users_identifier, Global.data.usersFreeList);
        Global.data.users_identifier.set(matricule, idx);
        storeValue(Global.data.users_name, idx, name);
        storeValue(Global.data.users_surname, idx, surname);
        b._data_identifier = matricule;
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

      if (matricule !== old.matricule && Global.data.users_identifier.has(matricule)) {
        Utils.setBackgroundColor(inputs.matricule, palette.red);
        return;
      }
      SideMenu.setUserButton(b, name, surname, matricule);
      let w = Api.createBufferWriter(Api.UPDATE, Api.USERS_ID_MAP_ID);
      w.writeInt32(old.matricule);

      endOfUserInputs(b, w, inputs);
      Api.request(w)
      .then(resp => {
        Utils.throwIfNotOk(resp);
        const idx = Global.data.users_identifier.get(old.matricule);
        if (idx === undefined) {
          console.error("old matricule does not exist locally");
          return
        }
        if (old.matricule !== matricule) {
          Global.data.users_identifier.delete(old.matricule);
          Global.data.users_identifier.set(matricule, idx);
        }
        Global.data.users_name[idx] = name;
        Global.data.users_surname[idx] = surname;
        b._data_identifier = matricule;
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
  const id = Number(state.edit_target._data_id);
  if (id == undefined) {
    throw new Error('delete-target should have a property `_data_id` which infers to which piece of data the element is associated with');
  }

  let w = new BufferWriter();
  switch (state.edit_target.parentElement._id) {
    case zones_identifier.STAFF: {
      b.removeEventListener('click', SideMenu.buttonClickCallback);
      const idx = Global.data.users_identifier.get(id);
      if (idx === undefined) {
        console.error('user index is not found');
        return;
      }
      const old = {
        name: Global.data.users_name[idx],
        surname: Global.data.users_surname[idx],
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

    case zones_identifier.EVENT: {
      updateEventOrVenue(
        b,
        'Nom d\'Événement',
        Api.EVENTS_ID_MAP_ID,
        Global.data.bundleEventsNames(),
      );
      break;
    }
    case zones_identifier.VENUE: {
      updateEventOrVenue(
        b,
        'Nom de Lieu',
        Api.VENUES_ID_MAP_ID,
        Global.data.bundleVenuesNames(),
      );
      break;
    }
    case zones_identifier.DURATION: {
      const event_identifier = zones[zones_identifier.EVENT].selection._data_id;
      const event_index = Global.data.events_identifier.get(event_id);
      if (event_index === undefined) { throw new Error('[updating duration]: event_identifier does not exist'); }
      const old_duration = Global.data.events_duration[event_index];

      numeric_input.endOfWriting = () => {
        const duration = swapBackNumberButtonAndReturnNewValue(b);
        if (duration === undefined) { return; }
        const w = EventInformation.createDurationBuffer(duration, Api.UPDATE, event_id);
        Api.request(w)
        .then(response => {
          Utils.throwIfNotOk(response);
          Global.data.events_duration[event_index] = duration;
        })
        .catch(e => {
          b.textContent = old_duration;
        });
      };
      swapNumberButtonToInputAndLatterToOldValue(b, old_duration);
      break;
    }
    case zones_identifier.EMPLOYEES_LIMIT: {
      const old_limit = Global.data.employees_limit;

      numeric_input.endOfWriting = () => {
        const new_limit = swapBackNumberButtonAndReturnNewValue(b);
        if (new_limit === undefined) { return; }

        const w = Api.createBufferWriter(Api.UPDATE, Api.EMPLOYEES_LIMIT_ID);
        w.writeInt32(new_limit);
        Api.request(w)
        .then(response => {
          Utils.throwIfNotOk(response);
          Global.data.employees_limit = new_limit;
        })
        .catch(e => {
          b.textContent = old_limit;
        });
      };
      swapNumberButtonToInputAndSetLatterToOldValue(b, old_limit);
      break;
    }
  }
});

function swapNumberButtonToInputAndSetLatterToOldValue(button, old_value) {
  numeric_input.element.value = old_value;
  const width = Utils.measureText(window.getComputedStyle(numeric_input.element), old_value)+2;
  Utils.setWidthInPixels(numeric_input.element, width);
  numeric_input.replace(button);
}

function swapBackNumberButtonAndReturnNewValue(button) {
  if (numeric_input.element.value === '') {
    numeric_input.element.replaceWith(button);
    return undefined;
  }

  button.textContent = numeric_input.element.value;
  numeric_input.element.replaceWith(button);
  return Number(numeric_input.element.value);
}

document.getElementById('delete-button').addEventListener('click', function() {
  const id = state.delete_target._data_id;
  if (id == undefined) {
    throw new Error('delete-target should have a property `_data_id` which infers with which piece of data the element is associated');
  }
  state.delete_target.classList.add('disp-none');

  let w = new BufferWriter();
  switch (state.delete_target.parentElement._id) {
    case zones_identifier.STAFF:
      Api.writeHeader(w, Api.DELETE, Api.USERS_ID_MAP_ID);
      break;
    case zones_identifier.VENUE:
      Api.writeHeader(w, Api.DELETE, Api.VENUES_ID_MAP_ID);
      break;
    case zones_identifier.EVENT:
      Api.writeHeader(w, Api.DELETE, Api.EVENTS_ID_MAP_ID);
      break;
    case zones_identifier.EVENT_STAFF:
      Api.writeHeader(w, Api.DELETE, Api.ROLES_ID_MAP_ID);
      break;
    case zones_identifier.PERSONAL_NUMBER_MAP:
      Api.writeHeader(w, Api.DELETE, Api.EVENTS_PERSONAL_NUM_MAP_ID);
      w.writeInt32(zones[zones_identifier.EVENT].selection._data_id);
      break;
    default:
      state.delete_target.classList.remove('disp-none');
      throw new Error('delete_target\'s parent should have `_id` property with a value from `zones_identifier`');
  }
  w.writeInt32(Number(id));
  Api.request(w)
  .then(resp => {
    Utils.throwIfNotOk(resp);
    switch (state.delete_target.parentElement._id) {
      case zones_identifier.STAFF:
        deleteValue(Global.data.users_identifier, Global.data.usersFreeList, id);
        deleteOccurrences(Global.data.occurrences_participants, id);
        break;
      case zones_identifier.VENUE:
        deleteValue(Global.data.venues_identifier, Global.data.venuesFreeList, id);
        deleteOccurrences(Global.data.events_venues, id);
        break;
      case zones_identifier.EVENT:
        deleteValue(Global.data.events_identifier, Global.data.eventsFreeList, id);
        break;
      case zones_identifier.EVENT_STAFF: // we should here remove the button from a backing array
        EventInformation.elements.event_role_list._btn_list =
          EventInformation.elements.event_role_list._btn_list.filter(b => b !== state.delete_target);

        deleteValue(Global.data.roles_idetifier, Global.data.rolesFreeList, id);
        for (let i = 0; i < Global.data.events_roles.length; i++) {
          let eventsRoles = Global.data.events_roles[i];
          let idx = eventsRoles.indexOf(id);
          eventsRoles.splice(Number(id), 1);
          let nummap = Global.data.eventsStaffNumericMap[i];
          for (let j = 0; j < nummap.length; j++) {
            nummap.splice(idx, 1);
          }
        }
        EventInformation.update();
        break;
      case zones_identifier.PERSONAL_NUMBER_MAP:
        Global.data.eventsStaffNumericMap[zones[zones_identifier.EVENT].selection._data_id].splice(Number(id), 1)

        EventInformation.update();
        break;
      default:
        throw new Error('that zones_identifier does not support local storage');
    }
  })
  .catch(e => {
    state.delete_target.classList.remove('disp-none');
    console.error("Could not delete ", e);
    return;
  });
});

function endOfStandardInput(e, input, b, val) {
  Utils.setBackgroundColor(input, 'transparent');
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
          Utils.setBackgroundColor(input, palette.red);
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
          meta_data.array[idx] = val;
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
  let b = SideMenu.createTemplateButton();
  const input = Utils.createTextInput(placeholder)
  b.replaceChildren(input);
  parent.appendChild(b);
  setCreateInput(b, input, api, meta_data);
}

function updateEventOrVenue(b, placeholder, api, meta_data) {
  const id = Number(state.edit_target._data_id);
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
      for (const [_id, _index] of meta_data.map) {
        const name = meta_data.arr[_index];
        if (name !== old_name && name === val) {
          Utils.setBackgroundColor(input, palette.red);
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
    case zones_identifier.STAFF: {
      const target = zones[zones_identifier.STAFF].element_list;
      let b = SideMenu.createTemplateButton(); 
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
    case zones_identifier.EVENT: {
      createEventOrVenue(
        zones[zones_identifier.EVENT].element_list, 
        'Nouvel Événement',
        Api.EVENTS_ID_MAP_ID,
        Global.data.bundleEventsNames(),
      );
      break;
    }
    case zones_identifier.VENUE: {
      createEventOrVenue(
        zones[zones_identifier.VENUE].element_list, 
        'Nouveau Lieu',
        Api.VENUES_ID_MAP_ID,
        Global.data.bundleVenuesNames(),
      );
      break;
    }
    case zones_identifier.EVENT_STAFF: {
      let b = SearchDisplay.createButton();
      const input = Utils.createTextInput('Nouveau Rôle');
      b.appendChild(input);
      state.extend_target.appendChild(b);
      input.focus();

      setCreateInput(
        b,
        input,
        Api.ROLES_ID_MAP_ID,
        Global.data.bundleRolesNames(),
      );
      EventInformation.elements.event_role_list._btn_list.push(b);
      break;
    }
    default:
  }
});

document.getElementById('toggle-button').addEventListener('click', () => {
  const target = state.toggle_target;
  const turning_on = target.classList.toggle('clicked');
  switch (state.toggle_target.parentElement._id) { // working
    case zones_identifier.EVENT_STAFF:
      const event_identifier = zones[zones_identifier.EVENT].selection._data_id; 
      const role_identifier = target._data_id;
      const idx = Global.data.events_identifier.get(event_id);
      const role_index = Global.data.roles_idetifier.get(role_id);
      if (idx === undefined || role_index === undefined) {
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
        let num_map = Global.data.eventsStaffNumericMap;

        if (turning_on) {
          Global.data.events_roles[idx].push(role_id);
          for (const arr of num_map[idx]) {
            arr.push(-1);
          }
        }
        else {
          const pos = Global.data.events_roles[idx].indexOf(role_id); 
          Global.data.events_roles[idx].splice(pos, 1);
          for (let arr of num_map[idx]) {
            arr.splice(pos+2, 1);
          }
        }
        EventInformation.update();
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
  const menu = Global.elements.right_click_menu;
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
