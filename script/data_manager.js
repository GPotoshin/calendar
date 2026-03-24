import * as Io from './io.js';

export function storageIndex(map, free_list) {
  if (free_list.length > 0) {
    return free_list.pop();
  } else {
    return map.size;
  }
}

export const newId = storageIndex;

export function storeValue(array, index, value) {
  if (index >= 0 && index < array.length) {
    array[index] = value;
  } else {
    array.push(value);
  }
}

function sortedInsert(sorted_array, value_to_insert) {
  let low = 0, high = sorted_array.length;
  
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (sorted_array[mid] < value_to_insert) low = mid + 1;
    else high = mid;
  }
  
  sorted_array.splice(low, 0, value_to_insert);
  return sorted_array;
}

export function deleteValue(map, free_list, identifier) {
  const index = map.get(identifier);
  if (index !== undefined) {
    sortedInsert(free_list, index);
    map.delete(identifier);
  }
  return index;
}

export function rebaseMap(map, free_list) {
  for (let [key, index] of map.entries()) {
    let count = 0;
    while (count < free_list.length && free_list[count] < index) {
      count++;
    }
    map.set(key, index - count);
  }
}

export function shrinkArray(array, free_list) {
  for (let i = 0; i < freeList.length; i++) {
    let limit;
    if (i === free_list.length-1) {
      limit = array.length-1-i;
    } else {
      limit = free_list[i+1]-1-i;
    }

    for (let j = free_list[i]-i; j < limit; j++) {
      array[j] = array[j+1+i];
    }
  }

  array.length = array.length - free_list.length;
}

export function removeAllOf(array, value) {
  for (let i = 0; i < array.length; i++) {
    array[i] = array[i].filter(array_value => array_value !== value);
  }
}

function readEventRole(r) {
  return {
    identifer: Io.readInt32(r),
    requirements: Io.readInt32Array(r),
  };
}

function readEventRoleArray(r) {
  return Io.readArray(r, readEventRole);
}

function readArrayOfEventRoleArray(r) {
  return Io.readArray(r, readEventRoleArray);
}

export class Int32Slice {
  constructor(initialCapacity) {
    this.buffer = new ArrayBuffer(initialCapacity * 4);
    this.view = new Int32Array(this.buffer);
    this.length = 0;
  }

  push(value) {
    if (this.length >= this.view.length) {
      throw new Error('capacity of a slice is exceded');
    }
    this.view[this.length++] = value;
  }

  /**
   * @param {Int32Slice} free_list - Sorted indices to remove
   */
  shrink(free_list) {
    let number_of_items_freed = 0;
    const total_len = this.length;

    for (; number_of_items_freed < free_list.length; number_of_items_freed++) {
      let shift_region_limit;
      const free_index = free_list.view[number_of_items_freed];

      if (free_index >= total_len) {
        break;
      }

      const shift_by = number_of_items_freed + 1;
      let shift_target_index = free_list.view[number_of_items_freed] - number_of_items_freed;

      if (number_of_items_freed === free_list.length - 1) {
        shift_region_limit = total_len - shift_by;
      } else {
        shift_region_limit = Math.min(
          total_len - shift_by,
          free_list.view[number_of_items_freed + 1] - shift_by
        );
      }

      for (; shift_target_index < shift_region_limit; shift_target_index++) {
        this.view[shift_target_index] = this.view[shift_target_index + shift_by];
      }
    }
    this.length -= free_list.length;
  }

  includes(value) {
    const len = this.length;
    const v = this.view;
    
    for (let i = 0; i < len; i++) {
      if (v[i] === value) {
        return true;
      }
    }
    return false;
  }
}
