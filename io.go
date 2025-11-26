package main

import(
	"io"
	"encoding/binary"
	"fmt"
)

func writeString(w io.Writer, s string) error {
	l := int32(len(s))
	if err := binary.Write(w, binary.LittleEndian, l); err != nil {
		return err
	}
	_, err := w.Write([]byte(s))
	return err
}

func writeInt32(w io.Writer, val int32) error {
	if err := binary.Write(w, binary.LittleEndian, val); err != nil {
		return fmt.Errorf("failed to write int32 value: %w", err)
	}
	return nil
}

func writeArray[T any](w io.Writer, arr []T, writeT func(io.Writer, T) error) error {
	n := int32(len(arr))
	if err := binary.Write(w, binary.LittleEndian, n); err != nil {
		return fmt.Errorf("failed to write array length: %w", err)
	}

	for i, item := range arr {
		if err := writeT(w, item); err != nil {
			return fmt.Errorf("failed to write element %d: %w", i, err)
		}
	}
	return nil
}

func writeStringArray(w io.Writer, arr []string) error {
	return writeArray(w, arr, writeString)
}

func writeInt32Array(w io.Writer, arr []int32) error {
	return writeArray(w, arr, writeInt32)
}

func writeArrayOfInt32Arrays(w io.Writer, arr [][]int32) error {
	return writeArray(w, arr, writeInt32Array)
}

func writeApplicationState(w io.Writer, state ApplicationState) error {
	if err := writeStringArray(w, state.EventNames); err != nil {
		return fmt.Errorf("failed to write EventNames: %w", err)
	}

	if err := writeArrayOfInt32Arrays(w, state.EventStaff); err != nil {
		return fmt.Errorf("failed to write EventStaff: %w", err)
	}

	if err := writeArrayOfInt32Arrays(w, state.EventVenues); err != nil {
		return fmt.Errorf("failed to write EventVenues: %w", err)
	}

	if err := writeStringArray(w, state.StaffNames); err != nil {
		return fmt.Errorf("failed to write StaffNames: %w", err)
	}

	if err := writeStringArray(w, state.VenueNames); err != nil {
		return fmt.Errorf("failed to write VenueNames: %w", err)
	}

	return nil
}

func readString(r io.Reader) (string, error) {
	var l int32
	if err := binary.Read(r, Endianness, &l); err != nil {
		return "", fmt.Errorf("failed to read string length: %w", err)
	}
	if l < 0 {
		return "", fmt.Errorf("string length is negative: %d", l)
	}
	
	buffer := make([]byte, l)
	n, err := io.ReadFull(r, buffer)
	if err != nil {
		return "", fmt.Errorf("failed to read string content: %w", err)
	}
	return string(buffer[:n]), nil
}

func readInt32(r io.Reader) (int32, error) {
	var val int32
	if err := binary.Read(r, Endianness, &val); err != nil {
		return 0, fmt.Errorf("failed to read int32 value: %w", err)
	}
	return val, nil
}

func readArray[T any](r io.Reader, readT func(io.Reader) (T, error)) ([]T, error) {
	var n int32
	if err := binary.Read(r, Endianness, &n); err != nil {
		return nil, fmt.Errorf("failed to read array length: %w", err)
	}
	if n < 0 {
		return nil, fmt.Errorf("array length is negative: %d", n)
	}
	
	N := int(n)
	retval := make([]T, N)
	
	for i := 0; i < N; i++ {
		item, err := readT(r)
		if err != nil {
			return nil, fmt.Errorf("failed to read element %d: %w", i, err)
		}
		retval[i] = item
	}
	
	return retval, nil
}

func readStringArray(r io.Reader) ([]string, error) {
	return readArray(r, readString)
}

func readInt32Array(r io.Reader) ([]int32, error) {
	return readArray(r, readInt32)
}

func readArrayOfInt32Arrays(r io.Reader) ([][]int32, error) {
	return readArray(r, readInt32Array)
}

func readApplicationState(r io.Reader) (*ApplicationState, error) {
	state := &ApplicationState{}
	var err error

	if state.EventNames, err = readStringArray(r); err != nil {
		return nil, fmt.Errorf("failed to read EventNames: %w", err)
	}

	if state.EventStaff, err = readArrayOfInt32Arrays(r); err != nil {
		return nil, fmt.Errorf("failed to read EventStaff: %w", err)
	}

	if state.EventVenues, err = readArrayOfInt32Arrays(r); err != nil {
		return nil, fmt.Errorf("failed to read EventVenues: %w", err)
	}

	if state.StaffNames, err = readStringArray(r); err != nil {
		return nil, fmt.Errorf("failed to read StaffNames: %w", err)
	}

	if state.VenueNames, err = readStringArray(r); err != nil {
		return nil, fmt.Errorf("failed to read VenueNames: %w", err)
	}

	return state, nil
}
