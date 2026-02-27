export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Handle upload
    if (request.method === "POST") {
      try {
        const formData = await request.formData();
        const file = formData.get("file");

        if (!file) {
          throw new Error("No file uploaded");
        }

        // Folder berdasarkan tipe file
        const folder = file.type.startsWith("image/")
          ? "covers/"
          : "audio/";

        const fileName = `${folder}${Date.now()}-${file.name}`;

        // Upload ke R2
        await env["dynotic-storage"].put(fileName, file.stream(), {
          httpMetadata: {
            contentType: file.type,
          },
        });

        // URL publik R2 (bucket harus public)
        const fileURL = `https://dynotic-storage.r2.cloudflarestorage.com/${fileName}`;

        return new Response(
          JSON.stringify({
            success: true,
            url: fileURL,
          }),
          {
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      } catch (err) {
        return new Response(
          JSON.stringify({
            success: false,
            error: err.message,
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }
    }

    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  },
};
