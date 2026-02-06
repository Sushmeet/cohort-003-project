import { data } from "react-router";
import type { Route } from "./+types/api.video-tracking";
import { getCurrentUserId } from "~/lib/session";
import { logWatchEvent } from "~/services/videoTrackingService";

export async function action({ request }: Route.ActionArgs) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Unauthorized", { status: 401 });
  }

  const body = await request.json();
  const lessonId = Number(body.lessonId);
  const eventType = String(body.eventType);
  const positionSeconds = Number(body.positionSeconds);

  if (isNaN(lessonId) || isNaN(positionSeconds)) {
    throw data("Invalid parameters", { status: 400 });
  }

  logWatchEvent(currentUserId, lessonId, eventType, positionSeconds);

  return { success: true };
}
