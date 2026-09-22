package main

// ============================================================
// 🧾 سجل الطباعة المحلي + الأوراق المحفوظة على القرص
// ============================================================
// اتطلب بالنص في خريطة التطوير:
//
//	م٤ — حفظ ورقة التزويد على القرص: آخر كام ورقة تتحفظ على الجهاز،
//	     وتتطبع تاني **من غير النظام ومن غير نت**.
//	م٥ — سجل طباعة محلي على الجهاز: اللي اتطبع من الكمبيوتر ده، حتى
//	     والنت مقطوع.
//
// ------------------------------------------------------------
// ⚠️⚠️ ليه ده في البرنامج مش في النظام
// ------------------------------------------------------------
// النظام عنده سجل عمليات فعلًا، بس هو **في السحابة**: عايز نت،
// وعايز حساب، وبيتكتب لما الطبعة تتبعت مش لما تخرج. والحالة اللي
// بتوجع فعلًا هي: النت مقطوع، والورقة اتطبعت، وحد عايز يعرف طبع
// إيه امبارح — أو عايز نفس الورقة تاني وهي مش موجودة عنده.
//
// البرنامج هو المكان الوحيد اللي شايف الطبعة **وهي بتخرج**، وشغّال
// والنت مقطوع.
//
// ------------------------------------------------------------
// ⚠️⚠️ ولا سطر من ده بيقدر يوقّع الطباعة
// ------------------------------------------------------------
// الكتابة على القرص بتحصل **بعد** ما البايتات تروح للطابعة، وأي
// فشل فيها بيتكتب في اللوج وبس. الطبعة عمرها ما تقف عشان السجل.

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

const (
	// 200 سطر ≈ 30 كيلو. كفاية لأسابيع في محل بيطبع كل يوم.
	maxPrintLog = 200
	// ⚠️ 20 ورقة بس: الورقة PNG بعشرات الكيلو، و20 ≈ 2 ميجا على
	// الأكتر. القرص بتاع صاحب المحل مش مكان نكوّم فيه.
	maxSheets = 20
	// ⚠️ سقف للورقة الواحدة: سقف الطلب كله 12 ميجا، ولو حد بعت
	// صورة ضخمة مش هنحفظ 20 منها على القرص. بنسجّلها من غير ما
	// نحفظها بدل ما نملا القرص في سكوت.
	maxSheetBytes = 2 << 20
)

// سطر واحد في السجل.
type printLogEntry struct {
	Ms      int64  `json:"ms"`
	Kind    string `json:"kind"` // restock | label | test
	Printer string `json:"printer"`
	Name    string `json:"name"`
	Count   int    `json:"count,omitempty"` // عدد اللاصقات
	Bytes   int    `json:"bytes,omitempty"`
	OK      bool   `json:"ok"`
	Error   string `json:"error,omitempty"`

	// 📄 اسم ملف الورقة المحفوظة (ورق التزويد بس) — فاضي يعني
	// مااتحفظتش، والصفحة ساعتها مابتوريش زرار "اطبعها تاني".
	Sheet string `json:"sheet,omitempty"`
	// ⚠️ بيتحفظ مع الورقة: الطبعة التانية لازم تقص زي الأولى
	// بالظبط، وإلا الورقة بتطلع مختلفة عن اللي اتطبعت.
	Cut bool `json:"cut,omitempty"`
}

var (
	plMu   sync.Mutex
	plData []printLogEntry
	plRead bool
)

// المجلد اللي بنكتب فيه — نفس مجلد الإعدادات بالظبط.
//
// ⚠️ بنشتق من settingsPath() مش من مسار البرنامج: settingsPath
// بتجرّب الكتابة فعلًا وبترجع لمجلد المستخدم لو المجلد مقفول
// (Program Files). لو كتبنا المنطق ده تاني هنا، الملفين ممكن
// يتفرّقوا يوم ما واحد يتصلّح والتاني لأ.
func helperDataDir() string {
	return filepath.Dir(settingsPath())
}

func printLogPath() string { return filepath.Join(helperDataDir(), "printlog.json") }
func sheetsDir() string    { return filepath.Join(helperDataDir(), "sheets") }

func loadPrintLog() []printLogEntry {
	if plRead {
		return plData
	}
	plRead = true
	b, err := os.ReadFile(printLogPath())
	if err != nil {
		return plData
	}
	var got []printLogEntry
	// الملف البايظ = سجل فاضي، مش وقوع.
	if err := json.Unmarshal(b, &got); err == nil {
		plData = got
	}
	return plData
}

