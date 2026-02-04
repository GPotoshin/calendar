package main

func isSorted(arr []int) bool {
  for i := 1; i < len(arr); i++ {
    if arr[i] < arr[i-1] {
      return false
    }
  }
  return true
}

func newId[K, V comparable](m map[K]V, freeId *[]int32) int32 {
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
    idx := (*freeList)[len(*freeList)-1]
		*freeList = (*freeList)[:len(*freeList)-1]
    return idx
	} else {
		return len(m)
	}
}

func storeValue[T any](array *[]T, idx int, value T) {
	if idx >= 0 && idx < len(*array) {
		(*array)[idx] = value
	} else {
		*array = append(*array, value)
	}
}

func deleteToken(m map[[32]byte]int, freeList *[]int, token [32]byte) {
  idx, exists := m[token]
  if exists {
    *freeList = append(*freeList, idx)
    delete(m, token)
  }
}

func deleteValue(m map[int32]int, freeId *[]int32, freeList *[]int, id int32) {
  idx, exists := m[id]
  if exists {
    if freeId != nil {
      *freeId = append(*freeId, id)
    }
    *freeList = append(*freeList, idx)
    delete(m, id) 
  }
}

// we may want to do hashing here
func rebaseMap[K comparable](m map[K]int, freeList []int) {
  if len(freeList) == 0 {
    return
  }
  for key, idx := range m {
    count := 0
    for count < len(freeList) && freeList[count]<idx {
      count++
    }
    m[key] -= count
  }
}

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
  idx, exists := m[id]
  if exists {
    retval = a[idx] 
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

func filterIdx[T any](arr *[]T, idx int) {
  for i := idx; i < len(*arr)-1; i++ {
    (*arr)[i] = (*arr)[i+1];
  }
  (*arr) = (*arr)[:len(*arr)-1]
}

func deleteOccurrences(arr [][]int32, val int32) {
	for i := range arr {
    filterVal(&arr[i], val)
	}
}
