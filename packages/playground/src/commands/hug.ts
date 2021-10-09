import {
  defineSlashCommand,
  defineUserCommand,
} from "@itsmapleleaf/gatekeeper/src/main"

const emojis = [
  "<:hug:784024746424795157>",
  "<:hugHappy:872202892654825492>",
  "<:hugeline:824390890339827814>",
  "<a:HuggieAttack:814532184341872710>",
  "<a:huggies:865273755152678972>",
  "<a:hugkitty:722600431666200671>",
  "<a:hug:407871889755734016>",
  "<:hug:655881281195868180>",
  "<:btmcHug:814621172611940352>",
]

// this defines a context menu command when you right-click on a user
export const hugUserCommand = defineUserCommand({
  name: "hug",
  run(context) {
    const user = `<@${context.user.id}>`
    const target = `<@${context.targetUser.id}>`
    const emoji = emojis[Math.floor(Math.random() * emojis.length)] as string
    context.reply(() => `${user} gave ${target} a hug! ${emoji}`)
  },
})

export const hugSlashCommand = defineSlashCommand({
  name: "hug",
  description: "give someone a hug ♥",
  options: {
    target: {
      type: "MENTIONABLE",
      description: "the target to hug",
      required: true,
    },
  },
  run(context) {
    const { target } = context.options
    const user = `<@!${context.user.id}>`
    const emoji = emojis[Math.floor(Math.random() * emojis.length)] as string
    context.reply(() => `${user} gave ${target.mention} a hug! ${emoji}`)
  },
})
