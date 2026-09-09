package main

// ============================================================
// تحويل الصورة لأوامر الطابعة الحرارية (ESC/POS)
// ============================================================
// النظام بيرسم ورقة التزويد **صورة أبيض وأسود** بعرض 576 نقطة (وده
// عرض رأس الطباعة في طابعة 80مم على 203 نقطة/بوصة بالظبط).
// الملف ده بيحوّلها لأوامر الطابعة مباشرة.
//
// ⚠️⚠️ ليه ده مهم: الطريقة دي **مابتعدّيش على موديل الصفحة** بتاع
// الويندوز خالص. الطابعة بتطبع صفوف نقط لحد ما البيانات تخلص — زي
// إيصال الكاشير بالظبط. يعني:
//   • مافيش فورم ورق يقص الورقة الطويلة
//   • مافيش تصغير تلقائي
//   • مافيش حد لحجم الرسالة

import (
	"bytes"
	"errors"
	"image/png"
)

// عرض رأس الطباعة في طابعة 80مم على 203 نقطة/بوصة.
const headWidthDots = 576

// ⚠️ بنقسّم الصورة لشرايح بدل ما نبعتها أمر واحد.
//
// أمر `GS v 0` بياخد ارتفاع لحد 65535 نظريًا، بس كتير من الطابعات
// عندها **ذاكرة محدودة** وبتقع أو تطبع نص الصورة لو الأمر كبير أوي.
// ورقة التزويد ممكن توصل 4800 صف — فبنبعتها شرايح.
//
// 128 صف = تقريبًا 16مم — رقم آمن ومجرّب في أغلب المكتبات.
const bandRows = 128

// ------------------------------------------------------------
// PNG → صفوف بِتّات (1 = نقطة سودا)
// ------------------------------------------------------------
// ⚠️ العتبة 128 على القناة الحمرا بس: الصورة اللي جايالنا **أبيض
// وأسود صافي** أصلًا (النظام بيرسمها كده)، فمافيش رمادي نقلق منه.
// ولو جت صورة ملوّنة يومًا، ده تحويل معقول مش وقوع.
func pngToBits(raw []byte) (bits []byte, width, height, rowBytes int, err error) {
	img, err := png.Decode(bytes.NewReader(raw))
	if err != nil {
		return nil, 0, 0, 0, err
	}
	b := img.Bounds()
	width, height = b.Dx(), b.Dy()
	if width <= 0 || height <= 0 {
		return nil, 0, 0, 0, errors.New("صورة فاضية")
	}
	rowBytes = (width + 7) / 8
	bits = make([]byte, rowBytes*height)

	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			r, g, bl, a := img.At(b.Min.X+x, b.Min.Y+y).RGBA()
			// الشفاف بيتقرا **أبيض** مش أسود — من غير كده الهوامش
			// بتطلع سودا وتاكل الورق.
			if a < 0x8000 {
				continue
			}
			// متوسط بسيط، والعتبة في النص
			lum := (r + g + bl) / 3
			if lum < 0x8000 {
				bits[y*rowBytes+x/8] |= 0x80 >> uint(x%8)
			}
		}
	}
	return bits, width, height, rowBytes, nil
}

// ------------------------------------------------------------
// صفوف البِتّات → أوامر ESC/POS
// ------------------------------------------------------------
// شكل الأمر: GS v 0 m xL xH yL yH [البيانات]
//   m  = 0 (الحجم الطبيعي)
//   xL/xH = عرض الصف **بالبايت** (مش بالنقط)
//   yL/yH = عدد الصفوف في الشريحة دي
func escposRaster(bits []byte, width, height, rowBytes int) []byte {
	var out bytes.Buffer

	// تهيئة الطابعة — بترجّع أي إعداد فاضل من طبعة قبلها
	out.Write([]byte{0x1B, 0x40}) // ESC @

	for y0 := 0; y0 < height; y0 += bandRows {
		rows := bandRows
		if y0+rows > height {
			rows = height - y0
		}
		out.Write([]byte{0x1D, 0x76, 0x30, 0x00}) // GS v 0 m=0
		out.WriteByte(byte(rowBytes & 0xFF))
		out.WriteByte(byte(rowBytes >> 8))
		out.WriteByte(byte(rows & 0xFF))
		out.WriteByte(byte(rows >> 8))
		out.Write(bits[y0*rowBytes : (y0+rows)*rowBytes])
	}
	return out.Bytes()
}

// ⚠️ التقديم **قبل** القص عن قصد: من غيره آخر سطر بيفضل تحت رأس
// الطباعة والسكينة بتقطع في نص الكلام.
//
// ESC d 3      = قدّم 3 سطور
// GS V 66 0    = قص جزئي (الفيرموير بيحسب المسافة للسكينة)
func feedAndCut() []byte {
	return []byte{0x1B, 0x64, 0x03, 0x1D, 0x56, 0x42, 0x00}
}

// البوابة الوحيدة: PNG → بايتات جاهزة للطابعة.
func pngToESCPOS(raw []byte, cut bool) ([]byte, int, int, error) {
	bits, w, h, rowBytes, err := pngToBits(raw)
	if err != nil {
		return nil, 0, 0, err
	}
	// ⚠️ أعرض من رأس الطباعة = الطابعة هتقص من اليمين في صمت.
	// بنرفض بدل ما نطبع ورقة ناقصة.
	if w > headWidthDots {
		return nil, w, h, errors.New("الصورة أعرض من رأس الطباعة")
	}
	out := escposRaster(bits, w, h, rowBytes)
	if cut {
		out = append(out, feedAndCut()...)
	}
	return out, w, h, nil
}
