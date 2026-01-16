import { callbacks, elms } from './global_state.js';
import { BufferReader, BufferWriter } from './io.js';
import { zones, zonesId, listId, scopeId } from './global_state.js';
import { storageIndex, deleteValue, deleteOccurrences } from './data_manager.js';
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
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = placeholder;
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

document.getElementById('edit-button').addEventListener('click', function() {
  let b = state.edit_target;
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
        data.eventPersonalNumMap[_eventId][b._dIdx] = -1;
        function localCallback() {
          b.replaceWith(numInput.elm);
          numInput.elm.focus();
          numInput.endOfWriting = () => { endOfWriting() };
        }
        function endOfWriting() {
          numInput.elm.replaceWith(b);
          const _eventId = zones[zonesId.EVENTLIST].selection._dataId;
          if (numInput.elm.value === '') {
            data.eventPersonalNumMap[_eventId][b._dIdx] = -1;
            return;
          }
          b.textContent = numInput.elm.value;
          data.eventPersonalNumMap[_eventId][b._dIdx] = Number(numInput.elm.value);
          b.classList.add('editable');
          b.removeEventListener('click', localCallback);
        }
        b.addEventListener('click', localCallback);
      } else {
        b.textContent = numInput.elm.value;
        data.eventPersonalNumMap[_eventId][b._dIdx] = Number(b.textContent);
      }
      numInput.elm.replaceWith(b);
    };
  }
});


document.getElementById('delete-button').addEventListener('click', function() {
  const id = state.delete_target._dataId;
  if (id == undefined) { throw new Error('undefined delete target data id'); }
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
    case listId.NUMMAP_LINE:
      Api.writeHeader(w, Api.DELETE, Api.EVENTS_PERSONAL_NUM_MAP_ID);
      w.writeInt32(zones[zonesId.EVENTLIST].selection._dataId);
      break;
    default:
      state.delete_target.classList.remove('disp-none');
      throw new Error('incorrect delete target type');
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
        deleteOccurrences(data.eventsRole, id);
        EventInfo.update();
        break;
      default:
        throw new Error('incorrect delete target type');
    }
    state.delete_target.remove();
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

      let w = new BufferWriter();
      Api.writeHeader(w, Api.CREATE, api);
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
      const inputName = document.createElement('input');
      inputName.type = 'text';
      inputName.placeholder = 'Prenom';
      const inputSurname = document.createElement('input');
      inputSurname.type = 'text';
      inputSurname.placeholder = 'Nom';
      const inputMatricule = document.createElement('input');
      inputMatricule.type = 'text';
      inputMatricule.placeholder = 'Matricule';
      inputMatricule.classList = 'dynamic-bg';
      inputMatricule.addEventListener('input', () => {
        inputMatricule.value = Utils.digitise(inputMatricule.value);
      });

      function save() {
        const name = inputName.value;
        const surname = inputSurname.value;
        const matricule = Number(inputMatricule.value);

        if (data.usersId.has(Number(matricule))) {
          Utils.setBgColor(inputMatricule, palette.red);
          return;
        }

        SideManu.setUserButton(b, name, surname, matricule);

        let w = new BufferWriter();
        Api.writeHeader(w, Api.CREATE, Api.USERS_ID_MAP_ID);
        w.writeInt32(mat);
        w.writeString(name);
        w.writeString(surname);

        inputName.remove();
        inputSurname.remove();
        inputMatricule.remove();
        SideMenu.setClickCallback(b, zonesId.STAFFLIST);
        Api.request(w)
          .then(resp => {
            if (!resp.ok) {
              throw new Error(`HTTP error! status: ${resp.status}`);
              return;
            }
          })
          .catch( e => {
            b.remove();
            console.error("Could not store ", name, e);
          });
      }

      inputName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          if (inputName.value !== '' &&
            inputSurname.value !== '' &&
            inputMatricule.value !== '') {
            e.preventDefault();
            save();
          }
          inputSurname.focus();
        } else if (e.key === 'Escape') {
          b.remove();
        }
      });
      inputSurname.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          if (inputName.value !== '' &&
            inputSurname.value !== '' &&
            inputMatricule.value !== '') {
            e.preventDefault();
            save();
          }
          inputMatricule.focus();
        } else if (e.key === 'Escape') {
          b.remove();
        }
      });
      inputMatricule.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          if (inputName.value !== '' &&
            inputSurname.value !== '' &&
            inputMatricule.value !== '') {
            e.preventDefault();
            save();
          }
        } else if (e.key === 'Escape') {
          b.remove();
        }
      });
      target.appendChild(b);
      b.appendChild(inputName);
      b.appendChild(inputSurname);
      b.appendChild(inputMatricule);
      inputName.focus();
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
      const input = document.createElement('input');
      input.className = 'dynamic-bg';
      input.type = 'text';
      input.placeholder = 'Nouveau Rôle';
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

        if (turning_on) { data.eventsRole[idx].push(role_id); }
        else { data.eventsRole[idx] = data.eventsRole[idx].filter(x => x !== role_id); }
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
