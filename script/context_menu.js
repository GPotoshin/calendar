import { callbacks, elms } from './global_state.js';
import { BufferReader, BufferWriter } from './io.js';
import { zones, zonesId, listId, scopeId } from './global_state.js';
import { storageIndex, deleteValue, deleteOccurrences, storeValue } from './data_manager.js';
import * as Api from './api.js';
import * as SideMenu from './side_menu.js';
import * as Utils from './utils.js';
import * as SearchDisplay from './search_display.js';
import * as EventInfo from './event_info.js';
import { numInput } from './num_input.js';

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

function handleAddToList(target, placeholder, url, storage) { // @nocheckin
  const button = document.createElement('button');
  const input = Utils.createTextInput(placeholder);
  button.appendChild(input);
  target.appendChild(button);
  input.focus();

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = input.value;
      input.remove();
      button.textContent = value;
      storage.push(value);
      button.addEventListener('click', () => {
        this.classList.toggle('clicked');
      });

      button.className = 'hover';
    } else if (e.key === 'Escape') {
      input.remove();
    }
  });
}

function createUserDataInputs() {
  const retval = {
    name:      Utils.createTextInput('Prenom'),
    surname:   Utils.createTextInput('Nom'),
    matricule: Utils.createTextInput('Matricule'),
  };
  retval.matricule.classList = 'dynamic-bg';
  retval.matricule.addEventListener('input', () => {
    retval.matricule.value = Utils.digitise(retval.matricule.value);
  });
  return retval;
}

