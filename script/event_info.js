import { tmpls, scopeId } from './global_state.js';
import * as SearchDisplay from './search_display.js';


function createStaffTable() {
  let table = document.createElement('div');
  table.classList.add('v-container', 'align-items-center');

  const columnWidth = 125;
  const list = ["Participants", "Formateur", "Responsable Pedagogique", "Assistant"];

  table.innerHTML = `
    <h3 class="txt-center">Nomber de</h3>

    <div class="h-container with-width">
    </div>

    <div class="m-box v-container with-width">
    <div id="event-staff-number-map" class="v-container scrollable-box disp-flex grow scroll-smooth bordered">
    </div>
    </div>
    `;
  
  function createLocalHeader(name) {
    let retval = document.createElement('div');
    retval.className = 'disp-flex grow half-wide justify-content-center';
    let header = document.createElement('h4');
    header.className = 'txt-center';
    header.textContent = name;
    retval.append(header);
    return retval;
  }

  // let container = table.children[1];
  // container.style.setProperty('--width', (columnWidth*(list.length+1)) + 'px');
  // for (let name of list) {
  //   container.append(createLocalHeader(name));
  // }
  //
  // container = table.children[2];
  // container.style.setProperty('--width', (columnWidth*(list.length+1)) + 'px');
  
  return table;
}

function createCompetencesTable() {
  let table = document.createElement('div');
  table.classList.add('v-container', 'align-items-center');
  table.innerHTML = `
    <div class="v-container align-items-center">
    <h3 class="txt-center">Competences de</h3>

    <div class="js-set h-container align-items-center">
    </div>
    `;

  const container = table.querySelector('.js-set');

  // const baseWidth = 125; 
  container.append(SearchDisplay.create('Participant', 'Nouvelle Compétence'));
  for (let name of data.rolesName) {
    container.append(SearchDisplay.create(name, data.rolesName, 'Nouvelle Compétence'));// @nocheckin
  }

  return table;
}

function createFooterOptions() {
  let footer = document.createElement('div');
  footer.className = 'h-container';
  footer.innerHTML = `
    <div class="row-selection">
    Durée: <button id="event-duration" class="hover std-min no-padding txt-center tiny-button">\u00A0</button>d
    </div>
    `;
  return footer;
}

export function loadTemplate() {
  fetch('html/event_info')
  .then(resp => {
    if (!resp.ok) {
      throw new Error('cannot fetch "html/event_info.html"');
    }
    resp.text()
    .then(txt => {
      console.log(txt);
      const fragment = document.createRange().createContextualFragment(txt);
      tmpls[scopeId.EVENT].append(fragment);
    })
  })
  .catch(err => {
    console.error("Could not load event_info", err);
  });
}

function createTemplateLine() {
  let line = document.createElement('div');
  line.className = 'h-container align-items-center wide';
  line.innerHTML = tmplHTML
  return line;
}

export function update() { // @working
  // scoped functions
  const tmplHTML = `
    <div class="disp-flex grow half-wide justify-content-center bottom-right-border">
    <div class="with-padding">de <button class="std-min hover no-padding txt-center tiny-button"></button> à <button class="std-min hover no-padding txt-center tiny-button"></button></div>
    </div>
    <div class="disp-flex grow half-wide bottom-border">
    <div class="with-padding"><button class="hover std-min no-padding txt-center tiny-button"> </button></div>
    </div>
    `;

  function createTemplateLine() {
    let line = document.createElement('div');
    line.className = 'h-container align-items-center wide';
    line.innerHTML = tmplHTML;
    return line;
  }

  function addEmptyLine(parent) {
    let line = createTemplateLine();
    const btns = line.querySelectorAll('button');
    const btnsCallbacks = [];
    function endOfWriting(b) {
      b.textContent = numInput.elm.value || '\u00A0';
      numInput.elm.replaceWith(b);

      let dataIsSet = true;
      for (let _b of btns) {
        if (_b.textContent == '\u00A0') {
          dataIsSet = false;
          break;
        }
      };
      if (dataIsSet) {
        line.classList.add('deletable');
        let dataArray = data.eventsPersonalNumMap[zones[zonesId.EVENTLIST].selection];
        line._dIdx = dataArray.length/3;
        for (let j = 0; j < btns.length; j++) {
          btns[j]._dIdx = dataArray.length;
          dataArray.push(Number(btns[j].textContent));
          btns[j].classList.add('editable');
          btns[j].removeEventListener('click', btnsCallbacks[j]);
        }
        addEmptyLine(parent);
      }
    }
    btns.forEach(b => {
      b.textContent = '\u00A0'; // '\u00A0' is an empty space with non zero size
      b.className = 'std-min hover no-padding txt-center tiny-button';

      function localCallback() {
        b.replaceWith(numInput.elm);
        numInput.elm.focus();
        numInput.endOfWriting = () => { endOfWriting(b) };
      }
      btnsCallbacks.push(localCallback);
      b.addEventListener('click', localCallback);
    });

    parent.appendChild(line);
  }

  // actual function code
  const zone = zones[zonesId.EVENTLIST];
  if (zone.selection == -1) { // we need to show general setting
    return;
  }
  const event_id = zone.eList[zone.selection]._dIdx;
  let list = document.getElementById('event-staff-number-map');
  list.innerHTML = '';

  const _eventId = zones[zonesId.EVENTLIST].selection;

  let dataArray = data.eventsPersonalNumMap[_eventId];
  if (dataArray === undefined) {
    dataArray = [];
    data.eventsPersonalNumMap[_eventId] = [];
  }
  for (let i = 0; i < dataArray.length;) {
    let line = createTemplateLine();
    line._dIdx = Math.floor(i/3);
    const btns = line.querySelectorAll('button');
    for (let j = 0; j < btns.length; j++) {
      let b = btns[j];
      b._dIdx = i;
      b.textContent = dataArray[i++];
    };
    list.appendChild(line);
  }
  addEmptyLine(list);

  let duration = data.eventsDuration[_eventId];
  if (duration === undefined) {
    data.eventsDuration[_eventId] = -1;
    duration = -1;
  }

  let b = document.getElementById('event-duration');
  if (duration === -1) {
    b.textContent = '\u00A0';

    function localCallback() {
      b.replaceWith(numInput.elm);
      numInput.elm.focus();
      numInput.endOfWriting = () => { endOfWriting() };
    }
    function endOfWriting() {
      numInput.elm.replaceWith(b);
      const _eventId = zones[zonesId.EVENTLIST].selection;
      if (numInput.elm.value === '') {
        data.eventsDuration[_eventId] = -1;
        return;
      }
      b.textContent = numInput.elm.value;
      data.eventsDuration[_eventId] = Number(numInput.elm.value);
      b.classList.add('editable');
      b.removeEventListener('click', localCallback);
    }
    b.addEventListener('click', localCallback);
  } else {
    b.textContent = duration;
    b.classList.add('editable');
  }
}
