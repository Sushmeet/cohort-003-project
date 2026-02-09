import { Link, useFetcher, redirect } from "react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import type { Route } from "./+types/courses.$slug.purchase";
import {
  getCourseBySlug,
  getCourseWithDetails,
  getLessonCountForCourse,
} from "~/services/courseService";
import { isUserEnrolled, enrollUser, getEnrollmentCountForCourse } from "~/services/enrollmentService";
import { getCurrentUserId } from "~/lib/session";
import { CourseStatus } from "~/db/schema";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { BookOpen, Clock, Users, ArrowLeft } from "lucide-react";
import { CourseImage } from "~/components/course-image";
import { UserAvatar } from "~/components/user-avatar";
import { data } from "react-router";
import { formatDuration, formatPrice } from "~/lib/utils";

export function meta({ data: loaderData }: Route.MetaArgs) {
  const title = loaderData?.course?.title ?? "Purchase";
  return [
    { title: `Confirm Purchase: ${title} — Cadence` },
    { name: "description", content: `Confirm your enrollment in ${title}` },
  ];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const slug = params.slug;
  const course = getCourseBySlug(slug);

  if (!course) {
    throw data("Course not found.", { status: 404 });
  }

  if (course.status !== CourseStatus.Published) {
    throw data("Course not found.", { status: 404 });
  }

  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("You must be logged in to purchase a course.", { status: 401 });
  }

  if (isUserEnrolled(currentUserId, course.id)) {
    throw redirect(`/courses/${slug}`);
  }

  const courseWithDetails = getCourseWithDetails(course.id);
  if (!courseWithDetails) {
    throw data("Course not found.", { status: 404 });
  }

  const lessonCount = getLessonCountForCourse(course.id);
  const enrollmentCount = getEnrollmentCountForCourse(course.id);

  const totalDuration = courseWithDetails.modules.reduce(
    (sum, mod) =>
      sum + mod.lessons.reduce((s, l) => s + (l.durationMinutes ?? 0), 0),
    0
  );

  return {
    course: courseWithDetails,
    lessonCount,
    enrollmentCount,
    totalDuration,
  };
}

export async function action({ params, request }: Route.ActionArgs) {
  const slug = params.slug;
  const course = getCourseBySlug(slug);

  if (!course) {
    throw data("Course not found.", { status: 404 });
  }

  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("You must be logged in.", { status: 401 });
  }

  if (isUserEnrolled(currentUserId, course.id)) {
    throw redirect(`/courses/${slug}`);
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "confirm-purchase") {
    enrollUser(currentUserId, course.id, false, false);
    throw redirect(`/courses/${slug}/welcome`);
  }

  throw data("Invalid action.", { status: 400 });
}

export default function PurchaseConfirmation({
  loaderData,
}: Route.ComponentProps) {
  const { course, lessonCount, enrollmentCount, totalDuration } = loaderData;
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.error) {
      toast.error(fetcher.data.error);
    }
  }, [fetcher.state, fetcher.data]);

  const priceLabel = formatPrice(course.price);

  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-8">
      {/* Back link */}
      <Link
        to={`/courses/${course.slug}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to course
      </Link>

      <h1 className="mb-2 text-2xl font-bold">Confirm Your Purchase</h1>
      <p className="mb-8 text-muted-foreground">
        Review the details below before enrolling.
      </p>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 sm:flex-row">
            {/* Cover image */}
            <div className="w-full shrink-0 overflow-hidden rounded-lg sm:w-48">
              <CourseImage
                src={course.coverImageUrl}
                alt={course.title}
                className="aspect-video h-full w-full object-cover sm:aspect-auto"
              />
            </div>

            {/* Course info */}
            <div className="flex-1">
              <h2 className="mb-1 text-xl font-semibold">{course.title}</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                {course.description}
              </p>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <UserAvatar
                  name={course.instructorName}
                  avatarUrl={course.instructorAvatarUrl}
                  className="size-6"
                />
                <span>Taught by {course.instructorName}</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-6 flex flex-wrap gap-6 border-t pt-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <BookOpen className="size-4" />
              {lessonCount} {lessonCount === 1 ? "lesson" : "lessons"}
            </span>
            <span className="flex items-center gap-2">
              <Clock className="size-4" />
              {formatDuration(totalDuration, true, false, false)} total
            </span>
            <span className="flex items-center gap-2">
              <Users className="size-4" />
              {enrollmentCount}{" "}
              {enrollmentCount === 1 ? "student" : "students"} enrolled
            </span>
          </div>

          {/* Price + Confirm */}
          <div className="mt-6 border-t pt-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-muted-foreground">Total</span>
                <div className="text-3xl font-bold">{priceLabel}</div>
              </div>
              <div className="flex items-center gap-3">
                <Link to={`/courses/${course.slug}`}>
                  <Button variant="outline">Go Back</Button>
                </Link>
                <fetcher.Form method="post">
                  <input
                    type="hidden"
                    name="intent"
                    value="confirm-purchase"
                  />
                  <Button size="lg" disabled={isSubmitting}>
                    {isSubmitting ? "Processing..." : "Confirm Purchase"}
                  </Button>
                </fetcher.Form>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
