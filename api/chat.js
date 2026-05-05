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

// ✅ يقبل كلمة واحدة أو كلمتين
function isLikelyName(text) {
  const words = text.trim().split(" ");

  if (words.length < 1 || words.length > 3) return false;
  if (/\d/.test(text)) return false;
  if (isGreeting(text)) return false;
  if (/تمام|اوكي|حاضر|ماشي/i.test(text)) return false;
  if (text.length < 2 || text.length > 25) return false;

  return true;
}

// ========================
// 🧠 Extract Data
// ========================

function extractData(text, session) {
  const clean = normalize(text);

  if (session.name && normalize(session.name) === clean) return;

  // اسم
  if (!session.name && isLikelyName(text)) {
    session.name = text;
    return;
  }

  // رقم
  const phoneMatch = text.match(/01\d{9}/);
  if (phoneMatch && !session.phone) {
    session.phone = phoneMatch[0];
    return;
  }

  // عنوان
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
// 🤖 AI Intent
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
              "حدد النية بكلمة واحدة فقط من: greeting, tracking, return_create, unknown"
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
      address: null,
      intent: null // 👈 أهم إضافة
    };

    // ========================
    // 🧠 Detect Intent
    // ========================

    let intent = await detectIntent(message);

    // fallback
    if (!intent || intent === "fallback") {
      if (isGreeting(message)) intent = "greeting";
      else if (isTracking(message)) intent = "tracking";
      else if (isReturn(message)) intent = "return_create";
      else intent = "unknown";
    }

    // 👇 خزّن النية (مرة واحدة)
    if (!session.intent && intent !== "greeting" && intent !== "unknown") {
      session.intent = intent;
    }

    // 👇 استخرج البيانات بعد ما النية تتحدد
    extractData(message, session);

    let reply = "";

    // ========================
    // 🎯 Logic
    // ========================

    // 👋 ترحيب فقط
    if (!session.intent) {
      reply = "وعليكم السلام 👋\nتقدر تختار:\n📦 متابعة أوردر\n↩️ إرجاع أوردر";
    }

    // 📦 متابعة
    else if (session.intent === "tracking") {
      reply = "تمام 👌 هنساعدك في متابعة الأوردر";
    }

    // ↩️ إرجاع (مباشر)
    else if (session.intent === "return_create") {
      return res.status(200).json({
        reply: `تقدر تعمل إرجاع من هنا 👇
https://www.noon.com`
      });
    }

    else {
      reply = "تقصد متابعة أوردر ولا إرجاع؟ 🤔";
    }

    // ========================
    // 📌 Flow (بعد تحديد النية فقط)
    // ========================

    if (session.intent === "tracking") {

      if (!session.name) {
        reply += "\nممكن الاسم اللي متسجل بيه الأوردر؟";
      }

      else if (!session.phone) {
        reply += `\nتمام يا ${session.name} 👌 ممكن رقم تليفونك؟`;
      }

      else if (!session.address) {
        reply += "\nممتاز 👍 ممكن العنوان بالتفصيل؟";
      }

      else {
        reply += `\nتمام يا ${session.name} 👌 تم تسجيل البيانات والمندوب هيتواصل معاك 🚚`;
      }
    }

    // 💾 Save
    sessions.set(sessionId, session);

    return res.status(200).json({ reply });

  } catch (err) {
    return res.status(200).json({
      reply: "السيستم ضغط شوية 😅 حاول تاني"
    });
  }
}
