//go:build windows

package main

// ============================================================
// الطباعة على الويندوز — بايت بايت، من غير موديل الصفحة
// ============================================================
// ⚠️⚠️ ده قلب البرنامج كله. بنبعت البايتات للطابعة بنوع بيانات
// **RAW**، يعني الويندوز بيسلّمها للماكينة زي ما هي من غير ما
// التعريف يرسم صفحة ولا يحسب مقاس ولا يصغّر.
//
// وده بالظبط الفرق: التعريف هو اللي كان بيقص الورقة عند فورم الورق
// بتاعه، وهو اللي كان بيصغّرها. لما نعدّي من هنا، مافيش تعريف أصلًا.
//
// بنستخدم winspool.drv من الويندوز نفسه — مافيش مكتبات خارجية.

import (
	"fmt"
	"os/exec"
	"syscall"
	"unsafe"
)

// ⚠️ بيفتح المتصفح على صفحة التجربة أول ما البرنامج يشتغل — اتطلب
// بالنص: "ينفع نعمل فتح الواجهه والتجربة من البرنامج".
//
// ⚠️⚠️ ليه المتصفح مش شباك برنامج حقيقي: الشباك الحقيقي محتاج مكتبة
// واجهات (WebView2 أو غيرها) — تنصيب زيادة وحجم أكبر بمرات، وده ضد
// "خفيفة وبسيطة". بالطريقة دي الواجهة بتفتح لوحدها والبرنامج فاضل
// ملف واحد من غير أي اعتماد.
//
// `start` جوّه cmd عشان تشتغل مع المتصفح الافتراضي أيًا كان.
// و`HideWindow` عشان مايظهرش شباك أسود تاني للحظة.
func openBrowser(url string) {
	cmd := exec.Command("cmd", "/c", "start", "", url)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	if err := cmd.Start(); err != nil {
		fmt.Println("   (مقدرتش أفتح المتصفح لوحدي — افتح العنوان بنفسك)")
	}
}

// ⚠️⚠️ الشباك الأسود بيعرض **مربعات** مكان العربي
// ------------------------------------------------------------
// اتبلّغ بالصورة: كل الرسائل طلعت ؟؟؟؟. الرسائل بتتبعت صح — الشباك
// هو اللي مش عارف يرسمها، لأنه بيفتح على صفحة ترميز قديمة (437 أو
// 1252) مش UTF-8.
//
// SetConsoleOutputCP(65001) بتحوّله لـUTF-8.
//
// ⚠️ وده **مش ضمان كامل**: الشباك القديم (conhost) بخط نقطي مش
// هيرسم عربي حتى مع UTF-8. اللي بيحل ده نهائيًا هو إننا نبطّل
// نعتمد على الشباك أصلًا — الواجهة في المتصفح بتعرض كل حاجة.
func fixConsoleEncoding() {
	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	kernel32.NewProc("SetConsoleOutputCP").Call(65001)
	kernel32.NewProc("SetConsoleCP").Call(65001)
}

var (
	winspool           = syscall.NewLazyDLL("winspool.drv")
	procOpenPrinterW   = winspool.NewProc("OpenPrinterW")
	procClosePrinter   = winspool.NewProc("ClosePrinter")
	procStartDocPrintW = winspool.NewProc("StartDocPrinterW")
	procEndDocPrinter  = winspool.NewProc("EndDocPrinter")
	procStartPagePrint = winspool.NewProc("StartPagePrinter")
	procEndPagePrinter = winspool.NewProc("EndPagePrinter")
	procWritePrinter   = winspool.NewProc("WritePrinter")
	procEnumPrintersW  = winspool.NewProc("EnumPrintersW")
)

type docInfo1 struct {
	DocName    *uint16
	OutputFile *uint16
	Datatype   *uint16
}

// ⚠️ الترتيب ده لازم يطابق PRINTER_INFO_4W في الويندوز بالظبط.
// أي حقل زيادة أو ناقص = قراءة ذاكرة غلط وأسماء طابعات مكسّرة.
type printerInfo4 struct {
	PrinterName *uint16
	ServerName  *uint16
	Attributes  uint32
	_           uint32 // حشو المحاذاة على 64 بت
}

