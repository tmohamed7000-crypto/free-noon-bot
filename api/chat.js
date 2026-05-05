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
// 🧠 Fallback Intent
// ========================

function fallbackIntent(message) {
  const msg = normalize(message);

  if (isGreeting(msg)) return "greeting";
  if (msg.includes("ارجاع") || msg.includes("مرتجع")) return "return_create";
  if (msg.includes("امتى") || msg.includes("وصل") || msg.includes("توصيل")) return "tracking";

  return "unknown";
}

// ========================
// 🧠 AI Intent Detection (SAFE)
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
            content: "حدد النية بكلمة واحدة فقط: greeting, tracking, return_create, return_status, return_policy, unknown"
          },
          { role: "user", content: message }
        ]
      })
    });

    // ❗ لو API رجع error
    if (!res.ok) {
      console.log("API STATUS:", res.status);
      return fallbackIntent(message);
    }

    // ❗ parse آمن
    const text = await res.text();

    if (!text) return fallbackIntent(message);

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      console.log("INVALID JSON:", text);
      return fallbackIntent(message);
    }

    const intent = data?.choices?.[0]?.message?.content?.trim().toLowerCase();

    const allowed = [
      "greeting",
      "tracking",
      "return_create",
      "return_status",
      "return_policy"
    ];

    return allowed.includes(intent) ? intent : fallbackIntent(message);

  } catch (e) {
    console.log("AI ERROR:", e);
    return fallbackIntent(message);
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

    const intent = await detectIntent(message);

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
      reply = "لو وصلك رسالة من نون على واتساب، ده معناه إن المندوب في الطريق يستلم الأوردر 🚚";
    }

    else if (intent === "return_policy") {
      reply = "الإرجاع بيكون خلال فترة حسب المنتج، وغالبًا المندوب بييجي خلال يوم أو يومين 👍";
    }

    else if (intent === "tracking") {
      reply = "لو وصلك رسالة من نون على واتساب، ده معناه إن الأوردر في الطريق ليك 🚚";
    }

    else {
      reply = "تقصد متابعة أوردر ولا إرجاع؟ 🤔";
    }

    // ========================
    // 📌 Smart Flow
    // ========================

    if (normalize(message) === normalize(session.name)) {
      return res.status(200).json({ reply: "" });
    }

    if (!session.name) {
      reply += "\nممكن الاسم المسجل عليه الأوردر؟";
    }

    else if (!session.phone) {
      reply += `\nتمام يا ${session.name} 👌 ممكن رقم تليفونك؟`;
    }

    else if (!session.address) {
      reply += "\nممتاز 👍 ممكن العنوان بالتفصيل؟";
    }

    else {
      reply += `\nتمام كده يا ${session.name} 👌 تم تأكيد البيانات والمندوب هيتواصل معاك قريب 🚚`;
    }

    sessions.set(sessionId, session);

    return res.status(200).json({ reply });

  } catch (err) {
    console.error("SERVER ERROR:", err);

    return res.status(200).json({
      reply: "حصل تأخير بسيط 😅 ممكن تقولّي عايز متابعة أوردر ولا إرجاع؟"
    });
  }
}
