import { callbacks } from './global_state.js';

let state = {
  parent_target: null,
  target: null,
};

function handleClickForContextMenu() {
  let menu = elms.rightClickMenu;
  menu.classList.replace('disp-flex', 'disp-none');
  document.removeEventListener('click', handleClickForContextMenu);
  if (callbacks.showInfo.obj && callbacks.showInfo.func) {
    callbacks.showInfo.obj.removeEventListener('click', callbacks.showInfo.func);
  }
  callbacks.showInfo = { func: null, obj: null };
  for (const child of menu.children) {
    child.classList.replace('disp-block', 'disp-none');
  }
}

function postString(url, str) {
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

function handleAddToList(target, placeholder, url, storage) {
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

document.getElementById('new-member-button').addEventListener('click', function() {
  handleAddToList(elms.nameList, 'Nouveau Agent', '/store/agent', data.staffNames);
});

document.getElementById('new-venue-button').addEventListener('click', function() {
  handleAddToList(elms.venueList, 'Nouveau Lieu', '/store/venue', data.venueNames);
});

document.getElementById('edit-button').addEventListener('click', function() {
  let b = state.target;
  numInput.elm.value = b.textContent;
  b.replaceWith(numInput.elm);
  numInput.elm.focus();

  const _eventId = zones[zonesId.EVENTLIST].selection;
  let dataArray = null;
  let idx = -1;

  if (b.id === 'event-duration') {
    numInput.endOfWriting = () => {
      const _eventId = zones[zonesId.EVENTLIST].selection;
      if (numInput.elm.value === '') {
        b.textContent = '\u00A0';
        data.eventDuration[_eventId] = -1;
        function localCallback() {
          b.replaceWith(numInput.elm);
          numInput.elm.focus();
          numInput.endOfWriting = () => { endOfWriting() };
        }
        function endOfWriting() {
          const _eventId = zones[zonesId.EVENTLIST].selection;
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
      const _eventId = zones[zonesId.EVENTLIST].selection;
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
          const _eventId = zones[zonesId.EVENTLIST].selection;
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
  state.target.remove();
  let idx = state.target._dIdx*3;
  let dataarr = data.eventPersonalNumMap[zones[zonesId.EVENTLIST].selection];
  let list = document.getElementById('event-staff-number-map');
  let btns = list.querySelectorAll('button');
  for (let i = idx+3; i<dataarr.length; i += 3) {
    btns[i-3]._dIdx -= 3;
    btns[i-2]._dIdx -= 3;
    btns[i-1]._dIdx -= 3;
    dataarr[i-3] = dataarr[i];
    dataarr[i-2] = dataarr[i+1];
    dataarr[i-1] = dataarr[i+2];
  }
  dataarr.length -= 3;
});

document.getElementById('create-button').addEventListener('click', () => {
  const target = state.target;
  const button = target._createButton();
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = target._btnPlaceholder;
  button.appendChild(input);
  target.appendChild(button);
  input.focus();

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = input.value;
      input.remove();
      button.textContent = value;
      target._storage.push(value);
      // postString(url, value);
    } else if (e.key === 'Escape') {
      button.remove();
    }
  });
});

document.getElementById('toggle-button').addEventListener('click', () => {
  state.target.classList.toggle('clicked');
});

document.getElementById('new-event-button').addEventListener('click', 
  function() {
    let menu = elms.sideMenu;
    let new_button = document.createElement('button');
    new_button.classList.add('event-button');
    new_button.textContent = "Nouvel Événement";
    menu.appendChild(new_button);

    const rect = new_button.getBoundingClientRect();
    menu = document.getElementById('create-option-menu');
    menu.classList.replace('disp-none', 'disp-flex');
    menu.style.setProperty('--menu-left', rect.right + 'px');
    menu.style.setProperty('--menu-top', rect.top + 'px');

    let input = menu.querySelectorAll('input')[0];
    input.focus();

    state.focusedElement = new_button; // @nocheckin
    callbacks.handleTyping.func = function(event) {
      if (event.target.value === "") {
        new_button.textContent = "Nouvel Événement";
      } else {
        new_button.textContent = event.target.value;
      }
    };

    input.addEventListener('input', callbacks.handleTyping.func);
    callbacks.handleTyping.obj = input;
  });

document.addEventListener('contextmenu', function(e) {
  const menu = elms.rightClickMenu;
  let show = true;
  let target = null;
  if (elms.sideMenu.contains(e.target)) {
    document.getElementById('new-event-button').classList.replace('disp-none', 'disp-block');
  } else if (elms.nameList.contains(e.target)) {
    document.getElementById('new-member-button').classList.replace('disp-none', 'disp-block');
  } else if (elms.venueList.contains(e.target)) {
    document.getElementById('new-venue-button').classList.replace('disp-none', 'disp-block');
  } else if (e.target.classList.contains('editable')) {
    document.getElementById('edit-button').classList.replace('disp-none', 'disp-block');
    state.target = e.target;
  } else if (target = e.target.closest('.deletable')) { 
    document.getElementById('delete-button').classList.replace('disp-none', 'disp-block');
    state.target = target;
  } else {
    show = false;
  }

  if (e.target.classList.contains('editable')) {
    document.getElementById('edit-button').classList.replace('disp-none', 'disp-block');
    state.target = e.target;
    show = true;
  }

  if (e.target.classList.contains('togglable')) {
    document.getElementById('toggle-button').classList.replace('disp-none', 'disp-block');
    state.target = e.target;
    show = true;
  }

  if (state.parent_target = e.target.closest('.extendable')) {
    document.getElementById('create-button').classList.replace('disp-none', 'disp-block');
    state.target = e.target;
    show = true;
  }

  for (const button of elms.sideMenu.children) { // @nocheckin, ??
    if (button.contains(e.target)) {
      show = true;
      let infoButton = document.getElementById('info-event-button');
      infoButton.classList.replace('disp-none', 'disp-block');
      callbacks.showInfo = { func: showInfo(button), obj: infoButton };
      infoButton.addEventListener('click', callbacks.showInfo.func);
      break;
    }
  }

  if (show) {
    e.preventDefault();
    menu.classList.replace('disp-none', 'disp-flex');
    menu.style.setProperty('--menu-left', e.clientX + 'px');
    menu.style.setProperty('--menu-top', e.clientY + 'px');
    document.addEventListener('click', handleClickForContextMenu);
  }
});
