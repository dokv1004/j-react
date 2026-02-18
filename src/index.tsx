import { createElement } from "./j-react/element";
import { render, useState } from "./j-react/core";

/** @jsx createElement */

function Counter() {
  const [count, setCount] = useState(1);
  return (
    <div>
      <h1>Count: {count}</h1>
      <button onclick={() => setCount((c: number) => c + 1)}>Click Me</button>
    </div>
  );
}

const container = document.getElementById("root");
render(createElement(Counter, null), container as Node);
