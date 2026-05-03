/*
Назначение: Хранит тип и atom текущей основной страницы renderer-приложения.
Не входит: Drawer-навигация, хлебные крошки и выбор сущностей внутри страниц.
*/
import { atom } from "jotai";

export type AppPage = "tasks" | "resources" | "project-hints";

export const currentPageAtom = atom<AppPage>("tasks");
