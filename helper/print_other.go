//go:build !windows

package main

// ============================================================
// بديل للتجربة على غير الويندوز
// ============================================================
// ⚠️ ده **مش** مسار حقيقي — موجود عشان نقدر نفحص كل الباقي (التحويل،
// الخادم، الأمان) من غير ويندوز. البرنامج اللي بيتسلّم للمحل بيتبني
// لويندوز، والملف ده مابيدخلش فيه أصلًا (build tag).

import (
	"fmt"
	"os"
	"path/filepath"
)

func openBrowser(url string) {}

func fixConsoleEncoding() {}

func listPrinters() ([]string, error) {
	return []string{"جهاز-تجريبي"}, nil
}

// بتكتب البايتات في ملف بدل الطابعة، عشان الفحص يقدر يقراها.
func printRaw(printer string, data []byte, jobName string) error {
	dir := os.Getenv("TAZWEED_HELPER_OUT")
	if dir == "" {
		return fmt.Errorf("الطباعة مدعومة على الويندوز بس")
	}
	return os.WriteFile(filepath.Join(dir, "job.bin"), data, 0o644)
}
