const sessions = new Map();

// ========================
// 🧠 Helper Functions
// ========================

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

function extractData(text, session) {
  // اسم
  if (!session.name && isLikelyName(text)) {
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
حدد النية بكلمة واحدة فقط من:
greeting, tracking, return_create, return_status, return_policy, unknown
بدون أي شرح
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

    if (!allowed.includes(intent)) return "unknown";

    return intent;

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
      if (!session.name && !session.phone) {
        reply = "وعليكم السلام 👋 اقدر اساعد حضرتك ازاي؟";
      } else {
        reply = "وعليكم السلام 👋";
      }
    }

    else if (intent === "return_create") {
      reply = `تقدر تعمل طلب إرجاع بسهولة من خلال تطبيق أو موقع نون 👍

من هنا 👇
https://www.noon.com/`;
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
      reply = "مش فاهمك قوي 🤔 تقصد متابعة أوردر ولا إرجاع؟";
    }

    // ========================
    // 📌 Smart Data Flow
    // ========================

    if (intent !== "return_create" && intent !== "greeting") {

      if (!session.name) {
        reply += "\nممكن الاسم المسجل عليه الأوردر؟";
      }

      else if (session.name && !session.phone) {
        reply += `\nتمام يا ${session.name} 👌 ممكن رقم تليفونك؟`;
      }

      else if (session.phone && !session.address) {
        reply += "\nممتاز 👍 ممكن العنوان بالتفصيل؟";
      }

      else if (session.name && session.phone && session.address) {
        reply += `\nتمام كده يا ${session.name} 👌 تم تأكيد البيانات والمندوب في الطريق 🚚`;
      }
    }

    // 💾 Save session
    sessions.set(sessionId, session);

    return res.status(200).json({ reply });

  } catch (err) {
    return res.status(200).json({ reply: "في مشكلة في السيرفر 😅" });
  }
}
