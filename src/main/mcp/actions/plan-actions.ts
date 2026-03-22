/*
Назначение: Регистрирует MCP-экшены домена планирования: вопросы, сохранение плана, расширения, доработки и консолидация обсуждения.
Не входит: Операции с проектами, задачами вне плана, ресурсами и prompt-ами.
*/
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { textContent, type McpControllerContext } from "../controller/mcp-controller-context";

export function registerPlanActions(server: McpServer, context: McpControllerContext) {
  server.registerTool(
    "answer_plan_question",
    {
      description:
        "Ответить на открытый вопрос плана по questionId. Ответ переносится в discussion, вопрос удаляется из списка открытых.",
      inputSchema: {
        taskId: z.string(),
        questionId: z.string().min(1),
        answer: z.string().min(1)
      }
    },
    async ({ answer, questionId, taskId }) => {
      const taskContext = await context.requireTaskContext(taskId);
      context.getLogger().info("mcp", "Tool answer_plan_question called", { questionId, taskId });
      await taskContext.answerQuestion(questionId, answer);
      context.touchSession({ taskId });

      return {
        content: textContent("Ответ сохранен.")
      };
    }
  );

  server.registerTool(
    "add_plan_questions",
    {
      description:
        "Добавить один или несколько открытых вопросов к задаче без изменения плана. Используй когда нужно уточнить требования у пользователя.",
      inputSchema: {
        taskId: z.string(),
        questions: z.array(z.string().min(1)).min(1)
      }
    },
    async ({ questions, taskId }) => {
      const taskContext = await context.requireTaskContext(taskId);
      context.getLogger().info("mcp", "Tool add_plan_questions called", { taskId, count: questions.length });
      for (const content of questions) {
        await taskContext.addQuestion(content);
      }
      context.touchSession({ taskId });

      return {
        content: textContent(`Вопросы добавлены: ${questions.length}.`)
      };
    }
  );

  server.registerTool(
    "save_plan",
    {
      description:
        "Сохранить Markdown-план и отдельный список открытых вопросов для задачи внутри активного подготовленного проекта.",
      inputSchema: {
        taskId: z.string(),
        contentMd: z.string().min(1),
        openQuestions: z.array(z.string().min(1)).optional()
      }
    },
    async ({ contentMd, openQuestions, taskId }) => {
      const taskContext = await context.requireTaskContext(taskId);
      context.getLogger().info("mcp", "Tool save_plan called", {
        taskId,
        openQuestionsCount: openQuestions?.length ?? 0
      });
      await taskContext.savePlan(contentMd, openQuestions, "agent");
      context.touchSession({ taskId });

      return {
        content: textContent("План сохранен.")
      };
    }
  );

  server.registerTool(
    "append_plan_extension",
    {
      description: "Добавить расширение текущего плана задачи без создания новой ревизии.",
      inputSchema: {
        taskId: z.string(),
        content: z.string().min(1)
      }
    },
    async ({ content, taskId }) => {
      const taskContext = await context.requireTaskContext(taskId);
      context.getLogger().info("mcp", "Tool append_plan_extension called", { taskId });
      await taskContext.appendExtension(content);
      context.touchSession({ taskId });

      return {
        content: textContent("Расширение добавлено.")
      };
    }
  );

  server.registerTool(
    "append_plan_improvement",
    {
      description: "Добавить доработку плана отдельным блоком без создания новой ревизии.",
      inputSchema: {
        taskId: z.string(),
        content: z.string().min(1)
      }
    },
    async ({ content, taskId }) => {
      const taskContext = await context.requireTaskContext(taskId);
      context.getLogger().info("mcp", "Tool append_plan_improvement called", { taskId });
      await taskContext.appendImprovement(content);
      context.touchSession({ taskId });

      return {
        content: textContent("Доработка добавлена.")
      };
    }
  );

  server.registerTool(
    "consolidate_plan_discussion",
    {
      description:
        "Сжать переписку по плану в новый Markdown-план, при необходимости сохранить новый список открытых вопросов и очистить отдельные блоки обсуждения.",
      inputSchema: {
        taskId: z.string(),
        contentMd: z.string().min(1),
        openQuestions: z.array(z.string().min(1)).optional()
      }
    },
    async ({ contentMd, openQuestions, taskId }) => {
      const taskContext = await context.requireTaskContext(taskId);
      context.getLogger().info("mcp", "Tool consolidate_plan_discussion called", {
        taskId,
        openQuestionsCount: openQuestions?.length ?? 0
      });
      await taskContext.consolidateDiscussion(contentMd, openQuestions, "agent");
      context.touchSession({ taskId });

      return {
        content: textContent("Обсуждение сжато.")
      };
    }
  );
}
