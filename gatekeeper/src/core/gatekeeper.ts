import type * as Discord from "discord.js"
import type { CommandInteraction } from "discord.js"
import { relative } from "path"
import { toError } from "../internal/helpers"
import type { Logger } from "../internal/logger"
import { createConsoleLogger, createNoopLogger } from "../internal/logger"
import type { UnknownRecord } from "../internal/types"
import type { RenderReplyFn } from "./reply-component"
import type { ReplyInstance } from "./reply-instance"
import { EphemeralReplyInstance, PublicReplyInstance } from "./reply-instance"
import type {
  SlashCommandContext,
  SlashCommandDefinition,
  SlashCommandDefinitionWithoutType,
  SlashCommandEphemeralReplyHandle,
  SlashCommandOptions,
  SlashCommandReplyHandle,
} from "./slash-command"
import { defineSlashCommand, isSlashCommandDefinition } from "./slash-command"

type CommandManagerOptions = {
  /**
   * Enables debug logging. This will literally spam your console.
   */
  debug?: boolean
}

type UseClientOptions = {
  useGlobalCommands?: boolean
  useGuildCommands?: boolean
}

type DiscordCommandManager =
  | Discord.ApplicationCommandManager
  | Discord.GuildApplicationCommandManager

export class Gatekeeper {
  readonly #slashCommands = new Map<string, SlashCommandDefinition>()
  readonly #replyInstances = new Set<ReplyInstance>()
  readonly #logger: Logger

  private constructor(options: CommandManagerOptions) {
    this.#logger = options.debug
      ? createConsoleLogger({ name: "gatekeeper" })
      : createNoopLogger()
  }

  static create(options: CommandManagerOptions = {}) {
    return new Gatekeeper(options)
  }

