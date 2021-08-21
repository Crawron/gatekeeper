import type * as Discord from "discord.js"
import { createActionQueue } from "../internal/action-queue"
import { isAnyObject, raise } from "../internal/helpers"
import type { Logger } from "../internal/logger"
import type { OptionalKeys } from "../internal/types"
import type { InteractionContext } from "./interaction-context"
import { createInteractionContext } from "./interaction-context"

export type MessageCommandDefinition = {
  __type: typeof messageCommandType
  name: string
  run: (context: MessageCommandInteractionContext) => void | Promise<unknown>
}

type MessageCommandDefinitionWithoutType = OptionalKeys<
  MessageCommandDefinition,
  "__type"
>

export type MessageCommandInteractionContext = InteractionContext & {
  targetMessage: Discord.Message
}

const messageCommandType = Symbol("messageCommand")

export function defineMessageCommand(
  definition: MessageCommandDefinitionWithoutType,
): MessageCommandDefinition {
  return { ...definition, __type: messageCommandType }
}

export function isMessageCommandDefinition(
  definition: unknown,
): definition is MessageCommandDefinition {
  return isAnyObject(definition) && definition.__type === messageCommandType
}

export async function createMessageCommandContext(
  interaction: Discord.ContextMenuInteraction,
  logger: Logger,
): Promise<MessageCommandInteractionContext> {
  const actionQueue = createActionQueue(logger)

  const targetMessage =
    (await interaction.channel?.messages.fetch(interaction.targetId)) ??
    raise("Target message not found")

  return {
    ...createInteractionContext(interaction, logger, actionQueue),
    targetMessage,
  }
}
