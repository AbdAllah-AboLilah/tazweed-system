package main

// ============================================================
// 🔤 خطوط الملصق — محفورة جوّه البرنامج
// ============================================================
// اتطلب بالنص:
//   "انا كنت عاوزك تضيف تغير الخط في نظام تصميم الملصق في البرنامج
//    المساعد مش النظام بحيث بردوا اقدر اشوف تغير الخط هياثر ازاي"
//
// وقبلها:
//   "ماشي موافق حط الخط في البرنامج ... انا معنديش مشكلة البرنامج
//    حجمه يكبر"
//
// ------------------------------------------------------------
// ⚠️⚠️ ليه الملفات متحفورة جوّه البرنامج مش بتتجاب من النت
// ------------------------------------------------------------
// المصمّم بيتفتح على 127.0.0.1 — مافيش أي ضمان إن الجهاز عليه نت
// ساعتها، والبرنامج المساعد اتعمل أصلًا عشان المحل يشتغل من غير نت.
// خط بييجي من بره معناه إن المعاينة تطلع بخط الجهاز والمستخدم فاكر
// إنه بيشوف الخط اللي اختاره — وده أسوأ من إن الاختيار مايبقاش موجود.
//
// التكلفة: 328 كيلو على حجم البرنامج (من 6.6 لـ6.9 ميجا). واللي
// بيتحمّل في المتصفح هو **الخط المختار بس**، مش الـ16 ملف.
//
// ⚠️ والملفات مكرّرة من مجلد fonts/ بتاع النظام (زي qrcode-generator.js
// بالظبط) لأن go:embed مابيقدرش يطلع بره مجلد الموديول. فيه فحص
// (TestFontsMatchSystem) بيقارن المجلدين ملف بملف بايت ببايت.

import (
	"embed"
	"fmt"
	"net/http"
	"strings"
)

//go:embed fonts/*.woff2
var fontFiles embed.FS

// ⚠️ المقطع العربي — نفس المدى المكتوب في styles.css و js/label-font.js
// بالحرف. من غيره المتصفح ممكن يجيب الحروف العربية من ملف "latin"
// اللي مافيهوش عربي، فتطلع مربعات فاضية.
const arabicRange = "U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, " +
	"U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, " +
	"U+FE70-FE74, U+FE76-FEFC"

type labelFont struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Hint  string `json:"hint"`
	// فاضي = خط الجهاز، يعني مافيش @font-face ومافيش تحميل.
	Family string `json:"family"`
	// اسم الملفات: <slug>-<arabic|latin>-<weight>.woff2
	Slug string `json:"-"`
	// ⚠️ الوزن التاني هو اللي بيتستخدم للعريض. بلكس عنده 600 مش 700
	// (ده اللي متحفوظ للشاشة من الأصل)، والمتصفح بيستخدمه لما نطلب
	// bold — فالرقم هنا لازم يطابق الملف الموجود فعلًا.
	Weights []int `json:"weights"`
}

