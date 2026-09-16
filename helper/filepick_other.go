//go:build !windows

package main

import "errors"

// ⚠️ الشاشة دي بتاعة الويندوز. على غيره بنقول السبب بدل ما نفشل
// بخطأ غامض — والخانة اللي بتتكتب بالإيد فاضلة شغّالة.
func pickFileDialog(startDir string) (string, error) {
	return "", errors.New("اختيار الملف من شاشة الويندوز شغّال على الويندوز بس — الزق المسار في الخانة")
}