function isEscOrSaveOnEnter(e, b, inputs, op, next = null, old = null) {
  if (e.key === 'Enter') {
    if (inputs.name.value !== '' &&
      inputs.surname.value !== '' &&
      inputs.matricule.value !== '') {
      e.preventDefault();
      const name = inputs.name.value;
      const surname = inputs.surname.value;
      const matricule = Number(inputs.matricule.value);

      switch (op) {
        case Api.CREATE:
          if (data.usersId.has(matricule)) {
            Utils.setBgColor(inputs.matricule, palette.red);
            return;
          }
          break;
        case Api.UPDATE:
          if (matricule !== old.matricule && data.usersId.has(matricule)) {
            Utils.setBgColor(inputs.matricule, palette.red);
            return;
          }
          break;
        default:
          console.error('unsupported user data save mode');
          return;
      }

      let w = Api.createBufferWriter(op, Api.USERS_ID_MAP_ID);
      if (op === Api.UPDATE) {
        if (!old || !old.matricule) {
          console.error('undefined old matricule');
          return;
        }
        w.writeInt32(old.matricule);
      }
      SideMenu.setUserButton(b, name, surname, matricule);
      w.writeInt32(matricule);
      w.writeString(name);
      w.writeString(surname);

      inputs.name.remove();
      inputs.surname.remove();
      inputs.matricule.remove();
      SideMenu.setClickCallback(b, zonesId.STAFFLIST);
      switch (op) {
        case Api.CREATE:
          Api.request(w)
            .then(resp => {
              if (!resp.ok) {
                throw new Error(`HTTP error! status: ${resp.status}`);
                return;
              }
              let idx = storageIndex(data.usersId, data.usersFreeList);
              data.usersId.set(matricule, idx);
              storeValue(data.usersName, idx, name);
              storeValue(data.usersSurname, idx, name);
            })
            .catch( e => {
              b.remove();
              console.error("Could not store ", name, e);
            });
          break;
        case Api.UPDATE:
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
            })
            .catch( e => {
              SideMenu.setUserButton(b, old.name, old.surname, old.matricule);
              console.error("Could not store ", name, e);
            });
          break;
      }
    }
    if (next) { next.focus(); }
    return false;
  } else if (e.key === 'Escape') {
    return true;
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
    case listId.STAFF:
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
      inputs.matrucule.value = old.matricule;
      inputs.name.addEventListener('keydown', (e) => {
        if (isEscOrSaveOnEnter(e, b, inputs, Api.CREATE, null, old)) {
          SideMenu.setUserButton(b, old.name, old.surname, old.matricule);
        }
      });
      inputs.surname.addEventListener('keydown', (e) => {
        if (isEscOrSaveOnEnter(e, b, inputs, Api.CREATE, null, old)) {
          SideMenu.setUserButton(b, old.name, old.surname, old.matricule);
        }
      });
      inputs.matricule.addEventListener('keydown', (e) => {
        if (isEscOrSaveOnEnter(e, b, inputs, Api.CREATE, null, old)) {
          SideMenu.setUserButton(b, old.name, old.surname, old.matricule);
        }
      });
      b.replaceChildren(inputs.name, inputs.surname, inputs.matricule);
      break;
  }
  numInput.elm.value = b.textContent;
  b.replaceWith(numInput.elm);
  numInput.elm.focus();

  const _eventId = zones[zonesId.EVENTLIST].selection._dataId;
  let dataArray = null;
  let idx = -1;

  if (b.id === 'event-duration') {
    numInput.endOfWriting = () => {
      const _eventId = zones[zonesId.EVENTLIST].selection._dataId;
      if (numInput.elm.value === '') {
        b.textContent = '\u00A0';
        data.eventDuration[_eventId] = -1;
        function localCallback() {
          b.replaceWith(numInput.elm);
          numInput.elm.focus();
          numInput.endOfWriting = () => { endOfWriting() };
        }
        function endOfWriting() {
          const _eventId = zones[zonesId.EVENTLIST].selection._dataId;
          numInput.elm.replaceWith(b);
          if (numInput.elm.value === '') {
            data.eventDuration[_eventId] = -1;
            return;
          }
          b.textContent = numInput.elm.value;
          data.eventDuration[_eventId] = Number(numInput.elm.value);
          b.classList.add('editable');
          b.removeEventListener('click', localCallback);
        }
        b.addEventListener('click', localCallback);
      } else {
        b.textContent = numInput.elm.value;
        data.eventDuration[_eventId] = Number(b.textContent);
      }
      numInput.elm.replaceWith(b);
    };
  } else { // @nocheckin: we should probably set a special class on a button or somewhat like that
    numInput.endOfWriting = () => {
      const _eventId = zones[zonesId.EVENTLIST].selection._dataId;
      if (numInput.elm.value === '') {
        b.textContent = '\u00A0';
        data.eventPersonalNumMap[_eventId][b._dataId] = -1;
        function localCallback() {
          b.replaceWith(numInput.elm);
          numInput.elm.focus();
          numInput.endOfWriting = () => { endOfWriting() };
        }
        function endOfWriting() {
          numInput.elm.replaceWith(b);
          const _eventId = zones[zonesId.EVENTLIST].selection._dataId;
          if (numInput.elm.value === '') {
            data.eventPersonalNumMap[_eventId][b._dataId] = -1;
            return;
          }
          b.textContent = numInput.elm.value;
          data.eventPersonalNumMap[_eventId][b._dataId] = Number(numInput.elm.value);
          b.classList.add('editable');
          b.removeEventListener('click', localCallback);
        }
        b.addEventListener('click', localCallback);
      } else {
        b.textContent = numInput.elm.value;
        data.eventPersonalNumMap[_eventId][b._dataId] = Number(b.textContent);
      }
      numInput.elm.replaceWith(b);
    };
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
    case listId.STAFF:
      Api.writeHeader(w, Api.DELETE, Api.USERS_ID_MAP_ID);
      break;
    case listId.VENUE:
      Api.writeHeader(w, Api.DELETE, Api.VENUES_ID_MAP_ID);
      break;
    case listId.EVENT:
      Api.writeHeader(w, Api.DELETE, Api.EVENTS_ID_MAP_ID);
      break;
    case listId.EVENT_STAFF:
      Api.writeHeader(w, Api.DELETE, Api.ROLES_ID_MAP_ID);
      break;
    case listId.NUMMAP:
      Api.writeHeader(w, Api.DELETE, Api.EVENTS_PERSONAL_NUM_MAP_ID);
      w.writeInt32(zones[zonesId.EVENTLIST].selection._dataId);
      break;
    default:
      state.delete_target.classList.remove('disp-none');
      throw new Error('delete_target\'s parent should have `_id` property with a value from `listId`');
  }
  w.writeInt32(Number(id));
  Api.request(w)
  .then(resp => {
    if (!resp.ok) {
      throw new Error(`HTTP error! status: ${resp.status}`);
    }
    switch (state.delete_target.parentElement._id) {
      case listId.STAFF:
        deleteValue(data.usersId, data.usersFreeList, id);
        deleteOccurrences(data.occurrencesParticipant, id);
        break;
      case listId.VENUE:
        deleteValue(data.venuesId, data.venuesFreeList, id);
        deleteOccurrences(data.eventsVenues, id);
        break;
      case listId.EVENT:
        deleteValue(data.eventsId, data.eventsFreeList, id);
        break;
      case listId.EVENT_STAFF: // we should here remove the button from a backing array
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
      case listId.NUMMAP:
        data.eventsPersonalNumMap[zones[zonesId.EVENTLIST].selection._dataId].splice(Number(id), 1)
        EventInfo.update();
        break;
      default:
        throw new Error('that listId does not support local storage');
    }
  })
  .catch(e => {
    state.delete_target.classList.remove('disp-none');
    console.error("Could not delete ", e);
    return;
  });
});

