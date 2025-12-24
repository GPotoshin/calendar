package main

func storageIndex[T any](array []T, freeList []int32) int32 {
	if len(freeList) > 0 {
		return freeList[len(freeList)-1]
	} else {
		return len(array)
	}
}

func storeValue[T any](array *[]T, freeList []int32, value T) {
	if len(*freeList) > 0 {
		index := freeList[len(*freeList)-1]
		(*array)[index] = value
	} else {
		*array = append(*array, value)
	}
}

func popFreeList(freeList *[]int32) {
	if len(*freeList) > 0 {
		*freeList = (*freeList)[:len(*freeList)-1]
  }
}

func deleteValue[K any](m map[K]int32, freeList *[]int32, id K) {
	*freeList = append(*freeList, m[id])
  delete(m, id)
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
