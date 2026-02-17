// -------------------- [1. 타입 정의] --------------------
let wipRoot: Fiber | null = null;
let currentRoot: Fiber | null = null;
let deletions: Fiber[] = [];

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
  alternate?: Fiber | null;
  effectTag?: "PLACEMENT" | "UPDATE" | "DELETION";
}

// -------------------- [2. 엘리먼트 생성 함수] --------------------
function createElement(
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

// -------------------- [3. DOM 조작 헬퍼 함수들 (위치 변경!)] --------------------
const isEvent = (key: string) => key.startsWith("on");
const isProperty = (key: string) => key !== "children" && !isEvent(key);
const isNew = (prev: any, next: any) => (key: string) =>
  prev[key] !== next[key];
const isGone = (prev: any, next: any) => (key: string) => !(key in next);

function updateDom(dom: Node, prevProps: any, nextProps: any) {
  // 1. 이벤트 제거
  Object.keys(prevProps)
    .filter(isEvent)
    .filter((key) => !(key in nextProps) || isNew(prevProps, nextProps)(key))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2);
      dom.removeEventListener(eventType, prevProps[name]);
    });

  // 2. 속성 제거
  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(prevProps, nextProps))
    .forEach((name) => {
      (dom as any)[name] = "";
    });

  // 3. 속성 설정
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      (dom as any)[name] = nextProps[name];
    });

  // 4. 이벤트 추가
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2);
      dom.addEventListener(eventType, nextProps[name]);
    });
}

// -------------------- [4. DOM 생성 함수 (수정됨!)] --------------------
function createDom(fiber: Fiber): Node {
  const dom =
    fiber.type === "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(fiber.type as string);

  // ✅ 수정된 부분: 이제 updateDom을 재사용해서 이벤트를 연결합니다!
  updateDom(dom, {}, fiber.props);

  return dom;
}

// -------------------- [5. 엔진 (Work Loop)] --------------------
let nextUnitOfWork: Fiber | null = null;

function workLoop(deadline: IdleDeadline) {
  let shouldYield = false;
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
    shouldYield = deadline.timeRemaining() < 1;
  }
  if (!nextUnitOfWork && wipRoot) {
    commitRoot();
  }
  requestIdleCallback(workLoop);
}
requestIdleCallback(workLoop);

// -------------------- [6. 작업 수행 (Perform Unit Of Work)] --------------------
function performUnitOfWork(fiber: Fiber): Fiber | null {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }

  const elements = fiber.props.children;
  reconcileChildren(fiber, elements);

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

function reconcileChildren(wipFiber: Fiber, elements: JReactElement[]) {
  let index = 0;
  let oldFiber = wipFiber.alternate?.child;
  let prevSibling: Fiber | null = null;

  while (index < elements.length || oldFiber != null) {
    const element = elements[index];
    let newFiber: Fiber | null = null;

    const sameType = oldFiber && element && element.type == oldFiber.type;

    if (sameType) {
      newFiber = {
        type: oldFiber!.type,
        props: element.props,
        dom: oldFiber!.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: "UPDATE",
      };
    }
    if (element && !sameType) {
      newFiber = {
        type: element.type,
        props: element.props,
        dom: undefined,
        parent: wipFiber,
        alternate: null,
        effectTag: "PLACEMENT",
      };
    }
    if (oldFiber && !sameType) {
      oldFiber.effectTag = "DELETION";
      deletions.push(oldFiber);
    }

    if (oldFiber) {
      oldFiber = oldFiber.sibling;
    }

    if (newFiber) {
      if (index === 0) {
        wipFiber.child = newFiber;
      } else if (prevSibling) {
        prevSibling.sibling = newFiber;
      }
      prevSibling = newFiber;
    }
    index++;
  }
}

// -------------------- [7. 렌더 & 커밋 함수] --------------------
function render(element: JReactElement, container: Node) {
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
    alternate: currentRoot,
  };
  deletions = [];
  nextUnitOfWork = wipRoot;
}

function commitRoot() {
  if (!wipRoot) return;
  deletions.forEach(commitWork);
  commitWork(wipRoot.child);
  currentRoot = wipRoot;
  wipRoot = null;
}

function commitWork(fiber: Fiber | undefined | null): void {
  if (!fiber) return;

  const parentDom = fiber.parent?.dom;

  if (fiber.effectTag === "PLACEMENT" && fiber.dom && parentDom) {
    parentDom.appendChild(fiber.dom);
  } else if (fiber.effectTag === "UPDATE" && fiber.dom) {
    updateDom(fiber.dom, fiber.alternate?.props, fiber.props);
  } else if (fiber.effectTag === "DELETION" && parentDom) {
    if (fiber.dom) parentDom.removeChild(fiber.dom);
    return;
  }

  commitWork(fiber.child);
  commitWork(fiber.sibling);
}

// -------------------- [8. 실행 코드] --------------------
const container = document.getElementById("root");

// 1. 초기 렌더링
const element1 = createElement(
  "div",
  { id: "foo", style: "background: #eee; padding: 20px;" },
  createElement("h1", null, "Hello J-React! 👋"),
  createElement("p", null, "잠시 후 내용이 바뀝니다..."),
);

if (container) render(element1, container);

// 2. 2초 뒤 업데이트
setTimeout(() => {
  const element2 = createElement(
    "div",
    { id: "foo", style: "background: #ffcccc; padding: 20px;" },
    createElement("h1", null, "Wow! It updated! 🚀"),
    createElement(
      "p",
      { style: "color: blue" },
      "화면이 깜빡이지 않고 부드럽게 변경되었어요.",
    ),
    // 버튼 클릭 이벤트 테스트!
    createElement(
      "button",
      { onClick: () => alert("성공! 🎉") },
      "클릭해보세요",
    ),
  );

  if (container) render(element2, container);
}, 2000);
