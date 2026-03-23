import { createElement } from "./element";
import { useState, useEffect } from "./core";
import { JReactElement } from "./types";

let listeners: (() => void)[] = [];

// export function navigate(to: string) {
//   console.log("🚗 navigate 호출:", to);
//   // URL 변경
//   window.history.pushState(null, "", to);
//   console.log("🔔 listeners 개수:", listeners.length);
//   // Router에게 알림
//   listeners.forEach((listener) => listener());
// }

export function navigate(to: string) {
  console.log("navigate 호출:", to);
  window.history.pushState(null, "", to);
  console.log("listeners 개수:", listeners.length);
  console.log("현재 URL:", window.location.pathname);
  listeners.forEach((listener) => listener());
}

export function Router(props: any) {
  // const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [, forceUpdate] = useState(0);
  // console.log("Router 렌더링 - currentPath:", currentPath);

  useEffect(() => {
    const handlePopState = () => {
      forceUpdate((c: number) => c + 1);
    };
    window.addEventListener("popstate", handlePopState);

    const listener = () => {
      forceUpdate((c: number) => c + 1);
    };
    listeners.push(listener);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  const currentPath = window.location.pathname;
  const children = props.children || [];

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const routePath = child.props.path;

    if (routePath === currentPath) {
      const Component = child.props.component;
      return createElement(Component, null);
    }
  }
  return createElement("div", null, "404 Not Found");
}

export function Route(props: {
  path: string;
  component: (props: any) => JReactElement;
}) {
  return null as any;
}

export function Link(props: { to: string; children?: any }) {
  return createElement(
    "a",
    {
      href: props.to,

      onclick: (e: Event) => {
        e.preventDefault();
        navigate(props.to);
      },
    },
    props.children,
  );
}
