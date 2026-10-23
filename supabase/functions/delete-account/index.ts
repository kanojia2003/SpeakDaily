import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const baseHeaders = {
  "Access-Control-Allow-Headers":
    "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function headersFor(request: Request) {
  const origin = request.headers.get("origin");
  const configured = (Deno.env.get("SPEAKDAILY_ALLOWED_ORIGINS") ?? "")
    .split(",").map((item) => item.trim()).filter(Boolean);
  const allowed = new Set([
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    ...configured,
  ]);
  return {
    ...baseHeaders,
    ...(origin && allowed.has(origin)
      ? { "Access-Control-Allow-Origin": origin }
      : {}),
  };
}

function response(
  request: Request,
  status: number,
  body: Record<string, unknown>,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headersFor(request),
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

async function readConfirmation(request: Request) {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]
    ?.trim().toLowerCase();
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (
    contentType !== "application/json" || declaredLength > 512 || !request.body
  ) {
    return false;
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 512) {
        await reader.cancel();
        return false;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const body: unknown = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
    return Boolean(
      body && typeof body === "object" && !Array.isArray(body) &&
        (body as Record<string, unknown>).confirm_delete === true &&
        Object.keys(body).length === 1,
    );
  } catch {
    return false;
  }
}

function safeSegment(value: string) {
  return value.length > 0 && value !== "." && value !== ".." &&
    !value.includes("/") && !value.includes("\\");
}

type PrivateBucket = {
  list: (
    path: string,
    options: {
      limit: number;
      offset: number;
      sortBy: { column: string; order: "asc" };
    },
  ) => Promise<{
    data: Array<{ name: string; id: string | null }> | null;
    error: unknown;
  }>;
  remove: (paths: string[]) => Promise<{ error: unknown }>;
};

async function listUserObjects(
  bucket: PrivateBucket,
  path: string,
  depth: number,
  objects: string[],
): Promise<void> {
  if (depth > 5) throw new Error("storage_path_invalid");
  const pageSize = 100;
  let offset = 0;
  while (true) {
    const { data, error } = await bucket.list(path, {
      limit: pageSize,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error("storage_list_failed");
    for (const entry of data ?? []) {
      if (!safeSegment(entry.name)) throw new Error("storage_path_invalid");
      const entryPath = `${path}/${entry.name}`;
      if (entry.id) {
        objects.push(entryPath);
      } else {
        await listUserObjects(bucket, entryPath, depth + 1, objects);
      }
    }
    if (!data || data.length < pageSize) break;
    offset += data.length;
  }
}

Deno.serve(async (request) => {
  const headers = headersFor(request);
  const origin = request.headers.get("origin");
  if (origin && !headers["Access-Control-Allow-Origin"]) {
    return response(request, 403, { error: "origin_not_allowed" });
  }
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") {
    return response(request, 405, { error: "method_not_allowed" });
  }
  if (!await readConfirmation(request)) {
    return response(request, 400, { error: "confirmation_required" });
  }

  const token = request.headers.get("authorization")
    ?.match(/^Bearer\s+(.+)$/i)?.[1];
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!token || !supabaseUrl || !anonKey || !serviceKey) {
    return response(request, 401, { error: "unauthorized" });
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(
    token,
  );
  if (authError || !authData.user) {
    return response(request, 401, { error: "unauthorized" });
  }
  const userId = authData.user.id;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const bucket = admin.storage.from("speaking-audio");
    const objectPaths: string[] = [];
    await listUserObjects(bucket, userId, 0, objectPaths);

    for (let offset = 0; offset < objectPaths.length; offset += 100) {
      const { error } = await bucket.remove(
        objectPaths.slice(offset, offset + 100),
      );
      if (error) throw new Error("storage_delete_failed");
    }

    const { error: sessionError } = await admin.from("speaking_sessions")
      .delete().eq("user_id", userId);
    if (sessionError) throw new Error("session_delete_failed");
    const { error: usageError } = await admin.from("speaking_evaluation_usage")
      .delete().eq("user_id", userId);
    if (usageError) throw new Error("usage_delete_failed");
    const { error: profileError } = await admin.from("profiles")
      .delete().eq("id", userId);
    if (profileError) throw new Error("profile_delete_failed");

    const { error: authDeleteError } = await admin.auth.admin.deleteUser(
      userId,
    );
    if (authDeleteError) throw new Error("auth_delete_failed");

    return response(request, 200, { deleted: true });
  } catch (error) {
    const code = error instanceof Error
      ? error.message
      : "account_delete_failed";
    console.error("Account deletion did not complete", { code });
    return response(request, 500, { error: "account_deletion_incomplete" });
  }
});
