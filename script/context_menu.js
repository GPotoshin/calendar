import { callbacks, elms } from './global_state.js';
import { BufferWriter } from './io.js';
import { listId } from './global_state.js';
import * as Api from './api.js';
import { deleteValue, deleteOccurrences } from './data_manager.js';

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

document.getElementById('create-button').addEventListener('click', () => {
  state.target._create();
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
