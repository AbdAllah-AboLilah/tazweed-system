//go:build windows

package main

// ============================================================
// 🔔 أيقونة في شريط المهام + إخفاء الشباك الأسود
// ============================================================
// اتطلب بالنص: "عاوزين نعمل ايقونة ل البرنامج ويبقي فيه اوبشن
// hidden icon".
//
// ⚠️⚠️ وده كمان بيحل مشكلة الـ؟؟؟؟ **من جذرها**: الشباك الأسود بتاع
// الويندوز مش عارف يرسم عربي حتى بعد ما حوّلناه UTF-8 — الخط النقطي
// بتاعه مافيهوش الحروف أصلًا. فبدل ما نلف حوالين المشكلة، بنخفي
// الشباك خالص وكل الكلام بيبقى في الواجهة (متصفح) وفي القايمة دي.

import (
	_ "embed"
	"syscall"

	"github.com/energye/systray"
)

//go:embed icon.ico
var trayIcon []byte

// ⚠️ إخفاء الشباك بدل ما نبنيه بـ-H windowsgui: كده لو حد شغّله من
// سطر الأوامر لأي سبب، لسه يقدر يشوف الرسائل. الإخفاء بيحصل للشباك
// اللي البرنامج فتحه هو بس.
func hideConsoleWindow() {
	k32 := syscall.NewLazyDLL("kernel32.dll")
	u32 := syscall.NewLazyDLL("user32.dll")
	h, _, _ := k32.NewProc("GetConsoleWindow").Call()
	if h != 0 {
		u32.NewProc("ShowWindow").Call(h, 0) // SW_HIDE
	}
}

func startTray(onQuit func()) {
	systray.Run(func() {
		systray.SetIcon(trayIcon)
		systray.SetTitle("مساعد التزويد")
		systray.SetTooltip("مساعد التزويد — نسخة " + version + "\nشغّال على " + addr)

		open := systray.AddMenuItem("افتح الواجهة", "يفتح صفحة الإعدادات والتجربة")
		upd := systray.AddMenuItem("شوف لو فيه تحديث", "بيفتح الواجهة على قسم التحديث")
		systray.AddSeparator()
		quit := systray.AddMenuItem("اقفل البرنامج", "بيوقف الطباعة المباشرة")

		open.Click(func() { openBrowser("http://" + addr) })
		upd.Click(func() { openBrowser("http://" + addr + "/?update=1") })
		quit.Click(func() {
			systray.Quit()
			onQuit()
		})
	}, func() {})
}
