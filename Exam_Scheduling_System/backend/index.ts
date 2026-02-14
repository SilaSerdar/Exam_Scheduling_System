import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { prisma } from "./src/prisma";
import { generateSchedule } from "./src/scheduler";
import { renderTimetablePdf, type TimetableDay, type TimetableEvent } from "./src/pdf";

function toAsciiFilename(input: string) {
  // Keep it HTTP-header-safe (ASCII). Replace Turkish chars and strip others.
  const map: Record<string, string> = {
    ı: "i",
    İ: "I",
    ş: "s",
    Ş: "S",
    ğ: "g",
    Ğ: "G",
    ü: "u",
    Ü: "U",
    ö: "o",
    Ö: "O",
    ç: "c",
    Ç: "C",
  };

  const replaced = input
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("");

  return replaced
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 180);
}

function contentDispositionAttachment(filenameUtf8: string) {
  const ascii = toAsciiFilename(filenameUtf8) || "download.pdf";
  const encoded = encodeURIComponent(filenameUtf8);
  // RFC5987 filename* is ASCII-safe (percent-encoded) but preserves UTF-8 name.
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

const app = new Elysia()
  .use(
    cors({
      origin: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    })
  )
  .use(
    swagger({
      path: "/swagger",
      documentation: {
        info: { title: "Exam Planning API", version: "0.1.0" },
      },
    })
  )
  .get("/health", () => ({ ok: true }))

  // Departments
  .get("/api/departments", async () =>
    prisma.department.findMany({ orderBy: { name: "asc" } })
  )
  .post(
    "/api/departments",
    async ({ body }) => prisma.department.create({ data: body }),
    { body: t.Object({ name: t.String({ minLength: 1 }) }) }
  )
  .put(
    "/api/departments/:id",
    async ({ params, body }) =>
      prisma.department.update({ where: { id: params.id }, data: body }),
    { body: t.Object({ name: t.String({ minLength: 1 }) }) }
  )
  .delete("/api/departments/:id", async ({ params }) =>
    prisma.department.delete({ where: { id: params.id } })
  )

  // Rooms
  .get("/api/rooms", async () =>
    prisma.room.findMany({ orderBy: { name: "asc" } })
  )
  .post(
    "/api/rooms",
    async ({ body }) => prisma.room.create({ data: body }),
    { body: t.Object({ name: t.String({ minLength: 1 }), capacity: t.Number() }) }
  )
  .put(
    "/api/rooms/:id",
    async ({ params, body }) =>
      prisma.room.update({ where: { id: params.id }, data: body }),
    { body: t.Object({ name: t.String({ minLength: 1 }), capacity: t.Number() }) }
  )
  .delete("/api/rooms/:id", async ({ params }) =>
    prisma.room.delete({ where: { id: params.id } })
  )

  // Teachers (+ availability)
  .get("/api/teachers", async () => {
    const teachers = await prisma.teacher.findMany({
      orderBy: { name: "asc" },
      include: { availability: true },
    });
    return teachers.map((t) => ({
      id: t.id,
      name: t.name,
      availableDays: t.availability.map((a) => a.dayOfWeek).sort((a, b) => a - b),
    }));
  })
  .post(
    "/api/teachers",
    async ({ body }) =>
      prisma.teacher.create({
        data: {
          name: body.name,
          availability: {
            create: body.availableDays.map((d) => ({ dayOfWeek: d })),
          },
        },
      }),
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        availableDays: t.Array(t.Number()),
      }),
    }
  )
  .put(
    "/api/teachers/:id",
    async ({ params, body }) =>
      prisma.teacher.update({
        where: { id: params.id },
        data: {
          name: body.name,
          availability: {
            deleteMany: {},
            create: body.availableDays.map((d) => ({ dayOfWeek: d })),
          },
        },
      }),
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        availableDays: t.Array(t.Number()),
      }),
    }
  )
  .delete("/api/teachers/:id", async ({ params }) =>
    prisma.teacher.delete({ where: { id: params.id } })
  )

  // Courses
  .get("/api/courses", async () =>
    prisma.course.findMany({
      orderBy: [{ department: { name: "asc" } }, { code: "asc" }],
      include: { department: true },
    })
  )
  .post(
    "/api/courses",
    async ({ body }) => prisma.course.create({ data: body }),
    {
      body: t.Object({
        code: t.String({ minLength: 1 }),
        name: t.String({ minLength: 1 }),
        departmentId: t.String({ minLength: 1 }),
        classLevel: t.Number(),
      }),
    }
  )
  .put(
    "/api/courses/:id",
    async ({ params, body }) =>
      prisma.course.update({ where: { id: params.id }, data: body }),
    {
      body: t.Object({
        code: t.String({ minLength: 1 }),
        name: t.String({ minLength: 1 }),
        departmentId: t.String({ minLength: 1 }),
        classLevel: t.Number(),
      }),
    }
  )
  .delete("/api/courses/:id", async ({ params }) =>
    prisma.course.delete({ where: { id: params.id } })
  )

  // Exam requests
  .get("/api/exam-requests", async () =>
    prisma.examRequest.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        course: { include: { department: true } },
        teacher: true,
      },
    })
  )
  .post(
    "/api/exam-requests",
    async ({ body }) => prisma.examRequest.create({ data: body }),
    {
      body: t.Object({
        courseId: t.String({ minLength: 1 }),
        teacherId: t.String({ minLength: 1 }),
        studentCount: t.Number(),
        durationMinutes: t.Number(),
      }),
    }
  )
  .put(
    "/api/exam-requests/:id",
    async ({ params, body }) =>
      prisma.examRequest.update({ where: { id: params.id }, data: body }),
    {
      body: t.Object({
        courseId: t.String({ minLength: 1 }),
        teacherId: t.String({ minLength: 1 }),
        studentCount: t.Number(),
        durationMinutes: t.Number(),
      }),
    }
  )
  .delete("/api/exam-requests/:id", async ({ params }) =>
    prisma.examRequest.delete({ where: { id: params.id } })
  )

  // Generate schedule
  .post(
    "/api/schedules/generate",
    async ({ body, set }) => {
      const rooms = await prisma.room.findMany();
      const requests = await prisma.examRequest.findMany({
        include: {
          course: true,
          teacher: { include: { availability: true } },
        },
      });

      const input = requests.map((r) => ({
        id: r.id,
        studentCount: r.studentCount,
        durationMinutes: r.durationMinutes,
        course: {
          id: r.course.id,
          code: r.course.code,
          name: r.course.name,
          departmentId: r.course.departmentId,
        },
        teacher: {
          id: r.teacher.id,
          name: r.teacher.name,
          availableDays: r.teacher.availability.map((a) => a.dayOfWeek),
        },
      }));

      const result = generateSchedule({
        examRequests: input,
        rooms,
        days: body.days,
        slots: body.slots,
      });

      if (!result.ok) {
        set.status = 400;
        return { ok: false, error: result.error };
      }

      const schedule = await prisma.$transaction(async (tx) => {
        const schedule = await tx.schedule.create({
          data: {
            name: body.name,
            days: JSON.stringify(body.days),
            slots: JSON.stringify(body.slots),
          },
        });

        for (const s of result.sessions) {
          const created = await tx.examSession.create({
            data: {
              scheduleId: schedule.id,
              courseId: s.courseId,
              teacherId: s.teacherId,
              dayOfWeek: s.dayOfWeek,
              slotIndex: s.slotIndex,
              startMinuteOfDay: s.startMinuteOfDay,
              endMinuteOfDay: s.endMinuteOfDay,
              durationMinutes: s.durationMinutes,
            },
          });

          await tx.examRoomAllocation.createMany({
            data: s.allocations.map((a) => ({
              examSessionId: created.id,
              roomId: a.roomId,
              assignedStudents: a.assignedStudents,
            })),
          });
        }

        return schedule;
      });

      const full = await prisma.schedule.findUnique({
        where: { id: schedule.id },
        include: {
          examSessions: {
            include: {
              course: { include: { department: true } },
              teacher: true,
              allocations: { include: { room: true } },
            },
          },
        },
      });

      return { ok: true, schedule: full };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        days: t.Array(t.Number()),
        slots: t.Array(t.String({ minLength: 1 })),
      }),
    }
  )
  .get("/api/schedules/latest", async ({ set }) => {
    const s = await prisma.schedule.findFirst({
      orderBy: { createdAt: "desc" },
    });
    if (!s) {
      set.status = 404;
      return { ok: false, error: "Schedule yok." };
    }
    return { ok: true, schedule: s };
  })
  .get("/api/schedules/:id", async ({ params, set }) => {
    const s = await prisma.schedule.findUnique({
      where: { id: params.id },
      include: {
        examSessions: {
          include: {
            course: { include: { department: true } },
            teacher: true,
            allocations: { include: { room: true } },
          },
        },
      },
    });
    if (!s) {
      set.status = 404;
      return { ok: false, error: "Schedule bulunamadı." };
    }
    return { ok: true, schedule: s };
  })

  // PDF exports
  .get(
    "/api/schedules/:id/pdf/department/:departmentId",
    async ({ params, set }) => {
      const schedule = await prisma.schedule.findUnique({
        where: { id: params.id },
      });
      if (!schedule) {
        set.status = 404;
        return { ok: false, error: "Schedule bulunamadı." };
      }

      const dept = await prisma.department.findUnique({
        where: { id: params.departmentId },
      });
      if (!dept) {
        set.status = 404;
        return { ok: false, error: "Bölüm bulunamadı." };
      }

      const slots: string[] = JSON.parse(schedule.slots);

      const sessions = await prisma.examSession.findMany({
        where: {
          scheduleId: schedule.id,
          course: { departmentId: dept.id },
        },
        include: {
          course: true,
          teacher: true,
          allocations: { include: { room: true } },
        },
      });

      const days = buildDays(schedule.days);
      const { startHour, endHour } = computeHourRange(sessions, slots);
      const events: TimetableEvent[] = sessions
        .map((s) => {
          const start = getStartMinute(s, slots);
          const end = getEndMinute(s, slots);
          if (start === null || end === null) return null;
          return {
            dayOfWeek: s.dayOfWeek,
            startMinuteOfDay: start,
            endMinuteOfDay: end,
            text: [
              s.course.name,
              s.teacher.name,
              s.allocations.map((a) => a.room.name).join(", "),
            ]
              .filter(Boolean)
              .join("\n"),
          } satisfies TimetableEvent;
        })
        .filter(Boolean) as TimetableEvent[];

      const pdf = await renderTimetablePdf({
        headerLines: [
          "SINAV PROGRAMI",
          `BÖLÜM: ${dept.name.toUpperCase()}`,
          `TAKVİM: ${schedule.name}`,
        ],
        days,
        startHour,
        endHour,
        events,
      });

      set.headers["content-type"] = "application/pdf";
      set.headers["content-disposition"] =
        contentDispositionAttachment(`department-${dept.name}-schedule.pdf`);
      return pdf;
    }
  )
  .get(
    "/api/schedules/:id/pdf/room/:roomId",
    async ({ params, set }) => {
      const schedule = await prisma.schedule.findUnique({
        where: { id: params.id },
      });
      if (!schedule) {
        set.status = 404;
        return { ok: false, error: "Schedule bulunamadı." };
      }

      const room = await prisma.room.findUnique({ where: { id: params.roomId } });
      if (!room) {
        set.status = 404;
        return { ok: false, error: "Sınıf bulunamadı." };
      }

      const slots: string[] = JSON.parse(schedule.slots);

      const allocations = await prisma.examRoomAllocation.findMany({
        where: { roomId: room.id, examSession: { scheduleId: schedule.id } },
        include: {
          examSession: { include: { course: true, teacher: true } },
        },
      });

      const days = buildDays(schedule.days);
      const sessions = allocations.map((a) => a.examSession);
      const { startHour, endHour } = computeHourRange(sessions, slots);
      const events: TimetableEvent[] = allocations
        .map((a) => {
          const start = getStartMinute(a.examSession, slots);
          const end = getEndMinute(a.examSession, slots);
          if (start === null || end === null) return null;
          return {
            dayOfWeek: a.examSession.dayOfWeek,
            startMinuteOfDay: start,
            endMinuteOfDay: end,
            text: [
              a.examSession.course.name,
              a.examSession.teacher.name,
              `${room.name} (${a.assignedStudents}/${room.capacity})`,
            ]
              .filter(Boolean)
              .join("\n"),
          } satisfies TimetableEvent;
        })
        .filter(Boolean) as TimetableEvent[];

      const pdf = await renderTimetablePdf({
        headerLines: [
          "SINAV PROGRAMI",
          `SINIF: ${room.name.toUpperCase()}`,
          `TAKVİM: ${schedule.name}`,
        ],
        days,
        startHour,
        endHour,
        events,
      });

      set.headers["content-type"] = "application/pdf";
      set.headers["content-disposition"] =
        contentDispositionAttachment(`room-${room.name}-schedule.pdf`);
      return pdf;
    }
  );

