package main

// ============================================================
// 📦 اللي اترفع لازم يطابق اللي اتكتب
// ============================================================
// ⚠️⚠️ العطل اللي الفحص ده اتعمل عشانه، اتبلّغ بالنص:
//
//	"المساعد كاتب انه علي اخر نسخة ✅ انت على آخر نسخة (1.12.0)"
//
// وكان صح: رقم النسخة في المصدر اتغيّر لـ1.13.0، لكن **الملف اللي
// بيتنزّل مااتبناش تاني**. فالبرنامج بيقرا helper/dist/VERSION من
// جيت هاب، بيلاقي 1.12.0، وبيقول "انت على آخر نسخة" — وهو صادق.
//
// النتيجة: المستخدم بيتقاله "حمّل النسخة الجديدة" ومافيش نسخة جديدة
// موجودة أصلًا. ومافيش حاجة في النظام كانت بتمسك ده — الفحوص كلها
// كانت بتقرا المصدر، ومحدش بيبص على اللي **اترفع**.
//
// فالفحص ده بيربط التلاتة ببعض: رقم النسخة في الكود، والرقم في ملف
// النشر، وبصمة الملف اللي هينزل فعلًا.

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"strings"
	"testing"
)

func readPublished(t *testing.T) (ver, sum string) {
	t.Helper()
	b, err := os.ReadFile("dist/VERSION")
	if err != nil {
		t.Fatalf("مافيش dist/VERSION: %v", err)
	}
	f := strings.Fields(string(b))
	if len(f) < 2 {
		t.Fatalf("dist/VERSION شكله غريب: %q", string(b))
	}
	return f[0], strings.ToLower(f[1])
}

// ⚠️ ده اللي كان هيمسك العطل: الرقم في الكود غير الرقم المرفوع.
func TestPublishedVersionMatchesSource(t *testing.T) {
	ver, _ := readPublished(t)
	if ver != version {
		t.Fatalf("الكود على %s والمرفوع على %s — ابني الملف تاني وحدّث dist/VERSION\n"+
			"  cd helper && GOOS=windows GOARCH=amd64 GOFLAGS=-mod=vendor go build -ldflags=\"-s -w\" -o dist/tazweed-helper.exe .",
			version, ver)
	}
}

// ⚠️⚠️ والبصمة كمان: البرنامج بيتأكد منها قبل ما يستبدل نفسه (شوف
// applyUpdate). لو البصمة قديمة، التحديث بيقف عند **كل** جهاز ويقول
// "الملف اللي نزل مش مطابق" — وده أسوأ من إنه مايشوفش تحديث أصلًا.
func TestPublishedChecksumMatchesBinary(t *testing.T) {
	_, want := readPublished(t)
	b, err := os.ReadFile("dist/tazweed-helper.exe")
	if err != nil {
		t.Fatalf("مافيش dist/tazweed-helper.exe: %v", err)
	}
	h := sha256.Sum256(b)
	got := hex.EncodeToString(h[:])
	if got != want {
		t.Fatalf("البصمة مش مطابقة للملف:\n  في VERSION: %s\n  الملف نفسه: %s", want, got)
	}
}

// ⚠️ والملف لازم يكون **ويندوز** فعلًا: بناء بالغلط على لينكس بيطلّع
// ملف بيتنزّل عادي ومابيشتغلش، والمستخدم بيدوّر على السبب في مكان تاني.
func TestPublishedBinaryIsWindows(t *testing.T) {
	f, err := os.Open("dist/tazweed-helper.exe")
	if err != nil {
		t.Fatalf("مافيش الملف: %v", err)
	}
	defer f.Close()
	head := make([]byte, 2)
	if _, err := f.Read(head); err != nil {
		t.Fatalf("مش قادر أقرا: %v", err)
	}
	if head[0] != 'M' || head[1] != 'Z' {
		t.Fatalf("مش ملف ويندوز — أول بايتين %q مش MZ", head)
	}
}
