package main

// ============================================================
// 🔤 فحوصات خطوط الملصق
// ============================================================
// ⚠️⚠️ الخطر الأساسي هنا مش "بيشتغل ولا لأ" — ده **الانفصال**.
// نفس الخطوط متخزّنة في مكانين (مجلد النظام fonts/ ومجلد البرنامج
// helper/fonts/) لأن go:embed مابيقدرش يطلع بره مجلد الموديول.
// ولو الاتنين فرقوا، المستخدم بيظبط الشكل في المصمّم وبيطبع من
// النظام بخط تاني — والمعاينة بتبقى بتكدب وهو مش واخد باله.

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// ============================================================
// ⭐⭐⭐⭐⭐ ملفات الخط لازم تبقى **مطابقة** للي في النظام
// ============================================================
func TestFontsMatchSystem(t *testing.T) {
	for _, f := range labelFonts {
		if f.Family == "" {
			continue
		}
		for _, w := range f.Weights {
			for _, sub := range []string{"arabic", "latin"} {
				name := fmt.Sprintf("%s-%s-%d.woff2", f.Slug, sub, w)

				mine, err := fontFiles.ReadFile("fonts/" + name)
				if err != nil {
					t.Fatalf("%s: مش متحفور في البرنامج: %v", name, err)
				}
				theirs, err := os.ReadFile(filepath.Join("..", "fonts", name))
				if err != nil {
					t.Fatalf("%s: مش موجود في مجلد النظام: %v", name, err)
				}
				if !bytes.Equal(mine, theirs) {
					t.Fatalf("%s: النسختين مش متطابقتين — انسخ المجلد تاني", name)
				}
				// ⚠️ وملف woff2 حقيقي مش نص فاضي أو HTML خطأ اتحفظ
				// بالغلط: الأربع حروف الأولى لازم تبقى wOF2.
				if len(mine) < 4 || string(mine[:4]) != "wOF2" {
					t.Fatalf("%s: مش ملف woff2 سليم", name)
				}
			}
		}
	}
}

// ============================================================
// ⭐⭐⭐⭐⭐ قايمة الخطوط لازم تطابق النظام معرّفًا بمعرّف
// ============================================================
// ⚠️ لو البرنامج عرض خط النظام مايعرفهوش، المستخدم هيختاره ويظبط
// عليه وهيتحفظ — وأول ما النظام يقرا التصميم مش هيعرف يرسم بيه.
func TestFontListMatchesSystem(t *testing.T) {
	src, err := os.ReadFile(filepath.Join("..", "js", "label-font.js"))
	if err != nil {
		t.Fatalf("مش لاقي js/label-font.js: %v", err)
	}
	// ⚠️ بنقص كتلة LABEL_FONTS بس. الملف كله فيه كلمة family كذا مرة
	// تانية (في بناء الـ@font-face مثلًا)، ولو قرينا الملف كله الفحص
	// بيقع على حاجة مالهاش علاقة ويضيّع وقت اللي بيدوّر.
	all := string(src)
	a := strings.Index(all, "const LABEL_FONTS = [")
	if a < 0 {
		t.Fatal("مش لاقي LABEL_FONTS في js/label-font.js")
	}
	b := strings.Index(all[a:], "\n];")
	if b < 0 {
		t.Fatal("كتلة LABEL_FONTS مش مقفولة")
	}
	block := all[a : a+b]

	ids := regexp.MustCompile(`id:\s*'([^']+)'`).FindAllStringSubmatch(block, -1)
	fams := regexp.MustCompile(`family:\s*'([^']*)'`).FindAllStringSubmatch(block, -1)
	if len(ids) != len(labelFonts) {
		t.Fatalf("عدد الخطوط مختلف: النظام %d والبرنامج %d", len(ids), len(labelFonts))
	}
	if len(fams) != len(labelFonts) {
		t.Fatalf("عدد أسماء العائلات مختلف: %d مقابل %d", len(fams), len(labelFonts))
	}
	for i, f := range labelFonts {
		if ids[i][1] != f.ID {
			t.Fatalf("الخط رقم %d: النظام '%s' والبرنامج '%s'", i, ids[i][1], f.ID)
		}
		if fams[i][1] != f.Family {
			t.Fatalf("%s: اسم العائلة مختلف — النظام '%s' والبرنامج '%s'", f.ID, fams[i][1], f.Family)
		}
	}
}

