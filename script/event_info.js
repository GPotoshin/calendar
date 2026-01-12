import { listId, zones, zonesId, tmpls, scopeId } from './global_state.js';
import * as SearchDisplay from './search_display.js';
import * as Utils from './utils.js';

const elms = {
  event_role_list: null,
  comp_tables: null,
  numtab_header_list: null,
  numtab_content: null,
};

function createStaffTable() {
  let table = document.createElement('div');
  table.classList.add('v-container', 'align-items-center');
  const columnWidth = 125;

  table.innerHTML = `
    <h3 class="txt-center">Nombre de</h3>
    <div class="h-container with-width align-items-center">
    </div>

    <div class="m-box v-container with-width">
    <div id="event-staff-number-map" class="v-container scrollable-box disp-flex grow scroll-smooth bordered">
    </div>
    </div>
    `;
  

  elms.numtab_header_list = table.children[1];
  elms.numtab_content = table.children[2];
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
  elms.comp_tables = container;

  // const baseWidth = 125; 
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
  tmpls[scopeId.EVENT].innerHTML = `
    <div class="v-container">
    </div>
  `;

  let [sDisplay, container] = SearchDisplay.createAndReturnListContainer('Personel', listId.EVENT_STAFF);
  container._btnList = [];

  for (const [id, idx] of data.rolesId) {
    const name = data.rolesName[idx];
    const b = SearchDisplay.createButton(); 
    Utils.setNameAndId(b, name, id);
    container.appendChild(b);
    container._btnList.push(b);
  }
  elms.event_role_list = container;

  tmpls[scopeId.EVENT].children[0].append(
    sDisplay,
    createStaffTable(),
    createCompetencesTable(),
    createFooterOptions(),
  );
}

export function update() { // @working
  // scoped functions
  const participant_num_field_html = `
    <div class="disp-flex with-width justify-content-center bottom-right-border">
    <div class="with-padding">de <button class="std-min hover no-padding txt-center tiny-button">
    </button> à <button class="std-min hover no-padding txt-center tiny-button"></button>
    </div>
    </div>
    `;
  const staff_num_field_html = `
    <div class="disp-flex with-width bottom-border">
    <div class="with-padding">
    <button class="hover std-min no-padding txt-center tiny-button"></button>
    </div>
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
        let dataArray = data.eventsPersonalNumMap[zones[zonesId.EVENTLIST].selection._dataId];
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
  if (zone.selection == null) { // we need to show general setting
    return;
  }
  const event_id = zone.selection._dataId;
  const event_roles = data.eventsRole[event_id];

  // roles table
  for (const b of elms.event_role_list._btnList) {
    if (event_roles.includes(b._dataId)) {
      b.classList.add('clicked');
    } else {
      b.classList.remove('clicked');
    }
  }

  // numtab
  let width = 125*(event_roles.length+1);
  Utils.setWidthPx(elms.numtab_header_list, width);
  Utils.setWidthPx(elms.numtab_content, width);

  function createLocalHeader(name) {
    let retval = document.createElement('div');
    retval.className = 'disp-flex with-width justify-content-center';
    Utils.setWidthPx(retval, width);
    let header = document.createElement('h4');
    header.className = 'txt-center';
    header.textContent = name;
    retval.append(header);
    return retval;
  }
  // @nocheckin: we will need to merge all those iterations together
  let list = [createLocalHeader('Participant')];
  for (const role_id of event_roles[event_id]) {
    const role_idx = data.rolesId.get(role_id);
    const name = data.rolesName[role_idx];
    list.push(createLocalHeader(name));
  }
  elms.numtab_header_list.replaceChildren(...list);

  const btns_in_line = event_roles.length+2;
  for (let i = 0; i < dataArray.length;) {
    let line = createTemplateLine(event_roles.length);
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

  list = [SearchDisplay.create('Participant', listId.COMPETENCES)];
  for (const role_id of event_roles) {
    const role_idx = data.rolesId.get(role_id);
    const name = data.rolesName[role_idx];
    list.push(SearchDisplay.create(name, listId.COMPETENCES));
  }
  elms.comp_tables.replaceChildren(...list);

  let duration = data.eventsDuration[event_id];
  if (duration === undefined) {
    data.eventsDuration[_eventId] = -1;
    duration = -1;
  }

  let b = tmpls[scopeId.EVENT].querySelector('#event-duration');
  if (duration === -1) {
    b.textContent = '\u00A0';

    function localCallback() {
      b.replaceWith(numInput.elm);
      numInput.elm.focus();
      numInput.endOfWriting = () => { endOfWriting() };
    }
    function endOfWriting() {
      numInput.elm.replaceWith(b);
      const _eventId = zones[zonesId.EVENTLIST].selection._dataId;
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
