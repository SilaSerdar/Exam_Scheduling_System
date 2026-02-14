<template>
  <div class="grid">
    <div class="col-12 lg:col-4">
      <div class="app-card">
        <div class="text-2xl font-semibold mb-1">Takvim Oluştur</div>
        <div class="text-sm text-500 mb-3">
          Gün/slot tanımla, sistem çakışmasız sınavları otomatik yerleştirir.
        </div>

        <div class="flex flex-column gap-3">
          <div class="flex flex-column gap-2">
            <label class="font-medium">Takvim adı</label>
            <InputText v-model="form.name" placeholder="Örn: Final Haftası" />
          </div>

          <div class="flex flex-column gap-2">
            <label class="font-medium">Günler</label>
            <MultiSelect
              v-model="form.days"
              :options="dayOptions"
              optionLabel="label"
              optionValue="value"
              display="chip"
              placeholder="Gün seçin"
            />
          </div>

          <div class="flex flex-column gap-2">
            <label class="font-medium">Başlangıç Saatleri (tam saat)</label>
            <div class="flex gap-2">
              <InputText v-model="newSlot" placeholder="09:00" class="flex-1" />
              <Button icon="pi pi-plus" @click="addSlot" />
            </div>
            <div class="flex flex-wrap gap-2">
              <Chip v-for="s in form.slots" :key="s" :label="s" removable @remove="removeSlot(s)" />
            </div>
          </div>

          <div class="flex gap-2">
            <Button label="Takvim Oluştur" icon="pi pi-play" class="flex-1" :loading="generating" @click="generate" />
            <Button label="Son Takvim" severity="secondary" icon="pi pi-refresh" :loading="loadingLatest" @click="loadLatest" />
          </div>
        </div>
      </div>

      <div class="app-card mt-3" v-if="scheduleId">
        <div class="text-lg font-semibold mb-2">PDF Çıktılar</div>
        <div class="text-sm text-500 mb-3">Her bölüm ve her sınıf için ayrı PDF indirebilirsiniz.</div>

        <div class="flex flex-column gap-2">
          <div class="font-medium">Bölüm bazlı</div>
          <div class="flex flex-wrap gap-2">
            <Button
              v-for="d in departments"
              :key="d.id"
              :label="d.name"
              icon="pi pi-file-pdf"
              severity="secondary"
              @click="downloadDepartment(d)"
            />
          </div>
        </div>

        <Divider />

        <div class="flex flex-column gap-2">
          <div class="font-medium">Sınıf bazlı</div>
          <div class="flex flex-wrap gap-2">
            <Button
              v-for="r in rooms"
              :key="r.id"
              :label="r.name"
              icon="pi pi-file-pdf"
              severity="secondary"
              @click="downloadRoom(r)"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="col-12 lg:col-8">
      <div class="app-card">
        <div class="flex justify-content-between align-items-center mb-3">
          <div>
            <div class="text-2xl font-semibold">Oluşturulan Program</div>
            <div class="text-sm text-500">
              Kurallar: aynı bölüm çakışmaz, aynı sınıfta aynı slotta 2 sınav olmaz, öğretmen müsait gün kısıtı var, kapasite aşarsa çoklu sınıf atanır.
            </div>
          </div>
        </div>

        <Message v-if="error" severity="error" :closable="false" class="mb-3">{{ error }}</Message>

        <DataTable :value="sessionRows" :loading="scheduleLoading" stripedRows>
          <Column field="dayLabel" header="Gün" style="width: 6rem" />
          <Column field="slotLabel" header="Saat" style="width: 10rem" />
          <Column field="department" header="Bölüm" style="width: 14rem" />
          <Column field="course" header="Ders" />
          <Column field="teacher" header="Öğretmen" style="width: 14rem" />
          <Column field="rooms" header="Sınıflar" style="width: 16rem" />
        </DataTable>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { api, downloadBlob } from "../api";
import { useToast } from "primevue/usetoast";

import Button from "primevue/button";
import InputText from "primevue/inputtext";
import MultiSelect from "primevue/multiselect";
import Chip from "primevue/chip";
import Divider from "primevue/divider";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Message from "primevue/message";

type Department = { id: string; name: string };
type Room = { id: string; name: string; capacity: number };

type Schedule = {
  id: string;
  name: string;
  days: string;
  slots: string;
  examSessions?: any[];
};

const toast = useToast();

const dayOptions = [
  { label: "Pzt", value: 0 },
  { label: "Sal", value: 1 },
  { label: "Çar", value: 2 },
  { label: "Per", value: 3 },
  { label: "Cum", value: 4 },
  { label: "Cmt", value: 5 },
  { label: "Paz", value: 6 },
];
const dayLabel = new Map(dayOptions.map((d) => [d.value, d.label] as const));

const departments = ref<Department[]>([]);
const rooms = ref<Room[]>([]);

