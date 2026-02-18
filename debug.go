//go:build debug

package main

func assert(condition bool, msg string) {
  if !condition {
    panic(msg)
  }
}