// ============================================================
// ⚠️⚠️ الأرقام اللي ورا الوصف — مقيسة من المعاينة نفسها
// ============================================================
// خانة 23.5×4.6مم، سطرين، مقاس مطلوب 1.9مم. اللي في الجدول هو
// المقاس اللي **طلع فعلًا** بعد التصغير:
//
//     الاسم            الجهاز  بلكس  كايرو  تجوال  المراعي
//     قصير/متوسط        1.90  1.90  1.90  1.90  1.90
//     طويل (38 حرف)     1.90  1.82  1.68  1.90  1.90
//     طويل جدًا (66)     1.37  1.55  1.49  1.49  1.49
//
// ⚠️ الدرس اللي غلّطني أول مرة: قِست **عرض الكلام بس** وقلت إن بلكس
// أحسن حاجة. بس خانة الاسم محدودة بالطول مش بالعرض — وبلكس سطره
// أطول، فبيتصغّر بدري. العرض لوحده مايقولش النتيجة.
//
// ⚠️⚠️ القايمة دي **لازم** تطابق LABEL_FONTS في js/label-font.js:
// المستخدم بيظبط الشكل هنا وبيطبع من هناك، فاختلاف خط واحد معناه
// إن المعاينة بتكدب. فيه فحص (TestFontListMatchesSystem) بيقرا ملف
// النظام ويقارن المعرّفات.
var labelFonts = []labelFont{
	{
		ID:    "system",
		Label: "خط الجهاز (الافتراضي)",
		Hint:  "زي ما هو دلوقتي بالظبط — مافيش أي تغيير في الملصق.",
	},
	{
		ID:     "plex",
		Label:  "Plex Arabic — نفس خط الشاشة",
		Hint:   "نفس خط الشاشة. حروفه أضيق بس سطره أطول — الأسماء الطويلة بتتصغّر بدري شوية.",
		Family: "Plex Arabic",
		Slug:   "plex-ar",
		// ⚠️ 600 مش 700 — ده الوزن المحفوظ فعلًا (شوف styles.css).
		Weights: []int{400, 600},
	},
	{
		ID:      "cairo",
		Label:   "Cairo — كايرو",
		Hint:    "حديث وواضح، بس سطره أطول — بيصغّر الأسماء الطويلة أكتر من غيره.",
		Family:  "TZ Cairo",
		Slug:    "cairo",
		Weights: []int{400, 700},
	},
	{
		ID:      "tajawal",
		Label:   "Tajawal — تجوال",
		Hint:    "بيحافظ على المقاس زي خط الجهاز في الأسماء الطويلة، وبيكسبه في الطويلة جدًا.",
		Family:  "TZ Tajawal",
		Slug:    "tajawal",
		Weights: []int{400, 700},
	},
	{
		ID:      "almarai",
		Label:   "Almarai — المراعي",
		Hint:    "حروفه تخينة فبتبان أوضح لو الطباعة باهتة، وبيتصرّف زي تجوال في المساحة.",
		Family:  "TZ Almarai",
		Slug:    "almarai",
		Weights: []int{400, 700},
	},
}

const defaultFontID = "system"

func fontByID(id string) *labelFont {
	for i := range labelFonts {
		if labelFonts[i].ID == id {
			return &labelFonts[i]
		}
	}
	return nil
}

// ============================================================
// /fonts.css — كل القواعد مرة واحدة، والتحميل بيحصل عند الاستعمال
// ============================================================
// ⚠️ حط كل الخطوط هنا **مابيكلّفش حاجة**: المتصفح مابينزّلش ملف خط
// إلا لما يلاقي كلام معروض بيه فعلًا. فاللي سايب الاختيار على "خط
// الجهاز" مابينزّلش ولا بايت.
func fontFaceCSS() string {
	var b strings.Builder
	for _, f := range labelFonts {
		if f.Family == "" {
			continue
		}
		for _, w := range f.Weights {
			// ⚠️ font-display: block مش swap. الـswap معناها "ارسم
			// بخط تاني دلوقتي وبدّله بعدين" — يعني المعاينة تتقاس
			// بخط غير اللي هيطلع. هنا الانتظار أحسن من الكذب.
			fmt.Fprintf(&b,
				"@font-face{font-family:'%s';font-style:normal;font-weight:%d;"+
					"font-display:block;src:url('/fonts/%s-arabic-%d.woff2') format('woff2');"+
					"unicode-range:%s}\n",
				f.Family, w, f.Slug, w, arabicRange)
			fmt.Fprintf(&b,
				"@font-face{font-family:'%s';font-style:normal;font-weight:%d;"+
					"font-display:block;src:url('/fonts/%s-latin-%d.woff2') format('woff2')}\n",
				f.Family, w, f.Slug, w)
		}
	}
	return b.String()
}

func handleFontsCSS(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/css; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=86400")
	w.Write([]byte(fontFaceCSS()))
}

func handleFontsJSON(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"fonts": labelFonts})
}

// ⚠️ اسم الملف بيتفلتر من القايمة نفسها مش من اللي المستخدم بعته:
// كده مستحيل حد يطلب ملف تاني من جوّه البرنامج عن طريق المسار.
func handleFontFile(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimPrefix(r.URL.Path, "/fonts/")
	ok := false
	for _, f := range labelFonts {
		if f.Family == "" {
			continue
		}
		for _, wt := range f.Weights {
			if name == fmt.Sprintf("%s-arabic-%d.woff2", f.Slug, wt) ||
				name == fmt.Sprintf("%s-latin-%d.woff2", f.Slug, wt) {
				ok = true
			}
		}
	}
	if !ok {
		http.NotFound(w, r)
		return
	}
	data, err := fontFiles.ReadFile("fonts/" + name)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "font/woff2")
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	w.Write(data)
}
