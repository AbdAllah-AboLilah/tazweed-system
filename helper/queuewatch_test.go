package main

// ============================================================
// ⏳ الطابور الواقف — التجارب
// ============================================================
// ⚠️⚠️ الحكم كله في queueJudge، وبياخد الوقت كمعامل عن قصد: من
// غير كده مكانش فيه طريقة نفحص "عدّى دقيقة" من غير ما نستنى دقيقة
// حقيقية في كل تشغيل.

import (
	"strings"
	"testing"
	"time"
)

func clearQueueMemory() {
	qMu.Lock()
	qSeen = map[string]*queueSample{}
	qMu.Unlock()
}

// ============================================================
// ⭐⭐⭐ الدقيقة شرط — أقل منها مش إنذار
// ============================================================
// ⚠️ لو شلنا الشرط ده، أي ورقة كبيرة لسه بتتنقل للماكينة هتطلّع
// "فيه حاجة واقفة" — وإنذار كداب بيخلّي اللي بيقراه يبطّل يصدّقه.
func TestQueueIsOnlyStuckAfterAFullMinute(t *testing.T) {
	clearQueueMemory()
	t0 := time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC)

	if st := queueJudge("P80", 1, true, "", t0); st.Stuck {
		t.Fatal("أول عيّنة مستحيل تكون واقفة — مافيش حاجة نقارن بيها")
	}
	if st := queueJudge("P80", 1, true, "", t0.Add(30*time.Second)); st.Stuck {
		t.Fatalf("30 ثانية مش كفاية: %+v", st)
	}
	if st := queueJudge("P80", 1, true, "", t0.Add(59*time.Second)); st.Stuck {
		t.Fatalf("59 ثانية مش كفاية: %+v", st)
	}
	st := queueJudge("P80", 1, true, "", t0.Add(61*time.Second))
	if !st.Stuck {
		t.Fatalf("بعد دقيقة المفروض واقف: %+v", st)
	}
	if st.StuckSeconds < 60 {
		t.Fatalf("المدة غلط: %+v", st)
	}
	if !strings.Contains(st.Summary, "واقف") {
		t.Fatalf("الرسالة مش بتقول إنه واقف: %q", st.Summary)
	}
}

// ============================================================
// ⭐⭐⭐ العدد لما يتحرّك، العدّاد بيرجع من الأول
// ============================================================
// ⚠️⚠️ ده اللي بيفرّق بين طابور **ماشي** وطابور **واقف**. من غيره،
// طابعة شغّالة عادي وبتاخد ورقة ورا ورقة كانت هتتحسب واقفة بمجرد
// ما يعدّي دقيقة من أول ورقة.
func TestQueueResetsWhenTheCountMoves(t *testing.T) {
	clearQueueMemory()
	t0 := time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC)
	queueJudge("P80", 3, true, "", t0)
	queueJudge("P80", 3, true, "", t0.Add(50*time.Second))
	// الطابور اتحرّك
	if st := queueJudge("P80", 2, true, "", t0.Add(70*time.Second)); st.Stuck {
		t.Fatalf("العدد نزل يبقى ماشي: %+v", st)
	}
	// ولسه بيعدّ من لحظة الحركة، مش من الأول
	if st := queueJudge("P80", 2, true, "", t0.Add(100*time.Second)); st.Stuck {
		t.Fatalf("30 ثانية من لحظة الحركة بس: %+v", st)
	}
	if st := queueJudge("P80", 2, true, "", t0.Add(135*time.Second)); !st.Stuck {
		t.Fatalf("بعد دقيقة من لحظة الحركة المفروض واقف: %+v", st)
	}
}

// ============================================================
// ⭐⭐ الطابور الفاضي مافيهوش كلام
// ============================================================
func TestEmptyQueueIsNeverStuck(t *testing.T) {
	clearQueueMemory()
	t0 := time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC)
	queueJudge("P80", 2, true, "", t0)
	if st := queueJudge("P80", 0, true, "", t0.Add(5*time.Minute)); st.Stuck {
		t.Fatalf("طابور فاضي اتحسب واقف: %+v", st)
	}
	// والذاكرة اتمسحت: ورقة جديدة بتبدأ عدّ جديد
	if st := queueJudge("P80", 2, true, "", t0.Add(6*time.Minute)); st.Stuck {
		t.Fatalf("العيّنة القديمة لسه محسوبة بعد ما الطابور فضي: %+v", st)
	}
}

