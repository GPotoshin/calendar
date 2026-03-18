import * as Global from './global.js';
import * as Io from './io.js';
import { storageIndex, deleteValue, deleteOccurrences, storeValue } from './data_manager.js';
import * as Api from './api.js';
import * as SideMenu from './side_menu.js';
import * as Utilities from './utilities.js';
import * as SearchDisplay from './search_display.js';
import * as EventInformation from './event_information.js';
import * as Calendar from './calendar.js';
import * as StaffInformation from './staff_information.js';
import { numeric_input } from './numeric_input.js';
import { palette } from './color.js';

const gcm_delete_button      = document.getElementById('delete-button');
const gcm_edit_button        = document.getElementById('edit-button');
const gcm_toggle_button      = document.getElementById('toggle-button');
const gcm_create_button      = document.getElementById('create-button');
const gcm_instantiate_button = document.getElementById('instantiate-button');
const gcm_apply_button       = document.getElementById('apply-button');

let gcm_delete_target      = null;
let gcm_extend_target      = null;
let gcm_edit_target        = null;
let gcm_toggle_target      = null;
let gcm_instantiate_target = null;
let gcm_apply_target       = null;

let gcm_context_menu_x = 0;
let gcm_context_menu_y = 0;

function createUserDataInputs() {
  const inputs = {
    name:      Utilities.createTextInput('Prenom'),
    surname:   Utilities.createTextInput('Nom'),
    matricule: Utilities.createTextInput('Matricule'),
  };
  inputs.matricule.addEventListener('input', () => {
    inputs.matricule.value = Utilities.digitise(inputs.matricule.value);
  });
  return inputs;
}