// بترجّع نسخة من السجل — الأحدث الأول.
func printLogEntries() []printLogEntry {
	plMu.Lock()
	defer plMu.Unlock()
	src := loadPrintLog()
	// ⚠️⚠️ بنعكس الترتيب **قبل** ما نرتّب بالوقت. السبب اتقاس في
	// فحص حقيقي: طبعتين في نفس المللي ثانية بيبقى وقتهم متساوي،
	// والترتيب الثابت (stable) بيسيبهم بترتيب الكتابة — يعني
	// **الأقدم فوق**. والعكس ده بيخلّي المتساويين يطلعوا الأحدث
	// الأول زي الباقي بالظبط.
	out := make([]printLogEntry, 0, len(src))
	for i := len(src) - 1; i >= 0; i-- {
		out = append(out, src[i])
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Ms > out[j].Ms })
	return out
}

// ⚠️ بتتنده **بعد** الطباعة وبس. أي خطأ هنا بيتبلّع: السجل مايوقفش
// الطبعة.
func addPrintLog(e printLogEntry) {
	if e.Ms == 0 {
		e.Ms = nowMs()
	}
	plMu.Lock()
	defer plMu.Unlock()
	cur := loadPrintLog()
	cur = append(cur, e)
	// ⚠️ القص من الأول: الأقدم هو اللي بيطير.
	if len(cur) > maxPrintLog {
		cur = cur[len(cur)-maxPrintLog:]
	}
	plData = cur
	writePrintLogLocked()
}

func writePrintLogLocked() {
	b, err := json.Marshal(plData)
	if err != nil {
		log.Printf("تعذّر تجهيز سجل الطباعة: %v", err)
		return
	}
	if err := os.WriteFile(printLogPath(), b, 0o644); err != nil {
		log.Printf("تعذّر حفظ سجل الطباعة: %v", err)
	}
}

func nowMs() int64 { return time.Now().UnixNano() / int64(time.Millisecond) }

// ============================================================
// 📄 حفظ الورقة نفسها
// ============================================================
// بنحفظ الـPNG زي ما جه من النظام — مش البايتات اللي راحت للطابعة.
//
// ⚠️⚠️ ليه الـPNG: البايتات (ESC/POS) متظبّطة على إعدادات الماكينة
// **ساعة الطبعة**. لو صاحب المحل عاير الماكينة بعد كده، الورقة
// المحفوظة لازم تتطبع بالمعايرة الجديدة مش القديمة — والـPNG هو
// اللي بيسمح بده. وكمان الـPNG بيتفتح بالعين على أي جهاز.
//
// بترجّع اسم الملف، أو "" لو مااتحفظش (ومش خطأ يوقّف حاجة).
func saveSheet(png []byte) string {
	if len(png) == 0 || len(png) > maxSheetBytes {
		return ""
	}
	dir := sheetsDir()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		log.Printf("تعذّر عمل مجلد الأوراق: %v", err)
		return ""
	}
	name := itoa(nowMs()) + ".png"
	if err := os.WriteFile(filepath.Join(dir, name), png, 0o644); err != nil {
		log.Printf("تعذّر حفظ الورقة: %v", err)
		return ""
	}
	pruneSheets(dir)
	return name
}

// ⚠️ بيشيل الأقدم لما العدد يعدّي الحد. من غيرها المجلد بيكبر
// للأبد على جهاز محدش بيبص على القرص بتاعه.
func pruneSheets(dir string) {
	ents, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	names := []string{}
	for _, e := range ents {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".png") {
			names = append(names, e.Name())
		}
	}
	if len(names) <= maxSheets {
		return
	}
	// الاسم هو الوقت بالمللي، فالترتيب الأبجدي = ترتيب زمني
	// **طالما الأرقام بنفس الطول** — وهي كده لحد سنة 2286.
	sort.Strings(names)
	for _, n := range names[:len(names)-maxSheets] {
		os.Remove(filepath.Join(dir, n))
	}
}

// ⚠️⚠️ نفس حماية helper/fonts: الاسم اللي جاي من الصفحة مابيتحطش
// في مسار على طول. من غير ده، "../../settings.json" بيقرا أي ملف
// على الجهاز.
func sheetPath(name string) string {
	name = strings.TrimSpace(name)
	if name == "" || !strings.HasSuffix(name, ".png") {
		return ""
	}
	if name != filepath.Base(name) {
		return ""
	}
	for _, r := range name[:len(name)-4] {
		if r < '0' || r > '9' {
			return ""
		}
	}
	return filepath.Join(sheetsDir(), name)
}

// ============================================================
// 🌐 المسارات
// ============================================================

type printLogReply struct {
	Entries []printLogEntry `json:"entries"`
	Sheets  int             `json:"sheets"`
	Max     int             `json:"max"`
	MaxLog  int             `json:"maxLog"`
}

