package main

// ============================================================
// 🩺 ترجمة حالة الطابعة
// ============================================================
// ⚠️⚠️ أخطر حاجة هنا مش "بيقرا ولا لأ" — **الصفر**. الصفر معناه إن
// التعريف مابلّغش حاجة، ومش معناه إن الطابعة تمام. ولو خلطنا
// الاتنين، النظام هيقول "كله كويس" والرول خارج.

import (
	"strings"
	"testing"
)

func TestZeroIsNotAPromiseThatEverythingIsFine(t *testing.T) {
	st := describePrinterStatus("P", 0, 0)
	if st.Blocking || len(st.Problems) > 0 {
		t.Fatalf("الصفر اتترجم لمشكلة: %+v", st)
	}
	msg := st.Summary()
	// ⚠️ الرسالة **لازم** تقول إنه مش ضمان — مش "الطابعة تمام".
	if strings.Contains(msg, "تمام") && !strings.Contains(msg, "مش معناه") {
		t.Fatalf("الرسالة بتوعد بحاجة مش مضمونة: %s", msg)
	}
	// ⚠️ لازم تقول صراحةً إن **التعريف** هو اللي مابلّغش — مش إن
	// الطابعة كويسة.
	if !strings.Contains(msg, "بلاغ") || !strings.Contains(msg, "التعريف") {
		t.Fatalf("الرسالة مش بتقول إن التعريف مابلّغش: %s", msg)
	}
}

// ⭐⭐⭐ المشاكل اللي بتمنع الطباعة لازم تتمسك كلها
func TestBlockingProblemsAreDetected(t *testing.T) {
	cases := map[string]uint32{
		"الورق خلص":   0x00000010,
		"الورق اتزنق": 0x00000008,
		"الغطا مفتوح": 0x00400000,
		"مقفولة":      0x00000080,
	}
	for label, bit := range cases {
		st := describePrinterStatus("P", bit, 0)
		if !st.Blocking {
			t.Fatalf("%s: مااتحسبتش مانعة (raw=%d)", label, bit)
		}
		if !strings.Contains(st.Summary(), label) {
			t.Fatalf("%s: الرسالة مش بتقولها — %s", label, st.Summary())
		}
	}
}

// ⚠️ و"بتطبع دلوقتي" **مش** مشكلة — لو اتحسبت مانعة، كل طبعة تانية
// في نفس اللحظة هتترفض.
func TestBusyIsNotAProblem(t *testing.T) {
	st := describePrinterStatus("P", 0x00000400|0x00000100, 2)
	if st.Blocking || len(st.Problems) > 0 {
		t.Fatalf("الانشغال اتحسب مشكلة: %+v", st)
	}
	if len(st.Busy) == 0 {
		t.Fatal("الانشغال مااتسجّلش خالص")
	}
}

// ⚠️ وكذا مشكلة مع بعض بيتقالوا كلهم — مش أول واحدة بس.
func TestReportsEveryProblem(t *testing.T) {
	st := describePrinterStatus("P", 0x00000010|0x00400000, 0)
	if len(st.Problems) != 2 {
		t.Fatalf("قال %d مشكلة بس: %+v", len(st.Problems), st.Problems)
	}
}

// ⚠️⚠️ وعلى غير الويندوز بيقول **مش مدعوم** بدل ما يقول صفر: الصفر
// على لينكس كدبة، مش "مافيش بلاغ".
func TestUnsupportedSaysSoPlainly(t *testing.T) {
	st := printerState{Name: "P", Supported: false}
	if !strings.Contains(st.Summary(), "مايقدرش") {
		t.Fatalf("الرسالة مش واضحة: %s", st.Summary())
	}
}
