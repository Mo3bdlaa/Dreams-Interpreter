# النشر على Vercel (مجاناً)

التطبيق Next.js جاهز للنشر على Vercel. يحتاج فقط قاعدة بيانات سحابية
(SQLite عبر **Turso**، مجانية) ومتغيّرات بيئية.

---

## 1) أنشئ قاعدة بيانات Turso (مجانية)

من [turso.tech](https://turso.tech) (أو عبر CLI):

```bash
# ثبّت الـ CLI وسجّل الدخول
curl -sSfL https://get.tur.so/install.sh | bash
turso auth signup        # أو: turso auth login

# أنشئ قاعدة واطبع بياناتها
turso db create dreams-interpreter
turso db show dreams-interpreter --url          # => DATABASE_URL
turso db tokens create dreams-interpreter       # => DATABASE_AUTH_TOKEN
```

> الجداول تُنشأ **تلقائياً** عند أول طلب (CREATE TABLE IF NOT EXISTS)، فلا حاجة
> لأي migration يدوي.

## 2) ولّد سرّ الجلسات

```bash
openssl rand -base64 48      # => AUTH_SECRET
```

## 3) استورد المشروع إلى Vercel

1. ادخل [vercel.com/new](https://vercel.com/new) واربط حساب GitHub.
2. اختر مستودع `Dreams-Interpreter` والفرع `claude/dream-chatbot-app-8iw7E`
   (أو ادمجه إلى `main` أولاً).
3. Vercel يكتشف Next.js تلقائياً — لا تغيّر إعدادات البناء.

## 4) أضِف متغيّرات البيئة (Project → Settings → Environment Variables)

| المتغيّر | القيمة |
|----------|--------|
| `DATABASE_URL` | `libsql://...turso.io` (من الخطوة 1) |
| `DATABASE_AUTH_TOKEN` | توكن Turso |
| `AUTH_SECRET` | السرّ المُولّد (الخطوة 2) |
| `AI_API_KEY` | مفتاح المزوّد (OpenRouter/OpenAI…) |
| `AI_BASE_URL` | `https://openrouter.ai/api/v1` |
| `AI_MODEL` | `deepseek/deepseek-v4-flash-0731:free,inclusionai/ling-3.0-flash-vl:free,nvidia/nemotron-3-ultra-550b-a55b:free` (سلسلة بديلة تلقائية عند الـ 429) |
| `AI_MAX_TOKENS` | `1500` |
| `AI_DISABLE_REASONING` | `true` (لموديلات reasoning المجانية) |
| `AI_EMBED_MODEL` | *(لا تضعه)* الاسترجاع الدلالي **مفعّل تلقائياً** مع OpenRouter. ضع `off` لتعطيله |
| `AI_RATE_LIMIT_PER_HOUR` | *(اختياري)* عدد التفاسير لكل مستخدم في الساعة — الافتراضي ٣٠، و`0` يعطّل الحدّ |
| `ADMIN_EMAILS` | *(اختياري)* إيميلك للوصول للوحة `/admin` (عرض وإدارة كل المستخدمين) |

> بدون `AI_API_KEY` يعمل التطبيق بوضع fallback (استرجاع مباشر من المراجع).
> الاسترجاع الدلالي يعمل تلقائياً مع OpenRouter (المتجهات مُضمّنة في الريبو)؛
> `AI_EMBED_MODEL=off` يُبقي الاسترجاع لفظياً ومحلياً بالكامل.

## 5) Deploy

اضغط **Deploy**. بعد انتهاء البناء، التطبيق يعمل على رابط `*.vercel.app`.

---

## ملاحظات

- **مهلة الـ functions**: مضبوطة على 60s لمسارات الـ AI (`maxDuration`) لتفادي
  انقطاع التوليد على الخطة المجانية.
- **حجم الـ bundle**: قاعدة المعرفة (~4MB) والمتجهات المضغوطة (~15MB) مُضمّنة —
  ضمن حدود Vercel.
- **حدّ الموديلات المجانية** على OpenRouter ٢٠ طلباً/دقيقة، والاسترجاع الدلالي
  يستهلك طلباً إضافياً مع كل تفسير. لو ضغطت الحصة، عطّله بـ `AI_EMBED_MODEL=off`.
- **الخصوصية**: الاسترجاع الدلالي (المفعّل تلقائياً مع OpenRouter) يرسل نص الحلم
  لمزوّد الـ embeddings. ضع `AI_EMBED_MODEL=off` لإبقاء كل الاسترجاع محلياً.
- **لا تضع المفاتيح في الكود** — فقط في Environment Variables على Vercel.