const form = ref<{ name: string; days: number[]; slots: string[] }>({
  name: "Yeni Takvim",
  days: [0, 1, 2, 3, 4],
  slots: ["09:00", "13:00"],
});
const newSlot = ref("");

const generating = ref(false);
const scheduleLoading = ref(false);
const loadingLatest = ref(false);
const error = ref<string | null>(null);

const schedule = ref<Schedule | null>(null);
const scheduleId = computed(() => schedule.value?.id ?? null);

function addSlot() {
  const s = newSlot.value.trim();
  if (!s) return;
  if (form.value.slots.includes(s)) return;
  form.value.slots.push(s);
  newSlot.value = "";
}

function removeSlot(s: string) {
  form.value.slots = form.value.slots.filter((x) => x !== s);
}

async function loadMeta() {
  try {
    const [d, r] = await Promise.all([
      api.get<Department[]>("/api/departments"),
      api.get<Room[]>("/api/rooms"),
    ]);
    departments.value = d.data;
    rooms.value = r.data;
  } catch (e: any) {
    toast.add({
      severity: "error",
      summary: "Bağlantı hatası",
      detail: e?.response?.data?.error ?? e?.message ?? "API erişilemiyor",
      life: 5000,
    });
  }
}

async function generate() {
  error.value = null;
  generating.value = true;
  try {
    const res = await api.post<{ ok: boolean; error?: string; schedule?: any }>(
      "/api/schedules/generate",
      form.value
    );
    if (!res.data.ok) {
      error.value = res.data.error ?? "Takvim oluşturulamadı.";
      return;
    }
    schedule.value = res.data.schedule;
    toast.add({ severity: "success", summary: "Takvim oluşturuldu", life: 2500 });
  } catch (e: any) {
    error.value = e?.response?.data?.error ?? e?.message ?? "Takvim oluşturulamadı.";
  } finally {
    generating.value = false;
  }
}

async function loadLatest() {
  loadingLatest.value = true;
  error.value = null;
  try {
    const latest = await api.get<{ ok: boolean; schedule?: Schedule; error?: string }>("/api/schedules/latest");
    if (!latest.data.ok || !latest.data.schedule) {
      error.value = latest.data.error ?? "Takvim yok.";
      return;
    }
    scheduleLoading.value = true;
    const full = await api.get<{ ok: boolean; schedule?: any; error?: string }>(`/api/schedules/${latest.data.schedule.id}`);
    if (!full.data.ok || !full.data.schedule) {
      error.value = full.data.error ?? "Takvim yüklenemedi.";
      return;
    }
    schedule.value = full.data.schedule;
    toast.add({ severity: "info", summary: "Son takvim yüklendi", life: 2000 });
  } catch (e: any) {
    error.value = e?.response?.data?.error ?? e?.message ?? "Takvim yüklenemedi.";
  } finally {
    scheduleLoading.value = false;
    loadingLatest.value = false;
  }
}

const sessionRows = computed(() => {
  const s = schedule.value;
  if (!s?.examSessions) return [];
  const slots: string[] = safeParseArray(s.slots);
  return [...s.examSessions]
    .map((es: any) => ({
      day: es.dayOfWeek as number,
      slotIndex: es.slotIndex as number,
      dayLabel: dayLabel.get(es.dayOfWeek) ?? String(es.dayOfWeek),
      slotLabel:
        typeof es.startMinuteOfDay === "number" && typeof es.endMinuteOfDay === "number"
          ? `${fmtMinutes(es.startMinuteOfDay)}-${fmtMinutes(es.endMinuteOfDay)}`
          : (slots[es.slotIndex] ?? `Slot ${es.slotIndex}`),
      department: es.course?.department?.name ?? "-",
      course: `${es.course?.code ?? ""} - ${es.course?.name ?? ""}`,
      teacher: es.teacher?.name ?? "-",
      rooms: (es.allocations ?? []).map((a: any) => `${a.room?.name ?? a.roomId}(${a.assignedStudents})`).join(", "),
    }))
    .sort((a, b) => (a.day !== b.day ? a.day - b.day : a.slotIndex - b.slotIndex));
});

function fmtMinutes(min: number) {
  const m = Math.max(0, Math.min(24 * 60, Math.floor(min)));
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

async function downloadDepartment(d: Department) {
  if (!scheduleId.value) return;
  await downloadBlob(
    `/api/schedules/${scheduleId.value}/pdf/department/${d.id}`,
    `department-${d.name}-schedule.pdf`
  );
}

async function downloadRoom(r: Room) {
  if (!scheduleId.value) return;
  await downloadBlob(
    `/api/schedules/${scheduleId.value}/pdf/room/${r.id}`,
    `room-${r.name}-schedule.pdf`
  );
}

function safeParseArray(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

onMounted(loadMeta);
</script>

<style scoped></style>

