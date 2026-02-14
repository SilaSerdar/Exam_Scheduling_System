<template>
  <div class="app-card">
    <div class="flex justify-content-between align-items-center mb-3">
      <div>
        <div class="text-2xl font-semibold">Dersler</div>
        <div class="text-sm text-500">Ders kodu/adı, bölüm ve sınıf seviyesi bilgileri.</div>
      </div>
      <Button label="Yeni Ders" icon="pi pi-plus" @click="openNew" />
    </div>

    <DataTable :value="items" :loading="loading" stripedRows>
      <Column field="code" header="Kod" style="width: 8rem" />
      <Column field="name" header="Ders" />
      <Column header="Bölüm" style="width: 14rem">
        <template #body="{ data }">
          <span>{{ data.department?.name ?? "-" }}</span>
        </template>
      </Column>
      <Column field="classLevel" header="Sınıf Seviyesi" style="width: 10rem" />
      <Column header="İşlemler" style="width: 12rem">
        <template #body="{ data }">
          <div class="flex gap-2 justify-content-end">
            <Button label="Düzenle" icon="pi pi-pencil" severity="secondary" @click="openEdit(data)" />
            <Button label="Sil" icon="pi pi-trash" severity="danger" @click="remove(data)" />
          </div>
        </template>
      </Column>
    </DataTable>

    <Dialog v-model:visible="dialogOpen" modal header="Ders" :style="{ width: '38rem' }">
      <div class="grid">
        <div class="col-12 md:col-4">
          <label class="font-medium">Ders kodu</label>
          <InputText v-model="form.code" class="w-full mt-2" />
        </div>
        <div class="col-12 md:col-8">
          <label class="font-medium">Ders adı</label>
          <InputText v-model="form.name" class="w-full mt-2" />
        </div>
        <div class="col-12 md:col-8">
          <label class="font-medium">Bölüm</label>
          <Dropdown
            v-model="form.departmentId"
            :options="departments"
            optionLabel="name"
            optionValue="id"
            placeholder="Bölüm seçin"
            class="w-full mt-2"
          />
        </div>
        <div class="col-12 md:col-4">
          <label class="font-medium">Sınıf seviyesi</label>
          <InputNumber v-model="form.classLevel" :min="1" class="w-full mt-2" />
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
import { onMounted, ref } from "vue";
import { api } from "../api";
import { useToast } from "primevue/usetoast";

import Button from "primevue/button";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Dialog from "primevue/dialog";
import InputText from "primevue/inputtext";
import InputNumber from "primevue/inputnumber";
import Dropdown from "primevue/dropdown";

type Department = { id: string; name: string };
type Course = { id: string; code: string; name: string; classLevel: number; departmentId: string; department?: Department };

const toast = useToast();

const items = ref<Course[]>([]);
const departments = ref<Department[]>([]);
const loading = ref(false);
const saving = ref(false);

const dialogOpen = ref(false);
const editingId = ref<string | null>(null);
const form = ref<{ code: string; name: string; departmentId: string; classLevel: number }>({
  code: "",
  name: "",
  departmentId: "",
  classLevel: 1,
});

async function load() {
  loading.value = true;
  try {
    const [c, d] = await Promise.all([
      api.get<Course[]>("/api/courses"),
      api.get<Department[]>("/api/departments"),
    ]);
    items.value = c.data;
    departments.value = d.data;
  } finally {
    loading.value = false;
  }
}

function openNew() {
  editingId.value = null;
  form.value = {
    code: "",
    name: "",
    departmentId: departments.value[0]?.id ?? "",
    classLevel: 1,
  };
  dialogOpen.value = true;
}

function openEdit(c: Course) {
  editingId.value = c.id;
  form.value = { code: c.code, name: c.name, departmentId: c.departmentId, classLevel: c.classLevel };
  dialogOpen.value = true;
}

async function save() {
  if (!form.value.code.trim() || !form.value.name.trim() || !form.value.departmentId) return;
  saving.value = true;
  try {
    if (editingId.value) {
      await api.put(`/api/courses/${editingId.value}`, form.value);
      toast.add({ severity: "success", summary: "Güncellendi", life: 2000 });
    } else {
      await api.post(`/api/courses`, form.value);
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

async function remove(c: Course) {
  if (!confirm(`Silinsin mi? (${c.code})`)) return;
  try {
    await api.delete(`/api/courses/${c.id}`);
    toast.add({ severity: "success", summary: "Silindi", life: 2000 });
    await load();
  } catch (e: any) {
    toast.add({ severity: "error", summary: "Hata", detail: e?.message ?? "Silinemedi", life: 4000 });
  }
}

onMounted(load);
</script>

<style scoped></style>