// بترجّع أسماء الطابعات المركّبة على الجهاز.
func listPrinters() ([]string, error) {
	const (
		printerEnumLocal       = 0x00000002
		printerEnumConnections = 0x00000004
		level                  = 4
	)
	flags := uintptr(printerEnumLocal | printerEnumConnections)

	// النداء الأول بيقول محتاجين كام بايت
	var needed, returned uint32
	procEnumPrintersW.Call(flags, 0, level, 0, 0,
		uintptr(unsafe.Pointer(&needed)), uintptr(unsafe.Pointer(&returned)))
	if needed == 0 {
		return []string{}, nil
	}

	buf := make([]byte, needed)
	r, _, err := procEnumPrintersW.Call(flags, 0, level,
		uintptr(unsafe.Pointer(&buf[0])), uintptr(needed),
		uintptr(unsafe.Pointer(&needed)), uintptr(unsafe.Pointer(&returned)))
	if r == 0 {
		return nil, fmt.Errorf("تعذّرت قراءة قايمة الطابعات: %v", err)
	}

	out := make([]string, 0, returned)
	info := (*[1 << 16]printerInfo4)(unsafe.Pointer(&buf[0]))
	for i := 0; i < int(returned); i++ {
		if info[i].PrinterName != nil {
			out = append(out, utf16ToString(info[i].PrinterName))
		}
	}
	return out, nil
}

func utf16ToString(p *uint16) string {
	if p == nil {
		return ""
	}
	n := 0
	for ptr := unsafe.Pointer(p); *(*uint16)(ptr) != 0; ptr = unsafe.Add(ptr, 2) {
		n++
		if n > 1024 {
			break
		}
	}
	return syscall.UTF16ToString(unsafe.Slice(p, n))
}

// بتبعت البايتات للطابعة زي ما هي.
func printRaw(printer string, data []byte, jobName string) error {
	name, err := syscall.UTF16PtrFromString(printer)
	if err != nil {
		return err
	}

	var h syscall.Handle
	r, _, e := procOpenPrinterW.Call(uintptr(unsafe.Pointer(name)),
		uintptr(unsafe.Pointer(&h)), 0)
	if r == 0 {
		return fmt.Errorf("مالقيتش الطابعة %q: %v", printer, e)
	}
	defer procClosePrinter.Call(uintptr(h))

	docName, _ := syscall.UTF16PtrFromString(jobName)
	// ⚠️⚠️ "RAW" هي الكلمة اللي بتشيل التعريف من الطريق. لو اتغيّرت
	// لـ"XPS_PASS" أو اتسابت فاضية، الويندوز هيرجع يرسم صفحة —
	// وهنرجع لنفس العطل اللي البرنامج ده اتعمل عشانه.
	dataType, _ := syscall.UTF16PtrFromString("RAW")
	di := docInfo1{DocName: docName, Datatype: dataType}

	r, _, e = procStartDocPrintW.Call(uintptr(h), 1, uintptr(unsafe.Pointer(&di)))
	if r == 0 {
		return fmt.Errorf("تعذّر فتح أمر الطباعة: %v", e)
	}
	defer procEndDocPrinter.Call(uintptr(h))

	r, _, e = procStartPagePrint.Call(uintptr(h))
	if r == 0 {
		return fmt.Errorf("تعذّر بدء الصفحة: %v", e)
	}
	defer procEndPagePrinter.Call(uintptr(h))

	// ⚠️ الكتابة على دفعات: WritePrinter ممكن يكتب أقل من المطلوب،
	// والدفعة الكبيرة أوي ممكن تفشل على بعض التعريفات.
	const chunk = 32 * 1024
	for off := 0; off < len(data); {
		end := off + chunk
		if end > len(data) {
			end = len(data)
		}
		var written uint32
		r, _, e = procWritePrinter.Call(uintptr(h),
			uintptr(unsafe.Pointer(&data[off])), uintptr(end-off),
			uintptr(unsafe.Pointer(&written)))
		if r == 0 || written == 0 {
			return fmt.Errorf("الكتابة للطابعة وقفت عند %d بايت: %v", off, e)
		}
		off += int(written)
	}
	return nil
}
