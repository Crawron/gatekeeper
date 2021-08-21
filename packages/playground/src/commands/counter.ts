import {
  actionRowComponent,
  buttonComponent,
  defineSlashCommand,
} from "../../../gatekeeper/src/main"

export const counterCommand = defineSlashCommand({
  name: "counter",
  description: "make a counter",
  run(context) {
    let count = 0

    const reply = context.reply(() => [
      `button pressed ${count} times`,
      actionRowComponent(
        buttonComponent({
          style: "PRIMARY",
          label: "press it",
          onClick: () => {
            count += 1
          },
        }),
        buttonComponent({
          style: "PRIMARY",
          label: "done",
          onClick: (event) => {
            if (event.user.id === context.user.id) {
              reply.delete()
            }
          },
        }),
      ),
    ])
  },
})