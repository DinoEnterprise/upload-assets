
const PUBLIC_BASE_URL = "https://pub-ee08d555521649b1a4f4176053b2954c.r2.dev";

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    if (request.method !== "POST") {
      return json({ success: false, error: "Method Not Allowed" }, 405);
    }

    const bucket = env["dynotic-storage"];

    if (!bucket) {
      return json({ success: false, error: "R2 binding tidak ditemukan" }, 500);
    }

    try {
      const contentType = request.headers.get("Content-Type") || "";

      // ===== DELETE / CHECK FILE =====
      if (contentType.includes("application/json")) {
        const body = await request.json();
        const { action, url } = body;

        if (!url || !action) {
          throw new Error("Action dan URL wajib diisi");
        }

        const parsed = new URL(url);

        // Batasi hanya URL R2 milik Dynotic
        if (parsed.hostname !== new URL(PUBLIC_BASE_URL).hostname) {
          throw new Error("URL bukan file R2 Dynotic");
        }

        const key = decodeURIComponent(
          parsed.pathname.replace(/^\/+/, "")
        );

        // Hanya izinkan folder audio dan covers
        if (
          !key.startsWith("audio/") &&
          !key.startsWith("covers/")
        ) {
          throw new Error("Lokasi file tidak diizinkan");
        }

        if (action === "check") {
          const object = await bucket.head(key);

          return json({
            success: true,
            exists: !!object,
            key
          });
        }

        if (action === "delete") {
          const object = await bucket.head(key);

          if (!object) {
            return json({
              success: true,
              deleted: false,
              exists: false,
              message: "File memang sudah tidak tersedia"
            });
          }

          await bucket.delete(key);

          return json({
            success: true,
            deleted: true,
            exists: false,
            key
          });
        }

        throw new Error("Action tidak dikenal");
      }

      // ===== UPLOAD FILE (MEKANISME LAMA) =====
      const formData = await request.formData();
      const file = formData.get("file");

      if (!file) {
        throw new Error("No file uploaded");
      }

      const type = file.type.startsWith("image/")
        ? "covers/"
        : "audio/";

      const safeName = file.name
        .split(/[\\/]/)
        .pop()
        .replace(/[^\w.\- ()]/g, "_");

      const fileName = `${type}${Date.now()}-${safeName}`;

      await bucket.put(fileName, file.stream(), {
        httpMetadata: {
          contentType: file.type
        }
      });

      const fileURL = `${PUBLIC_BASE_URL}/${fileName
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`;

      return json({
        success: true,
        url: fileURL
      });

    } catch (err) {
      return json({
        success: false,
        error: err.message || "Terjadi kesalahan"
      }, 500);
    }
  }
};
