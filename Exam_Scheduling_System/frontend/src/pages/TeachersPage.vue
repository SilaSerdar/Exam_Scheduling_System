<template>
  <div class="app-card">
    <div class="flex justify-content-between align-items-center mb-3">
      <div>
        <div class="text-2xl font-semibold">Öğretmenler</div>
        <div class="text-sm text-500">Öğretmen müsait günleri sınav yerleştirmede kısıt olarak kullanılır.</div>
      </div>
      <Button label="Yeni Öğretmen" icon="pi pi-plus" @click="openNew" />
    </div>

    <DataTable :value="items" :loading="loading" stripedRows>
      <Column field="name" header="Ad" />
      <Column header="Müsait Günler">
        <template #body="{ data }">
          <span>{{ formatDays(data.availableDays) }}</span>
        </template>
      </Column>
      <Column header="İşlemler" style="width: 12rem">
        <template #body="{ data }">
          <div class="flex gap-2 justify-content-end">
            <Button label="Düzenle" icon="pi pi-pencil" severity="secondary" @click="openEdit(data)" />
            <Button label="Sil" icon="pi pi-trash" severity="danger" @click="remove(data)" />
          </div>
        </template>
      </Column>
    </DataTable>

    <Dialog v-model:visible="dialogOpen" modal header="Öğretmen" :style="{ width: '34rem' }">
      <div class="flex flex-column gap-3">
        <div class="flex flex-column gap-2">
          <label class="font-medium">Ad</label>
          <InputText v-model="form.name" autofocus />
        </div>

        <div class="flex flex-column gap-2">
          <label class="font-medium">Müsait Günler</label>
          <MultiSelect
            v-model="form.availableDays"
            :options="dayOptions"
            optionLabel="label"
            optionValue="value"
            display="chip"
            placeholder="Gün seçin"
          />
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
import MultiSelect from "primevue/multiselect";

type Teacher = { id: string; name: string; availableDays: number[] };

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

function formatDays(days: number[]) {
  const map = new Map(dayOptions.map((d) => [d.value, d.label] as const));
  return (days ?? []).slice().sort((a, b) => a - b).map((d) => map.get(d) ?? String(d)).join(", ");
}

const items = ref<Teacher[]>([]);
const loading = ref(false);
const saving = ref(false);

const dialogOpen = ref(false);
const editingId = ref<string | null>(null);
const form = ref<{ name: string; availableDays: number[] }>({ name: "", availableDays: [0, 1, 2, 3, 4] });

async function load() {
  loading.value = true;
  try {
    const res = await api.get<Teacher[]>("/api/teachers");
    items.value = res.data;
  } finally {
    loading.value = false;
  }
}

function openNew() {
  editingId.value = null;
  form.value = { name: "", availableDays: [0, 1, 2, 3, 4] };
  dialogOpen.value = true;
}

function openEdit(t: Teacher) {
  editingId.value = t.id;
  form.value = { name: t.name, availableDays: [...(t.availableDays ?? [])] };
  dialogOpen.value = true;
}

async function save() {
  if (!form.value.name.trim() || (form.value.availableDays?.length ?? 0) === 0) return;
  saving.value = true;
  try {
    if (editingId.value) {
      await api.put(`/api/teachers/${editingId.value}`, form.value);
      toast.add({ severity: "success", summary: "Güncellendi", life: 2000 });
    } else {
      await api.post(`/api/teachers`, form.value);
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

async function remove(t: Teacher) {
  if (!confirm(`Silinsin mi? (${t.name})`)) return;
  try {
    await api.delete(`/api/teachers/${t.id}`);
    toast.add({ severity: "success", summary: "Silindi", life: 2000 });
    await load();
  } catch (e: any) {
    toast.add({ severity: "error", summary: "Hata", detail: e?.message ?? "Silinemedi", life: 4000 });
  }
}

onMounted(load);
</script>

<style scoped></style>

