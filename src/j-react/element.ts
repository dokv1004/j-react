// JSX를 JS 객체로 바꾼다.
import { JReactElement } from "./types";

export function createElement(
  type: any,
  props: any,
  ...children: any[]
): JReactElement {
  return {
    type,
    props: {
      ...props,
      children: children.map((child) =>
        typeof child === "object" ? child : createTextElement(child),
      ),
    },
  };
}

function createTextElement(text: string): JReactElement {
  return {
    type: "TEXT_ELEMENT",
    props: {
      nodeValue: text,
      children: [],
    },
  };
}
