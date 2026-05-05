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

function isTracking(text) {
  return /اتابع|متابعة|اوردر|طلب|فين/i.test(text);
}

function isReturn(text) {
  return /ارجاع|ارجع|استرجاع/i.test(text);
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
// 🤖 AI Intent (مع حماية)
// ========================

async function detectIntent(message) {
  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content:
              "حدد النية بكلمة واحدة: greeting, tracking, return_create, unknown"
          },
          { role: "user", content: message }
        ]
      })
    });

    const data = await res.json();

    return data?.choices?.[0]?.message?.content?.trim().toLowerCase();

  } catch {
    return "fallback";
  }
}

// ========================
// 🚀 API
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

    // 🧠 AI
    let intent = await detectIntent(message);

    // 💡 FALLBACK لو AI فشل
    if (!intent || intent === "fallback") {
      if (isGreeting(message)) intent = "greeting";
      else if (isTracking(message)) intent = "tracking";
      else if (isReturn(message)) intent = "return_create";
      else intent = "unknown";
    }

    extractData(message, session);

    let reply = "";

    // ========================
    // 🎯 Logic
    // ========================

    if (intent === "greeting") {
      reply = session.name
        ? "وعليكم السلام 👋"
        : "وعليكم السلام 👋 اقدر اساعدك ازاي؟";
    }

    else if (intent === "tracking") {
      reply = "تمام 👌 خلينا نتابع الأوردر بتاعك";
    }

    else if (intent === "return_create") {
      reply = `تقدر تعمل إرجاع من هنا 👇
https://www.noon.com`;
      return res.status(200).json({ reply });
    }

    else {
      reply = "تقصد متابعة أوردر ولا إرجاع؟ 🤔";
    }

    // ========================
    // 📌 Flow
    // ========================

    if (!session.name) {
      reply += "\nممكن الاسم اللي متسجل بيه الاوردر كامل؟";
    }

    else if (!session.phone) {
      reply += `\nتمام يا ${session.name} 👌 رقمك؟`;
    }

    else if (!session.address) {
      reply += "\nالعنوان بالتفصيل؟";
    }

    else {
      reply += `\nتمام يا ${session.name} 👌 المندوب هيتواصل معاك 🚚`;
    }

    sessions.set(sessionId, session);

    return res.status(200).json({ reply });

  } catch (err) {
    return res.status(200).json({
      reply: "السيستم ضغط شوية دلوقتي 😅 حاول تاني"
    });
  }
}
