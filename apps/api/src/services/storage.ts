import { Database } from "@/supabase-types";
import { SupabaseClient } from "@supabase/supabase-js";

const AVATAR_BUCKET = "profile-avatar";
const MEMORIES_BUCKET = "memories";
const ALBUM_PDF_BUCKET = "album-exports";

/** Turn the file name into an URL-compatible name. */
function urlify(name: string) {
  return name.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

/**
 * Gets the correct file extension based on MIME type
 */
function getFileExtensionFromMimeType(mimeType: string): string {
  const mimeToExtension: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/heic": "heic",
    "image/heif": "heif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/ogg": "ogv",
    "video/avi": "avi",
    "video/quicktime": "mov",
    "video/x-msvideo": "avi",
    "video/x-ms-wmv": "wmv",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
    "audio/mp4": "m4a",
    "audio/aac": "aac",
    "audio/flac": "flac",
    "audio/webm": "webm",
    "audio/m4a": "m4a",
    "audio/x-m4a": "m4a",
    "audio/3gpp": "3gp",
    "audio/3gpp2": "3gp",
    "audio/AMR": "amr",
    "audio/amr": "amr",
  };

  return (
    mimeToExtension[mimeType] || 
    mimeType.split("/").pop() ||
    "bin"
  );
}

/**
 * Normalizes MIME type to a format Supabase accepts
 */
function normalizeMimeType(mimeType: string): string {
  // For audio files, use generic octet-stream if it's a variant that Supabase may reject
  if (mimeType.startsWith("audio/")) {
    // Check if it's a problematic audio format
    if (mimeType.includes("x-m4a") || mimeType.includes("m4a")) {
      // Use a more generic MIME for audio
      return "application/octet-stream";
    }
  }
  
  // Map other non-standard types
  const mimeNormalization: Record<string, string> = {
    "video/quicktime": "application/octet-stream",
  };

  return mimeNormalization[mimeType] || mimeType;
}

/**
 * Determines the media type folder based on file MIME type
 */
function getMediaTypeFolder(mimeType: string): string {
  if (mimeType.startsWith("image/")) {
    return "imagenes";
  } else if (mimeType.startsWith("video/")) {
    return "videos";
  } else if (mimeType.startsWith("audio/")) {
    return "audios";
  } else {
    return "otros"; // Para otros tipos de archivos
  }
}

/**
 * Uploads a profile avatar to Supabase Storage and returns the public URL.
 */
export async function uploadUserAvatarImage(
  supabase: SupabaseClient<Database>,
  userId: string,
  file: File
): Promise<string> {
  // Use MIME type to determine correct extension, not original filename
  const mimeType = file.type || "application/octet-stream";
  const correctExtension = getFileExtensionFromMimeType(mimeType);
  const fileName = `${Date.now()}-avatar.${correctExtension}`;
  const path = `${userId}/${fileName}`;

  console.log("📤 Uploading avatar to Supabase Storage:", {
    path,
    fileName,
    mimeType,
    extension: correctExtension,
    fileSize: file.size,
  });

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) {
    let errorMessage = "Unknown storage error";
    
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "object" && error !== null) {
      const errorObj = error as any;
      errorMessage = 
        errorObj.message || 
        errorObj.error_description ||
        errorObj.error ||
        errorObj.statusMessage ||
        JSON.stringify(errorObj);
    } else {
      errorMessage = String(error);
    }

    console.error("🔴 Avatar upload error:", {
      path,
      mimeType,
      fileSize: file.size,
      error: errorMessage,
    });

    throw new Error(`Upload failed: ${errorMessage}`);
  }

  console.log("✅ Avatar uploaded successfully:", { path });
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Uploads a memory media file to Supabase Storage organized by media type and returns the public URL.
 * Files are organized as: {groupId}/{bookId}/{mediaType}/{fileName}
 * Where mediaType can be: imagenes, videos, audios, otros
 */
