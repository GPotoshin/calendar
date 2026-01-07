package main

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

func shrinkArray[K any](a *[]K, freeList []int) {
  for i := 0; i < len(freeList); i++ {
    var limit int
    if i == len(freeList)-1 {
      limit = len(*a)-1-i;
    } else {
      limit = freeList[i+1]-1-i
    }

    for j := freeList[i]-i; j < limit; j++ {
      (*a)[j] = (*a)[j+1+i]
    }
  }
  *a = (*a)[:len(*a)-len(freeList)]
}

func getById[K, T comparable](id K, m map[K]int, a []T) (T, bool) {
  var retval T
  idx, exists := m[id]
  if exists {
    retval = a[idx] 
  }
  return retval, exists
}

func deleteOccurrences(array *[][]int32, value int32) {
	for i := range *array {
		temp := (*array)[i][:0]
		for _, arrayValue := range (*array)[i] {
			if arrayValue != value {
				temp = append(temp, arrayValue)
			}
		}
		(*array)[i] = temp
	}
}
