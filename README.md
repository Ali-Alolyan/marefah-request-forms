# مولّد الخطابات - جمعية معرفة (v14)

مولّد خطابات عربي خفيف (Static Web App) يدعم:
- **خطاب عام**
- **طلب عهدة**
- **طلب إغلاق عهدة**
- معاينة **A4** فورية مع كليشة الجمعية
- تصدير **PDF** (متوافق مع Safari/Chrome على Mac و iPhone)

> جميع الخطابات موجهة إلى: **سعادة المدير التنفيذي/ أ.د. محمد عبدالعزيز العواجي حفظه الله**

---

## تشغيل محلي (حل مشكلة 404)
**السبب الشائع للـ 404**: تشغيل السيرفر من مجلد غير الذي يحتوي `index.html`.

### الطريقة الأسهل (مُستحسنة)
1) ادخل مجلد المشروع:
```bash
cd letter-tool-v14
```
2) شغّل سيرفر محلي:
```bash
python3 -m http.server 8080
```
3) افتح في المتصفح:
- `http://localhost:8080/` أو `http://localhost:8080/index.html`

### إذا شغّلت السيرفر من المجلد الأب (Parent)
افتح:
- `http://localhost:8080/letter-tool-v14/index.html`

---

## رفعه على GitHub
### 1) إنشاء مستودع جديد
```bash
git init
git add .
git commit -m "Initial commit (letter-tool v14)"
```
ثم اربط المستودع (GitHub) وادفع:
```bash
git branch -M main
git remote add origin <YOUR_REPO_URL>
git push -u origin main
```

### 2) (اختياري) نشره على GitHub Pages
- من GitHub: **Settings → Pages**
- Source: **Deploy from a branch**
- Branch: **main** و Folder: **/(root)**

> لأن المشروع Static، فهو مناسب جدًا لـ GitHub Pages.

---

## تصدير PDF (جودة عالية)

- زر **تصدير PDF** يفتح نافذة طباعة مخصصة تحتوي على صفحات الخطاب فقط (بدون واجهة الموقع) لضمان نتيجة ثابتة بين Safari/Chrome على الجوال والكمبيوتر.

> ملاحظة: بعض المتصفحات قد تُظهر خيار **Headers & Footers** (مثل عنوان URL/الوقت) داخل شاشة الطباعة. عطّل هذا الخيار للحصول على مخرج مطابق للكليشة.

### إعدادات الطباعة الموصى بها (للـكمبيوتر)
عند Save as PDF تأكد من:
- Paper size: **A4**
- Margins: **None** (أو أدنى قيمة)
- Scale: **100%** (لا تستخدم Fit / Shrink)
- Disable: **Headers & Footers**
- Enable: **Background graphics** (حتى تظهر الكليشة كاملة)

---

## الجوال (Responsive)
- على الشاشات الصغيرة يظهر شريط تبديل **بالأسفل**: **المدخلات** / **المعاينة**.
- المعاينة تُصغّر تلقائيًا لتناسب عرض الشاشة.

---

## تخصيص مواضع حقول الهيدر
في `css/app.css` ستجد متغيرات (بوحدة mm) لحقول الهيدر:
- `--ov-hijri-top/left`
- `--ov-greg-top/left`
- `--ov-att-top/left`

ولتحريك التاريخين يمين/يسار بسرعة (بالـ px):
- `--ov-date-shift-x` (القيمة الافتراضية: `-5px`)

---

## استبدال الكليشة (Letterhead)
الصورة المستخدمة للمعاينة:
- `assets/letterhead.png` (خفيفة)

الصورة عالية الدقة للطباعة:
- `assets/letterhead-300.png` (تُستخدم تلقائياً عبر srcset)

**مستحسن** أن تكون بدقة 300 DPI (A4 = 2482×3510 px) لضمان PDF نظيف.

## الخط (Fonts)
الخط مضمّن محلياً داخل:
- `assets/fonts/IBMPlexSansArabic-*.ttf`

مع ملف الترخيص:
- `assets/fonts/OFL.txt`
