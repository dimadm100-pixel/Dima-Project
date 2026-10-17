# Finance Tracker — to'liq qo'llanma

## Avval bilib qo'y

**Hamma ma'lumot faqat sening telefoningda turadi.** Server yo'q, ro'yxatdan o'tish yo'q, hech narsa internetga yuborilmaydi. Hech kim — men ham, boshqa odam ham — sening raqamlaringni ko'ra olmaydi.

Bu yaxshi tomoni ham, xavfli tomoni ham. Agar brauzer ma'lumotlarini tozalasang yoki telefonni yo'qotsang, hammasi yo'qoladi. Shuning uchun:

> **Settings → Export data** ni vaqti-vaqti bilan bos va chiqqan faylni saqlab qo'y (Telegram'da o'zingga yuborib qo'ysang ham bo'ladi). Yangi telefonda **Import data** orqali qaytarasan.

Ilova internetsiz ham ishlaydi. Faqat FX Rates va Assistant internet talab qiladi.

## O'rnatish

Linkni telefonda ochasan, keyin:

- **Android (Chrome):** ⋮ menyu → **"Установить и создать ярлык"** (Install app)
- **iPhone (Safari):** Share belgisi → **"Add to Home Screen"**

Shundan keyin oddiy ilovadek ochiladi, to'liq ekran, internetsiz ham.

⚠️ Chrome menyusidagi **"Удалить данные о работе в браузере"** yoki saytning ma'lumotlarini tozalash — buni hech qachon bosma. U yozgan hamma narsangni o'chirib yuboradi.

## Birinchi ochganda

Welcome ekrani chiqadi va 2 ta narsa so'raydi:

1. **Tilni tanlaysan** — O'zbekcha, Русский yoki English.
2. **Qaysi kartada pul turadi** va **hozir qancha bor** — eng ko'p ishlatadigan kartang yoki naqd pul.
3. **Qaysi kundan boshlab hisob yuritasan** — odatda bugun.

Tamom. Keyin xohlagan paytda hammasini o'zgartirsang bo'ladi, qo'rqma.

Ko'proq karta qo'shish: **Position → + Add account**.
Boshlang'ich summani o'zgartirish: **Position** sahifasida eng pastdagi **Opening balance** qatoridagi **Edit** tugmasi.

## Kundalik ishlatish

Pastdagi **+** tugmasi — kirim yoki chiqim qo'shish uchun. U so'raydi: summa, sana, kategoriya va **qaysi kartadan**.

Kartani ko'rsatish muhim. Agar ko'rsatmasang, Position sahifasida **"Ledger doesn't balance"** degan ogohlantirish chiqadi — ya'ni umumiy pul va kartalardagi pul bir-biriga to'g'ri kelmayapti. **"Assign them now"** tugmasi bilan bir joyda hammasini to'g'rilaysan.

---

# Sahifalar

## 💵 Position — haqiqat

Bu sahifa "aslida nima bo'ldi" ni ko'rsatadi.

- Yuqorida bugungi umumiy balans.
- **Accounts** — har bir karta va naqd pul alohida, qanchadan qolgani bilan. Bu summalar qo'lda yozilmaydi — boshlang'ich summadan va o'sha kartaga biriktirilgan harakatlardan o'zi hisoblanadi.
- **Ledger** — hamma kirim-chiqim, eng yangisi tepada, har birining yonida o'sha paytdagi qoldiq.
- Eng pastda **Opening balance** — boshlagan kuningdagi pul. **Edit** bosib har bir kartaning boshlang'ich summasini o'zgartirsang bo'ladi; umumiysi o'zi yangilanadi.
- Kartalar orasida pul o'tkazsang, u ham ro'yxatda ko'rinadi (lekin umumiy pulni o'zgartirmaydi — shunchaki bir joydan ikkinchisiga ko'chdi).

## 📅 Cash Flow — reja

Bu yerda kelajak yoziladi: qaysi kuni qancha kirim yoki chiqim kutilyapti.

- Byudjet qatorlarini **qo'shish, tahrirlash va o'chirish** mumkin — summasini ham, kirim/chiqim turini ham.
- Oylik **PLAN vs FAKT** — har bir kategoriya bo'yicha rejalashtirgan va aslida sarflagan puling yonma-yon.

Position "bo'ldi" bo'lsa, Cash Flow "bo'ladi" degani.

## 🏠 Home — bosh sahifa

Bir qarashda hammasi:

