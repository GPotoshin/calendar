import { callbacks, elms } from './global_state.js';
import { BufferReader, BufferWriter } from './io.js';
import { zones, zonesId, listId, scopeId } from './global_state.js';
import { storageIndex, deleteValue, deleteOccurrences } from './data_manager.js';
import * as Api from './api.js';
import * as SideMenu from './side_menu.js';
import * as Utils from './utils.js';

let state = {
  delete_target: null,
  extend_target: null,
  target: null,
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
  let b = state.target;
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
        data.eventPersonalNumMap[_eventId][b._dIdx] = -1;conte
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
  if (id == undefined) {
    throw new Error('undefined delete target data id');
  }
  let w = new BufferWriter();
  let state_field = -1;
  switch (state.delete_target.parentElement._id) {
    case listId.STAFF:
      state_field = Api.StateField.USERS_ID_MAP_ID;
      break;
    case listId.VENUE:
      state_field = Api.StateField.VENUES_ID_MAP_ID;
      break;
    case listId.EVENT:
      state_field = Api.StateField.EVENTS_ID_MAP_ID;
      break;
    default:
      throw new Error('incorrect delete target type');
  }
  Api.writeHeader(w, Api.Op.DELETE, state_field);
  w.writeInt32(Number(id));
  Api.request(w)
  .then(resp => {
    if (!resp.ok) {
      throw new Error(`HTTP error! status: ${resp.status}`);
    }
  })
  .catch(e => {
    console.error("Could not delete ", e);
    return;
  });
  // we are deleting localy if we succeed to delete on the server
  switch (state.delete_target.parentElement._id) { // fill that switch
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

    default:
    throw new Error('incorrect delete target type');
  }
  state.delete_target.remove();
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
      Api.writeHeader(w, Api.Op.CREATE, api);
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
            map[id] = idx;
            arr[idx] = val;
            b.textContent = '';
            SideMenu.setNameAndId(b, val, id);
          });
        })
        .catch(e => {
          button.remove();
          console.error("Could not store ", name, e);
        });
      SideMenu.setClickCallback(b, zone_id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      b.remove();
    }
  });
}

function createEventOrVenue(placeholder, api, map, arr, freeList, zone_id) {
  let [b, input] = SideMenu.createButtonAndInput(placeholder);
  state.extend_target.appendChild(b);
  setStandardInputCallback(b, input, api, map, arr, freeList, zone_id);
}

document.getElementById('create-button').addEventListener('click', () => {
  switch (state.extend_target._id) {
    case listId.EVENT: {
      createEventOrVenue(
        'Nouvel Événement',
        Api.StateField.EVENTS_ID_MAP_ID,
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
        Api.writeHeader(w, Api.Op.CREATE, Api.StateField.USERS_ID_MAP_ID);
        Api.writeCreateUserMapEntry(w, name, surname, matricule); 

        inputName.remove();
        inputSurname.remove();
        inputMatricule.remove();
        SideMenu.setClickCallback(b, zonesId.STAFFLIST);
        Api.request(w)
          .then(resp => {
            if (!resp.ok) {
              throw new Error(`HTTP error! status: ${resp.status}`);
              b.remove();
              return;
            }
          })
          .catch( e => {
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
        Api.StateField.VENUES_ID_MAP_ID,
        data.venuesId,
        data.venuesName,
        data.venuesFreeList,
        zonesId.VENUELIST,
      );
      break;
    }
    case listId.EVENT_STAFF: {
      let [b, input] = SearchDisplay.createButtonWithInput(); // I'm not sure if it will focus
      state.extend_target.appendChild(b);
      setStandrdInputCallback(
        b,
        input,
        Api.StateField.ROLES_ID_MAP_ID,
        data.rolesId,
        data.rolesName,
        data.rolesFreeList,
        zonesId.NONE,
      );

      break;
    }
    default:
  }
});

document.getElementById('toggle-button').addEventListener('click', () => {
  state.target.classList.toggle('clicked');
});

document.addEventListener('contextmenu', function(e) {
  const menu = elms.rightClickMenu;
  let show = false;
  let target = null;

  state.target = e.target;
  if (state.delete_target = e.target.closest('.deletable')) { 
    document.getElementById('delete-button').classList.replace('disp-none', 'disp-block');
    show = true;
  }

  if (e.target.classList.contains('editable')) {
    document.getElementById('edit-button').classList.replace('disp-none', 'disp-block');
    show = true;
  }

  if (e.target.classList.contains('togglable')) {
    document.getElementById('toggle-button').classList.replace('disp-none', 'disp-block');
    show = true;
  }

  if (state.extend_target = e.target.closest('.extendable')) {
    document.getElementById('create-button').classList.replace('disp-none', 'disp-block');
    show = true;
  }

  if (show) {
    e.preventDefault();
    menu.classList.replace('disp-none', 'disp-flex');
    menu.style.setProperty('--menu-left', e.clientX + 'px');
    menu.style.setProperty('--menu-top', e.clientY + 'px');
    document.addEventListener('click', handleClickForContextMenu);
  }
});
