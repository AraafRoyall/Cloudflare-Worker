export default {
	async fetch(request, env) {

		if (request.method != "POST")
			return json({ ok: true, service: "CleanerRoyall Worker" });

		const type = request.headers.get("X-GitHub-Event");

		if (type)
			return await github(request, env);

		return await api(request, env);

	}
};

async function api(request, env) {

	try {

		const data = await request.json();

		if (data.key != env.API_KEY)
			return json({ ok: false, error: "Unauthorized" }, 401);

		const text = (data.title ? "📢 " + data.title + "\n\n" : "") + (data.message || "");

		return await telegram(text, env);

	} catch (e) {
		return json({ ok: false, error: e.toString() }, 500);
	}

}

async function github(request, env) {

	const signature = request.headers.get("X-Hub-Signature-256");
	if (!signature)
		return json({ ok: false, error: "Missing Signature" }, 401);

	const body = await request.text();

	if (!(await verify(body, signature, env.API_KEY)))
		return json({ ok: false, error: "Invalid Signature" }, 401);

	const payload = JSON.parse(body);

	const branch = (payload.ref || "").replace("refs/heads/", "");
	const repo = payload.repository?.full_name || "";
	const pusher = payload.pusher?.name || "";
	const commits = payload.commits || [];

	let msg = "📦 GitHub Push\n\n";
	msg += "📁 " + repo + "\n";
	msg += "🌿 " + branch + "\n";
	msg += "👤 " + pusher + "\n\n";

	for (const c of commits)
		msg += "• " + c.message + "\n";

	return await telegram(msg, env);

}

async function telegram(text, env) {

	const res = await fetch(
		"https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage",
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

	const out = await res.json();

	return json(out, res.status);

}

async function verify(body, signature, secret) {

	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{
			name: "HMAC",
			hash: "SHA-256"
		},
		false,
		["sign"]
	);

	const hash = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(body)
	);

	const hex = [...new Uint8Array(hash)]
		.map(b => b.toString(16).padStart(2, "0"))
		.join("");

	return "sha256=" + hex === signature;

}

function json(obj, status = 200) {

	return new Response(
		JSON.stringify(obj, null, 2),
		{
			status: status,
			headers: {
				"Content-Type": "application/json"
			}
		}
	);

}