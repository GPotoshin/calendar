package main

func storeValue[T any](array *[]T, freeList *[]int32, value T) int32 {
	if len(*freeList) > 0 {
		index := (*freeList)[len(*freeList)-1]
		*freeList = (*freeList)[:len(*freeList)-1]
		(*array)[index] = value
		return index
	} else {
		*array = append(*array, value)
		return int32(len(*array) - 1)
	}
}

func deleteValue[T comparable](array *[]T, freeList *[]int32, index int32) {
	idx := int(index)
	var zero T
	if (*array)[idx] == zero {
		return
	}

	(*array)[idx] = zero
	*freeList = append(*freeList, index)
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

func getAll[T1 comparable, T2 any](array []T1, composeT func(T1, int)T2) []T2 {
  var zero T1
  var retval []T2
  for i, val := range(array) {
    if val != zero {
      retval = append(retval, composeT(val, i))
    }
  }
  return retval
}
