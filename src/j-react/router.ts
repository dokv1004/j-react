import { createElement } from "./element";
import { useState, useEffect } from "./core";
import { JReactElement } from "./types";

let listeners: (() => void)[] = [];

export function navigate(to: string) {
  // URL 변경
  window.history.pushState(null, "", to);
  // Router에게 알림
  listeners.forEach((listener) => listener());
}

export function Router(props: { children: JReactElement[] }) {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener("popstate", handlePopState);

    const listener = () => {
      setCurrentPath(window.location.pathname);
    };
    listeners.push(listener);

    // 클린업
    return () => {
      window.removeEventListener("popstate", handlePopState);
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

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
