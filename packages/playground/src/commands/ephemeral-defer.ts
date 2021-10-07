import {
  buttonComponent,
  defineSlashCommand,
} from "@itsmapleleaf/gatekeeper/src/main"

export const ephemeralDeferCommand = defineSlashCommand({
  name: "ephemeral-defer",
  description: "test ephemeral deferring",
  run(context) {
    context.ephemeralDefer()

    let count = 0
    context.reply(() => [
      "replied with an ephemeral defer",
      buttonComponent({
        label: String(count),
        style: "PRIMARY",
        onClick: () => {
          count += 1
        },
      }),
    ])

    context.ephemeralReply(() => "hi")
  },
})