package main

// ============================================================
// 🗂 شكل الصفحة بعد التابات — التجارب
// ============================================================
// ⚠️⚠️ الشرطين اللي اتفقنا عليهم قبل ما التابات تتعمل أصلًا:
//
//	١) زرار «احفظ الإعدادات» يفضل **تحت وثابت** في كل تاب
//	٢) الحاجات اللي بتتحفظ لوحدها تفضل بتتحفظ لوحدها
//
// ولو واحد منهم اتكسر، ده **مش** عيب شكلي: الأول معناه إن حد
// يظبّط طابعة ويدوّر على الحفظ ومايلاقيهوش، والتاني معناه إن حد
// يعلّم على مفتاح ويمشي ويفتكره اتحفظ.

import (
	"strings"
	"testing"
)

// بتقسّم الصفحة لكروت: كل كارت بيبدأ بسطر مسافة واحدة + <div class="card
func pageCards() []string {
	parts := strings.Split(testPage, "\n <div class=\"card")
	out := []string{}
	for i, p := range parts {
		if i == 0 {
			continue
		}
		// الكارت بينتهي عند أول " </div>" على نفس المسافة
		if j := strings.Index(p, "\n </div>"); j >= 0 {
			out = append(out, p[:j])
		} else {
			out = append(out, p)
		}
	}
	return out
}

// ============================================================
// ⭐⭐⭐ زرار الحفظ بره التابات
// ============================================================
func TestSaveButtonIsOutsideEveryTab(t *testing.T) {
	for _, c := range pageCards() {
		if !strings.Contains(c, `id="save"`) {
			continue
		}
		if strings.Contains(c, "data-tab=") {
			t.Fatalf("زرار الحفظ وقع جوه تاب — هيختفي لما تبدّل:\n%s", c[:min(300, len(c))])
		}
		return
	}
	t.Fatal("مالقيتش زرار الحفظ في الصفحة خالص")
}

// ============================================================
// ⭐⭐⭐ كل التابات الخمسة موجودة وكل واحد فيه حاجة
// ============================================================
// ⚠️ تاب فاضي أسوأ من تاب مش موجود: بتدوس عليه وتلاقي بياض ومش
// عارف ده عطل ولا كده المفروض.
func TestEveryTabExistsAndHasContent(t *testing.T) {
	want := []string{"printer", "label", "products", "logs", "app"}
	for _, name := range want {
		if !strings.Contains(testPage, `data-go="`+name+`"`) {
			t.Fatalf("مافيش زرار تاب اسمه %q", name)
		}
		if !strings.Contains(testPage, `data-tab="`+name+`"`) {
			t.Fatalf("تاب %q مالوش ولا كارت — هيفتح فاضي", name)
		}
	}
	// ومافيش كارت محتواه نساه بره كل التابات
	for _, c := range pageCards() {
		if !strings.Contains(c, "sec-title") {
			continue // الترويسة وزرار الحفظ
		}
		if !strings.Contains(c, "data-tab=") {
			t.Fatalf("كارت فيه قسم ومش تابع لأي تاب — مش هيبان خالص:\n%s", c[:min(200, len(c))])
		}
	}
}

// ============================================================
// ⭐⭐⭐ اللي كان بيتحفظ لوحده لسه بيتحفظ لوحده
// ============================================================
// ⚠️⚠️ دي أخطر حاجة ممكن تتكسر في إعادة ترتيب: المفاتيح دي مالهاش
// دعوة بزرار الحفظ، وكل واحد فيهم بيبعت بنفسه أول ما تعلّم عليه.
func TestAutoSavingSwitchesStillSaveThemselves(t *testing.T) {
	selfSavers := map[string]string{
		"auto":    "/autostart",     // يشتغل مع الويندوز
		"opensys": "/settings",      // ويفتح النظام كمان
		"pf-auto": "/products/file", // الرفع التلقائي
		"pf-path": "/products/file", // مسار ملف الأصناف
	}
	for id, endpoint := range selfSavers {
		// لازم يكون عليه onchange بيبعت بنفسه
		if !strings.Contains(testPage, `document.getElementById('`+id+`').onchange`) &&
			!strings.Contains(testPage, id2js(id)+".onchange") {
			t.Fatalf("المفتاح %q مابقاش بيتحفظ لوحده", id)
		}
		if !strings.Contains(testPage, endpoint) {
			t.Fatalf("المفتاح %q مابقاش بينده على %s", id, endpoint)
		}
	}
	// ⚠️ وتصاميم الأنواع كمان — بتتحفظ أول ما تختار
	if !strings.Contains(testPage, "'/design/role'") {
		t.Fatal("اختيار تصميم النوع مابقاش بيتحفظ لوحده")
	}
}

// الأسماء اللي متخزّنة في متغيّر بدل نداء مباشر
func id2js(id string) string {
	switch id {
	case "pf-auto":
		return "pfAuto"
	case "pf-path":
		return "pfPath"
	}
	return id
}

// ============================================================
// ⭐⭐ التاب الأول هو «الطابعة»
// ============================================================
func TestPrinterTabIsTheDefault(t *testing.T) {
	i := strings.Index(testPage, `data-go="printer"`)
	if i < 0 {
		t.Fatal("مافيش تاب الطابعة")
	}
	seg := testPage[i:min(i+120, len(testPage))]
	if !strings.Contains(seg, `aria-selected="true"`) {
		t.Fatalf("تاب الطابعة مش هو اللي بيفتح: %s", seg)
	}
	if !strings.Contains(testPage, "saved='printer'") {
		t.Fatal("الرجوع الافتراضي مش على الطابعة")
	}
}

// ============================================================
// ⭐⭐⭐ فتح التاب المحفوظ لازم يفضل آخر سطر في السكربت
// ============================================================
// ⚠️⚠️ عطل اتقاس في متصفح حقيقي: showTab كانت بتتنده من أول
// السكربت، وهي بتلمس متغيّرات معرّفة بـconst تحت — فطلعت 14
// ReferenceError، وتاب الطابعة بيفتح من غير ما يسأل عن الطابور،
// وتاب السجلات بيفضل فاضي.
func TestTabIsOpenedAtTheVeryEndOfTheScript(t *testing.T) {
	open := strings.LastIndex(testPage, "showTab(saved)")
	if open < 0 {
		t.Fatal("مافيش فتح للتاب المحفوظ")
	}
	// آخر حاجة بتتعرّف في السكربت لازم تكون **قبله**
	for _, decl := range []string{"const qOut=", "const sheetsBox=", "const pfPath="} {
		if i := strings.Index(testPage, decl); i < 0 || i > open {
			t.Fatalf("%q اتعرّف بعد فتح التاب — هيطلّع ReferenceError", decl)
		}
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
