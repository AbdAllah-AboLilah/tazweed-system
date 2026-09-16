//go:build windows

package main

// ============================================================
// 🗂️ شاشة "اختار ملف" بتاعة الويندوز
// ============================================================
// اتطلب بالنص: "ممكن تقولي هجيبه ازاي وده مش هيبقي زي لما بضغط علي
// استرداد ملف اصناف ويفتحلي شاشة الويندوز اختار الملف من الجهاز نفسه".
//
// ⚠️⚠️ ليه البرنامج هو اللي بيفتحها مش الصفحة:
// خانة الملف في المتصفح (input type=file) **مابتديش المسار**. بترجّع
// اسم الملف وC:\fakepath — ده حاجز أمان في كل المتصفحات ومالوش لف.
// وإحنا محتاجين المسار الحقيقي عشان نفضل نراقب الملف بعد ما الصفحة
// تتقفل. والبرنامج ده شغّال على الماكينة نفسها، فهو الوحيد اللي يقدر
// يفتح شاشة الويندوز الحقيقية ويرجّع المسار كامل.
//
// ⚠️ بنستخدم **powershell** بتاع الويندوز
// نفسه بدل ما نستدعي comdlg32 بالإيد — نفس المنطق اللي خلّى
// التشغيل-مع-الويندوز يتعمل بـreg.exe: مافيش اعتماد زيادة، والكود
// يتقرا. (وبناء OPENFILENAMEW بالإيد بايت بايت خطأ فيه مايبانش غير
// على ويندوز حقيقي — وإحنا مش بنقدر نجرّبه هنا.)

import (
	"context"
	"encoding/base64"
	"errors"
	"os/exec"
	"strings"
	"syscall"
	"time"
	"unicode/utf16"
)

// ⚠️ شاشة واحدة بس في المرة: لو النظام بعت الطلب مرتين (دوستين
// سريعتين)، هيفتح شاشتين والتانية هتفضل مستنية ورا الأولى.
var pickBusy = make(chan struct{}, 1)

// ⚠️ سقف وقت: لو حد فتح الشاشة وسابها، الطلب مايفضلش معلّق للأبد.
const pickTimeout = 3 * time.Minute

// ⚠️ TopMost: البرنامج شغّال في الخلفية (أيقونة جنب الساعة)، فالشاشة
// اللي هيفتحها ممكن تطلع **ورا المتصفح** والمستخدم يفتكر إن الزرار
// مابيشتغلش. بنديها نافذة صاحبة فوق الكل عشان تبان قدامه.
//
// ⚠️⚠️ وOutputEncoding UTF8 مش زيادة: المسار ممكن يكون فيه عربي
// (سطح المكتب بتاع مستخدم عربي مثلًا)، ومن غيرها بيرجع محروق.
const pickScript = `
Add-Type -AssemblyName System.Windows.Forms
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$d = New-Object System.Windows.Forms.OpenFileDialog
$d.Title = 'اختار ملف الأصناف'
$d.Filter = 'ملفات الإكسل|*.xlsx;*.xlsm;*.xls|كل الملفات|*.*'
$d.Multiselect = $false
$d.CheckFileExists = $true
if ($env:TZPICK_DIR -and (Test-Path $env:TZPICK_DIR)) { $d.InitialDirectory = $env:TZPICK_DIR }
$top = New-Object System.Windows.Forms.Form
$top.TopMost = $true
$top.ShowInTaskbar = $false
$top.Opacity = 0
$top.Show()
$r = $d.ShowDialog($top)
$top.Close()
if ($r -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($d.FileName) }
`

// ⚠️ EncodedCommand مش -Command: السكربت فيه عربي وعلامات اقتباس
// وأسطر — والتهريب في سطر الأوامر بتاع الويندوز فخ. بنبعته UTF-16
// مكوّد base64 — زي ما الويندوز نفسه بيتوقّعه.
func encodePS(s string) string {
	u := utf16.Encode([]rune(s))
	b := make([]byte, 0, len(u)*2)
	for _, c := range u {
		b = append(b, byte(c), byte(c>>8))
	}
	return base64.StdEncoding.EncodeToString(b)
}

// بترجّع المسار اللي اتختار، أو "" لو المستخدم قفل الشاشة.
func pickFileDialog(startDir string) (string, error) {
	select {
	case pickBusy <- struct{}{}:
		defer func() { <-pickBusy }()
	default:
		return "", errors.New("فيه شاشة اختيار مفتوحة على الكمبيوتر خلاص — كمّلها الأول")
	}

	ctx, cancel := context.WithTimeout(context.Background(), pickTimeout)
	defer cancel()

	// ⚠️ -STA شرط: شاشة الويندوز دي محتاجة الخيط يبقى Single-Threaded
	// Apartment، ومن غيرها بتفشل من غير ما تفتح.
	cmd := exec.CommandContext(ctx, "powershell", "-NoProfile", "-STA",
		"-EncodedCommand", encodePS(pickScript))
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	if startDir != "" {
		cmd.Env = append(cmd.Environ(), "TZPICK_DIR="+startDir)
	}
	out, err := cmd.Output()
	if ctx.Err() == context.DeadlineExceeded {
		return "", errors.New("شاشة الاختيار فضلت مفتوحة من غير ما تختار")
	}
	if err != nil {
		return "", errors.New("مقدرتش أفتح شاشة اختيار الملف: " + err.Error())
	}
	return strings.TrimSpace(string(out)), nil
}
