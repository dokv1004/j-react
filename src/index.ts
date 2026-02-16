// -------------------- [1. 타입 정의] --------------------
interface JReactElement {
  type: string;
  props: {
    children: JReactElement[];
    [key: string]: any;
  };
}

interface Fiber {
  type?: string;
  dom?: Node;
  props: {
    children: JReactElement[];
    [key: string]: any;
  };
  parent?: Fiber;
  child?: Fiber;
  sibling?: Fiber;
}

// -------------------- [2. 엘리먼트 생성 함수] --------------------
export function createElement(
  type: string,
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

// -------------------- [3. DOM 생성 헬퍼 함수] --------------------
function createDom(fiber: Fiber): Node {
  const dom =
    fiber.type === "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(fiber.type as string);

  const isProperty = (key: string) => key !== "children";
  Object.keys(fiber.props)
    .filter(isProperty)
    .forEach((name) => {
      (dom as any)[name] = fiber.props[name];
    });

  return dom;
}

// -------------------- [4. 엔진 (Work Loop)] --------------------
let nextUnitOfWork: Fiber | null = null;

function workLoop(deadline: IdleDeadline) {
  let shouldYield = false;

  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
    shouldYield = deadline.timeRemaining() < 1;
  }

  requestIdleCallback(workLoop);
}

requestIdleCallback(workLoop); // 엔진 시동!

// -------------------- [5. 작업 수행 (Perform Unit Of Work)] --------------------
function performUnitOfWork(fiber: Fiber): Fiber | null {
  // A. DOM 노드 생성 (아직 없으면)
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }

  // B. [중요] 부모 DOM에 내 DOM 붙이기 (여기가 질문한 부분!)
  // (Day 3에서는 이 부분을 제거하고 'Commit Phase'로 옮길 예정)
  if (fiber.parent && fiber.dom) {
    fiber.parent.dom?.appendChild(fiber.dom);
  }

  // C. 자식 Fiber 생성 및 연결 (Linked List 만들기)
  const elements = fiber.props.children;
  let index = 0;
  let prevSibling: Fiber | null = null;

  while (index < elements.length) {
    const element = elements[index];
    const newFiber: Fiber = {
      type: element.type,
      props: element.props,
      parent: fiber,
      dom: undefined,
    };

    if (index === 0) {
      fiber.child = newFiber; // 첫째는 child로
    } else {
      if (prevSibling) {
        prevSibling.sibling = newFiber; // 둘째부터는 형의 sibling으로
      }
    }

    prevSibling = newFiber;
    index++;
  }

  // D. 다음 작업 반환 (자식 -> 형제 -> 삼촌 순서)
  if (fiber.child) {
    return fiber.child;
  }

  let nextFiber: Fiber | undefined = fiber;
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling;
    }
    nextFiber = nextFiber.parent;
  }

  return null;
}

// -------------------- [6. 렌더 함수 (진입점)] --------------------
export function render(element: JReactElement, container: Node) {
  nextUnitOfWork = {
    dom: container,
    props: {
      children: [element],
    },
  };
}

// -------------------- [7. 실행 코드] --------------------
// const element = createElement(
//   "div",
//   { id: "foo", style: "background: #eee; padding: 20px;" },
//   createElement("h1", null, "J-React Day 2 성공! 🎉"),
//   createElement("p", null, "이제 Fiber 아키텍처가 작동합니다."),
// );

// const container = document.getElementById("root");
// if (container) render(element, container);
