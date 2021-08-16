import { isObject } from "../../internal/helpers.js"
import type { ReplyComponent } from "../reply-component"
import type { ButtonComponent } from "./button"
import type { SelectMenuComponent } from "./select-menu"

export type ActionRowComponent = ReturnType<typeof actionRowComponent>

export type ActionRowChild = SelectMenuComponent | ButtonComponent

export function actionRowComponent(
  ...children: Array<ActionRowChild | ActionRowChild[]>
) {
  return {
    type: "actionRow",
    children: children.flat(),
  } as const
}

export function isActionRow(
  component: ReplyComponent,
): component is ActionRowComponent {
  return isObject(component) && component.type === "actionRow"
}
