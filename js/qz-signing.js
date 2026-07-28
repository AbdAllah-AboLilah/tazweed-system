// ============================================================
// توقيع طلبات الطباعة لـ QZ Tray
// ============================================================
// الغرض: من غير توقيع، QZ Tray بيعتبر الموقع "Untrusted" وبيوري مربّع
// "Allow / Block" في كل طباعة، وبيمنع خيار "Remember this decision" عمدًا
// (عشان مايبقاش أي موقع على النت ياخد إذن دائم للطباعة على جهازك).
// مع التوقيع ده، الطباعة بتبقى صامتة 100% من غير أي مربّع.
//
// ⚠️ خطوة مطلوبة مرة واحدة على كل جهاز طباعة:
//    انسخ الملف docs/qz-tray/override.crt جوه مجلد تثبيت QZ Tray
//    (عادة C:\Program Files\QZ Tray\) وبعدين اقفل QZ Tray وافتحه تاني.
//    من غير الخطوة دي، الجهاز مش هيثق في التوقيع وهيفضل يسأل زي الأول.
//
// ⚠️ ملحوظة أمان (متقالة صراحة، مش مخبّاة): المفتاح الخاص تحت مكتوب في
//    كود الصفحة، وأي حد يفتح المستودع يقدر يشوفه. الخطر الفعلي محدود جدًا
//    لأن QZ Tray بيسمع على الجهاز نفسه بس (localhost)، ومش بيثق في
//    التوقيع ده غير على الأجهزة اللي انت نسخت عليها override.crt بإيدك.
//    يعني حد بعيد على النت مايقدرش يستغله. لو حبيت تلغي الثقة في أي وقت،
//    امسح override.crt من الأجهزة وأعد تشغيل QZ Tray.

const QZ_CERTIFICATE =
  '-----BEGIN CERTIFICATE-----\n' +
  'MIIDcTCCAlmgAwIBAgIUfSgR69tTgq7Rl321wJvelZRG03UwDQYJKoZIhvcNAQEN\n' +
  'BQAwSDEXMBUGA1UEAwwOVGF6d2VlZCBTeXN0ZW0xEDAOBgNVBAoMB1RhendlZWQx\n' +
  'DjAMBgNVBAsMBVByaW50MQswCQYDVQQGEwJFRzAeFw0yNjA3MjgxMjQ0NTJaFw00\n' +
  'NjA3MjMxMjQ0NTJaMEgxFzAVBgNVBAMMDlRhendlZWQgU3lzdGVtMRAwDgYDVQQK\n' +
  'DAdUYXp3ZWVkMQ4wDAYDVQQLDAVQcmludDELMAkGA1UEBhMCRUcwggEiMA0GCSqG\n' +
  'SIb3DQEBAQUAA4IBDwAwggEKAoIBAQCsnnFmV5GKEKKUpVFIzmQT7l2ad5yvrqME\n' +
  'UVgLJnfw0MVZzTRkJKo04R9CAXbiNbYgCS+RKjgZsEIv5f/PsPfGUBOemkEBWlNV\n' +
  'Aty/TUfIc3sVnEq4wGGqTcg2EvZh02twlwAg4t4mKTTZ6cW3G0bHEOMsm/ri6Rj5\n' +
  'fiielhsIXNYUcrTGheRPXhDMMZLvxJx77nSzxWZZlOaNXt2+mn99O4TylPyypy00\n' +
  'qB12RMZWztaaKlcWx0rzNd8qqWhQuS6P5WwCR0ZoBAnLMqPmc0X7rvvaIQQ2qGZH\n' +
  'O3JeQ/2enZ+VO2WuQAv2Wdf7qEIrhqi19aUB4xxe8KyXWNRG0QrpAgMBAAGjUzBR\n' +
  'MB0GA1UdDgQWBBRZunXb3IqTCIe0iQ07+fnduUy12TAfBgNVHSMEGDAWgBRZunXb\n' +
  '3IqTCIe0iQ07+fnduUy12TAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3DQEBDQUA\n' +
  'A4IBAQBJhmY8v18T97x0NAOpi37jU+Fhw03aRp8Av94tVtfYB42MJJ73hjnU6aiK\n' +
  'PxMuBrucnSLJechJsD+VYIMcZ0aVzZj0ml6Lj5DmAMXuc86LN2C1B/4rRYjzw+oV\n' +
  'W2F7evi41hK3QdnyDbnWsD8YZHshcf6OJJILs06GSn5hTsnt+8o/EdnpaRYZ0kqu\n' +
  'L7FjdZJwkodTnLD93RHToxiHWDp1k5+e0hUQS+7q/WGJ9WJ6NHoYLp8aqu/96kK6\n' +
  'tPMMkw2C0555FBhUHkH9JjTL2V6l6/I0F9mUs2rmeTnV6/B5+4iYbS/SX6/yuiCz\n' +
  'H5S5DNdwFDam40e4ExQmaVzCNF+D\n' +
  '-----END CERTIFICATE-----\n';

