import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";
import { getAssetDiskPath, getAssetPath, getAssetURL, mediaTypeExt } from "./assets";
import { randomBytes } from "node:crypto";

export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  console.log("uploading thumbnail for video", videoId, "by user", userID);

  // TODO: implement the upload here
  const video = getVideo(cfg.db, videoId);
  if (!video) {
    throw new NotFoundError("Couldn't find video");
  }
  if (video.userID !== userID) {
    throw new UserForbiddenError("Not authorized to upload");
  }

  const formData = await req.formData();
  const file = formData.get("thumbnail");
  if (!(file instanceof File)) {
    throw new BadRequestError("Thumbnail file missing");
  }

  const MAX_UPLOAD_SIZE = 10 << 20;

  if (file.size > MAX_UPLOAD_SIZE) {
    throw new BadRequestError("Thumbnail exceeds allowed 10mb");
  }

  const mediaType = file.type;
  if (!mediaType) {
    throw new BadRequestError("Missing content type for thumbnail");
  }

  const ext = mediaTypeExt(mediaType);
  if (ext !== ".jpeg" && ext !== ".png") {
    throw new BadRequestError("Wrong file extension!");
  }

  const assetPath = getAssetPath(mediaType);

  const assetDiskPath = getAssetDiskPath(cfg, assetPath);
  await Bun.write(assetDiskPath, file);

  const urlPath = getAssetURL(cfg, assetPath);
  video.thumbnailURL = urlPath;

  updateVideo(cfg.db, video);

  return respondWithJSON(200, null);
}
