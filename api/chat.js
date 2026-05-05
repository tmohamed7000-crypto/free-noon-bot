const sessions = new Map();

// 🧠 استخراج بيانات بسيط
function extractData(text, session) {
  if (!session.name && text.split(" ").length <= 3 && !text.match(/\d/)) {
    session.name = text;
  }

  const phoneMatch = text.match(/01\d{9}/);
  if (phoneMatch) {
    session.phone = phoneMatch[0];
  }

  if (session.phone && !session.address && text.length > 5) {
    session.address = text;
  }
}

// 🧠 AI Intent Detection
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
حدد نية المستخدم من الرسالة فقط بكلمة واحدة من دول:
greeting, tracking, return_create, return_status, return_policy, unknown

رد بكلمة واحدة فقط بدون أي شرح
`
          },
          { role: "user", content: message }
        ]
      })
    });

    const data = await res.json();
    let intent = data?.choices?.[0]?.message?.content?.trim().toLowerCase();

    const allowed = ["greeting","tracking","return_create","return_status","return_policy"];

    if (!allowed.includes(intent)) return "unknown";

    return intent;

  } catch {
    return "unknown";
  }
}

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

    // 🧠 فهم النية بالـ AI
    const intent = await detectIntent(message);

    // 🧠 استخراج البيانات
    extractData(message, session);

    let reply = "";

    // 🎯 Logic Controlled Replies

    if (intent === "greeting") {
      if (!session.name && !session.phone) {
        reply = "وعليكم السلام 👋 اقدر اساعد حضرتك ازاي ؟";
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

    // 📌 Data Flow (متحكم)
    if (intent !== "return_create") {
      if (session.name && !session.phone) {
        reply += `\nتمام يا ${session.name} 👌 ممكن رقم تليفونك؟`;
      }
      else if (session.phone && !session.address) {
        reply += "\nممتاز 👍 ممكن العنوان بالتفصيل؟";
      }
      else if (session.name && session.phone && session.address) {
        reply += `\nتمام كده يا ${session.name} 👌 تم تأكيد البيانات والمندوب في الطريق 🚚`;
      }
    }

    sessions.set(sessionId, session);

    res.status(200).json({ reply });

  } catch (err) {
    res.status(200).json({ reply: "في مشكلة في السيرفر 😅" });
  }
}