function endOfUserInputs(button, writer, inputs) {
  button.addEventListener('click', SideMenu.buttonClickCallback);
  Io.writeInt32(writer, Number(inputs.matricule.value));
  Io.writeString(writer, inputs.name.value);
  Io.writeString(writer, inputs.surname.value);
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

      if (Global.data.users_map.has(matricule)) {
        Utilities.setBackgroundColor(inputs.matricule, palette.red);
        return;
      }
      SideMenu.setUserButton(button, name, surname, matricule);
      let writer = Api.createBufferWriter(Api.CREATE, Api.USERS_MAP);

      endOfUserInputs(button, writer, inputs);
      Api.request(writer)
      .then(response => {
        Utilities.throwIfNotOk(response);

        let index = storageIndex(Global.data.users_map, Global.data.users_free_list);
        Global.data.users_map.set(matricule, index);
        storeValue(Global.data.users_name, index, name);
        storeValue(Global.data.users_surname, index, surname);

        storeValue(Global.data.users_phone, index, 0);
        storeValue(Global.data.users_competences, index, []);
        storeValue(Global.data.users_duty_station, index, -1);
        storeValue(Global.data.users_privilege_level, index, Global.PRIVILEGE_LEVEL_USER);
        button._data_identifier = matricule;
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

      if (matricule !== old.matricule && Global.data.users_map.has(matricule)) {
        Utilities.setBackgroundColor(inputs.matricule, palette.red);
        return;
      }
      SideMenu.setUserButton(button, name, surname, matricule);
      let writer = Api.createBufferWriter(Api.UPDATE, Api.USERS_MAP);
      Io.writeInt32(writer, old.matricule);

      endOfUserInputs(button, writer, inputs);
      Api.request(writer)
      .then(response => {
        Utilities.throwIfNotOk(response);
        const index = Global.data.users_map.get(old.matricule);
        if (index === undefined) {
          console.error("old matricule does not exist locally");
          return
        }
        if (old.matricule !== matricule) {
          Global.data.users_map.delete(old.matricule);
          Global.data.users_map.set(matricule, index);
        }
        Global.data.users_name[index] = name;
        Global.data.users_surname[index] = surname;
        button._data_identifier = matricule;
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

gcm_edit_button.addEventListener('click', function() {
  const target_button = gcm_edit_target;
  const identifier = Number(target_button._data_identifier);
  if (identifier == undefined) {
    throw new Error('delete-target should have a property `_data_identifier` which infers to which piece of data the element is associated with');
  }

  let writer = new Io.BufferWriter();
  switch (target_button.parentElement._identifier) {
    case Global.zones_identifier.STAFF: {
      target_button.removeEventListener('click', SideMenu.buttonClickCallback);
      const index = Global.data.users_map.get(identifier);
      if (index === undefined) {
        console.error('user index is not found');
        return;
      }
      const old = {
        name: Global.data.users_name[index],
        surname: Global.data.users_surname[index],
        matricule: identifier,
      };

      let inputs = createUserDataInputs();
      inputs.name.value = old.name;
      inputs.surname.value = old.surname;
      inputs.matricule.value = old.matricule;
      inputs.name.addEventListener('keydown', event => {
        escOrUpdateOnEnter(event, target_button, inputs, old)
      });
      inputs.surname.addEventListener('keydown', event => {
        escOrUpdateOnEnter(event, target_button, inputs, old)
      });
      inputs.matricule.addEventListener('keydown', (e) => {
        escOrUpdateOnEnter(event, target_button, inputs, old)
      });
      target_button.replaceChildren(inputs.name, inputs.surname, inputs.matricule);
      break;
    }

    case Global.zones_identifier.EVENT: {
      updateEventOrVenue(
        target_button,
        'Nom d\'Événement',
        Api.EVENTS_MAP,
        Global.bundleEventsNames(),
      );
      break;
    }
    case Global.zones_identifier.VENUE: {
      updateEventOrVenue(
        target_button,
        'Nom de Lieu',
        Api.VENUES_MAP,
        Global.bundleVenuesNames(),
      );
      break;
    }
    case Global.zones_identifier.STAFF_NUMBER_MAP_FIELD: {
      const event_identifier = Global.getEventSelectionIdentifier();
      const event_index = Global.data.events_map.get(event_identifier);
      const line_index = target_button.parentElement.parentElement._data_identifier;
      const field_index = target_button._data_identifier;
      numeric_input.endOfWriting = () => {
        EventInformation.endOfButtonWriting(target_button, line_index, event_identifier, event_index);
      };
      numeric_input.element.value = target_button.value;
      numeric_input.replace(target_button);
       
      break;
    }
    case Global.zones_identifier.DURATION: {
      const event_identifier = Global.getEventSelectionIdentifier();
      const event_index = Global.data.events_map.get(event_identifier);
      if (event_index === undefined) { throw new Error('[updating duration]: event_identifier does not exist'); }
      const old_duration = Global.data.events_duration[event_index];

      numeric_input.endOfWriting = () => {
        const duration = swapBackNumberButtonAndReturnNewValue(target_button);
        if (duration === undefined) { return; }
        const writer = EventInformation.createDurationBuffer(duration, Api.UPDATE, event_identifier);
        Api.request(writer)
        .then(response => {
          Utilities.throwIfNotOk(response);
          Global.data.events_duration[event_index] = duration;
        })
        .catch(error => {
          target_button.textContent = old_duration;
        });
      };
      swapNumberButtonToInputAndSetLatterToOldValue(target_button, old_duration);
      break;
    }
    case Global.zones_identifier.EMPLOYEES_LIMIT: {
      const old_limit = Global.data.employees_limit;

      numeric_input.endOfWriting = () => {
        const new_limit = swapBackNumberButtonAndReturnNewValue(target_button);
        if (new_limit === undefined) { return; }

        const writer = Api.createBufferWriter(Api.UPDATE, Api.EMPLOYEES_LIMIT);
        Io.writeInt32(writer, new_limit);
        Api.request(writer)
        .then(response => {
          Utilities.throwIfNotOk(response);
          Global.data.employees_limit = new_limit;
        })
        .catch(error => {
          target_button.textContent = old_limit;
        });
      };
      swapNumberButtonToInputAndSetLatterToOldValue(target_button, old_limit);
      break;
    }
    case Global.zones_identifier.PRIVILEGE_LEVEL: {
      StaffInformation.openOptions(gcm_context_menu_x, gcm_context_menu_y);
      break;
    }
    default: {
      if (gcm_edit_target.classList.contains('event-occurrence')) {
        Calendar.startInstantiating(null, gcm_edit_target._data_identifier)
      } else {
        throw new Error('edit_target\'s parent should have `_identifier` property with a value from `Global.zones_identifier` or be an event-occurrence');
      }
    }
  }
});

function swapNumberButtonToInputAndSetLatterToOldValue(button, old_value) {
  numeric_input.element.value = old_value;
  const width = Utilities.measureText(window.getComputedStyle(numeric_input.element), old_value)+2;
  Utilities.setWidthInPixels(numeric_input.element, width);
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

gcm_delete_button.addEventListener('click', function() {
  if (gcm_delete_target._data_identifier == undefined) {
    throw new Error('delete-target should have a property `_data_identifier` which infers with which piece of data the element is associated');
  }
  const identifier = Number(gcm_delete_target._data_identifier);
  if (gcm_delete_target.classList.contains('event-occurrence')) {
    for (const bar of Calendar.gc_current.bars) {
      if (Number(bar._data_indentifier) === identifier) {
        bar.classList.add('deleting');
      }
    }
  } else {
    gcm_delete_target.classList.add('deleting');
  }

  let writer = new Io.BufferWriter();
  switch (gcm_delete_target.parentElement._identifier) {
    case Global.zones_identifier.STAFF:
      Api.writeHeader(writer, Api.DELETE, Api.USERS_MAP);
      Io.writeInt32(writer, identifier);
      Api.request(writer)
        .then(response => {
          Utilities.throwIfNotOk(response);
          deleteValue(Global.data.users_map, Global.data.users_free_list, identifier);
          deleteOccurrences(Global.data.occurrences_participants, identifier);
          gcm_delete_target.parentElement._button_list.filter(b => b !== gcm_delete_target);
          gcm_delete_target.remove();
        })
        .catch(e => {
          gcm_delete_target.classList.remove('deleting');
          console.error("Could not delete ", e);
          return;
        });
      break;
    case Global.zones_identifier.VENUE:
      Api.writeHeader(writer, Api.DELETE, Api.VENUES_MAP);
      Io.writeInt32(writer, identifier);
      Api.request(writer)
        .then(response => {
          Utilities.throwIfNotOk(response);
          deleteValue(Global.data.venues_map, Global.data.venues_free_list, identifier);
          deleteOccurrences(Global.data.events_venues, identifier);
          gcm_delete_target.parentElement._button_list.filter(b => b !== gcm_delete_target);
          gcm_delete_target.remove();
        })
        .catch(e => {
          gcm_delete_target.classList.remove('deleting');
          console.error("Could not delete ", e);
          return;
        });
      break;
    case Global.zones_identifier.EVENT:
      Api.writeHeader(writer, Api.DELETE, Api.EVENTS_MAP);
      Io.writeInt32(writer, identifier);
      Api.request(writer)
        .then(response => {
          Utilities.throwIfNotOk(response);
          deleteValue(Global.data.events_map, Global.data.events_free_list, identifier);
          gcm_delete_target.parentElement._button_list.filter(b => b !== gcm_delete_target);
          gcm_delete_target.remove();
        })
        .catch(e => {
          gcm_delete_target.classList.remove('deleting');
          console.error("Could not delete ", e);
          return;
        });
      break;
    case Global.zones_identifier.EVENT_STAFF:
      Api.writeHeader(writer, Api.DELETE, Api.ROLES_MAP);
      Io.writeInt32(writer, identifier);
      Api.request(writer)
        .then(response => {
          Utilities.throwIfNotOk(response);
          gcm_extend_target._button_list =
            gcm_extend_target._button_list.filter(b => b !== gcm_delete_target);
          deleteValue(Global.data.roles_map, Global.data.roles_free_list, identifier);
          deleteOccurrences(Global.data.events_roles, identifier);
          for (let i = 0; i < Global.data.events_roles.length; i++) {
            let events_roles = Global.data.events_roles[i];
            let index = events_roles.indexOf(identifier);
            events_roles.splice(identifier, 1);
            let staff_number_map = Global.data.events_staff_number_map[i];
            for (let j = 0; j < staff_number_map.length; j++) {
              staff_number_map.splice(index, 1);
            }
          }
          EventInformation.update();
        })
        .catch(e => {
          gcm_delete_target.classList.remove('deleting');
          console.error("Could not delete ", e);
          return;
        });
      break;
    case Global.zones_identifier.STAFF_NUMBER_MAP:
      Api.writeHeader(writer, Api.DELETE, Api.EVENTS_PERSONAL_NUM_MAP);
      Io.writeInt32(writer, Global.getEventSelectionIdentifier());
      Io.writeInt32(writer, identifier);
      Api.request(writer)
        .then(response => {
          Utilities.throwIfNotOk(response);
          const event_identifier = Global.getEventSelectionIdentifier();
          const event_index = Global.data.events_map.get(event_identifier);
          Global.data.events_staff_number_map[event_index].splice(identifier, 1)
          EventInformation.update();
        })
        .catch(e => {
          gcm_delete_target.classList.remove('deleting');
          console.error("Could not delete ", e);
          return;
        });
      break;
    case Global.zones_identifier.COMPETENCES:
      Api.writeHeader(writer, Api.DELETE, Api.COMPETENCES_MAP);
      Io.writeInt32(writer, identifier);
      Api.request(writer)
        .then(response => {
          Utilities.throwIfNotOk(response);
          EventInformation.gcm_participant_competences_button_list.push(button);
          deleteValue(Global.data.competences_map, Global.data.competences_free_list, identifier);
          for (const [event_identifier, event_index] in Global.data.events_map) {
            deleteOccurrences(Global.data.events_competences[event_index], identifier);
          }
          EventInformation.update();
        })
        .catch(e => {
          gcm_delete_target.classList.remove('deleting');
          console.error("Could not delete ", e);
          return;
        });
      break;
    default:
      if (gcm_delete_target.classList.contains('event-occurrence')) {
        Api.writeHeader(writer, Api.DELETE, Api.OCCURRENCES_MAP);
        Io.writeInt32(writer, identifier);
        Api.request(writer)
          .then(response => {
            Utilities.throwIfNotOk(response);
            const index = deleteValue(Global.data.occurrences_map,
              Global.data.occurrences_free_list,
              identifier);
            const intervals = Global.data.occurrences_dates[index];
            for (let i = 0; i < intervals.length; i++) {
              for (let j = intervals[i][0]-Global.data.base_day_number;
                       j <= intervals[i][1]-Global.data.base_day_number;
                       j++
              ) {
                Global.data.day_occurrences[j].filter(v => v !== identifier);
              }
            }
          })
          .catch(e => {
            for (const bar of Calendar.gc_current.bars) {
              if (Number(bar._data_indentifier) === identifier) {
                bar.classList.remove('deleting');
              }
            }
            console.error("Could not delete ", e);
        });
      } else {
        gcm_delete_target.classList.remove('deleting');
        throw new Error('delete_target\'s parent should have `_identifier` property with a value from `Global.zones_identifier`');
      }
  }
});

function endOfStandardInput(event, input, button, value) {
  Utilities.setBackgroundColor(input, 'transparent');
  event.preventDefault();
  input.remove();
  button.textContent = value;
}

function setCreateInput(button, input, api, meta_data, endCallback) {
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      const value = input.value;
      for (const [identifier, index] of meta_data.map) {
        if (meta_data.array[index] === value) {
          Utilities.setBackgroundColor(input, palette.red);
          return
        }
      }

      endOfStandardInput(event, input, button, value);
      let writer = Api.createBufferWriter(Api.CREATE, api);
      Io.writeString(writer, value);
      Api.request(writer)
      .then(response => {
        Utilities.throwIfNotOk(response);
        response.arrayBuffer()
        .then(binary => {
          let reader = new Io.BufferReader(binary);
          let identifier = Io.readInt32(reader);
          let index = storageIndex(meta_data.map, meta_data.free_list);
          meta_data.map.set(identifier, index);
          meta_data.array[index] = value;
          button.textContent = '';
          Utilities.setNameAndIdentifier(button, value, identifier);
          button.addEventListener('click', SideMenu.buttonClickCallback);
          if (endCallback) endCallback(button);
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
  const input = Utilities.createTextInput(placeholder)
  button.replaceChildren(input);
  parent.appendChild(button);
  parent._button_list.push(button);
  setCreateInput(button, input, api, meta_data, null);
}

function updateEventOrVenue(button, placeholder, api, meta_data) {
  const identifier = Number(gcm_edit_target._data_identifier);
  const index = meta_data.map.get(identifier);
  if (index === undefined) { throw new Error('[updateEventOrVenue]: id does not exist'); }
  const old_name = meta_data.array[index];

  button.removeEventListener('click', SideMenu.buttonClickCallback);

  const input = Utilities.createTextInput(placeholder)
  input.value = old_name;
  button.replaceChildren(input);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      const value = input.value;
      for (const [_identifier, _index] of meta_data.map) {
        const name = meta_data.array[_index];
        if (name !== old_name && name === value) {
          Utilities.setBackgroundColor(input, palette.red);
          return
        }
      }

      endOfStandardInput(event, input, button, value);
      let writer = Api.createBufferWriter(Api.UPDATE, api);
      Io.writeInt32(writer, identifier);
      Io.writeString(writer, value);
      Api.request(writer)
      .then(response => {
        Utilities.throwIfNotOk(response);
        meta_data.array[index] = value;
        button.textContent = '';
        button.addEventListener('click', SideMenu.buttonClickCallback);
        Utilities.setNameAndIdentifier(button, value, identifier);
      })
      .catch(error => {
        button.textContent = '';
        Utilities.setNameAndIdentifier(button, old_name, identifier);
        button.addEventListener('click', SideMenu.buttonClickCallback);
        console.error("Could not store ", value, error);
      });
    } else if (event.key === 'Escape') {
      button.textContent = '';
      button.addEventListener('click', SideMenu.buttonClickCallback);
      Utilities.setNameAndIdentifier(button, old_name, identifier);
      button.remove();
    }
  });
  input.focus();
}

gcm_create_button.addEventListener('click', () => {
  switch (gcm_extend_target._identifier) {
    case Global.zones_identifier.STAFF: {
      const target = Global.zones[Global.zones_identifier.STAFF].element_list;
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
      target._button_list.push(button);
      button.appendChild(inputs.name);
      button.appendChild(inputs.surname);
      button.appendChild(inputs.matricule);
      inputs.name.focus();
      break;
    }
    case Global.zones_identifier.EVENT: {
      createEventOrVenue(
        Global.zones[Global.zones_identifier.EVENT].element_list, 
        'Nouvel Événement',
        Api.EVENTS_MAP,
        Global.bundleEventsNames(),
      );
      break;
    }
    case Global.zones_identifier.VENUE: {
      createEventOrVenue(
        Global.zones[Global.zones_identifier.VENUE].element_list, 
        'Nouveau Lieu',
        Api.VENUES_MAP,
        Global.bundleVenuesNames(),
      );
      break;
    }
    case Global.zones_identifier.EVENT_STAFF: {
      let button = SearchDisplay.createButton();
      const input = Utilities.createTextInput('Nouveau Rôle');
      button.appendChild(input);
      gcm_extend_target.appendChild(button);
      input.focus();

      setCreateInput(
        button,
        input,
        Api.ROLES_MAP,
        Global.bundleRolesNames(),
        (button) => { EventInformation.gcm_event_role_button_list.push(button); },
      );
      break;
    }
    case Global.zones_identifier.COMPETENCES: {
      let button = SearchDisplay.createButton();
      const input = Utilities.createTextInput('Nouvelle Compétence');
      button.appendChild(input);
      gcm_extend_target.appendChild(button);
      input.focus();

      setCreateInput(
        button,
        input,
        Api.COMPETENCES_MAP,
        Global.bundleCompetencesNames(),
        (button) => {
          EventInformation.gcm_participant_competences_button_list.push(button);
          EventInformation.update();
        }
      );
      break;
    }
    default:
  }
});

function createConditionalApiWriter(turning_on, api) {
  const writer = new Io.BufferWriter();
  if (turning_on) {
    Api.writeHeader(writer, Api.CREATE, api);
  } else {
    Api.writeHeader(writer, Api.DELETE, api);
  }
  return writer;
}

gcm_toggle_button.addEventListener('click', () => {
  const target = gcm_toggle_target;
  const target_identifier = target._data_identifier;
  const turning_on = target.classList.toggle('clicked');
  const event_identifier = Global.getEventSelectionIdentifier(); 
  const event_index = Global.data.events_map.get(event_identifier);
  switch (target.parentElement._identifier) {
    case Global.zones_identifier.EVENT_STAFF: {
      const role_index = Global.data.roles_map.get(target_identifier);
      if (event_index === undefined || role_index === undefined) {
        console.error('[toggle-button:click] Incorrect event\'s or role\'s ids');
        return;
      }
      const writer = createConditionalApiWriter(turning_on, Api.EVENTS_ROLE);
      Io.writeInt32(writer, event_identifier);
      Io.writeInt32(writer, target_identifier);

      Api.request(writer)
      .then(response => {
        Utilities.throwIfNotOk(response);
        let staff_number_map = Global.data.events_staff_number_map;

        if (turning_on) {
          Global.data.events_roles[event_index].push(target_identifier);
          for (const line of staff_number_map[event_index]) {
            line.push(-1);
          }
          Global.datat.events_roles_requirements[event_index].push([]);
        } else {
          const position = Global.data.events_roles[event_index].indexOf(target_identifier); 
          Global.data.events_roles[event_index].splice(position, 1);
          Global.data.events_roles_requirements[event_index].splice(position, 1);
          for (let line of staff_number_map[event_index]) {
            line.splice(position+2, 1);
          }
        }
        EventInformation.update();
      })
      .catch(error => {
        target.classList.toggle('clicked');
        console.error("fail in [toggle-button:click]", name, error);
      });
      break;
    }
    case Global.zones_identifier.COMPETENCES: {
      const role_ordinal = target.parentElement._data_identifier; 
      const competence_index = Global.data.competences_map.get(target_identifier);
      if (competence_index === undefined || role_ordinal === undefined) {
        console.error('[toggle-button:click] Incorrect event\'s id or role\'s ordinal');
        return;
      }
      const writer = createConditionalApiWriter(turning_on, Api.EVENTS_ROLES_REQUIREMENT);
      Io.writeInt32(writer, event_identifier);
      Io.writeInt32(writer, role_ordinal);
      Io.writeInt32(writer, target_identifier);

      Api.request(writer)
      .then(response => {
        Utilities.throwIfNotOk(response);
        let target_array = Global.data.events_roles_requirements[event_index][role_ordinal];
        if (turning_on) {
          target_array.push(target_identifier);
        } else {
          const position = target_array.indexOf(target_identifier);
          target_array.splice(position, 1);
        }
        EventInformation.update();
      })
      .catch(error => {
        target.classList.toggle('clicked');
        console.error("fail in [toggle-button:click]", name, error);
      });
      break;
    }
  }
});

gcm_instantiate_button.addEventListener('click', () => {
  const target = gcm_instantiate_target;
  const target_identifier = target._data_identifier;
  switch (target.parentElement._identifier) {
    case Global.zones_identifier.EVENT: {
      Calendar.startInstantiating(target._data_identifier);
      break;
    }
    default: {
      console.error('this object is not instantiatable');
      break;
    }
  }
});

function display(local_state, button) {
  button.classList.replace('disp-none', 'disp-block');
  local_state.show = true;
}

function handleClickForContextMenu() {
  let menu = Global.elements.right_click_menu;
  menu.classList.replace('disp-flex', 'disp-none');
  document.removeEventListener('click', handleClickForContextMenu);
  for (const child of menu.children) {
    child.classList.replace('disp-block', 'disp-none');
  }
}

gcm_apply_button.addEventListener('click', () => {
  const target = gcm_apply_target;
  const occurrence_identifier = target._data_identifier;
  const occurrence_index = Global.data.occurrences_map.get(occurrence_identifier);
  if (occurrence_index === undefined) {
    console.error("can't get occurrence index");
    return;
  }
  const event_identifier = Global.data.occurrences_event_identifiers[occurrence_index];
  const event_index = Global.data.events_map.get(event_identifier)
  if (event_identifier === undefined) {
    console.error("can't get event index");
    return;
  }

  const selected_role = new Map();

  for (let i = 0; i < Global.data.events_roles[event_index].length; i++) {
    const role_identifier = Global.data.events_roles[event_index][i];
    const role_requirements = Global.data.events_roles_requirements[event_index][i+1]

    let role_is_available = true;
    for (const req of role_requirements) {
      if (!Global.data.competences.includes(req)) {
        role_is_available = false;
        break;
      }
    }

    if (role_is_available) {
      const role_index = Global.data.roles_map.get(role_identifier);
      if (role_index === undefined) {
        console.error("can't get role index");
        return;
      }
      selected_role.set(role_identifier, role_index);
    }
  }

  const roles = Global.bundleRolesNames();
  roles.map = selected_role;

  const loc_search_display = SearchDisplay.create(
    "Rôles",
    undefined,
    roles,
    false,
  );
  // addinng participant button
  const role_requirements = Global.data.events_roles_requirements[event_index][0];
  let role_is_available = true;
  for (const req of role_requirements) {
    if (!Global.data.competences.includes(req)) {
      role_is_available = false;
      break;
    }
  }
  if (role_is_available) {
    const button = SearchDisplay.createButton(false); 
    button._data_idenetifier = -1;
    Utilities.setNameAndIdentifier(button, "participant", -1);
    loc_search_display._container.appendChild(button);
    loc_search_display._container._button_list.push(button);
  }
  
  const menu = Global.elements.option_menu;
  menu.replaceChildren(loc_search_display);
  menu.style.setProperty('--menu-left', gcm_context_menu_x+'px');
  menu.style.setProperty('--menu-top',  gcm_context_menu_y+'px');
  menu.classList.replace('disp-none', 'disp-flex');
});

document.addEventListener('contextmenu', event => {
  const local_state = { show: false };
  const menu = Global.elements.right_click_menu;
  const target = event.target;

  if (gcm_delete_target = target.closest('.deletable')) {
    display(local_state, gcm_delete_button);
  }
  if (gcm_edit_target = target.closest('.editable')) {
    display(local_state, gcm_edit_button);
  }
  if (gcm_toggle_target = target.closest('.togglable')) {
    display(local_state, gcm_toggle_button);
  }
  if (gcm_extend_target = target.closest('.extendable')) {
    display(local_state, gcm_create_button);
  }
  if (gcm_instantiate_target = target.closest('.instantiatable')) {
    display(local_state, gcm_instantiate_button);
  }
  if (gcm_apply_target = target.closest('.appliable')) {
    display(local_state, gcm_apply_button);
  }

  if (local_state.show) {
    event.preventDefault();
    menu.classList.replace('disp-none', 'disp-flex');
    menu.style.setProperty('--menu-left', event.clientX + 'px');
    menu.style.setProperty('--menu-top', event.clientY + 'px');
    gcm_context_menu_x = event.clientX;
    gcm_context_menu_y = event.clientY;
    document.addEventListener('click', handleClickForContextMenu);
  }
});
