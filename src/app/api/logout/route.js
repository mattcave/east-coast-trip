export async function POST() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      // Max-Age=0 tells the browser to delete the cookie immediately
      "Set-Cookie": "session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0",
    },
  });
}
