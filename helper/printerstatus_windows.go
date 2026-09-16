//go:build windows

package main

// ============================================================
// قراية حالة الطابعة من ويندوز — GetPrinter المستوى 2
// ============================================================
// ⚠️⚠️ المستوى 2 هو اللي فيه حقل Status و cJobs. المستوى 4 (اللي
// بنستخدمه في قايمة الطابعات) فيه الأسماء بس.
//
// ⚠️ بنسأل **مشغّل الطباعة** (الـspooler) مش الماكينة نفسها. القراية
// من الماكينة مباشرة (TSPL ~HS) محتاجة منفذ ثنائي الاتجاه، وأغلب
// طابعات USB الرخيصة مابتديهوش مع أمر RAW. فبنبدأ باللي مضمون إنه
// يشتغل، ونشوف بيرجّع إيه على ماكينة حقيقية.

import (
	"syscall"
	"unsafe"
)

var procGetPrinterW = winspool.NewProc("GetPrinterW")

// ⚠️⚠️ الترتيب ده لازم يطابق PRINTER_INFO_2W بالظبط — أي حقل زيادة
// أو ناقص معناه إننا بنقرا الحالة من مكان غلط في الذاكرة، والنتيجة
// رقم عشوائي بيتحوّل لـ"الورق خلص" على طابعة سليمة.
type printerInfo2 struct {
	ServerName         *uint16
	PrinterName        *uint16
	ShareName          *uint16
	PortName           *uint16
	DriverName         *uint16
	Comment            *uint16
	Location           *uint16
	DevMode            uintptr
	SepFile            *uint16
	PrintProcessor     *uint16
	Datatype           *uint16
	Parameters         *uint16
	SecurityDescriptor uintptr
	Attributes         uint32
	Priority           uint32
	DefaultPriority    uint32
	StartTime          uint32
	UntilTime          uint32
	Status             uint32
	CJobs              uint32
	AveragePPM         uint32
}

func readPrinterState(name string) printerState {
	np, err := syscall.UTF16PtrFromString(name)
	if err != nil {
		return printerState{Name: name, Supported: true, Error: "اسم طابعة مش مفهوم"}
	}
	var h syscall.Handle
	// ⚠️ بنفتحها **للقراية بس** (بدون PRINTER_ACCESS_ADMINISTER):
	// الفتح بصلاحيات إدارة بيفشل للمستخدم العادي، والبرنامج المفروض
	// يشتغل بدوبل كليك من غير "تشغيل كمسؤول".
	r1, _, e1 := procOpenPrinterW.Call(uintptr(unsafe.Pointer(np)), uintptr(unsafe.Pointer(&h)), 0)
	if r1 == 0 {
		return printerState{Name: name, Supported: true, Error: "مش قادر أفتح الطابعة: " + e1.Error()}
	}
	defer procClosePrinter.Call(uintptr(h))

	// النداء الأول بيقول محتاجين كام بايت.
	var need uint32
	procGetPrinterW.Call(uintptr(h), 2, 0, 0, uintptr(unsafe.Pointer(&need)))
	if need == 0 {
		return printerState{Name: name, Supported: true, Error: "الويندوز مارجّعش حجم"}
	}
	buf := make([]byte, need)
	r2, _, e2 := procGetPrinterW.Call(uintptr(h), 2,
		uintptr(unsafe.Pointer(&buf[0])), uintptr(need), uintptr(unsafe.Pointer(&need)))
	if r2 == 0 {
		return printerState{Name: name, Supported: true, Error: e2.Error()}
	}
	info := (*printerInfo2)(unsafe.Pointer(&buf[0]))
	return describePrinterStatus(name, info.Status, int(info.CJobs))
}
