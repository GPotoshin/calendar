package main

func storageIndex[K, V comparable](m map[K]V, freeList []int) int {
	if len(freeList) > 0 {
		return freeList[len(freeList)-1]
	} else {
		return len(m)
	}
}

func storeValue[T any](array *[]T, freeList []int, value T) {
	if len(freeList) > 0 {
		index := freeList[len(freeList)-1]
		(*array)[index] = value
	} else {
		*array = append(*array, value)
	}
}

func popFreeList(freeList *[]int) {
	if len(*freeList) > 0 {
		*freeList = (*freeList)[:len(*freeList)-1]
  }
}

func deleteValue[K comparable](m map[K]int, freeList *[]int, id K) {
	*freeList = append(*freeList, m[id])
  delete(m, id)
}

func rebaseMap[K comparable](m map[K]int, freeList []int) {
  for key, idx := range m {
    count := 0
    for count < len(freeList) && freeList[count]<idx {
      count++
    }
    m[key] -= count
  }
}

func shrinkArray[K comparable](a *[]K, freeList []int) {
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
