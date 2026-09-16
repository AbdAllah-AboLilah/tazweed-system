package main

// ============================================================
// 🔄 التحديث الذاتي
// ============================================================
// اتطلب بالنص: "ينفع نعمل جوه البرنامج زرار ل التحديث لما اضغط عليه
// يحدث نفسه ونربط البرنامج بالخدمة السحابية او جيت هاب".
//
// إزاي بيشتغل: ملف نصّي صغير في المستودع فيه رقم النسخة وبصمة الملف.
// البرنامج بيقراه، ولو فيه نسخة أحدث بينزّلها ويستبدل نفسه.
//
// ⚠️⚠️ البصمة (SHA-256) **مش رفاهية**: البرنامج بينزّل ملف وبيشغّله.
// من غير التحقق، أي تنزيل ناقص أو مقطوع بيطلّع برنامج مكسّر بيشتغل
// على جهاز المحل. البصمة بتوقفه قبل ما يتحط.

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

const (
	updateBase = "https://raw.githubusercontent.com/AbdAllah-AboLilah/tazweed-system/main/helper/dist/"
	// ⚠️ سقف للتنزيل: من غيره رد غلط (صفحة خطأ مثلًا) ممكن يملا القرص.
	maxDownload = 40 << 20
)

// ⚠️ متغيّرات مش ثوابت عشان الفحص يقدر يوجّهها لسيرفر مقلّد —
// من غير كده مافيش طريقة نفحص "مايحمّلش وهو على آخر نسخة" من غير ما
// ننزّل 7 ميجا من الإنترنت في كل فحص.
var (
	updateInfoURL   = updateBase + "VERSION"
	updateBinaryURL = updateBase + "tazweed-helper.exe"
)

type updateInfoReply struct {
	Version   string `json:"version"`
	Current   string `json:"current"`
	Newer     bool   `json:"newer"`
	Error     string `json:"error,omitempty"`
	Supported bool   `json:"supported"`
}

var httpClient = &http.Client{Timeout: 60 * time.Second}

// بتقرا ملف النسخة: أول سطر الرقم، تاني سطر بصمة الملف.
func fetchLatest() (ver, sum string, err error) {
	resp, err := httpClient.Get(updateInfoURL)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", "", fmt.Errorf("جيت هاب رد %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1024))
	if err != nil {
		return "", "", err
	}
	lines := strings.Fields(string(body))
	if len(lines) < 2 {
		return "", "", errors.New("ملف النسخة شكله غريب")
	}
	return lines[0], strings.ToLower(lines[1]), nil
}

// بتقارن "1.2.3" بـ"1.10.0" صح — المقارنة النصّية بتغلط هنا.
func newerThan(a, b string) bool {
	pa, pb := strings.Split(a, "."), strings.Split(b, ".")
	for i := 0; i < 3; i++ {
		x, y := 0, 0
		if i < len(pa) {
			x, _ = strconv.Atoi(pa[i])
		}
		if i < len(pb) {
			y, _ = strconv.Atoi(pb[i])
		}
		if x != y {
			return x > y
		}
	}
	return false
}

// ⚠️⚠️ القرار لوحده عن التنفيذ — عشان يتفحص.
// applyUpdate كلها ورا حارس "ويندوز بس"، فلو القرار جوّاها مافيش
// طريقة نفحصه غير على ويندوز. والقرار ده بالظبط هو اللي العطل كان
// فيه: "بيرجع ينزل اخر نسخة حتي لو كانت علي الجهاز اخر نسخة".
func shouldDownload(force bool) (bool, string, error) {
	latest, sum, err := fetchLatest()
	if err != nil {
		return false, "", err
	}
	if !force && !newerThan(latest, version) {
		return false, sum, nil
	}
	return true, sum, nil
}

func checkUpdate() updateInfoReply {
	out := updateInfoReply{Current: version, Supported: updateSupported()}
	ver, _, err := fetchLatest()
	if err != nil {
		out.Error = err.Error()
		return out
	}
	out.Version = ver
	out.Newer = newerThan(ver, version)
	return out
}

