import { checkPassword, generateToken } from "@/lib/auth";

export async function POST(request) {
  const { password } = await request.json();

  if (!checkPassword(password)) {
    return new Response(JSON.stringify({ error: "Invalid password" }), { status: 401 });
  }

  const token = await generateToken();
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Set-Cookie": `session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000`,
    },
  });
}
