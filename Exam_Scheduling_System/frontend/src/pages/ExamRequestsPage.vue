<template>
  <div class="app-card">
    <div class="flex justify-content-between align-items-center mb-3">
      <div>
        <div class="text-2xl font-semibold">Sınav Talepleri</div>
        <div class="text-sm text-500">Her talep: ders + öğretmen + sınava girecek öğrenci sayısı.</div>
      </div>
      <Button label="Yeni Talep" icon="pi pi-plus" @click="openNew" />
    </div>

    <DataTable :value="items" :loading="loading" stripedRows>
      <Column header="Ders">
        <template #body="{ data }">
          <div class="flex flex-column">
            <span class="font-medium">{{ data.course.code }} - {{ data.course.name }}</span>
            <span class="text-sm text-500">{{ data.course.department?.name ?? "-" }} | {{ data.course.classLevel }}. sınıf</span>
          </div>
        </template>
      </Column>
      <Column header="Öğretmen" style="width: 14rem">
        <template #body="{ data }">{{ data.teacher.name }}</template>
      </Column>
      <Column field="studentCount" header="Öğrenci" style="width: 8rem" />
      <Column field="durationMinutes" header="Süre (dk)" style="width: 8rem" />
      <Column header="İşlemler" style="width: 12rem">
        <template #body="{ data }">
          <div class="flex gap-2 justify-content-end">
            <Button label="Düzenle" icon="pi pi-pencil" severity="secondary" @click="openEdit(data)" />
            <Button label="Sil" icon="pi pi-trash" severity="danger" @click="remove(data)" />
          </div>
        </template>
      </Column>
    </DataTable>

    <Dialog v-model:visible="dialogOpen" modal header="Sınav Talebi" :style="{ width: '44rem' }">
      <div class="grid">
        <div class="col-12 md:col-6">
          <label class="font-medium">Ders</label>
          <Dropdown
            v-model="form.courseId"
            :options="courses"
            optionLabel="label"
            optionValue="id"
            filter
            placeholder="Ders seçin"
            class="w-full mt-2"
          />
        </div>
        <div class="col-12 md:col-6">
          <label class="font-medium">Öğretmen</label>
          <Dropdown
            v-model="form.teacherId"
            :options="teachers"
            optionLabel="name"
            optionValue="id"
            filter
            placeholder="Öğretmen seçin"
            class="w-full mt-2"
          />
        </div>
        <div class="col-12 md:col-4">
          <label class="font-medium">Öğrenci sayısı</label>
          <InputNumber v-model="form.studentCount" :min="1" class="w-full mt-2" />
        </div>
        <div class="col-12 md:col-4">
          <label class="font-medium">Süre (dakika)</label>
          <InputNumber v-model="form.durationMinutes" :min="1" :step="5" class="w-full mt-2" />
        </div>
      </div>

      <template #footer>
        <Button label="İptal" severity="secondary" @click="dialogOpen = false" />
        <Button label="Kaydet" icon="pi pi-check" :loading="saving" @click="save" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { api } from "../api";
import { useToast } from "primevue/usetoast";

import Button from "primevue/button";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Dialog from "primevue/dialog";
import Dropdown from "primevue/dropdown";
import InputNumber from "primevue/inputnumber";

type Department = { id: string; name: string };
type Course = {
  id: string;
  code: string;
  name: string;
  classLevel: number;
  departmentId: string;
  department?: Department;
};
type Teacher = { id: string; name: string; availableDays: number[] };
type ExamRequest = {
  id: string;
  studentCount: number;
  durationMinutes: number;
  courseId: string;
  teacherId: string;
  course: Course;
  teacher: Teacher;
};

const toast = useToast();

const items = ref<ExamRequest[]>([]);
const coursesRaw = ref<Course[]>([]);
const teachers = ref<Teacher[]>([]);
const loading = ref(false);
const saving = ref(false);

const courses = computed(() =>
  coursesRaw.value.map((c) => ({
    id: c.id,
    label: `${c.code} - ${c.name} (${c.department?.name ?? "-"})`,
  }))
);

const dialogOpen = ref(false);
const editingId = ref<string | null>(null);
const form = ref<{ courseId: string; teacherId: string; studentCount: number; durationMinutes: number }>({
  courseId: "",
  teacherId: "",
  studentCount: 30,
  durationMinutes: 120,
});

async function load() {
  loading.value = true;
  try {
    const [r, c, t] = await Promise.all([
      api.get<ExamRequest[]>("/api/exam-requests"),
      api.get<Course[]>("/api/courses"),
      api.get<Teacher[]>("/api/teachers"),
    ]);
    items.value = r.data;
    coursesRaw.value = c.data;
    teachers.value = t.data;
  } finally {
    loading.value = false;
  }
}

function openNew() {
  editingId.value = null;
  form.value = {
    courseId: coursesRaw.value[0]?.id ?? "",
    teacherId: teachers.value[0]?.id ?? "",
    studentCount: 30,
    durationMinutes: 120,
  };
  dialogOpen.value = true;
}

function openEdit(r: ExamRequest) {
  editingId.value = r.id;
  form.value = {
    courseId: r.courseId,
    teacherId: r.teacherId,
    studentCount: r.studentCount,
    durationMinutes: r.durationMinutes ?? 120,
  };
  dialogOpen.value = true;
}

async function save() {
  if (
    !form.value.courseId ||
    !form.value.teacherId ||
    !form.value.studentCount ||
    form.value.studentCount < 1 ||
    !form.value.durationMinutes ||
    form.value.durationMinutes < 1
  )
    return;
  saving.value = true;
  try {
    if (editingId.value) {
      await api.put(`/api/exam-requests/${editingId.value}`, form.value);
      toast.add({ severity: "success", summary: "Güncellendi", life: 2000 });
    } else {
      await api.post(`/api/exam-requests`, form.value);
      toast.add({ severity: "success", summary: "Eklendi", life: 2000 });
    }
    dialogOpen.value = false;
    await load();
  } catch (e: any) {
    toast.add({ severity: "error", summary: "Hata", detail: e?.message ?? "İşlem başarısız", life: 4000 });
  } finally {
    saving.value = false;
  }
}

async function remove(r: ExamRequest) {
  if (!confirm(`Silinsin mi? (${r.course.code})`)) return;
  try {
    await api.delete(`/api/exam-requests/${r.id}`);
    toast.add({ severity: "success", summary: "Silindi", life: 2000 });
    await load();
  } catch (e: any) {
    toast.add({ severity: "error", summary: "Hata", detail: e?.message ?? "Silinemedi", life: 4000 });
  }
}

onMounted(load);
</script>

<style scoped></style>