  addSlashCommand<Options extends SlashCommandOptions>(
    slashCommand: SlashCommandDefinitionWithoutType<Options>,
  ) {
    this.#logger.info(`Defining slash command: ${slashCommand.name}`)
    this.#slashCommands.set(
      slashCommand.name,
      defineSlashCommand(slashCommand) as SlashCommandDefinition,
    )
  }

  /**
   * A list of **absolute** file paths to load commands from.
   */
  async loadCommands(filePaths: ArrayLike<string>) {
    const commandModulePromises = Array.from(filePaths)
      .map((path) => path.replace(/\.[a-z]+$/i, ""))
      .map((path) =>
        this.#logger.promise<UnknownRecord>(
          `Loading command module "${relative(process.cwd(), path)}"`,
          import(path),
        ),
      )

    const commandModules = await this.#logger.promise(
      `Loading ${filePaths.length} commands`,
      Promise.all(commandModulePromises),
    )

    for (const command of commandModules.flatMap<unknown>(Object.values)) {
      if (isSlashCommandDefinition(command)) {
        this.addSlashCommand(command)
      }
    }
  }

  useClient(
    client: Discord.Client,
    {
      useGlobalCommands = true,
      useGuildCommands = false,
    }: UseClientOptions = {},
  ) {
    const syncGuildCommands = async (guild: Discord.Guild) => {
      await guild.commands.fetch()
      if (useGuildCommands) {
        await this.#logger.promise(
          `Syncing guild commands for "${guild.name}"`,
          this.#syncCommands(guild.commands),
        )
      } else {
        await this.#logger.promise(
          `Removing commands for guild "${guild.name}"`,
          this.#removeAllCommands(guild.commands),
        )
      }
    }

    client.on("ready", async () => {
      this.#logger.info("Client ready")

      const { application } = client
      if (application) {
        if (useGlobalCommands) {
          await application.commands.fetch()
          await this.#logger.promise(
            "Syncing global commands",
            this.#syncCommands(application.commands),
          )
        } else {
          await this.#logger.promise(
            "Removing global commands",
            this.#removeAllCommands(application.commands),
          )
        }
      }

      for (const guild of client.guilds.cache.values()) {
        await syncGuildCommands(guild)
      }
    })

    client.on("guildCreate", async (guild) => {
      await syncGuildCommands(guild)
    })

    client.on("interactionCreate", async (interaction) => {
      if (interaction.isCommand()) {
        await this.#handleCommandInteraction(interaction)
      }
      if (interaction.isMessageComponent()) {
        await this.#handleMessageComponentInteraction(interaction)
      }
    })
  }

  async #syncCommands(manager: DiscordCommandManager) {
    for (const command of this.#slashCommands.values()) {
      const options = Object.entries(
        command.options ?? {},
      ).map<Discord.ApplicationCommandOptionData>(([name, option]) => ({
        name,
        description: option.description,
        type: option.type,
        required: option.required,
        choices: "choices" in option ? option.choices : undefined,
      }))

      await this.#logger.promise(
        `Creating command "${command.name}"`,
        manager.create({
          name: command.name,
          description: command.description,
          options,
        }),
      )
    }

    for (const appCommand of manager.cache.values()) {
      if (!this.#slashCommands.has(appCommand.name)) {
        await this.#logger.promise(
          `Removing unused command "${appCommand.name}"`,
          manager.delete(appCommand.id),
        )
      }
    }
  }

  async #removeAllCommands(manager: DiscordCommandManager) {
    for (const command of manager.cache.values()) {
      await this.#logger.promise(
        `Removing command "${command.name}"`,
        manager.delete(command.id),
      )
    }
  }

  async #handleCommandInteraction(interaction: Discord.CommandInteraction) {
    const slashCommand = this.#slashCommands.get(interaction.commandName)
    if (!slashCommand) return

    await slashCommand.run(
      this.#createSlashCommandContext(slashCommand, interaction),
    )
  }

  #createSlashCommandContext(
    slashCommand: SlashCommandDefinition,
    interaction: CommandInteraction,
  ): SlashCommandContext {
    const options: Record<string, string | number | boolean | undefined> = {}

    for (const [name, optionDefinition] of Object.entries(
      slashCommand.options ?? {},
    )) {
      const value = interaction.options.get(name, optionDefinition.required)
      if (!value) continue

      options[value.name] = value.value
    }

    return {
      channel: interaction.channel ?? undefined,
      member: (interaction.member as Discord.GuildMember | null) ?? undefined,
      user: interaction.user,
      guild: interaction.guild ?? undefined,
      options,
      createReply: (render) => this.#createReplyInstance(interaction, render),
      createEphemeralReply: (render) =>
        this.#createEphemeralReplyInstance(interaction, render),
    }
  }

  #handleMessageComponentInteraction(
    interaction: Discord.MessageComponentInteraction,
  ) {
    interaction.deferUpdate().catch((error) => {
      this.#logger.warn("Failed to defer interaction update")
      this.#logger.warn(toError(error).stack || toError(error).message)
    })

    return Promise.all(
      [...this.#replyInstances].map((instance) =>
        instance.handleMessageComponentInteraction(interaction),
      ),
    )
  }

  async #createReplyInstance(
    interaction: Discord.CommandInteraction,
    render: RenderReplyFn,
  ): Promise<SlashCommandReplyHandle> {
    const instance = await PublicReplyInstance.create(interaction, render)

    if (!instance) {
      return {
        update: async () => {},
        delete: async () => {},
      }
    }

    this.#replyInstances.add(instance)

    return {
      update: async () => {
        await instance.update()
      },
      delete: async () => {
        this.#replyInstances.delete(instance)
        await instance.cleanup()
      },
    }
  }

  async #createEphemeralReplyInstance(
    interaction: Discord.CommandInteraction,
    render: RenderReplyFn,
  ): Promise<SlashCommandEphemeralReplyHandle> {
    const instance = await EphemeralReplyInstance.create(interaction, render)

    if (!instance) {
      return {
        update: async () => {},
      }
    }

    this.#replyInstances.add(instance)

    return {
      update: async () => {
        await instance.update()
      },
    }
  }
}
