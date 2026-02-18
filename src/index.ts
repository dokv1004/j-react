// 1. 전역 변수 및 타입 정의
let wipRoot: Fiber | null = null;
let currentRoot: Fiber | null = null;
let deletions: Fiber[] = [];
// Hooks를 위한 전역변수, 어떤 Fiber가 몇번째 훅을 호출했는지 추적
let wipFiber: Fiber | null = null; // 현재 작업 중인 Fiber
let hookIndex: number = 0; // 현재 처리 중인 Hook의 순서

interface JReactElement {
  type: any; // 함수를 받기 위해 any로 수정
  props: {
    children: JReactElement[];
    [key: string]: any;
  };
}

interface Hook {
  state: any; // 현재 상태
  queue: any[]; // 상태 변경 요청을 담을 큐
}

interface Fiber {
  type?: any;
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

  hooks?: Hook[];
}

// 2. 엘리먼트 생성 함수
function createElement(
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

// 3. DOM 조작 헬퍼 함수
const isEvent = (key: string) => key.startsWith("on");
const isProperty = (key: string) => key !== "children" && !isEvent(key);
const isNew = (prev: any, next: any) => (key: string) =>
  prev[key] !== next[key];
const isGone = (prev: any, next: any) => (key: string) => !(key in next);

function updateDom(dom: Node, prevProps: any, nextProps: any) {
  // 이벤트 파싱
  Object.keys(prevProps)
    .filter(isEvent)
    .filter((key) => !(key in nextProps) || isNew(prevProps, nextProps)(key))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2);
      dom.removeEventListener(eventType, prevProps[name]);
    });

  // 속성 제거
  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(prevProps, nextProps))
    .forEach((name) => {
      (dom as any)[name] = "";
    });

  // 속성 설정
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      (dom as any)[name] = nextProps[name];
    });

  // 이벤트 추가
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2);
      dom.addEventListener(eventType, nextProps[name]);
    });
}

// 4. DOM 생성 함수
function createDom(fiber: Fiber): Node {
  const dom =
    fiber.type === "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(fiber.type as string);

  updateDom(dom, {}, fiber.props);

  return dom;
}

// 5. 엔진 (Work Loop)
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

// 6. 작업 수행 (Perform Unit Of Work)
function performUnitOfWork(fiber: Fiber): Fiber | null {
  // 함수형 컴포넌트 로직 분기
  if (typeof fiber.type === "function") updateFunctionComponent(fiber);
  else updateHostComponent(fiber);

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

function updateFunctionComponent(fiber: Fiber) {
  wipFiber = fiber;
  hookIndex = 0;
  wipFiber.hooks = [];

  const children = (fiber.type as any)(fiber.props);
  reconcileChildren(fiber, [children]);
}

function updateHostComponent(fiber: Fiber) {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }
  const elements = fiber.props.children;
  reconcileChildren(fiber, elements);
}

// 비교 로직
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

// 7. 렌더 & 커밋 함수
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

  // 함수형 컴포넌트는 DOM이 없음
  let parentFiber = fiber.parent;
  while (parentFiber && !parentFiber.dom) {
    parentFiber = parentFiber.parent;
  }
  if (!parentFiber) return;
  // parentFiber가 undefined면 멈춤 (루트보다 더 위로 가는 경우 방지)
  const parentDom = parentFiber.dom;

  if (fiber.effectTag === "PLACEMENT" && fiber.dom && parentDom) {
    parentDom.appendChild(fiber.dom);
  } else if (fiber.effectTag === "UPDATE" && fiber.dom) {
    updateDom(fiber.dom, fiber.alternate?.props, fiber.props);
  } else if (fiber.effectTag === "DELETION" && parentDom) {
    commitDeletion(fiber, parentDom);
    return;
  }

  commitWork(fiber.child);
  commitWork(fiber.sibling);
}

// JReactHooks
// useState
function useState<T>(initial: T) {
  // 옵셔널 체이닝으로 이전에 Hook이 있는지 안전하게 찾음
  const oldHook = wipFiber?.alternate?.hooks?.[hookIndex];

  const hook: Hook = {
    state: oldHook ? oldHook.state : initial,
    queue: [],
  };

  // 큐 처리
  const actions = oldHook ? oldHook.queue : [];
  actions.forEach((action) => {
    hook.state = typeof action === "function" ? action(hook.state) : action;
  });

  // 함수든 값이든 뭔가 들어오겠지...
  const setState = (action: any) => {
    hook.queue.push(action);
    wipRoot = {
      dom: currentRoot!.dom,
      props: currentRoot!.props,
      alternate: currentRoot,
    };
    nextUnitOfWork = wipRoot;
    deletions = [];
  };

  wipFiber!.hooks!.push(hook);
  hookIndex++;

  return [hook.state, setState];
}

// 삭제 전용
function commitDeletion(fiber: Fiber, parentDom: Node) {
  if (fiber.dom) {
    parentDom.removeChild(fiber.dom);
  } else {
    if (fiber.child) commitDeletion(fiber.child, parentDom);
  }
}

// 8. 테스트 코드

function Counter() {
  const [count, setCount] = useState(1);
  const [text, setText] = useState("Apple");

  return createElement(
    "div",
    { style: "padding: 30px; background: #f0f0f0; border-radius: 10px;" },
    createElement("h1", null, `Count: ${count}`),
    createElement(
      "button",
      {
        onclick: () => {
          setCount((c: number) => c + 1);
        },
      },
      "+1 증가 (Re-render Trigger)",
    ),
    createElement("hr", null),
    createElement("h2", null, `${text} is delicious`),
    createElement(
      "button",
      {
        onclick: () => {
          setText((t: string) => (t === "Apple" ? "Banana" : "Apple"));
        },
      },
      "과일 바꾸기 (State 분리 테스트)",
    ),
  );
}

const container = document.getElementById("root");
// 이제 함수형 컴포넌트(Counter)를 렌더링합니다!
// createElement의 첫 번째 인자로 문자열("div")이 아니라 함수(Counter)가 들어갑니다.
render(createElement(Counter, null), container as Node);