// ------------------------------------------------------------
// التنزيل والاستبدال
// ------------------------------------------------------------
// ⚠️⚠️ الويندوز **مابيسمحش** تكتب فوق ملف شغّال، بس **بيسمح تغيّر
// اسمه**. فالترتيب ده مقصود بالحرف:
//   ١) ننزّل جنبه باسم .new
//   ٢) نتأكد من البصمة — **قبل** ما نلمس الأصلي
//   ٣) نغيّر اسم الشغّال لـ.old
//   ٤) نغيّر اسم الجديد للاسم الأصلي
//   ٥) نشغّل الجديد ونقفل
// ولو أي خطوة وقعت بعد (٣)، بنرجّع الاسم القديم مكانه — عشان
// مانسيبش المحل من غير برنامج.
//
// ⚠️⚠️ وبترجّع **هل اتحدّث فعلًا**: اتبلّغ بالنص: "لما بضغط علي
// تحديث المساعد بيرجع ينزل اخر نسخة حتي لو كانت علي الجهاز اخر نسخة".
//
// الدالة كانت بتنزّل الـ7 ميجا وتبدّل نفسها وتعيد التشغيل **من غير ما
// تبص على رقم النسخة أصلًا**. يعني "حدّث كل المساعدين" على 3 أجهزة
// كلهم على آخر نسخة = 21 ميجا تنزيل وتلات برامج بتقفل وتفتح مقابل
// لا حاجة — وفي وسط يوم شغل.
//
// دلوقتي بتقارن الأول. و`force` موجودة عشان إعادة التركيب لو النسخة
// اللي على الجهاز بايظة — من غيرها اللي على آخر رقم مالوش أي طريقة
// يصلّح بيها.
func applyUpdate(force bool) (bool, error) {
	if !updateSupported() {
		return false, errors.New("التحديث الذاتي على الويندوز بس")
	}
	want, wantSum, err := shouldDownload(force)
	if err != nil {
		return false, err
	}
	if !want {
		return false, nil
	}

	exe, err := os.Executable()
	if err != nil {
		return false, err
	}

	resp, err := httpClient.Get(updateBinaryURL)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return false, fmt.Errorf("تنزيل البرنامج رد %d", resp.StatusCode)
	}

	newPath := exe + ".new"
	f, err := os.OpenFile(newPath, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o755)
	if err != nil {
		return false, err
	}
	h := sha256.New()
	_, err = io.Copy(io.MultiWriter(f, h), io.LimitReader(resp.Body, maxDownload))
	f.Close()
	if err != nil {
		os.Remove(newPath)
		return false, err
	}

	got := hex.EncodeToString(h.Sum(nil))
	if got != wantSum {
		os.Remove(newPath)
		return false, fmt.Errorf("بصمة الملف مش مطابقة — التنزيل مش سليم")
	}

	oldPath := exe + ".old"
	os.Remove(oldPath)
	if err := os.Rename(exe, oldPath); err != nil {
		os.Remove(newPath)
		return false, err
	}
	if err := os.Rename(newPath, exe); err != nil {
		os.Rename(oldPath, exe) // رجّع اللي كان
		return false, err
	}
	return true, nil
}

// ============================================================
// ⚠️⚠️⚠️ "أنا اتحدّثت للتو" — البرنامج بيكتشفها بنفسه
// ============================================================
// اتبلّغ بالنص: "وراجع بردوا عمليت تحديث النظام المساعد في الخلفية
// لانها مش مظبوط".
//
// وكان محق. الإصلاح الأول كان في restartSelf: بتشغّل النسخة الجديدة
// بعلم --updated فتسكت. المشكلة إن **اللي بيشغّل هو البرنامج القديم**
// — يعني العلم بينفع من التحديثة **اللي بعد** اللي ركّبت الإصلاح.
// والمستخدم بيجرّب دلوقتي، والنسخة اللي عنده لسه القديمة.
//
// فالنسخة الجديدة بقت تكتشف بنفسها، من غير ما القديمة تتعاون:
//
//	applyUpdate بتسيب نسخة قديمة اسمها <البرنامج>.old جنبه
//	+ ملف البرنامج نفسه لسه متكتوب من ثواني (التنزيل)
//	= إحنا لسه اتحدّثنا
//
// ⚠️ والتنصيب اليدوي (بينزّل ويدوس دوبل كليك) **مافيهوش** ملف
// .old خالص — فالنافذة بتفتح عادي زي ما هو متعوّد.
//
// ⚠️⚠️ والتاريخ بيتقرا من **البرنامج نفسه** مش من .old:
// os.Rename بتنقل التاريخ القديم معاها، فتاريخ .old هو تاريخ النسخة
// القديمة — ممكن يبقى من شهر. تاريخ البرنامج الجديد هو لحظة التنزيل.
const justUpdatedWindow = 5 * time.Minute

func startedByUpdate() bool {
	exe, err := os.Executable()
	if err != nil {
		return false
	}
	return startedByUpdateAt(exe)
}

// ⚠️ المسار جاي من بره عشان الفحص يشتغل على **الكود ده نفسه**،
// مش على نسخة منه. النسخة في الفحص معناها إن أي غلط هنا يعدّي.
func startedByUpdateAt(exe string) bool {
	if _, err := os.Stat(exe + ".old"); err != nil {
		return false
	}
	// ⚠️⚠️ التاريخ من **البرنامج** مش من .old: os.Rename بتنقل
	// تاريخ النسخة القديمة معاها، فتاريخ .old ممكن يبقى من شهر.
	st, err := os.Stat(exe)
	if err != nil {
		return false
	}
	return time.Since(st.ModTime()) < justUpdatedWindow
}

// بتتنده أول ما البرنامج يشتغل: بتشيل النسخة القديمة اللي فضلت من
// تحديث سابق. مابتفشلش لو مالقتهاش.
//
// ⚠️ لازم تتنده **بعد** startedByUpdate — هي اللي بتمسح الدليل.
func cleanupOldBinary() {
	if exe, err := os.Executable(); err == nil {
		os.Remove(exe + ".old")
	}
}