// ============================================================
// ⭐⭐⭐⭐ كل رابط في fonts.css له ملف موجود فعلًا
// ============================================================
// ⚠️ الرابط المكسور بيفشل **في سكوت**: المتصفح بيرسم بخط الجهاز
// ومفيش أي رسالة — يعني المعاينة بتوري خط والورق بيطلع بخط تاني.
func TestFontCSSLinksAllResolve(t *testing.T) {
	css := fontFaceCSS()
	urls := regexp.MustCompile(`url\('([^']+)'\)`).FindAllStringSubmatch(css, -1)
	if len(urls) == 0 {
		t.Fatal("مافيش ولا رابط خط في fonts.css")
	}
	for _, u := range urls {
		name := strings.TrimPrefix(u[1], "/fonts/")
		rec := httptest.NewRecorder()
		handleFontFile(rec, httptest.NewRequest(http.MethodGet, u[1], nil))
		if rec.Code != http.StatusOK {
			t.Fatalf("%s: الكود %d — الرابط مكسور", name, rec.Code)
		}
		if rec.Header().Get("Content-Type") != "font/woff2" {
			t.Fatalf("%s: نوع غلط %q", name, rec.Header().Get("Content-Type"))
		}
	}
	// ⚠️ والمقطع العربي لازم يبقى على ملفات العربي بس — لو اتحط على
	// اللاتيني كمان، الأرقام هتدوّر على ملف مافيهوش أرقام.
	if strings.Count(css, "unicode-range") != len(urls)/2 {
		t.Fatalf("المقطع العربي مش على نص الملفات: %d من %d", strings.Count(css, "unicode-range"), len(urls))
	}
}

// ⚠️ وأي مسار تاني لازم يترفض — الملفات بتتفلتر من القايمة نفسها
// مش من اللي المستخدم بعته.
func TestFontFileRejectsAnythingElse(t *testing.T) {
	for _, bad := range []string{
		"/fonts/../main.go",
		"/fonts/qrcode-generator.js",
		"/fonts/cairo-arabic-999.woff2",
		"/fonts/",
	} {
		rec := httptest.NewRecorder()
		handleFontFile(rec, httptest.NewRequest(http.MethodGet, bad, nil))
		if rec.Code == http.StatusOK {
			t.Fatalf("%s: اتقدّم وهو المفروض يترفض", bad)
		}
	}
}

// ============================================================
// ⭐⭐⭐⭐ الخط جزء من التصميم — بيتحفظ وبيترجع
// ============================================================
func TestDesignKeepsFont(t *testing.T) {
	d := defaultDesign()
	d.Font = "tajawal"
	if err := validateDesign(&d); err != nil {
		t.Fatalf("خط معروف اترفض: %v", err)
	}
	if d.Font != "tajawal" {
		t.Fatalf("الخط اتغيّر: %s", d.Font)
	}
}

// ⚠️ التصميم القديم (من نسخة قبل الخطوط) مافيهوش الحقل ده خالص —
// ومايصحّش يبقى فجأة "غير صالح". بيتملّى بخط الجهاز.
func TestDesignWithoutFontFillsSystem(t *testing.T) {
	d := defaultDesign()
	d.Font = ""
	if err := validateDesign(&d); err != nil {
		t.Fatalf("تصميم من غير خط اترفض: %v", err)
	}
	if d.Font != defaultFontID {
		t.Fatalf("مااتملّاش بخط الجهاز: %q", d.Font)
	}
}

// ⚠️⚠️ واسم خط مش معروف **بيترفض** مش بيتجاهل: لو سكتنا عليه،
// التصميم هيتحفظ وهو بيقول "خط كذا" والملصق هيطلع بخط تاني.
func TestDesignRejectsUnknownFont(t *testing.T) {
	d := defaultDesign()
	d.Font = "خط مخترع"
	if err := validateDesign(&d); err == nil {
		t.Fatal("خط مش معروف عدّى")
	}
}

// ⭐ والقايمة بتتقدّم للصفحة بشكل تقدر تقراه
func TestFontsJSONIsUsable(t *testing.T) {
	rec := httptest.NewRecorder()
	handleFontsJSON(rec, httptest.NewRequest(http.MethodGet, "/fonts.json", nil))
	var out struct {
		Fonts []labelFont `json:"fonts"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("الرد مش JSON مفهوم: %v", err)
	}
	if len(out.Fonts) != len(labelFonts) {
		t.Fatalf("عدد ناقص: %d", len(out.Fonts))
	}
	// ⚠️ أول واحد لازم يبقى "خط الجهاز": هو الافتراضي، ولازم يبقى
	// أول اختيار في القايمة مش مدفون في النص.
	if out.Fonts[0].ID != defaultFontID || out.Fonts[0].Family != "" {
		t.Fatalf("الأول مش خط الجهاز: %+v", out.Fonts[0])
	}
	for _, f := range out.Fonts {
		if f.Label == "" || f.Hint == "" {
			t.Fatalf("%s: ناقص اسم أو وصف", f.ID)
		}
	}
}

// ⭐⭐ وصفحة المصمّم بتحمّل الخطوط وفيها خانة الاختيار
func TestDesignerHasFontPicker(t *testing.T) {
	for _, want := range []string{
		`<link rel="stylesheet" href="/fonts.css">`,
		`id="dfont"`,
		"/fonts.json",
		"ensureFont",
		"fontStack()",
	} {
		if !strings.Contains(designerPage, want) {
			t.Fatalf("المصمّم مافيهوش: %s", want)
		}
	}
}
