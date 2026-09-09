package main

// ============================================================
// 🏷️ الملصق — بلغة الطابعة نفسها (TSPL)
// ============================================================
// ⚠️⚠️ ورقة التزويد والملصق **لغتين مختلفتين تمامًا**:
//
//   ورقة التزويد → XP-80C   → ESC/POS  (إيصال، رول مستمر)
//   الملصق       → XP-235B  → TSPL     (لاصقات بمقاس ثابت وفواصل)
//
// عشان كده الملف ده منفصل عن raster.go بالكامل. لو بعتنا ESC/POS
// لطابعة الملصق هتطلّع ورق أبيض أو رموز مكسّرة.
//
// ------------------------------------------------------------
// ليه أصلًا بنبعت TSPL بدل ما نسيب التعريف يرسم؟
// ------------------------------------------------------------
// نفس سبب ورقة التزويد بالظبط:
//
//   ١) حد رسالة QZ (48 كيلو) بيخلّي **٤ ملصقات مختلفة بس** يدخلوا
//      في الأمر الواحد. من هنا مافيش حد أصلًا.
//   ٢) عطل "العمود اليمين مقصوص" (v0.73.2) كان **من التعريف**:
//      الصورة سليمة 304×200 وبتتقص بعد ما تخرج مننا.
//   ٣) العدد بيتنفّذ **جوه الطابعة** (PRINT n,1) بدل ما نبعت نفس
//      الصورة ٤٠ مرة على الشبكة.
//
// ⚠️ الأوامر اللي تحت مش تخمين: نفس الوصفة بالحرف اللي شغّالة في
// النظام من زمان في عيّنة الخطوط والمعايرة (SIZE / GAP 2 / DIRECTION 1
// / REFERENCE 0,0 / CLS / PRINT). اللي جديد هو BITMAP بس.

import (
	"bytes"
	"errors"
	"fmt"
	"strconv"
)

// دقة طابعة الملصق. زي ورقة التزويد بالظبط.
const labelDPI = 203

// أقصى عرض معقول لملصق (٨ بوصة). فوق كده الصورة أكيد غلط، وأحسن
// نرفض من إننا نغرق الطابعة.
const maxLabelDots = labelDPI * 8

// الافتراضيات — نفس اللي في عيّنة الخطوط اللي اتجرّبت على ماكينة المحل.
const (
	defaultGapMm     = 2.0
	defaultDirection = 1
)

type tsplLabel struct {
	PNG    []byte
	Copies int
}

// ------------------------------------------------------------
// ⚠️⚠️ قطبية البِتّات **مقلوبة** بين اللغتين
// ------------------------------------------------------------
//
//	ESC/POS (GS v 0): بِت 1 = نقطة سودا
//	TSPL    (BITMAP): بِت 0 = نقطة سودا   ← زي صورة BMP بلونين
//
// يعني لازم نقلب. ولو قلبنا غلط الملصق بيطلع **أسود بالكامل** —
// ودي أغلى غلطة ممكنة (شريط وورق ضايع). عشان كده فيه مفتاح
// labelInvert في الإعدادات: لو طلع مقلوب، تظبطه من صفحة البرنامج
// من غير ما تستنى نسخة جديدة.
//
// ⚠️ بِتّات الحشو في آخر الصف بتتظبط لوحدها: pngToBits بتسيبها صفر
// (أبيض عندها)، وبعد القلب بتبقى ١ = أبيض عند TSPL. مظبوطة.
func invertBits(bits []byte) []byte {
	out := make([]byte, len(bits))
	for i, b := range bits {
		out[i] = ^b
	}
	return out
}

// رقم بأقصر شكل مقروء: 38 مش 38.000000
func mmStr(v float64) string {
	return strconv.FormatFloat(v, 'g', -1, 64)
}

// ------------------------------------------------------------
// قايمة ملصقات → أمر TSPL واحد
// ------------------------------------------------------------
// الشكل الناتج:
//
//	SIZE 38 mm,25 mm
//	GAP 2 mm,0 mm
//	DIRECTION 1
//	REFERENCE 0,0
//	CLS
//	BITMAP 0,0,38,200,0,<بيانات>
//	PRINT 5,1
//	CLS
//	BITMAP ...
//	PRINT 3,1
//
// ⚠️ الترويسة (SIZE/GAP/DIRECTION) بتتكتب **مرة واحدة** في أول الأمر:
// دي إعدادات بتتخزّن في الطابعة، وتكرارها كل ملصق بيضيّع وقت من غير
// أي فايدة.
func buildTSPLJob(items []tsplLabel, widthMm, heightMm, gapMm float64, direction int, flipPolarity bool) ([]byte, int, int, error) {
	if len(items) == 0 {
		return nil, 0, 0, errors.New("مافيش ملصقات")
	}
	if gapMm < 0 {
		gapMm = defaultGapMm
	}
	if direction != 0 && direction != 1 {
		direction = defaultDirection
	}

	var body bytes.Buffer
	firstW, firstH := 0, 0

	for i, it := range items {
		bits, w, h, rowBytes, err := pngToBits(it.PNG)
		if err != nil {
			return nil, 0, 0, fmt.Errorf("ملصق %d: %v", i+1, err)
		}
		if w > maxLabelDots || h > maxLabelDots {
			return nil, w, h, fmt.Errorf("ملصق %d: مقاسه غير معقول (%dx%d نقطة)", i+1, w, h)
		}
		if i == 0 {
			firstW, firstH = w, h
		}
		// الوضع الطبيعي: بنقلب، لأن TSPL بِت ٠ = أسود وإحنا عندنا ١ = أسود.
		// وflipPolarity هو **مفتاح الطوارئ**: لو ماكينة طلّعت الملصق
		// مقلوب، بيتفتح من صفحة البرنامج فورًا من غير نسخة جديدة.
		if !flipPolarity {
			bits = invertBits(bits)
		}
		copies := it.Copies
		if copies < 1 {
			copies = 1
		}

		body.WriteString("CLS\r\n")
		body.WriteString(fmt.Sprintf("BITMAP 0,0,%d,%d,0,", rowBytes, h))
		body.Write(bits)
		body.WriteString("\r\n")
		body.WriteString(fmt.Sprintf("PRINT %d,1\r\n", copies))
	}

	// المقاس: اللي النظام بعته، وإلا بنحسبه من نقط الصورة نفسها.
	if widthMm <= 0 {
		widthMm = float64(firstW) / labelDPI * 25.4
	}
	if heightMm <= 0 {
		heightMm = float64(firstH) / labelDPI * 25.4
	}

	var out bytes.Buffer
	out.WriteString("SIZE " + mmStr(widthMm) + " mm," + mmStr(heightMm) + " mm\r\n")
	out.WriteString("GAP " + mmStr(gapMm) + " mm,0 mm\r\n")
	out.WriteString(fmt.Sprintf("DIRECTION %d\r\n", direction))
	out.WriteString("REFERENCE 0,0\r\n")
	out.Write(body.Bytes())
	return out.Bytes(), firstW, firstH, nil
}
