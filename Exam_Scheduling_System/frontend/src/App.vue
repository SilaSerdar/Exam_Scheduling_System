<template>
  <div class="min-h-screen">
    <Menubar :model="items" class="app-menubar border-noround border-x-none border-top-none">
      <template #start>
        <div class="flex align-items-center gap-2 px-2">
          <i class="pi pi-calendar" />
          <span class="font-semibold">Sınav Programı</span>
        </div>
      </template>
      <template #end>
        <a :href="swaggerUrl" target="_blank" rel="noreferrer" class="p-button p-button-text">
          Swagger
        </a>
      </template>
    </Menubar>

    <div class="p-3 md:p-4">
      <router-view />
    </div>
    <Toast />
  </div>
</template>

<script setup lang="ts">
import Menubar from "primevue/menubar";
import Toast from "primevue/toast";
import { computed } from "vue";
import { useRouter } from "vue-router";
import { API_BASE } from "./api";

const router = useRouter();

const items = computed(() => [
  { label: "Takvim", icon: "pi pi-calendar", command: () => router.push("/schedule") },
  { label: "Bölümler", icon: "pi pi-sitemap", command: () => router.push("/departments") },
  { label: "Sınıflar", icon: "pi pi-building", command: () => router.push("/rooms") },
  { label: "Öğretmenler", icon: "pi pi-users", command: () => router.push("/teachers") },
  { label: "Dersler", icon: "pi pi-book", command: () => router.push("/courses") },
  { label: "Sınav Talepleri", icon: "pi pi-inbox", command: () => router.push("/exam-requests") },
]);

const swaggerUrl = computed(() => `${API_BASE}/swagger`);
</script>
