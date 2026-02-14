import { createRouter, createWebHistory } from "vue-router";

import DepartmentsPage from "./pages/DepartmentsPage.vue";
import RoomsPage from "./pages/RoomsPage.vue";
import TeachersPage from "./pages/TeachersPage.vue";
import CoursesPage from "./pages/CoursesPage.vue";
import ExamRequestsPage from "./pages/ExamRequestsPage.vue";
import SchedulePage from "./pages/SchedulePage.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/schedule" },
    { path: "/departments", component: DepartmentsPage },
    { path: "/rooms", component: RoomsPage },
    { path: "/teachers", component: TeachersPage },
    { path: "/courses", component: CoursesPage },
    { path: "/exam-requests", component: ExamRequestsPage },
    { path: "/schedule", component: SchedulePage },
  ],
});

