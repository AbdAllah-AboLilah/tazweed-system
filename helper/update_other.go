//go:build !windows

package main

import "errors"

func updateSupported() bool { return false }

func restartSelf() error { return errors.New("مدعوم على الويندوز بس") }
