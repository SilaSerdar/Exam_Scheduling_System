<template>
  <div class="app-card">
    <div class="flex justify-content-between align-items-center mb-3">
      <div>
        <div class="text-2xl font-semibold">Sınıflar / Salonlar</div>
        <div class="text-sm text-500">Kapasite bilgisi, öğrenci sayısı dağıtımında kullanılır.</div>
      </div>
      <Button label="Yeni Sınıf" icon="pi pi-plus" @click="openNew" />
    </div>

    <DataTable :value="items" :loading="loading" stripedRows>
      <Column field="name" header="Sınıf" />
      <Column field="capacity" header="Kapasite" style="width: 10rem" />
      <Column header="İşlemler" style="width: 12rem">
        <template #body="{ data }">
          <div class="flex gap-2 justify-content-end">
            <Button label="Düzenle" icon="pi pi-pencil" severity="secondary" @click="openEdit(data)" />
            <Button label="Sil" icon="pi pi-trash" severity="danger" @click="remove(data)" />
          </div>
        </template>
      </Column>
    </DataTable>

    <Dialog v-model:visible="dialogOpen" modal header="Sınıf" :style="{ width: '30rem' }">
      <div class="flex flex-column gap-3">
        <div class="flex flex-column gap-2">
          <label class="font-medium">Sınıf adı</label>
          <InputText v-model="form.name" autofocus />
        </div>
        <div class="flex flex-column gap-2">
          <label class="font-medium">Kapasite</label>
          <InputNumber v-model="form.capacity" :min="1" />
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

type Room = { id: string; name: string; capacity: number };

const toast = useToast();

const items = ref<Room[]>([]);
const loading = ref(false);
const saving = ref(false);

const dialogOpen = ref(false);
const editingId = ref<string | null>(null);
const form = ref<{ name: string; capacity: number }>({ name: "", capacity: 30 });

async function load() {
  loading.value = true;
  try {
    const res = await api.get<Room[]>("/api/rooms");
    items.value = res.data;
  } catch (e: any) {
    toast.add({
      severity: "error",
      summary: "Bağlantı hatası",
      detail: e?.response?.data?.error ?? e?.message ?? "API erişilemiyor",
      life: 5000,
    });
  } finally {
    loading.value = false;
  }
}

function openNew() {
  editingId.value = null;
  form.value = { name: "", capacity: 30 };
  dialogOpen.value = true;
}

function openEdit(r: Room) {
  editingId.value = r.id;
  form.value = { name: r.name, capacity: r.capacity };
  dialogOpen.value = true;
}

async function save() {
  if (!form.value.name.trim() || !form.value.capacity || form.value.capacity < 1) return;
  saving.value = true;
  try {
    if (editingId.value) {
      await api.put(`/api/rooms/${editingId.value}`, form.value);
      toast.add({ severity: "success", summary: "Güncellendi", life: 2000 });
    } else {
      await api.post(`/api/rooms`, form.value);
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

async function remove(r: Room) {
  if (!confirm(`Silinsin mi? (${r.name})`)) return;
  try {
    await api.delete(`/api/rooms/${r.id}`);
    toast.add({ severity: "success", summary: "Silindi", life: 2000 });
    await load();
  } catch (e: any) {
    toast.add({ severity: "error", summary: "Hata", detail: e?.message ?? "Silinemedi", life: 4000 });
  }
}

onMounted(load);
</script>

<style scoped></style>

