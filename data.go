package main

import(
  "slices"
)

func isSorted(arr []int) bool {
  for i := 1; i < len(arr); i++ {
    if arr[i] < arr[i-1] {
      return false
    }
  }
  return true
}

func newEntry(m map[int32]int, freeList *[]int, freeId *[]int32) (int32, int) {
  id := newId(m, freeId)
  index := storageIndex(m, freeList)
  m[id] = index
  return id, index
}

func newId(m map[int32]int, freeId *[]int32) int32 {
	if len(*freeId) > 0 {
    id := (*freeId)[len(*freeId)-1]
    *freeId = (*freeId)[:len(*freeId)-1]
    return id
	} else {
		return int32(len(m))
	}
}

func storageIndex[K, V comparable](m map[K]V, freeList *[]int) int {
	if len(*freeList) > 0 {
    index := (*freeList)[len(*freeList)-1]
		*freeList = (*freeList)[:len(*freeList)-1]
    return index
	} else {
		return len(m)
	}
}

func storeValue[T any](array *[]T, index int, value T) {
	if index >= 0 && index < len(*array) {
		(*array)[index] = value
	} else {
		*array = append(*array, value)
	}
}

func sortedInsert(sorted_slice []int, value int) []int {
  grown_slice := slices.Grow(sorted_slice, 1)
  grown_slice = grown_slice[:len(grown_slice)+1]

  i := len(grown_slice)-2
  for i >= 0 && grown_slice[i] > value {
    grown_slice[i+1] = grown_slice[i]
    i--
  }
  grown_slice[i+1] = value
  return grown_slice
}

func deleteToken(m map[[32]byte]int, freeList *[]int, token [32]byte) {
  index, exists := m[token]
  if exists {
    *freeList = sortedInsert(*freeList, index)
    delete(m, token)
  }
}

func deleteValue(m map[int32]int, freeId *[]int32, freeList *[]int, id int32) {
  index, exists := m[id]
  if exists {
    if freeId != nil {
      *freeId = append(*freeId, id)
    }
    *freeList = sortedInsert(*freeList, index)
    delete(m, id) 
  }
}

// we may want to do hashing here
func rebaseMap[K comparable](m map[K]int, freeList []int) {
  if len(freeList) == 0 {
    return
  }
  for key, index := range m {
    count := 0
    for count < len(freeList) && freeList[count]<index {
      count++
    }
    m[key] -= count
  }
}


// Asume that free list is sorted in ascending order
func shrinkArray[T any](array_p *[]T, free_list []int) {
  number_of_items_freed := 0
  for ;number_of_items_freed < len(free_list); number_of_items_freed++ {
    var shift_region_limit int
    free_index := free_list[number_of_items_freed]
    if free_index >= len(*array_p) {
      break
    }
    shift_by := number_of_items_freed+1
    shift_target_index := free_list[number_of_items_freed]-number_of_items_freed

    if number_of_items_freed == len(free_list)-1 {
      shift_region_limit = len(*array_p)-shift_by
    } else {
      shift_region_limit = min(
        len(*array_p)-shift_by,
        free_list[number_of_items_freed+1]-shift_by,
      )
    }

    for ; shift_target_index < shift_region_limit; shift_target_index++ {
      (*array_p)[shift_target_index] = (*array_p)[shift_target_index+shift_by]
    }
  }
  *array_p = (*array_p)[:len(*array_p)-number_of_items_freed]
}

func getById[K, T comparable](id K, m map[K]int, a []T) (T, bool) {
  var retval T
  index, exists := m[id]
  if exists {
    retval = a[index] 
  }
  return retval, exists
}

func filterVal[T comparable](arr *[]T, val T) {
  writeIdx := 0
  for _, item := range *arr {
    if item != val {
      (*arr)[writeIdx] = item
      writeIdx++
    }
  }
  (*arr) = (*arr)[:writeIdx]
}

func filterIdx[T any](arr *[]T, index int) {
  if index < 0 || index >= len(*arr) {
    return
  }
  for i := index; i < len(*arr)-1; i++ {
    (*arr)[i] = (*arr)[i+1];
  }
  (*arr) = (*arr)[:len(*arr)-1]
}

func deleteOccurrences(arr [][]int32, val int32) {
	for i := range arr {
    filterVal(&arr[i], val)
	}
}