- Hozir qancha pul bor va **shu tezlikda necha kunga yetadi**.
- Shu oydagi kirim va chiqim.
- **Balans grafigi** — keyingi 21 kun: bugungacha fakt, keyin reja bo'yicha prognoz.
- **Budget watch** — qaysi kategoriyada byudjetdan oshib ketyapsan yoki juda tez sarflayapsan.
- Maqsadlar (Goals) bo'yicha foiz.
- Oxirgi harakatlar, yaqinlashayotgan byudjet qatorlari va oxirgi kredit reyting.

## 🧭 Planner — avtomat byudjet

Kelasi 12 oyga byudjetni o'zi tuzib beradi. Qayerdan oladi:

1. Avval **Settings** dagi takrorlanuvchi to'lovlaring (ijara, maosh) — bu sening aniq niyating.
2. Keyin **haqiqiy xarajatlaring** — har bir kategoriya bo'yicha oylik medianani oladi.
3. Agar fakt bo'lmasa — mavjud byudjetdan.

Tez-tez takrorlanadigan xarajat (masalan, ovqat) oy bo'ylab tarqatiladi, oyda bir marta bo'ladigani (ijara, maosh) odatdagi kuniga qo'yiladi.

Chiqqan rejani **ko'rib chiqasan, istalgan summasini o'zgartirasan**, qaysi davriylikda bo'lishini tanlaysan, keyin **Apply** qilasan.

> ⚠️ Bu **AI emas**. Oddiy matematika — sening o'z raqamlaring ustida. API key kerak emas, internet kerak emas, pul to'lanmaydi.

## 💡 Insights — tahlil

Sening raqamlaring tahlili. **Bu ham AI emas va internetsiz ishlaydi:**

- Jamg'arish foizi (savings rate).
- Qayerda pul ortiqcha oqib ketyapti.
- Har bir maqsadga shu tezlikda qachon yetasan va necha oyda.

Qo'shimcha: agar Settings'ga Anthropic API key qo'ysang, qo'shimcha "AI review" tugmasi chiqadi va matn ko'rinishida tahlil yozib beradi. **Majburiy emas** — sahifaning asosiy qismi keysiz ham to'liq ishlaydi.

## 💱 FX Rates — valyuta kursi

