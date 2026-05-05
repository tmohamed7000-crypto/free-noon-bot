const sessions = new Map();

// ========================
// 🧠 Helpers
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
// 🧠 Extract Data
// ========================

function extractData(text, session) {
  const clean = normalize(text);

  if (session.name && normalize(session.name) === clean) return;

  if (!session.name && isLikelyName(text)) {
    session.name = text;
    return;
  }

  const phoneMatch = text.match(/01\d{9}/);
  if (phoneMatch && !session.phone) {
    session.phone = phoneMatch[0];
    return;
  }

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
// 🧠 Fallback Intent (بدون AI)
// ========================

function detectIntentLocal(message) {
  const text = normalize(message);

  if (/السلام|اهلا|hello|hi/.test(text)) return "greeting";
  if (/ارجاع|استرجاع|return/.test(text)) return "return_create";
  if (/اوردر|طلب|شحنة|track|delivery/.test(text)) return "tracking";

  return "unknown";
}

// ========================
// 🧠 DeepSeek Intent
// ========================

async function detectIntentAI(message) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500); // ⏱️ مهم

    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "حدد النية بكلمة واحدة: greeting, tracking, return_create, return_status, return_policy"
          },
          { role: "user", content: message }
        ]
      })
    });

    clearTimeout(timeout);

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
// 🚀 Handler
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

    // 🧠 أول حاجة: حاول local
    let intent = detectIntentLocal(message);

    // 🧠 لو مش واضح → استخدم AI
    if (intent === "unknown") {
      intent = await detectIntentAI(message);
    }

    // 🧠 Extract
    extractData(message, session);

    let reply = "";

    // ========================
    // 🎯 الردود
    // ========================

    if (intent === "greeting") {
      reply = session.name
        ? "وعليكم السلام 👋"
        : "وعليكم السلام 👋 اقدر اساعدك ازاي؟";
    }

    else if (intent === "return_create") {
      return res.status(200).json({
        reply: `تقدر تعمل طلب إرجاع بسهولة من خلال موقع نون 👍

https://www.noon.com`
      });
    }

    else if (intent === "tracking") {
      reply = "تمام 👌 عايز تتابع الأوردر";
    }

    else {
      reply = "ممكن توضح أكتر؟ تقصد متابعة أوردر ولا إرجاع؟ 🤔";
    }

    // ========================
    // 📌 Flow ذكي
    // ========================

    if (normalize(message) === normalize(session.name)) {
      return res.status(200).json({ reply: "" });
    }

    if (!session.name) {
      reply += "\nممكن الاسم المسجل عليه الأوردر؟";
    }

    else if (session.name && !session.phone && !/01\d{9}/.test(message)) {
      reply += `\nتمام يا ${session.name} 👌 ممكن رقم تليفونك؟`;
    }

    else if (session.phone && !session.address) {
      reply += "\nممتاز 👍 ممكن العنوان بالتفصيل؟";
    }

    else if (session.name && session.phone && session.address) {
      reply += `\nتمام كده يا ${session.name} 👌 تم تأكيد البيانات والمندوب هيتواصل معاك قريب 🚚`;
    }

    sessions.set(sessionId, session);

    return res.status(200).json({ reply });

  } catch (err) {
    return res.status(200).json({ reply: "في مشكلة في السيرفر 😅" });
  }
}
