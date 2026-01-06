import { callbacks, elms } from './global_state.js';
import { BufferWriter } from './io.js';
import { zonesId, listId, scopeId } from './global_state.js';
import * as Api from './api.js';
import { deleteValue, deleteOccurrences } from './data_manager.js';
import { setUserButton, handleClickOnListButton } from './side_menu.js';

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

function postString(url, str) { // @nocheckin
  let writer = new BufferWriter();
  writer.writeString(str);
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
    },
    body: writer.getBuffer(),
  })
    .then(resp => {
      if (!resp.ok) {
        throw new Error(`HTTP error! status: ${resp.status}`);
      }})
    .catch(e => {
      console.error(`Error: ${e}`);
    });
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
      postString(url, value);
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
  switch (state.delete_target.parentElement._id) {
    case listId.STAFF:
      Api.writeHeader(w, Api.Op.DELETE, Api.StateField.USERS_ID_MAP_ID);
      w.writeInt32(Number(state.target._dataId));
      break;

    default:
      throw new Error('incorrect delete target type');
  }
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
  switch (state.delete_target.parentElement._id) {
    case listId.STAFF:
      deleteValue(data.usersId, data.usersFreeList, id);
      deleteOccurrences(data.occurrencesParticipant, id);
      break;

    default:
    throw new Error('incorrect delete target type');
  }
  state.delete_target.remove();
});

function createListButtonWithInput(zone_id, btnPlaceholder, target) {
  let b = document.createElement('button');
  b.className = 'side-menu-list-button dynamic_bg deletable editable';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = btnPlaceholder;
  target.appendChild(b);
  b.appendChild(input);
  input.focus();
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = input.value;
      input.remove();
      b.textContent = value;
      target._store(value);
      b.addEventListener('click', function (){
        handleClickOnListButton(b, zone_id);
        if (zones[zone_id].selection._dataId >= 0 &&
          zones[zonesId.VIEWTYPE].selection._dataId === viewId.INFORMATION) {
          EventInfo.update();
        }
      });
    } else if (e.key === 'Escape') {
      b.remove();
    }
  });
}

document.getElementById('create-button').addEventListener('click', () => {
  switch (state.extend_target._id) {
    case listId.EVENT:
      createListButtonWithInput(zonesId.EVENTLIST, 'Nouvel Événement', elms.scope[scopeId.EVENT]);
      break;
    case listId.STAFF:
      const target = elms.scope[scopeId.STAFF];
      let b = document.createElement('button');
      b.className = 'side-menu-list-button dynamic_bg deletable editable';
      const inputName = document.createElement('input');
      inputName.type = 'text';
      inputName.placeholder = 'Prenom';
      const inputSurname = document.createElement('input');
      inputSurname.type = 'text';
      inputSurname.placeholder = 'Nom';
      const inputMatricule = document.createElement('input');
      inputMatricule.type = 'text';
      inputMatricule.placeholder = 'Matricule';
      inputMatricule.classList = 'dynamic_bg';
      inputMatricule.style.setProperty('--bg-color', 'transparent');
      inputMatricule.addEventListener('input', () => {
        inputMatricule.value = inputMatricule.value.replace(/\D/g, '');
      });

      function save() {
        const name = inputName.value;
        const surname = inputSurname.value;
        const matricule = Number(inputMatricule.value);

        if (data.usersId.has(Number(matricule))) {
          inputMatricule.style.setProperty('--bg-color', palette.red);
          return;
        }

        setUserButton(b, name, surname, matricule);

        let w = new BufferWriter();
        Api.writeHeader(w, Api.Op.CREATE, Api.StateField.USERS_ID_MAP_ID);
        Api.writeCreateUserMapEntry(w, name, surname, matricule); 

        inputName.remove();
        inputSurname.remove();
        inputMatricule.remove();
        b.addEventListener('click', function (){
          handleClickOnListButton(b, zonesId.STAFFLIST);
          if (zones[zonesId.STAFFLIST].selection._dataId >= 0 &&
            zones[zonesId.VIEWTYPE].selection._dataId === viewId.INFORMATION) {
            EventInfo.update();
          }
        });

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
    case listId.VENUE:
      createListButtonWithInput(zonesId.VENUELIST, 'Nouveau Lieu', elms.scope[scopeId.VENUE]);
      break;
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
