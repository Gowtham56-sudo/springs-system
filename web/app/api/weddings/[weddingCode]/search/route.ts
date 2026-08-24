import { NextRequest, NextResponse } from "next/server";
import {
  connectMongo,
  searchMatchingPhotos,
  processSelfie,
  getClientIp,
  checkRateLimit,
  validateImageMimeType,
  validateSelfieSize,
} from "backend";

interface RouteParams {
  params: Promise<{ weddingCode: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await connectMongo();
    const { weddingCode } = await params;

    const maxSearches = parseInt(
      process.env.MAX_SELFIE_SEARCHES_PER_MINUTE || "5",
      10
    );
    const clientIp = getClientIp(request);
    const rateLimitKey = `selfie:${weddingCode}:${clientIp}`;
    const rateCheck = checkRateLimit(rateLimitKey, maxSearches);

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: "Too many searches. Please wait a moment and try again.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.ceil((rateCheck.retryAfterMs || 60000) / 1000)
            ),
          },
        }
      );
    }

    const formData = await request.formData();
    const selfieFile = formData.get("selfie") as File | null;

    if (!selfieFile) {
      return NextResponse.json(
        { error: "Upload failed. Please try again." },
        { status: 400 }
      );
    }

    if (!validateImageMimeType(selfieFile.type)) {
      return NextResponse.json(
        { error: "Invalid image type. Please upload JPEG, PNG, or WebP." },
        { status: 400 }
      );
    }

    if (!validateSelfieSize(selfieFile.size)) {
      return NextResponse.json(
        { error: "Image too large. Maximum size is 50MB." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await selfieFile.arrayBuffer());

    // Process selfie - temporary, not stored
    const aiResult = await processSelfie(buffer, selfieFile.type);

    if ("error" in aiResult && aiResult.code) {
      const errorMessages: Record<string, string> = {
        NO_FACE: "Couldn't detect a face. Please upload a clear selfie.",
        MULTIPLE_FACES:
          "Please upload a selfie containing only one person.",
        LOW_QUALITY:
          "Face quality too low. Please upload a clearer selfie with good lighting.",
        INVALID_IMAGE: "Upload failed. Please try again.",
      };
      return NextResponse.json(
        {
          error: errorMessages[aiResult.code] || aiResult.error,
          code: aiResult.code,
        },
        { status: 422 }
      );
    }

    if ("error" in aiResult) {
      return NextResponse.json(
        { error: "Face processing failed. Please try again." },
        { status: 503 }
      );
    }

    console.log("Selfie processed successfully, embedding length:", aiResult.embedding.length);
    console.log("First 3 elements:", aiResult.embedding.slice(0, 3));

    const matches = await searchMatchingPhotos(
      weddingCode,
      aiResult.embedding
    );

    // Let's also log the highest score regardless of threshold for debugging!
    // We can do this by running vectorSearchFaces with threshold -1.0
    try {
      const { vectorSearchFaces } = await import("backend");
      const { getWeddingByCode } = await import("backend");
      const debugWedding = await getWeddingByCode(weddingCode);
      if (debugWedding && debugWedding._id) {
         const allRes = await vectorSearchFaces(debugWedding._id, aiResult.embedding, -1.0, 1);
         if (allRes.length > 0) {
            console.log(`DEBUG: Highest similarity score in DB is: ${allRes[0].score}`);
         } else {
            console.log(`DEBUG: No faces found in DB at all!`);
         }
      }
    } catch (e) {
      console.log("Debug error", e);
    }
    
    console.log(`Found ${matches.length} matches`);

    // Selfie buffer is garbage collected - not stored
    return NextResponse.json({
      matches,
      count: matches.length,
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Search failed. Please try again." },
      { status: 500 }
    );
  }
}
