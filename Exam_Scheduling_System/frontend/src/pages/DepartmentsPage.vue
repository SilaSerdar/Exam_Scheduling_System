<template>
  <div class="app-card">
    <div class="flex justify-content-between align-items-center mb-3">
      <div>
        <div class="text-2xl font-semibold">Bölümler</div>
        <div class="text-sm text-500">Derslerin bağlı olduğu bölümleri yönetin.</div>
      </div>
      <Button label="Yeni Bölüm" icon="pi pi-plus" @click="openNew" />
    </div>

    <DataTable :value="items" :loading="loading" stripedRows>
      <Column field="name" header="Bölüm Adı" />
      <Column header="İşlemler" style="width: 12rem">
        <template #body="{ data }">
          <div class="flex gap-2 justify-content-end">
            <Button label="Düzenle" icon="pi pi-pencil" severity="secondary" @click="openEdit(data)" />
            <Button label="Sil" icon="pi pi-trash" severity="danger" @click="remove(data)" />
          </div>
        </template>
      </Column>
    </DataTable>

    <Dialog v-model:visible="dialogOpen" modal header="Bölüm" :style="{ width: '28rem' }">
      <div class="flex flex-column gap-2">
        <label class="font-medium">Bölüm adı</label>
        <InputText v-model="form.name" autofocus />
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

type Department = { id: string; name: string };

const toast = useToast();

const items = ref<Department[]>([]);
const loading = ref(false);
const saving = ref(false);

const dialogOpen = ref(false);
const editingId = ref<string | null>(null);
const form = ref<{ name: string }>({ name: "" });

async function load() {
  loading.value = true;
  try {
    const res = await api.get<Department[]>("/api/departments");
    items.value = res.data;
  } finally {
    loading.value = false;
  }
}

function openNew() {
  editingId.value = null;
  form.value = { name: "" };
  dialogOpen.value = true;
}

function openEdit(d: Department) {
  editingId.value = d.id;
  form.value = { name: d.name };
  dialogOpen.value = true;
}

async function save() {
  if (!form.value.name.trim()) return;
  saving.value = true;
  try {
    if (editingId.value) {
      await api.put(`/api/departments/${editingId.value}`, form.value);
      toast.add({ severity: "success", summary: "Güncellendi", life: 2000 });
    } else {
      await api.post(`/api/departments`, form.value);
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

async function remove(d: Department) {
  if (!confirm(`Silinsin mi? (${d.name})`)) return;
  try {
    await api.delete(`/api/departments/${d.id}`);
    toast.add({ severity: "success", summary: "Silindi", life: 2000 });
    await load();
  } catch (e: any) {
    toast.add({ severity: "error", summary: "Hata", detail: e?.message ?? "Silinemedi", life: 4000 });
  }
}

onMounted(load);
</script>

<style scoped></style>