export async function uploadMemoryImage(
  supabase: SupabaseClient<Database>,
  groupId: string,
  bookId: string,
  file: File
): Promise<string> {
  // Use MIME type to determine correct extension, not original filename
  let mimeType = file.type || "application/octet-stream";
  const normalizedMimeType = normalizeMimeType(mimeType);
  const correctExtension = getFileExtensionFromMimeType(mimeType);
  const fileName = `${Date.now()}_${Math.random()
    .toString(36)
    .substring(2)}.${correctExtension}`;

  // Determinar el tipo de media y crear el path organizado
  const mediaTypeFolder = getMediaTypeFolder(mimeType);
  const path = `${groupId}/${bookId}/${mediaTypeFolder}/${fileName}`;

  console.log("📤 Uploading memory file to Supabase Storage:", {
    path,
    fileName,
    originalMimeType: mimeType,
    normalizedMimeType,
    extension: correctExtension,
    fileSize: file.size,
  });

  const { error } = await supabase.storage
    .from(MEMORIES_BUCKET)
    .upload(path, file, {
      contentType: normalizedMimeType,
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    let errorMessage = "Unknown storage error";
    let responseBody = "";
    
    try {
      const errorObj = error as any;
      
      // Try to read the Response body
      if (errorObj.originalError) {
        const resp = errorObj.originalError;
        if (resp instanceof Response && !resp.bodyUsed) {
          try {
            // Clone and read the body
            const cloned = resp.clone();
            responseBody = await cloned.text();
            console.error("🔴 Response body text:", responseBody);
            
            // Try to parse JSON
            if (responseBody) {
              try {
                const parsed = JSON.parse(responseBody);
                console.error("🔴 Parsed response:", parsed);
                errorMessage = parsed.message || parsed.error || JSON.stringify(parsed);
              } catch {
                errorMessage = responseBody;
              }
            }
          } catch (readErr) {
            console.error("Could not read response body:", readErr);
          }
        }
      }

      // Log detailed error info
      console.error("🔴 Full error object:", {
        keys: Object.keys(errorObj),
        name: errorObj.name,
        message: errorObj.message,
        status: (errorObj as any)?.originalError?.status,
        statusText: (errorObj as any)?.originalError?.statusText,
        bodyLength: responseBody.length,
        responseBody: responseBody.substring(0, 200),
      });

    } catch (e) {
      console.error("Error processing error object:", e);
      errorMessage = String(error);
    }

    console.error("🔴 Memory upload error - DEBUGGING RESPONSE BODY:", {
      path,
      fileName,
      normalizedMimeType,
      fileSize: file.size,
      error: errorMessage || "No error message extracted",
      responseBody: responseBody.substring(0, 500),
    });
    
    throw new Error(`Memory media upload failed: ${errorMessage || "Unknown error"}`);
  }

  console.log("✅ Memory file uploaded successfully:", { path });
  const { data } = supabase.storage.from(MEMORIES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Deletes a memory media object from Supabase Storage.
 * Expects a public URL produced by `getPublicUrl` for the `memories` bucket.
 */
export async function deleteMemoryMediaByPublicUrl(
  supabase: SupabaseClient<Database>,
  publicUrl: string
): Promise<void> {
  const normalizedUrl = publicUrl.split("?")[0] ?? publicUrl;
  const marker = `/storage/v1/object/public/${MEMORIES_BUCKET}/`;
  const index = normalizedUrl.indexOf(marker);

  if (index === -1) {
    throw new Error("Unsupported memories public URL format");
  }

  const path = normalizedUrl.substring(index + marker.length);
  if (!path) {
    throw new Error("Could not extract storage path from memories public URL");
  }

  const { error } = await supabase.storage.from(MEMORIES_BUCKET).remove([path]);
  if (error) {
    throw new Error(`Memory media delete failed: ${error.message}`);
  }
}
/**
 * Uploads an album cover image (generated by AI) to Supabase Storage and returns the public URL.
 * Files are organized as: album-covers/{groupId}/{albumId}/cover.png
 */
export async function uploadAlbumCoverImage(
  supabase: SupabaseClient<Database>,
  groupId: string,
  albumId: string,
  imageBuffer: Buffer
): Promise<string> {
  const path = `album-covers/${groupId}/${albumId}/cover.png`;

  const { error } = await supabase.storage
    .from(MEMORIES_BUCKET)
    .upload(path, imageBuffer, {
      contentType: "image/png",
      cacheControl: "3600",
      upsert: true,
    });

  if (error) {
    throw new Error(`Album cover image upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(MEMORIES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Uploads an album PDF export to Supabase Storage and returns the public URL.
 * Files are organized as: album-exports/{groupId}/{albumId}/{timestamp}.pdf
 */
export async function uploadAlbumPDF(
  supabase: SupabaseClient<Database>,
  groupId: string,
  albumId: string,
  buffer: Buffer
): Promise<string> {
  const timestamp = Date.now();
  const path = `${groupId}/${albumId}/${timestamp}.pdf`;

  const { error } = await supabase.storage
    .from(ALBUM_PDF_BUCKET)
    .upload(path, buffer, {
      contentType: "application/pdf",
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    throw new Error(`Album PDF upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(ALBUM_PDF_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}