package main

// ============================================================
// 🩺 حالة الطابعة — الحاجة اللي المتصفح **مايقدرش** عليها
// ============================================================
// اتطلب بالنص: "ممكن نستغل ازاي تواجدنا الفعلي علي جهاز الكمبيوتر".
//
// ودي أوضح إجابة: النظام دلوقتي بيقول "اتبعت ✅" بمجرد ما البايتات
// تروح لويندوز. اللي بيحصل بعد كده هو **مش شايفه خالص**:
//
//     الرول خلص      → 200 ملصق راحوا في الهوا
//     الغطا مفتوح    → نفس الحكاية
//     الورق اتزنق    → نفس الحكاية
//
// والمتصفح مستحيل يعرف حاجة من دي. البرنامج بس هو اللي يقدر يسأل
// ويندوز عن الماكينة.
//
// ------------------------------------------------------------
// ⚠️⚠️ وليه ده **تشخيص** قبل ما يبقى تصرّف
// ------------------------------------------------------------
// اللي بيرجع هنا جاي من **تعريف الطابعة**، والتعريفات الرخيصة
// بتاعة الطابعات الحرارية كتير منها بيرجّع صفر دايمًا — يعني
// "مافيش مشكلة" حتى والرول خلص.
//
// فمش هنبني عليه تصرّف قبل ما نشوف ماكينته بترجّع إيه فعلًا. عشان
// كده فيه زرار في الصفحة بيوري **الرقم الخام** — يجرّبه والرول
// خارج ويقولنا.
//
// ⚠️ ولما نبني عليه تصرّف، هيبقى **ورا مفتاح مقفول افتراضيًا**:
// تعريف بيكدب ويقول "فيه مشكلة" وهو مافيش هيوقف الطباعة خالص،
// وده أسوأ بكتير من إننا مانعرفش.

import (
	"net/http"
	"strings"
)

// كل مشكلة: البِت بتاعها في ويندوز، والاسم بالعربي، وهل تمنع الطباعة.
type printerFlag struct {
	Bit      uint32
	Label    string
	Blocking bool
}

// ⚠️ الترتيب مقصود: الأخطر الأول، عشان الرسالة تبدأ باللي يهم.
var printerFlags = []printerFlag{
	{0x00000010, "الورق خلص", true},
	{0x00000008, "الورق اتزنق", true},
	{0x00400000, "الغطا مفتوح", true},
	{0x00000080, "الطابعة مقفولة (offline)", true},
	{0x00001000, "الطابعة مش متاحة", true},
	{0x00000002, "الطابعة مبلّغة خطأ", true},
	{0x00100000, "الطابعة مستنية حد يتصرّف", true},
	{0x00000040, "مشكلة في الورق", true},
	{0x00000001, "الطباعة موقوفة (paused)", true},
	{0x00200000, "ذاكرة الطابعة خلصت", true},

	// ⚠️ دول **مش** مانعين: الطابعة شغّالة عادي وبتطبع.
	{0x00000400, "بتطبع دلوقتي", false},
	{0x00000200, "مشغولة", false},
	{0x00004000, "بتجهّز", false},
	{0x00010000, "بتسخّن", false},
	{0x00002000, "مستنية", false},
	{0x00000100, "بتستقبل بيانات", false},
	{0x01000000, "في وضع توفير الطاقة", false},
}

type printerState struct {
	Name string `json:"name"`
	// ⚠️ الرقم الخام لازم يفضل ظاهر: هو اللي بيفرّق بين "الماكينة
	// قالت كله تمام" و"الماكينة مابتردش أصلًا" — والاتنين بيبانوا
	// صفر في أي عرض مبسّط.
	Raw       uint32   `json:"raw"`
	Jobs      int      `json:"jobs"`
	Problems  []string `json:"problems"`
	Busy      []string `json:"busy"`
	Blocking  bool     `json:"blocking"`
	Supported bool     `json:"supported"` // النظام قدر يسأل أصلًا؟
	Error     string   `json:"error,omitempty"`
}

// بتترجم الرقم الخام لكلام مفهوم.
func describePrinterStatus(name string, raw uint32, jobs int) printerState {
	st := printerState{Name: name, Raw: raw, Jobs: jobs, Supported: true}
	for _, f := range printerFlags {
		if raw&f.Bit == 0 {
			continue
		}
		if f.Blocking {
			st.Problems = append(st.Problems, f.Label)
			st.Blocking = true
		} else {
			st.Busy = append(st.Busy, f.Label)
		}
	}
	return st
}

// ⚠️ رسالة واحدة جاهزة للعرض — عشان النظام والصفحة يقولوا نفس
// الكلام بدل ما كل واحد يركّب جملة من عنده.
func (s printerState) Summary() string {
	if !s.Supported {
		return "الجهاز ده مايقدرش يسأل الطابعة"
	}
	if s.Error != "" {
		return "مش قادر أقرا حالة الطابعة: " + s.Error
	}
	if len(s.Problems) > 0 {
		return "⚠️ " + strings.Join(s.Problems, " · ")
	}
	if len(s.Busy) > 0 {
		return strings.Join(s.Busy, " · ")
	}
	// ⚠️⚠️ **مش** "الطابعة تمام". الصفر معناه إن التعريف مابلّغش
	// حاجة، وده مش نفس إنه بلّغ إن كله كويس. الفرق ده هو اللي
	// بيمنعنا نوعد المستخدم بحاجة مش مضمونة.
	return "مافيش أي بلاغ من التعريف (ومش معناه إنها تمام بالضرورة)"
}

// GET /printer/status?name=...   (فاضي = طابعة الملصق المحفوظة)
func handlePrinterStatus(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimSpace(r.URL.Query().Get("name"))
	if name == "" {
		name = pickPrinter("", "label")
	}
	if name == "" {
		writeJSON(w, http.StatusOK, printerState{Error: "مافيش طابعة متظبطة"})
		return
	}
	st := readPrinterState(name)
	writeJSON(w, http.StatusOK, struct {
		printerState
		Summary string `json:"summary"`
	}{st, st.Summary()})
}