- Markaziy bankning rasmiy kursi — hozircha **USD va EUR**, kecha bilan farqi bilan.
- **"Load past 30/90/180 days"** tugmasi cbu.uz dan haqiqiy tarixni yuklaydi — ya'ni ilovani o'rnatgan kundan oldingi kurslarni ham ko'rsatadi.
- **"Track the live rate"** belgisi (default — o'chiq): yoqsang, **Marriage va Umrah** maqsadlari o'zingning qotirilgan kursing emas, jonli kurs bo'yicha qayta hisoblanadi. Sum tushsa, maqsad qimmatlashgani darrov ko'rinadi.
- Kurs belgilangan chegaradan oshsa yoki tushsa, Home sahifasida ogohlantirish chiqadi.

## 🤖 Assistant — ilova ichidagi AI

Suhbat oynasi: pul haqida savol berasan yoki vazifa topshirasan (masalan "kelasi yilga byudjet tuz"). U ma'lumotingni o'qiydi va o'zgartirish **taklif qiladi** — sen tasdiqlamaguningcha hech narsa o'zgarmaydi.

> Buning uchun **Anthropic API key** kerak (Settings'da), ishlatganing uchun pul to'lanadi. **Server olish kerak emas** — hech qanday server yo'q.
>
> Ishlatmasang ham bo'ladi: ilovaning qolgan hamma joyi keysiz to'liq ishlaydi, Planner va Insights ham.

## 🔍 Search

Istalgan xarajat, kirim yoki byudjet qatorini matn yoki summa bo'yicha qidirish.

## 🧮 Acc. Cash — to'plangan pul

Kun bo'yicha jadval: **reja bo'yicha** o'sha kuni qancha puling bo'lishi kerak va **aslida** qancha.

Eng foydali tomoni — kelajakdagi "teshik" ni oldindan ko'rsatadi: qaysi kuni pul minusga tushishi mumkinligini hali o'sha kun kelmasdan bilasan.

## 📈 P&L — foyda va zarar

Oylik kirim, chiqim va sof foyda. Pastida xarajatlar kategoriyalar bo'yicha taqsimlangan.

## ⚖️ Balance — balans hisoboti

- **Aktivlar:** naqd pul, investitsiya, qarzga berganlaring (receivable).
- **Majburiyatlar:** qarzlar, kreditlar.
- **Equity / net worth** = aktivlar − majburiyatlar. Ya'ni aslida qancha boyliging bor.

## 🎯 Goals — moliyaviy maqsadlar

Bu versiyada 3 ta aniq maqsad bor, har birining o'z kalkulyatori bilan:

- **Marriage** — yillik zaxira (USD) va kurs.
- **Home** — kvadrat metr, 1 m² narxi, boshlang'ich to'lov foizi, ustama va muddat.
- **Umrah** — bir kishi uchun summa (USD), necha kishi va zaxira.

Har biriga "hozirgacha yig'ilgan" summani yozib borasan, foiz o'zi hisoblanadi.

> Eslatma: maqsadlar nomi hozircha shu uchtasi — o'zing xohlagan nom bilan yangi maqsad qo'shib bo'lmaydi.

## 🏁 Targets — nazorat sanalari

O'zing muhim deb bilgan sanalar (masalan har chorak oxiri va yil oxiri). Har biriga: o'sha kuni qancha sof pul bo'lishini **rejalashtirgansan** va aslida **qancha bo'ldi**.

Acc. Cash ning qisqartirilgan, faqat muhim sanalardagi ko'rinishi.

## 🧾 Specs — tarkibi

Bitta summaning ichida nima borligini yozish uchun.

Masalan "Oziq-ovqat — 200,000": non 20,000, yog' 30,000, sariyog' 25,000 va hokazo. Jami o'zi qo'shiladi.

Yangi yozish uchun **+ New breakdown** tugmasi.

## 💳 Credit — kredit reyting

KATM dan ko'rgan reytingni vaqti-vaqti bilan yozib borasan. Ilova ballni, darajani (Excellent / Good / Fair) va vaqt bo'yicha grafikni ko'rsatadi.

## ⚙️ Settings — sozlamalar

"Oddiy sozlamalar" emas, muhim narsalar shu yerda:

- **Til** — O'zbekcha, Русский yoki English. Butun ilova darrov o'zgaradi.
- **Opening balance** — boshlang'ich summa va sana.
- **Recurring transactions** — har oy takrorlanadigan to'lovlar. Bir marta yozasan, keyin **"Generate into budget (12 months)"** bilan 12 oylik byudjetga bir zumda joylaysan.
- **AI features** — Anthropic API key va model.
- **Backup** — **Export data (.json)** va **Import data**. Buni unutma.
- **Danger zone** — hamma ma'lumotni o'chirish.

## 🗓️ Personal — pul emas

Yuqoridagi **💰 Finance ⇄ 🗓️ Personal** tugmalari orqali. Bu alohida sahifa:

- **Today's Plan** — bugungi ishlar, vaqti bilan.
- **Tomorrow** — ertaga uchun yozib qo'yasan, ertasiga o'zi bugungi rejaga o'tadi.
- **Routine** — haftalik doimiy jadval. Har kuni o'zi bugungi rejaga qo'shiladi.
- **Deadlines** — muddatlar.

Uning ma'lumoti pul ma'lumotidan butunlay alohida saqlanadi.

---

## Tez-tez beriladigan savollar

**Play Market'da bormi?**
Yo'q. Bu PWA — brauzerdan to'g'ridan-to'g'ri o'rnatiladi, do'kon kerak emas. Shuning uchun yangilanish ham o'zi keladi: ilovani ochsang, eng yangi versiyasi yuklanadi. Play Market'ga qo'yish ham mumkin, lekin buning uchun alohida paketlash kerak va hozircha hech qanday foydasi yo'q.

**Ikkalamizning ma'lumotimiz aralashib ketmaydimi?**
Yo'q. Ikkala nusxa butunlay alohida saqlanadi — bitta telefonda, bitta brauzerda ikkalasini ochsang ham bir-birini ko'rmaydi.

**Internet kerakmi?**
Faqat FX Rates va Assistant uchun. Qolgan hammasi internetsiz ishlaydi.

**Pul to'lanadimi?**
Yo'q. Faqat Assistant va Insights'dagi "AI review" uchun Anthropic API key kerak — u ixtiyoriy va alohida to'lanadi. Ilovaning o'zi, Planner va Insights'ning asosiy qismi — bepul.

**Ma'lumotni qanday ko'chiraman yangi telefonga?**
Eski telefonda Settings → Export data, faylni saqlaysan. Yangi telefonda ilovani o'rnatib, Settings → Import data.
