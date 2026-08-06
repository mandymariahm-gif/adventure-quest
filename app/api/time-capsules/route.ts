import { NextResponse } from "next/server";

// Time capsules are submitted through the offline sync queue so they behave
// the same online and offline. This endpoint simply forwards to the batch
// handler shape for clients that call it directly.
export async function POST(request: Request) {
  const body = await request.json();
  const res = await fetch(new URL("/api/sync/batch", request.url), {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: request.headers.get("cookie") ?? "" },
    body: JSON.stringify({ mutations: [{ ...body, type: "time_capsule" }] }),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
