//go:build !windows

package main

import "errors"

func autostartEnabled() bool     { return false }
func setAutostart(on bool) error { return errors.New("مدعوم على الويندوز بس") }