// ============================================================
// ⭐⭐⭐ عيّنة قديمة أوي مابتتحسبش
// ============================================================
// ⚠️⚠️ الصفحة بتسأل وهي مفتوحة بس. لو حد قفلها وفتحها بعد ساعة
// والطابور فيه نفس العدد، إحنا **مانعرفش** حصل إيه في النص —
// ممكن ورقة اتطبعت وواحدة تانية اتبعتت. فبنبدأ عدّ جديد بدل ما
// نطلّع إنذار على ورقة سليمة.
func TestAnAncientSampleIsThrownAway(t *testing.T) {
	clearQueueMemory()
	t0 := time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC)
	// ⚠️⚠️ الأرقام هنا **مكتوبة صريحة** مش مشتقّة من queueSampleMaxGap:
	// لو استعملنا الثابت نفسه، الفحص بيتحرّك معاه — تغيّره لأي قيمة
	// والفحص يفضل ناجح. جرّبناه كده فعلًا وعدّى والكود مكسور.
	queueJudge("P80", 1, true, "", t0)
	if st := queueJudge("P80", 1, true, "", t0.Add(11*time.Minute)); st.Stuck {
		t.Fatalf("عيّنة عمرها 11 دقيقة اتحسبت: %+v", st)
	}
	// وبعد الحساب الجديد، دقيقة كفاية تاني
	if st := queueJudge("P80", 1, true, "", t0.Add(12*time.Minute)); !st.Stuck {
		t.Fatalf("العدّ الجديد مابدأش: %+v", st)
	}
	// ⚠️ وعيّنة عمرها 9 دقايق **بتتحسب** — الحد مش بيلغي كل حاجة
	clearQueueMemory()
	queueJudge("P80", 4, true, "", t0)
	if st := queueJudge("P80", 4, true, "", t0.Add(9*time.Minute)); !st.Stuck {
		t.Fatalf("عيّنة جوه الحد اتلغت من غير داعي: %+v", st)
	}
}

// ⭐⭐ كل طابعة لوحدها
func TestEachPrinterIsCountedOnItsOwn(t *testing.T) {
	clearQueueMemory()
	t0 := time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC)
	queueJudge("P80", 1, true, "", t0)
	queueJudge("P235", 1, true, "", t0.Add(59*time.Second))
	if st := queueJudge("P80", 1, true, "", t0.Add(70*time.Second)); !st.Stuck {
		t.Fatalf("P80 المفروض واقف: %+v", st)
	}
	if st := queueJudge("P235", 1, true, "", t0.Add(75*time.Second)); st.Stuck {
		t.Fatalf("P235 لسه مامرّش عليها دقيقة: %+v", st)
	}
}

// ⭐⭐ الجهاز اللي مايقدرش يقرا بيقول كده — مش بيقول "تمام"
func TestUnsupportedSaysSoInsteadOfPretending(t *testing.T) {
	clearQueueMemory()
	st := queueJudge("P80", 0, false, "", time.Now())
	if st.Stuck {
		t.Fatal("مش مدعوم مايتحسبش واقف")
	}
	if !strings.Contains(st.Summary, "مايقدرش") {
		t.Fatalf("الرسالة مش صريحة: %q", st.Summary)
	}
	st = queueJudge("P80", 0, true, "الطابعة مش موجودة", time.Now())
	if !strings.Contains(st.Summary, "مش قادر أقرا الطابور") {
		t.Fatalf("الخطأ مش ظاهر: %q", st.Summary)
	}
}

// ⭐ المدة بالعربي ومقرّبة
func TestSinceTextIsReadableArabic(t *testing.T) {
	cases := map[int]string{60: "دقيقة", 119: "دقيقة", 180: "3 دقيقة", 3600: "ساعة", 7200: "2 ساعة"}
	for sec, want := range cases {
		if got := arabicSince(sec); got != want {
			t.Fatalf("%d ثانية → %q، المتوقّع %q", sec, got, want)
		}
	}
}
