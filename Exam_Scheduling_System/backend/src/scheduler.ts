export type RoomInput = { id: string; name: string; capacity: number };

export type ExamRequestInput = {
  id: string;
  studentCount: number;
  durationMinutes: number;
  course: {
    id: string;
    code: string;
    name: string;
    departmentId: string;
  };
  teacher: {
    id: string;
    name: string;
    availableDays: number[]; // 0=Mon..6=Sun
  };
};

export type GeneratedSession = {
  courseId: string;
  teacherId: string;
  dayOfWeek: number;
  slotIndex: number;
  startMinuteOfDay: number;
  endMinuteOfDay: number;
  durationMinutes: number;
  allocations: { roomId: string; assignedStudents: number }[];
};

export type GenerateScheduleResult =
  | { ok: true; sessions: GeneratedSession[] }
  | { ok: false; error: string };

function key(day: number, slot: number) {
  return `${day}:${slot}`;
}

function parseStartTimeToMinutes(label: string): number | null {
  // Expect "HH:MM" (we enforce MM=00 for whole-hour starts)
  const m = /^(\d{1,2}):(\d{2})$/.exec(label.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23) return null;
  if (mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  // half-open intervals [start,end)
  return aStart < bEnd && bStart < aEnd;
}

export function generateSchedule(params: {
  examRequests: ExamRequestInput[];
  rooms: RoomInput[];
  days: number[];
  slots: string[];
}): GenerateScheduleResult {
  const { examRequests, rooms, days, slots } = params;

  if (days.length === 0) return { ok: false, error: "Gün listesi boş." };
  if (slots.length === 0) return { ok: false, error: "Slot listesi boş." };
  if (rooms.length === 0) return { ok: false, error: "Sınıf/oda tanımı yok." };
  if (examRequests.length === 0)
    return { ok: false, error: "Sınav talebi yok." };

  const totalCapacity = rooms.reduce((a, r) => a + r.capacity, 0);
  const oversized = examRequests.find((r) => r.studentCount > totalCapacity);
  if (oversized) {
    return {
      ok: false,
      error: `Toplam kapasite yetersiz: ${oversized.course.code} için ${oversized.studentCount} öğrenci var, toplam kapasite ${totalCapacity}.`,
    };
  }

  const slotStarts: number[] = [];
  for (const s of slots) {
    const minutes = parseStartTimeToMinutes(s);
    if (minutes === null) {
      return { ok: false, error: `Slot formatı hatalı: "${s}". Örn: 09:00` };
    }
    if (minutes % 60 !== 0) {
      return { ok: false, error: `Slot başlangıcı tam saat olmalı: "${s}"` };
    }
    slotStarts.push(minutes);
  }

  // Hardest-first: larger exams and fewer available days first.
  const sorted = [...examRequests].sort((a, b) => {
    const aDays = a.teacher.availableDays.length || 0;
    const bDays = b.teacher.availableDays.length || 0;
    if (b.studentCount !== a.studentCount) return b.studentCount - a.studentCount;
    return aDays - bDays;
  });

  const sessions: GeneratedSession[] = [];

  const roomsByCapDesc = [...rooms].sort((a, b) => b.capacity - a.capacity);
  const placedByDay = new Map<
    number,
    { deptId: string; teacherId: string; roomIds: Set<string>; start: number; end: number }[]
  >();

  for (const req of sorted) {
    const deptId = req.course.departmentId;
    const teacherId = req.teacher.id;
    const teacherDays = new Set(req.teacher.availableDays);
    const duration = Math.max(1, Math.floor(req.durationMinutes || 0));

    let placed = false;

    for (const day of days) {
      if (!teacherDays.has(day)) continue;

      const placedToday = placedByDay.get(day) ?? [];

      for (let slotIndex = 0; slotIndex < slotStarts.length; slotIndex++) {
        const start = slotStarts[slotIndex]!;
        const end = start + duration;
        if (end > 24 * 60) continue;

        // Department / teacher conflicts (time overlap)
        let conflict = false;
        for (const p of placedToday) {
          if (!overlaps(start, end, p.start, p.end)) continue;
          if (p.deptId === deptId || p.teacherId === teacherId) {
            conflict = true;
            break;
          }
        }
        if (conflict) continue;

        // Rooms: compute rooms occupied during [start,end) for this day
        const occupiedRooms = new Set<string>();
        for (const p of placedToday) {
          if (!overlaps(start, end, p.start, p.end)) continue;
          for (const rid of p.roomIds) occupiedRooms.add(rid);
        }
        const freeRooms = roomsByCapDesc.filter((r) => !occupiedRooms.has(r.id));

        // Allocate rooms greedily (largest first) to minimize number of rooms.
        let remaining = req.studentCount;
        const allocations: { roomId: string; assignedStudents: number }[] = [];

        for (const room of freeRooms) {
          if (remaining <= 0) break;
          const take = Math.min(remaining, room.capacity);
          allocations.push({ roomId: room.id, assignedStudents: take });
          remaining -= take;
        }

        if (remaining > 0) continue; // not enough free rooms in this slot

        // Place it.
        sessions.push({
          courseId: req.course.id,
          teacherId,
          dayOfWeek: day,
          slotIndex,
          startMinuteOfDay: start,
          endMinuteOfDay: end,
          durationMinutes: duration,
          allocations,
        });

        placedToday.push({
          deptId,
          teacherId,
          roomIds: new Set(allocations.map((a) => a.roomId)),
          start,
          end,
        });
        placedByDay.set(day, placedToday);

        placed = true;
        break;
      }
      if (placed) break;
    }

    if (!placed) {
      return {
        ok: false,
        error: `Yerleştirilemedi: ${req.course.code} - ${req.course.name}. (Bölüm/oda/öğretmen müsaitliği kısıtları nedeniyle)`,
      };
    }
  }

  return { ok: true, sessions };
}

