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

let buttons = {
  delete: document.getElementById('delete-button'),
  edit: document.getElementById('edit-button'),
  toggle: document.getElementById('toggle-button'),
  create: document.getElementById('create-button'),
};

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
  const inputs = {
    name:      Utils.createTextInput('Prenom'),
    surname:   Utils.createTextInput('Nom'),
    matricule: Utils.createTextInput('Matricule'),
  };
  inputs.matricule.addEventListener('input', () => {
    inputs.matricule.value = Utils.digitise(inputs.matricule.value);
  });
  return inputs;
}

function endOfUserInputs(button, writer, inputs) {
  button.addEventListener('click', SideMenu.buttonClickCallback);
  writer.writeInt32(Number(inputs.matricule.value));
  writer.writeString(inputs.name.value);
  writer.writeString(inputs.surname.value);
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

function escOrCreateOnEnter(event, button, inputs, next = null) {
  if (event.key === 'Enter') {
    if (userInputsAreNotEmpty(inputs)) {
      event.preventDefault();
      const [name, surname, matricule] = getValuesFromUserInputs(inputs);

      if (Global.data.users_identifier.has(matricule)) {
        Utils.setBackgroundColor(inputs.matricule, palette.red);
        return;
      }
      SideMenu.setUserButton(button, name, surname, matricule);
      let writer = Api.createBufferWriter(Api.CREATE, Api.USERS_ID_MAP_ID);

      endOfUserInputs(button, writer, inputs);
      Api.request(writer)
      .then(response => {
        Utils.throwIfNotOk(response);

        let index = storageIndex(Global.data.users_identifier, Global.data.usersFreeList);
        Global.data.users_identifier.set(matricule, index);
        storeValue(Global.data.users_name, index, name);
        storeValue(Global.data.users_surname, index, surname);
        button._data_identifierentifier = matricule;
      })
      .catch(error => {
        button.remove();
        console.error("Could not store ", name, error);
      });
    }
    if (next) { next.focus(); }
  } else if (event.key === 'Escape') {
    event.preventDefault();
    button.remove();
  }
}

function escOrUpdateOnEnter(event, button, inputs, old) {
  if (event.key === 'Enter') {
    if (userInputsAreNotEmpty(inputs)) {
      event.preventDefault();
      const [name, surname, matricule] = getValuesFromUserInputs(inputs);

      if (matricule !== old.matricule && Global.data.users_identifier.has(matricule)) {
        Utils.setBackgroundColor(inputs.matricule, palette.red);
        return;
      }
      SideMenu.setUserButton(button, name, surname, matricule);
      let writer = Api.createBufferWriter(Api.UPDATE, Api.USERS_ID_MAP_ID);
      writer.writeInt32(old.matricule);

      endOfUserInputs(button, writer, inputs);
      Api.request(writer)
      .then(response => {
        Utils.throwIfNotOk(response);
        const index = Global.data.users_identifier.get(old.matricule);
        if (index === undefined) {
          console.error("old matricule does not exist locally");
          return
        }
        if (old.matricule !== matricule) {
          Global.data.users_identifier.delete(old.matricule);
          Global.data.users_identifier.set(matricule, index);
        }
        Global.data.users_name[index] = name;
        Global.data.users_surname[index] = surname;
        button._data_identifierentifier = matricule;
      })
      .catch(error => {
        SideMenu.setUserButton(button, old.name, old.surname, old.matricule);
        console.error("Could not store ", name, error);
      });
    }
  } else if (event.key === 'Escape') {
    evenet.preventDefault();
    SideMenu.setUserButton(button, old.name, old.surname, old.matricule);
  }
}

buttons.edit.addEventListener('click', function() {
  const button = state.edit_target;
  const identifier = Number(button._data_identifier);
  if (identifier == undefined) {
    throw new Error('delete-target should have a property `_data_identifier` which infers to which piece of data the element is associated with');
  }

  let writer = new BufferWriter();
  switch (state.edit_target.parentElement._id) {
    case zones_identifier.STAFF: {
      button.removeEventListener('click', SideMenu.buttonClickCallback);
      const index = Global.data.users_identifier.get(identifier);
      if (index === undefined) {
        console.error('user index is not found');
        return;
      }
      const old = {
        name: Global.data.users_name[index],
        surname: Global.data.users_surname[index],
        matricule: id,
      };

      let inputs = createUserDataInputs();
      inputs.name.value = old.name;
      inputs.surname.value = old.surname;
      inputs.matricule.value = old.matricule;
      inputs.name.addEventListener('keydown', event => {
        escOrUpdateOnEnter(event, button, inputs, old)
      });
      inputs.surname.addEventListener('keydown', event => {
        escOrUpdateOnEnter(event, button, inputs, old)
      });
      inputs.matricule.addEventListener('keydown', (e) => {
        escOrUpdateOnEnter(event, button, inputs, old)
      });
      button.replaceChildren(inputs.name, inputs.surname, inputs.matricule);
      break;
    }

    case zones_identifier.EVENT: {
      updateEventOrVenue(
        button,
        'Nom d\'Événement',
        Api.EVENTS_ID_MAP_ID,
        Global.data.bundleEventsNames(),
      );
      break;
    }
    case zones_identifier.VENUE: {
      updateEventOrVenue(
        button,
        'Nom de Lieu',
        Api.VENUES_ID_MAP_ID,
        Global.data.bundleVenuesNames(),
      );
      break;
    }
    case zones_identifier.DURATION: {
      const event_identifier = zones[zones_identifier.EVENT].selection._data_identifier;
      const event_index = Global.data.events_identifier.get(event_identifier);
      if (event_index === undefined) { throw new Error('[updating duration]: event_identifier does not exist'); }
      const old_duration = Global.data.events_duration[event_index];

      numeric_input.endOfWriting = () => {
        const duration = swapBackNumberButtonAndReturnNewValue(button);
        if (duration === undefined) { return; }
        const writer = EventInformation.createDurationBuffer(duration, Api.UPDATE, event_identifier);
        Api.request(writer)
        .then(response => {
          Utils.throwIfNotOk(response);
          Global.data.events_duration[event_index] = duration;
        })
        .catch(error => {
          button.textContent = old_duration;
        });
      };
      swapNumberButtonToInputAndLatterToOldValue(button, old_duration);
      break;
    }
    case zones_identifier.EMPLOYEES_LIMIT: {
      const old_limit = Global.data.employees_limit;

      numeric_input.endOfWriting = () => {
        const new_limit = swapBackNumberButtonAndReturnNewValue(button);
        if (new_limit === undefined) { return; }

        const writer = Api.createBufferWriter(Api.UPDATE, Api.EMPLOYEES_LIMIT_ID);
        writer.writeInt32(new_limit);
        Api.request(writer)
        .then(response => {
          Utils.throwIfNotOk(response);
          Global.data.employees_limit = new_limit;
        })
        .catch(error => {
          button.textContent = old_limit;
        });
      };
      swapNumberButtonToInputAndSetLatterToOldValue(button, old_limit);
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

buttons.delete.addEventListener('click', function() {
  const identifier = state.delete_target._data_identifier;
  if (identifier == undefined) {
    throw new Error('delete-target should have a property `_data_identifier` which infers with which piece of data the element is associated');
  }
  state.delete_target.classList.add('disp-none');

  let writer = new BufferWriter();
  switch (state.delete_target.parentElement._identifier) {
    case zones_identifier.STAFF:
      Api.writeHeader(writer, Api.DELETE, Api.USERS_ID_MAP_ID);
      break;
    case zones_identifier.VENUE:
      Api.writeHeader(writer, Api.DELETE, Api.VENUES_ID_MAP_ID);
      break;
    case zones_identifier.EVENT:
      Api.writeHeader(writer, Api.DELETE, Api.EVENTS_ID_MAP_ID);
      break;
    case zones_identifier.EVENT_STAFF:
      Api.writeHeader(writer, Api.DELETE, Api.ROLES_ID_MAP_ID);
      break;
    case zones_identifier.PERSONAL_NUMBER_MAP:
      Api.writeHeader(writer, Api.DELETE, Api.EVENTS_PERSONAL_NUM_MAP_ID);
      writer.writeInt32(zones[zones_identifier.EVENT].selection._data_identifier);
      break;
    default:
      state.delete_target.classList.remove('disp-none');
      throw new Error('delete_target\'s parent should have `_identifier` property with a value from `zones_identifier`');
  }
  writer.writeInt32(Number(identifier));
  Api.request(writer)
  .then(response => {
    Utils.throwIfNotOk(response);
    switch (state.delete_target.parentElement._identifier) {
      case zones_identifier.STAFF:
        deleteValue(Global.data.users_identifier, Global.data.usersFreeList, identifier);
        deleteOccurrences(Global.data.occurrences_participants, identifier);
        break;
      case zones_identifier.VENUE:
        deleteValue(Global.data.venues_identifier, Global.data.venuesFreeList, identifier);
        deleteOccurrences(Global.data.events_venues, identifier);
        break;
      case zones_identifier.EVENT:
        deleteValue(Global.data.events_identifier, Global.data.eventsFreeList, identifier);
        break;
      case zones_identifier.EVENT_STAFF: // we should here remove the button from a backing array
        EventInformation.elements.event_role_list._button_list =
          EventInformation.elements.event_role_list._button_list.filter(b => b !== state.delete_target);

        deleteValue(Global.data.roles_idetifier, Global.data.rolesFreeList, identifier);
        for (let i = 0; i < Global.data.events_roles.length; i++) {
          let events_roles = Global.data.events_roles[i];
          let index = events_roles.indexOf(identifier);
          events_roles.splice(Number(identifier), 1);
          let staff_numeric_map = Global.data.events_staff_numeric_map[i];
          for (let j = 0; j < staff_numberic_map.length; j++) {
            staff_numeric_map.splice(index, 1);
          }
        }
        EventInformation.update();
        break;
      case zones_identifier.PERSONAL_NUMBER_MAP:
        Global.data.eventsStaffNumericMap[zones[zones_identifier.EVENT].selection._data_identifier].splice(Number(identifier), 1)

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

function endOfStandardInput(event, input, button, value) {
  Utils.setBackgroundColor(input, 'transparent');
  event.preventDefault();
  input.remove();
  button.textContent = value;
}

function setCreateInput(button, input, api, meta_data) {
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      const value = input.value;
      for (const [identifier, index] of meta_data.map) {
        if (meta_data.array[index] === value) {
          Utils.setBackgroundColor(input, palette.red);
          return
        }
      }

      endOfStandardInput(evenet, input, button, value);
      let writer = Api.createBufferWriter(Api.CREATE, api);
      writer.writeString(value);
      Api.request(writer)
      .then(response => {
        Utils.throwIfNotOk(response);
        response.arrayBuffer()
        .then(binary => {
          let reader = new BufferReader(binary);
          let identifier = r.readInt32();
          let index = storageIndex(meta_data.map, meta_data.free_list);
          meta_data.map.set(identifier, index);
          meta_data.array[index] = value;
          b.textContent = '';
          Utils.setNameAndId(button, value, identifier);
          b.addEventListener('click', SideMenu.buttonClickCallback);
        });
      })
      .catch(error => {
        button.remove();
        console.error("Could not store ", value, error);
      });
    } else if (event.key === 'Escape') {
      event.preventDefault();
      button.remove();
    }
  });
  input.focus();
}

function createEventOrVenue(parent, placeholder, api, meta_data) {
  let button = SideMenu.createTemplateButton();
  const input = Utils.createTextInput(placeholder)
  button.replaceChildren(input);
  parent.appendChild(button);
  setCreateInput(button, input, api, meta_data);
}

function updateEventOrVenue(button, placeholder, api, meta_data) {
  const identifier = Number(state.edit_target._data_identifier);
  const index = meta_data.map.get(identifier);
  if (index === undefined) { throw new Error('[updateEventOrVenue]: id does not exist'); }
  const old_name = meta_data.array[index];

  button.removeEventListener('click', SideMenu.buttonClickCallback);

  const input = Utils.createTextInput(placeholder)
  input.value = old_name;
  button.replaceChildren(input);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      const value = input.value;
      for (const [_identifier, _index] of meta_data.map) {
        const name = meta_data.array[_index];
        if (name !== old_name && name === value) {
          Utils.setBackgroundColor(input, palette.red);
          return
        }
      }

      endOfStandardInput(event, input, button, value);
      let writer = Api.createBufferWriter(Api.UPDATE, api);
      writer.writeInt32(identifier);
      w.writeString(value);
      Api.request(writer)
      .then(response => {
        Utils.throwIfNotOk(response);
        meta_data.arr[index] = value;
        button.textContent = '';
        button.addEventListener('click', SideMenu.buttonClickCallback);
        Utils.setNameAndId(button, value, identifier);
      })
      .catch(error => {
        button.textContent = '';
        Utils.setNameAndId(button, old_name, identifier);
        button.addEventListener('click', SideMenu.buttonClickCallback);
        console.error("Could not store ", value, error);
      });
    } else if (event.key === 'Escape') {
      button.textContent = '';
      button.addEventListener('click', SideMenu.buttonClickCallback);
      Utils.setNameAndId(button, old_name, identifier);
      button.remove();
    }
  });
  input.focus();
}

buttons.create.addEventListener('click', () => {
  switch (state.extend_target._id) {
    case zones_identifier.STAFF: {
      const target = zones[zones_identifier.STAFF].element_list;
      let button = SideMenu.createTemplateButton(); 
      const inputs = createUserDataInputs();
      inputs.name.addEventListener('keydown', event => {
        escOrCreateOnEnter(event, button, inputs, inputs.surname)
      });
      inputs.surname.addEventListener('keydown', event => {
        escOrCreateOnEnter(event, button, inputs, inputs.matricule)
      });
      inputs.matricule.addEventListener('keydown', event => {
        escOrCreateOnEnter(event, button, inputs)
      });
      target.appendChild(button);
      button.appendChild(inputs.name);
      button.appendChild(inputs.surname);
      button.appendChild(inputs.matricule);
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
        button,
        input,
        Api.ROLES_ID_MAP_ID,
        Global.data.bundleRolesNames(),
      );
      EventInformation.elements.event_role_list._button_list.push(button);
      break;
    }
    default:
  }
});

buttons.toggle.addEventListener('click', () => {
  const target = state.toggle_target;
  const turning_on = target.classList.toggle('clicked');
  switch (state.toggle_target.parentElement._id) { // working
    case zones_identifier.EVENT_STAFF:
      const event_identifier = zones[zones_identifier.EVENT].selection._data_identifier; 
      const role_identifier = target._data_identifier;
      const index = Global.data.events_identifier.get(event_id);
      const role_index = Global.data.roles_idetifier.get(role_id);
      if (index === undefined || role_index === undefined) {
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
          Global.data.events_roles[index].push(role_id);
          for (const arr of num_map[index]) {
            arr.push(-1);
          }
        }
        else {
          const pos = Global.data.events_roles[index].indexOf(role_id); 
          Global.data.events_roles[index].splice(pos, 1);
          for (let arr of num_map[index]) {
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

function display(local_state, button) {
  button.classList.replace('disp-none', 'disp-block');
  local_state.show = true;
}

document.addEventListener('contextmenu', function(e) {
  const s = { show: false };
  const menu = Global.elements.right_click_menu;
  const target = e.target;

  if (state.delete_target = target.closest('.deletable')) {
    display(s, button.delete);
  }
  if (state.edit_target = target.closest('.editable')) {
    display(s, button.edit);
  }
  if (state.toggle_target = target.closest('.togglable')) {
    display(s, button.toggle);
  }
  if (state.extend_target = target.closest('.extendable')) {
    display(s, button.create);
  }

  if (s.show) {
    e.preventDefault();
    menu.classList.replace('disp-none', 'disp-flex');
    menu.style.setProperty('--menu-left', e.clientX + 'px');
    menu.style.setProperty('--menu-top', e.clientY + 'px');
    document.addEventListener('click', handleClickForContextMenu);
  }
});
