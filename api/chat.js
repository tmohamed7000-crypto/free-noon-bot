const sessions = new Map();

// ========================
// 🧠 Helper Functions
// ========================

function normalize(text) {
  return text.trim().toLowerCase();
}

function isGreeting(text) {
  return /السلام|اهلا|hi|hello|مساء|صباح/i.test(text);
}

function isLikelyName(text) {
  const words = text.trim().split(" ");

  if (words.length < 2 || words.length > 3) return false;
  if (/\d/.test(text)) return false;
  if (isGreeting(text)) return false;
  if (/تمام|اوكي|حاضر|ماشي/i.test(text)) return false;
  if (text.length < 3 || text.length > 25) return false;

  return true;
}

// ========================
// 🧠 Extract Data (ذكي)
// ========================

function extractData(text, session) {
  const clean = normalize(text);

  // ❌ تجاهل تكرار نفس الاسم
  if (session.name && normalize(session.name) === clean) return;

  // ✅ اسم
  if (!session.name && isLikelyName(text)) {
    session.name = text;
    return;
  }

  // ✅ رقم
  const phoneMatch = text.match(/01\d{9}/);
  if (phoneMatch && !session.phone) {
    session.phone = phoneMatch[0];
    return;
  }

  // ✅ عنوان (بشروط)
  if (
    session.phone &&
    !session.address &&
    text.length > 8 &&
    !isLikelyName(text)
  ) {
    session.address = text;
  }
}

// ========================
// 🧠 AI Intent Detection
// ========================

async function detectIntent(message) {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
حدد النية بكلمة واحدة فقط:
greeting, tracking, return_create, return_status, return_policy, unknown
بدون شرح
`
          },
          { role: "user", content: message }
        ]
      })
    });

    const data = await res.json();

    let intent = data?.choices?.[0]?.message?.content?.trim().toLowerCase();

    const allowed = [
      "greeting",
      "tracking",
      "return_create",
      "return_status",
      "return_policy"
    ];

    return allowed.includes(intent) ? intent : "unknown";

  } catch {
    return "unknown";
  }
}

// ========================
// 🚀 API Handler
// ========================

export default async function handler(req, res) {
  try {
    const { message, sessionId = "default" } = req.body;

    if (!message) {
      return res.status(200).json({ reply: "اكتب رسالة 😊" });
    }

    let session = sessions.get(sessionId) || {
      name: null,
      phone: null,
      address: null
    };

    // 🧠 Detect intent
    const intent = await detectIntent(message);

    // 🧠 Extract data
    extractData(message, session);

    let reply = "";

    // ========================
    // 🎯 Intent Logic
    // ========================

    if (intent === "greeting") {
      reply = session.name
        ? "وعليكم السلام 👋"
        : "وعليكم السلام 👋 اقدر اساعدك ازاي؟";
    }

    else if (intent === "return_create") {
      return res.status(200).json({
        reply: `تقدر تعمل طلب إرجاع بسهولة من خلال تطبيق أو موقع نون 👍

من هنا 👇
https://www.noon.com`
      });
    }

    else if (intent === "return_status") {
      reply = "لو وصلك رسالة من نون على واتساب، ده معناه إن المندوب في الطريق ليك يستلم الأوردر 🚚";
    }

    else if (intent === "return_policy") {
      reply = "الإرجاع بيكون خلال فترة حسب المنتج، وغالبًا المندوب بييجي خلال يوم أو يومين 👍";
    }

    else if (intent === "tracking") {
      reply = "لو وصلك رسالة من نون على واتساب، ده معناه إن الأوردر خرج من المخزن وهو في الطريق ليك 🚚";
    }

    else {
      reply = "تقصد متابعة أوردر ولا إرجاع؟ 🤔";
    }

    // ========================
    // 📌 Smart Flow (بدون غباء 😏)
    // ========================

    // ❌ لو المستخدم كرر نفس الحاجة → اسكت
    if (normalize(message) === normalize(session.name)) {
      return res.status(200).json({ reply: "" });
    }

    // ✅ اسم
    if (!session.name) {
      reply += "\nممكن الاسم المسجل عليه الأوردر؟";
    }

    // ✅ رقم
    else if (session.name && !session.phone && !/01\d{9}/.test(message)) {
      reply += `\nتمام يا ${session.name} 👌 ممكن رقم تليفونك؟`;
    }

    // ✅ عنوان
    else if (session.phone && !session.address) {
      reply += "\nممتاز 👍 ممكن العنوان بالتفصيل؟";
    }

    // ✅ تأكيد
    else if (session.name && session.phone && session.address) {
      reply += `\nتمام كده يا ${session.name} 👌 تم تأكيد البيانات والمندوب هيتواصل معاك قريب 🚚`;
    }

    // 💾 Save
    sessions.set(sessionId, session);

    return res.status(200).json({ reply });

  } catch (err) {
    return res.status(200).json({ reply: "في مشكلة في السيرفر 😅" });
  }
}
