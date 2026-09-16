//go:build !windows

package main

// ⚠️ على غير الويندوز بنرجّع "مش مدعوم" بصراحة بدل ما نرجّع صفر —
// الصفر معناه "التعريف مابلّغش مشكلة"، ودي كدبة على لينكس.
func readPrinterState(name string) printerState {
	return printerState{Name: name, Supported: false}
}
