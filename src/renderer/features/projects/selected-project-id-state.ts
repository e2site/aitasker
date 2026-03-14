/*
Назначение: Хранит id выбранного проекта для workspace в renderer.
Не входит: Загрузка данных, валидация форм и сохранение в хранилище.
*/
import { atom } from "jotai";

export const selectedProjectIdAtom = atom<string | null>(null);