const QZ_PRIVATE_KEY =
  '-----BEGIN RSA PRIVATE KEY-----\n' +
  'MIIEpQIBAAKCAQEArJ5xZleRihCilKVRSM5kE+5dmnecr66jBFFYCyZ38NDFWc00\n' +
  'ZCSqNOEfQgF24jW2IAkvkSo4GbBCL+X/z7D3xlATnppBAVpTVQLcv01HyHN7FZxK\n' +
  'uMBhqk3INhL2YdNrcJcAIOLeJik02enFtxtGxxDjLJv64ukY+X4onpYbCFzWFHK0\n' +
  'xoXkT14QzDGS78Sce+50s8VmWZTmjV7dvpp/fTuE8pT8sqctNKgddkTGVs7WmipX\n' +
  'FsdK8zXfKqloULkuj+VsAkdGaAQJyzKj5nNF+6772iEENqhmRztyXkP9np2flTtl\n' +
  'rkAL9lnX+6hCK4aotfWlAeMcXvCsl1jURtEK6QIDAQABAoIBACFyX+GnJQ2d9Iqd\n' +
  'z7auOwj7nkpwU71ctrx+8HLUpNfV8+9XCgg/bHVri210MC9bneruLLfReOZNVz3F\n' +
  'sH/zN8dGu8528BKNiGkH8XLly/tkmNxSmM3chPAFOz5zBSdmWkKKF53Hp6i4QkPY\n' +
  '/pTgpaGrvYDmxkGSTeMF1WQJDLrdRJg36Y5yyPV5Dnc2xhra7gLr0bXa2lFu+sbC\n' +
  'aV3nsi2Aj0hj+S1ixOsBQ3yRZAvpQojX6KzJYkyIugPI9pNjv4klQo5sK1o+4DFg\n' +
  'vcZJmfRG+snk5XPUONlFjpwtTuXKsQzGvkOXz5wXPqAJQUBICblPSvBuyTd/7ynQ\n' +
  '4G/7/UkCgYEA29DXRUl4Win7N3SW/zOmIGCivWouXl4+37i3pVeO4LyTJsiNFl81\n' +
  'QwvQsRobK1CY/JfszLQw3BcDqg6HPE5cRVpiz74Kobix0wFmlDaBia4DVYQUgwDX\n' +
  'YZ1eX8+fRw2d4GeK0t0cALz4SqA8+INAC60yX+9y90jTeYP8sBk2LwUCgYEAyQiz\n' +
  'LaOcoElUsrC3NS63lNsZoEqoO/AkLVyG4aDKw6GL1fw+HkhRXEdrm8eGveehumVg\n' +
  'rcgpcnXYD8ifJ+EiCR04wC17YA/5FqiOCVDxhN3BHmFs5GHSam4+H9ulSUSH5kyh\n' +
  'FHAmcuiF1egjKPemQwNwsziQ3xNUNmWfFk0GiZUCgYEAtwL1d/ZngYoaYl1rqiYy\n' +
  'Vhqe490XpfIJnvKH091GU84tJckrzkiOa7fWlN0LadC8zvEecoBDfbqbjmZyKb+E\n' +
  'CynpwtSSvXqscuVjplqLFzoOBJDnEvsMV3VSMasHDX1EyKTsbAszWVn7zwYCPVXp\n' +
  'aM9WdZFCwqebijxdkbAr8JECgYEAkQpA09WuJAqkHAPZOnqJItFszLPwasYYI84U\n' +
  '1mZ+w+QiknFZk9mTMaOppIuw0AR1L5kCxn6aQKV7C/Avu8L3HmJB1o057RW5Hbrg\n' +
  'NyJ6DeU79qJNwPw+pmEBW1TKDHFwJxz0Pl2nr9HI9Yp1C5KZFtI9lmBiTT+Ry2lH\n' +
  '/Pv3kn0CgYEAnTmCjnBjR3RTDW2UPKpfrDERHVHrDmBxMbexaKhEQGut36Sxzf+/\n' +
  'oiWw4qxqnHabxJfou6FsafI5JracJEIOdCdRvUPdquzDEes5Az0WggnaoYxqmdmU\n' +
  'Y8IEikVFZCk04nnc4ZFi+n9c+5r/OW9w3V1QRjIu3ajzEbV7Q2B5/rY=\n' +
  '-----END RSA PRIVATE KEY-----\n';

// بيتنفّذ مرة واحدة عند تحميل الصفحة، قبل أي محاولة طباعة.
// لو مكتبة التوقيع (jsrsasign) أو qz نفسها مش متحمّلين، بنسيب الأمور زي
// ما هي — النظام هيشتغل عادي لكن هيسأل Allow في كل طباعة.
(function setupQZSigning() {
  if (typeof qz === 'undefined') return;

  qz.security.setCertificatePromise(function (resolve) {
    resolve(QZ_CERTIFICATE);
  });

  if (typeof KJUR === 'undefined' || typeof KEYUTIL === 'undefined') {
    console.warn('مكتبة التوقيع (jsrsasign) مش متحمّلة — QZ Tray هيسأل Allow في كل طباعة.');
    return;
  }

  qz.security.setSignatureAlgorithm('SHA512');
  qz.security.setSignaturePromise(function (toSign) {
    return function (resolve, reject) {
      try {
        const key = KEYUTIL.getKey(QZ_PRIVATE_KEY);
        const sig = new KJUR.crypto.Signature({ alg: 'SHA512withRSA' });
        sig.init(key);
        sig.updateString(toSign);
        resolve(stob64(hextorstr(sig.sign())));
      } catch (err) {
        console.error('فشل توقيع طلب الطباعة:', err);
        reject(err);
      }
    };
  });
})();
