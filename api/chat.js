const sessions = new Map();

// ========================
// 🧠 Helpers
// ========================

function normalize(text) {
  return text.trim().toLowerCase();
}

function isGreeting(text) {
  return /السلام|اهلا|hi|hello|مرحبا|مساء|صباح/i.test(text);
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
// 🤖 AI (اختياري)
// ========================

async function detectIntent(message) {
  try {
    if (!process.env.DEEPSEEK_API_KEY) return "fallback";

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
    const { message, intent: manualIntent, sessionId = "default" } = req.body;

    if (!message && !manualIntent) {
      return res.status(200).json({ reply: "اكتب رسالة 😊" });
    }

    let session = sessions.get(sessionId) || {
      name: null,
      phone: null,
      address: null,
      intentChosen: false,
      intent: null
    };

    let intent = manualIntent || null;

    // 🧠 لو مفيش intent من الزر
    if (!intent) {
      intent = await detectIntent(message);

      if (!intent || intent === "fallback") {
        if (isGreeting(message)) intent = "greeting";
        else if (isTracking(message)) intent = "tracking";
        else if (isReturn(message)) intent = "return_create";
        else intent = "unknown";
      }
    }

    // ✅ حفظ الاختيار
    if (intent === "tracking" || intent === "return_create") {
      session.intentChosen = true;
      session.intent = intent;
    }

    // ========================
    // 🎯 قبل الاختيار → اعرض أزرار
    // ========================

    if (!session.intentChosen) {
      return res.status(200).json({
        reply: "اختار الخدمة 👇",
        buttons: [
          { text: "📦 متابعة أوردر", value: "tracking" },
          { text: "🔄 إرجاع منتج", value: "return_create" }
        ]
      });
    }

    // ========================
    // 📌 بعد الاختيار
    // ========================

    extractData(message || "", session);

    let reply = "";

    if (session.intent === "tracking") {
      reply = "تمام 👌 خلينا نتابع الأوردر بتاعك";
    }

    else if (session.intent === "return_create") {
      reply = "تمام 👌 هنساعدك في الإرجاع";
    }

    // ========================
    // 🧠 Data Flow
    // ========================

    if (!session.name) {
      reply += "\nممكن الاسم؟";
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

  } catch {
    return res.status(200).json({
      reply: "السيستم ضغط شوية 😅 حاول تاني"
    });
  }
}
