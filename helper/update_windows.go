//go:build windows

package main

import (
	"os"
	"os/exec"
	"syscall"
)

func updateSupported() bool { return true }

// ⚠️ بيشغّل النسخة الجديدة **منفصلة تمامًا** عن دي، وبعدين دي بتقفل.
// من غير الفصل، قفل البرنامج القديم بيقفل الجديد معاه.
//
// ⚠️⚠️ و`--updated` **مش زوّاقة**: اتبلّغ بالنص:
//
//	"لما اضغط علي تحديث النظام المساعد من الهاتف ميفتحش الواجهة بعد
//	 ما البرنامج المساعد يتحدث يعني يتحدث في صمت في الخلفيه"
//
// من غير العلم ده، النسخة الجديدة بتبتدي من غير أي أمر — يعني زي ما
// تكون المستخدم فتحها بإيده — فبتفتح صفحة البرنامج في المتصفح. وانت
// واقف في المحل قدام الزبون، والكمبيوتر بيفتح صفحة لوحده لأن حد
// دوس زرار من تليفونه.
func restartSelf() error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	cmd := exec.Command(exe, updatedFlag)
	cmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: 0x00000008 | 0x00000200} // DETACHED_PROCESS | NEW_PROCESS_GROUP
	return cmd.Start()
}
