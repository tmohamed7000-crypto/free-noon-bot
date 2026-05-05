const sessions = new Map();

function extractData(text, session) {
  // اسم (بدائي)
  if (!session.name && text.length < 30 && !text.match(/\d/)) {
    session.name = text;
  }

  // رقم
  const phoneMatch = text.match(/01\d{9}/);
  if (phoneMatch) {
    session.phone = phoneMatch[0];
  }

  // عنوان
  if (session.phone && !session.address && text.length > 5) {
    session.address = text;
  }
}

export default async function handler(req, res) {
  try {
    const { message, sessionId = "default" } = req.body;

    if (!message) {
      return res.status(200).json({ reply: "اكتب رسالة الأول 😊" });
    }

    // 📌 استرجاع أو إنشاء session
    let session = sessions.get(sessionId) || {
      history: [],
      name: null,
      phone: null,
      address: null
    };

    // 🧠 استخراج البيانات
    extractData(message, session);

    // 🧠 تحديد النية
    const text = message.toLowerCase();

    let intent = "unknown";

    if (text.match(/السلام|اهلا|hi|hello/)) intent = "greeting";
    else if (text.match(/ارجع|إرجاع|مرتجع/)) {
      if (text.match(/عملت|سجلت/)) intent = "return_status";
      else intent = "return_create";
    }
    else if (text.match(/امتى|فين|وصل|توصيل/)) intent = "tracking";

    let reply = "";

    // 🎯 الردود
    if (intent === "greeting") {
      reply = "وعليكم السلام 👋 تحب تتابع أوردر ولا عندك استفسار؟";
    }

    else if (intent === "return_create") {
      reply = `تقدر تعمل طلب إرجاع بسهولة من خلال تطبيق أو موقع نون 👍

من هنا 👇
https://www.noon.com`;
    }

    else if (intent === "return_status") {
      reply = "لو وصلك رسالة من نون على واتساب، ده معناه إن المندوب في الطريق ليك يستلم الأوردر 🚚";

      if (!session.name) {
        reply += "\nممكن الاسم المسجل عليه الأوردر؟";
      }
    }

    else if (intent === "tracking") {
      reply = "لو وصلك رسالة من نون على واتساب، ده معناه إن الأوردر خرج من المخزن وهو في الطريق ليك 🚚";

      if (!session.name) {
        reply += "\nممكن الاسم المسجل عليه الأوردر؟";
      }
    }

    else {
      reply = "ممكن توضح قصدك أكتر؟";
    }

    // 📌 flow البيانات
    if (intent !== "return_create") {
      if (session.name && !session.phone) {
        reply = `تمام يا ${session.name} 👌 ممكن رقم تليفونك؟`;
      }
      else if (session.phone && !session.address) {
        reply = "ممتاز 👍 ممكن العنوان بالتفصيل؟";
      }
      else if (session.name && session.phone && session.address) {
        reply = `تمام كده يا ${session.name} 👌 تم تأكيد البيانات والمندوب في الطريق 🚚`;
      }
    }

    // 💾 حفظ session
    sessions.set(sessionId, session);

    res.status(200).json({ reply });

  } catch (err) {
    res.status(200).json({ reply: "في مشكلة حصلت 😅" });
  }
}
