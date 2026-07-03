export default {
  async fetch(request, env) {

    if (request.method !== "POST")
      return reply("CleanerRoyall Worker");

    try {

      const event = request.headers.get("X-GitHub-Event");

      if (event)
        return await github(request, env);

      return await api(request, env);

    } catch (e) {
      return json({
        ok: false,
        error: e.message || String(e)
      }, 500);
    }

  }
};

async function api(request, env) {

  const body = await request.json();

  if (body.key !== env.API_KEY)
    return json({ ok: false, error: "Unauthorized" }, 401);

  const text =
    (body.title ? "📢 " + body.title + "\n\n" : "") +
    (body.message || "");

  return telegram(text, env);

}

async function github(request, env) {

  const body = await request.json();

  let text = "📦 GitHub Push\n\n";

  if (body.repository)
    text += "📁 " + body.repository.full_name + "\n";

  if (body.ref)
    text += "🌿 " + body.ref.replace("refs/heads/", "") + "\n";

  if (body.pusher)
    text += "👤 " + body.pusher.name + "\n\n";

  if (Array.isArray(body.commits))
    body.commits.forEach(c => text += "• " + c.message + "\n");

  return telegram(text, env);

}

async function telegram(text, env) {

  const res = await fetch(
    "https://api.telegram.org/bot" +
    env.BOT_TOKEN +
    "/sendMessage",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: env.CHAT_ID,
        text: text
      })
    }
  );

  return new Response(await res.text(), {
    status: res.status,
    headers: {
      "Content-Type": "application/json"
    }
  });

}

function reply(text) {

  return new Response(text, {
    headers: {
      "Content-Type": "text/plain"
    }
  });

}

function json(obj, status) {

  return new Response(JSON.stringify(obj, null, 2), {
    status: status,
    headers: {
      "Content-Type": "application/json"
    }
  });

}