// GET /print/log
func handlePrintLog(w http.ResponseWriter, r *http.Request) {
	ents := printLogEntries()
	sheets := 0
	for _, e := range ents {
		if e.Sheet != "" && sheetExists(e.Sheet) {
			sheets++
		} else if e.Sheet != "" {
			// ⚠️⚠️ الورقة اتشالت (عدّت الحد) بس سطرها لسه في السجل.
			// لازم نفضّي الاسم قبل ما نبعت، وإلا الصفحة بتوري زرار
			// "اطبعها تاني" على ورقة مش موجودة — ودوسة بترجع خطأ.
			for i := range ents {
				if ents[i].Ms == e.Ms {
					ents[i].Sheet = ""
				}
			}
		}
	}
	writeJSON(w, http.StatusOK, printLogReply{Entries: ents, Sheets: sheets, Max: maxSheets, MaxLog: maxPrintLog})
}

func sheetExists(name string) bool {
	p := sheetPath(name)
	if p == "" {
		return false
	}
	st, err := os.Stat(p)
	return err == nil && !st.IsDir()
}

// GET /print/sheet?name=...  → الـPNG نفسه (عشان تبصّ عليه قبل ما تطبع)
func handleSheetFile(w http.ResponseWriter, r *http.Request) {
	p := sheetPath(r.URL.Query().Get("name"))
	if p == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "اسم ورقة مش مفهوم"})
		return
	}
	b, err := os.ReadFile(p)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "الورقة دي مش محفوظة عندنا"})
		return
	}
	w.Header().Set("Content-Type", "image/png")
	w.Write(b)
}

type reprintReq struct {
	Name    string `json:"name"`
	Printer string `json:"printer"`
}

// POST /print/sheet/reprint  → يطبع ورقة محفوظة تاني
//
// ⚠️⚠️ دي الميزة كلها: الورقة بتخرج من **الكمبيوتر** — من غير
// النظام، من غير حساب، ومن غير نت.
func handleSheetReprint(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, printReply{Error: "POST بس"})
		return
	}
	var in reprintReq
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, printReply{Error: "الطلب مش مفهوم"})
		return
	}
	p := sheetPath(in.Name)
	if p == "" {
		writeJSON(w, http.StatusBadRequest, printReply{Error: "اسم ورقة مش مفهوم"})
		return
	}
	raw, err := os.ReadFile(p)
	if err != nil {
		writeJSON(w, http.StatusNotFound, printReply{Error: "الورقة دي مش محفوظة عندنا"})
		return
	}
	printer := pickPrinter(strings.TrimSpace(in.Printer), "restock")
	if printer == "" {
		writeJSON(w, http.StatusBadRequest, printReply{Error: "مافيش طابعة متظبطة لورقة التزويد"})
		return
	}
	// ⚠️ بندوّر على القص المحفوظ مع الورقة. لو مالقيناهوش (سطر قديم)
	// بنقص — ده اللي كل ورقة تزويد بتعمله.
	cut := true
	for _, e := range printLogEntries() {
		if e.Sheet == in.Name {
			cut = e.Cut
			break
		}
	}
	data, wpx, hpx, err := pngToESCPOS(raw, cut)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, printReply{Error: err.Error()})
		return
	}
	if err := printRaw(printer, data, "ورقة تزويد (نسخة تانية)"); err != nil {
		writeJSON(w, http.StatusInternalServerError, printReply{Error: err.Error()})
		return
	}
	// ⚠️ الطبعة التانية بتتسجّل زي أي طبعة — من غير ما نحفظ الورقة
	// تاني (هي محفوظة أصلًا)، وبنربطها بنفس الملف عشان تتطبع تالت
	// مرة لو لزم.
	addPrintLog(printLogEntry{Kind: "restock", Printer: printer,
		Name: "نسخة تانية من ورقة محفوظة", Bytes: len(data), OK: true, Sheet: in.Name, Cut: cut})
	writeJSON(w, http.StatusOK, printReply{OK: true, Bytes: len(data), Width: wpx, Height: hpx})
}

// POST /print/log/clear → يفضّي السجل والأوراق
//
// ⚠️ موجود عشان صاحب المحل يقدر يمسح — مش عشان النظام ينده عليه.
func handlePrintLogClear(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "POST بس"})
		return
	}
	plMu.Lock()
	plData = nil
	plRead = true
	writePrintLogLocked()
	plMu.Unlock()
	if ents, err := os.ReadDir(sheetsDir()); err == nil {
		for _, e := range ents {
			if !e.IsDir() && strings.HasSuffix(e.Name(), ".png") {
				os.Remove(filepath.Join(sheetsDir(), e.Name()))
			}
		}
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
