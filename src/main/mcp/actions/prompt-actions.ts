/*
Назначение: Регистрирует MCP prompt-экшены для сценариев planning, сжатия обсуждения и генерации project skill.
Не входит: Регистрация MCP-инструментов и resource-шаблонов.
*/
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildRegisteredPromptMessage } from "../../../renderer/components/mcp-prompt-presets";

export function registerPromptActions(server: McpServer) {
  server.registerPrompt(
    "plan_task",
    {
      description: "Провести planning задачи из AITasker внутри выбранного проекта и сохранить Markdown-план обратно.",
      argsSchema: {
        projectRef: z
          .string()
          .min(1)
          .describe("Id или читаемое имя проекта, внутри которого нужно работать."),
        taskRef: z
          .string()
          .min(1)
          .describe("Id задачи или человекочитаемое название задачи из запроса пользователя."),
        instructions: z
          .string()
          .optional()
          .describe("Дополнительные ограничения или пожелания к плану.")
      }
    },
    async ({ instructions, projectRef, taskRef }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: buildRegisteredPromptMessage("plan_task", { instructions, projectRef, taskRef })
          }
        }
      ]
    })
  );

  server.registerPrompt(
    "compress_plan_discussion",
    {
      description:
        "Сжать переписку по расширениям и доработкам задачи в обновленный Markdown-план и очистить отдельные discussion-блоки.",
      argsSchema: {
        projectRef: z
          .string()
          .min(1)
          .describe("Id или читаемое имя проекта, внутри которого нужно работать."),
        taskRef: z
          .string()
          .min(1)
          .describe("Id задачи или человекочитаемое название задачи из запроса пользователя."),
        instructions: z
          .string()
          .optional()
          .describe("Дополнительные ограничения к обновленному плану после сжатия переписки.")
      }
    },
    async ({ instructions, projectRef, taskRef }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: buildRegisteredPromptMessage("compress_plan_discussion", { instructions, projectRef, taskRef })
          }
        }
      ]
    })
  );

  server.registerPrompt(
    "create_project_skill",
    {
      description:
        "Подготовить или обновить SKILL.md для активного проекта, сохранить путь к нему в карточке проекта и затем кратко отчитаться.",
      argsSchema: {
        projectRef: z
          .string()
          .min(1)
          .describe("Id или название проекта, для которого нужно создать skill."),
        skillPath: z
          .string()
          .optional()
          .describe("Необязательный путь к SKILL.md. Если не указан, используй skillFilePath из проекта или <rootPath>/SKILL.md."),
        instructions: z
          .string()
          .optional()
          .describe("Дополнительные требования к содержимому skill-файла.")
      }
    },
    async ({ instructions, projectRef, skillPath }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: buildRegisteredPromptMessage("create_project_skill", { instructions, projectRef, skillPath })
          }
        }
      ]
    })
  );
}