function setStandardInputCallback(b, input, api, map, arr, freeList, zone_id) {
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = input.value;
      for (const [id, idx] of map) {
        if (arr[idx] === val) {
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
          let idx = storageIndex(map, freeList);
          map.set(id, idx);
          arr[idx] = val;
          b.textContent = '';
          Utils.setNameAndId(b, val, id);
        });
      })
      .catch(e => {
        b.remove();
        console.error("Could not store ", val, e);
      });
      SideMenu.setClickCallback(b, zone_id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      b.remove();
    }
  });
}

function createEventOrVenue(placeholder, api, map, arr, freeList, zone_id) {
  let b = SideMenu.createButtonTmpl();
  const input = Utils.createTextInput(placeholder)
  b.appendChild(input);
  state.extend_target.appendChild(b);
  input.focus();
  setStandardInputCallback(b, input, api, map, arr, freeList, zone_id);
}

document.getElementById('create-button').addEventListener('click', () => {
  switch (state.extend_target._id) {
    case listId.EVENT: {
      createEventOrVenue(
        'Nouvel Événement',
        Api.EVENTS_ID_MAP_ID,
        data.eventsId,
        data.eventsName,
        data.eventsFreeList,
        zonesId.EVENTLIST,
      );
      break;
    }
    case listId.STAFF: {
      const target = elms.scope[scopeId.STAFF];
      let b = SideMenu.createButtonTmpl(); 
      const inputs = createUserDataInputs();
      inputs.name.addEventListener('keydown', (e) => {
        if (isEscOrSaveOnEnter(e, b, inputs, Api.CREATE, inputs.surname)) {
          b.remove();
        }
      });
      inputs.surname.addEventListener('keydown', (e) => {
        if (isEscOrSaveOnEnter(e, b, inputs, Api.CREATE, inputs.matricule)) {
          b.remove();
        }
      });
      inputs.matricule.addEventListener('keydown', (e) => {
        if (isEscOrSaveOnEnter(e, b, inputs, Api.CREATE)) {
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
    case listId.VENUE: {
      createEventOrVenue(
        'Nouveau Lieu',
        Api.VENUES_ID_MAP_ID,
        data.venuesId,
        data.venuesName,
        data.venuesFreeList,
        zonesId.VENUELIST,
      );
      break;
    }
    case listId.EVENT_STAFF: {
      let b = SearchDisplay.createButton();
      const input = Utils.createTextInput('Nouveau Rôle');
      input.className = 'dynamic-bg';
      b.appendChild(input);
      state.extend_target.appendChild(b);
      input.focus();

      setStandardInputCallback(
        b,
        input,
        Api.ROLES_ID_MAP_ID,
        data.rolesId,
        data.rolesName,
        data.rolesFreeList,
        zonesId.NONE,
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
    case listId.EVENT_STAFF:
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