app.listen({ port: 3001, hostname: "0.0.0.0" });
console.log(`Backend running on http://0.0.0.0:3001`);

function formatMinutes(min: number) {
  const m = Math.max(0, Math.min(24 * 60, Math.floor(min)));
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function parseTimeToMinutes(label: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(label.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function buildDays(daysJson: string): TimetableDay[] {
  const dayNames = ["PAZARTESİ", "SALI", "ÇARŞAMBA", "PERŞEMBE", "CUMA", "CUMARTESİ", "PAZAR"];
  let arr: number[] = [];
  try {
    const p = JSON.parse(daysJson);
    if (Array.isArray(p)) arr = p as number[];
  } catch {
    arr = [0, 1, 2, 3, 4];
  }
  const uniq = [...new Set(arr)].filter((d) => Number.isFinite(d)).sort((a, b) => a - b);
  return uniq.map((d) => ({ dayOfWeek: d, label: dayNames[d] ?? `GÜN ${d}` }));
}

function getStartMinute(
  s: { startMinuteOfDay: number | null; slotIndex: number },
  slots: string[]
) {
  if (typeof s.startMinuteOfDay === "number") return s.startMinuteOfDay;
  const fromSlot = slots[s.slotIndex];
  if (!fromSlot) return null;
  return parseTimeToMinutes(fromSlot);
}

function getEndMinute(
  s: { endMinuteOfDay: number | null; startMinuteOfDay: number | null; slotIndex: number; durationMinutes: number | null },
  slots: string[]
) {
  if (typeof s.endMinuteOfDay === "number") return s.endMinuteOfDay;
  const start = getStartMinute(s, slots);
  const dur = typeof s.durationMinutes === "number" ? s.durationMinutes : 60;
  if (start === null) return null;
  return start + dur;
}

function computeHourRange(
  sessions: Array<{ startMinuteOfDay: number | null; endMinuteOfDay: number | null; slotIndex: number; durationMinutes: number | null }>,
  slots: string[]
) {
  const starts = sessions.map((s) => getStartMinute(s, slots)).filter((v): v is number => typeof v === "number");
  const ends = sessions.map((s) => getEndMinute(s, slots)).filter((v): v is number => typeof v === "number");
  // fallback to slot list
  for (const sl of slots) {
    const m = parseTimeToMinutes(sl);
    if (typeof m === "number") starts.push(m);
  }

  const minStart = starts.length ? Math.min(...starts) : 9 * 60;
  const maxEnd = ends.length ? Math.max(...ends) : minStart + 8 * 60;

  const startHour = Math.max(0, Math.min(23, Math.floor(minStart / 60)));
  const endHour = Math.max(startHour + 1, Math.min(24, Math.ceil(maxEnd / 60)));
  return { startHour, endHour };
}