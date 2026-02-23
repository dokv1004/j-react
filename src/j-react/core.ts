// 스케쥴링, 재조정, 상태관리

import { EffectHook, Fiber, Hook, JReactElement } from "./types";
import { createDom, updateDom } from "./dom";

// 전역 변수
let wipRoot: Fiber | null = null;
let currentRoot: Fiber | null = null;
let deletions: Fiber[] = [];
let nextUnitOfWork: Fiber | null = null;
let pendingEffects: EffectHook[] = [];

// Hooks를 위한 전역변수, 어떤 Fiber가 몇번째 훅을 호출했는지 추적
let wipFiber: Fiber | null = null; // 현재 작업 중인 Fiber
let hookIndex: number = 0; // 현재 처리 중인 Hook의 순서

// 렌더 & 커밋
export function render(element: JReactElement, container: Node) {
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

  // DOM 반영후 useEffect
  pendingEffects.forEach((hook) => {
    // 이전 cleanup이 있으면 먼저 실행
    if (hook.cleanup) {
      hook.cleanup();
    }

    // 새 effect 실행
    const cleanup = hook.effect();

    if (typeof cleanup === "function") {
      hook.cleanup = cleanup;
    }
  });
  pendingEffects = [];
}

// 실제 DOM을 조작하는 유일한 함수
function commitWork(fiber: Fiber | undefined | null): void {
  if (!fiber) return; // fiber가 없으면, tree 끝에 도달하면 재귀졸료

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
    commitDeletion(fiber, parentDom); // 함수형 컴포넌트는 dom이 없으니
    return;
  }

  commitWork(fiber.child);
  commitWork(fiber.sibling);
}

function commitDeletion(fiber: Fiber, parentDom: Node) {
  if (fiber.dom) {
    parentDom.removeChild(fiber.dom);
  } else {
    if (fiber.child) commitDeletion(fiber.child, parentDom);
  }
}

// 스케쥴링 & 재조정
function workLoop(deadline: IdleDeadline) {
  let shouldYield = false;
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
    shouldYield = deadline.timeRemaining() < 1; // 1ms 여유 주고 작업 중단
  }
  if (!nextUnitOfWork && wipRoot) {
    // wipRoot 조건으로 중복실행 방지
    commitRoot();
  }
  requestIdleCallback(workLoop);
}

requestIdleCallback(workLoop); // 최초 실행

// DFS
function performUnitOfWork(fiber: Fiber): Fiber | null {
  // 함수형 컴포넌트 로직 분기, 현재 Fiber 처리
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

  const children = fiber.type(fiber.props);
  reconcileChildren(fiber, [children]);
}

function updateHostComponent(fiber: Fiber) {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber); // dom이 없는 경우: placement의 경우
  }
  const elements = fiber.props.children;
  reconcileChildren(fiber, elements);
}

function reconcileChildren(wipFiber: Fiber, elements: JReactElement[]) {
  let index = 0;
  let oldFiber = wipFiber.alternate?.child;
  let prevSibling: Fiber | null = null; // 형제 elem 연결점

  while (index < elements.length || oldFiber != null) {
    const element = elements[index];
    let newFiber: Fiber | null = null;

    const sameType = oldFiber && element && element.type === oldFiber.type;

    // 업데이트
    if (sameType) {
      newFiber = {
        type: oldFiber!.type,
        props: element.props,
        dom: oldFiber!.dom, // 돔 재사용
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: "UPDATE",
      };
    }

    //
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

// JReact Hooks
// useState
export function useState<T>(initial: T) {
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

export function useEffect(effect: () => void | (() => void), deps?: any[]) {
  const oldHook = wipFiber?.alternate?.hooks?.[hookIndex] as
    | EffectHook
    | undefined;
  const hasChanged = oldHook
    ? !deps || !oldHook.deps || deps.some((dep, i) => dep !== oldHook.deps![i])
    : true;
  const hook: EffectHook = {
    tag: "effect",
    effect: hasChanged ? effect : oldHook!.effect,
    cleanup: oldHook?.cleanup,
    deps,
  };
  if (hasChanged) {
    pendingEffects.push(hook);
  }
  wipFiber!.hooks!.push(hook as any);
  hookIndex++;
}

export function useRef<T>(initial: T): { current: T } {
  const oldHook = wipFiber?.alternate?.hooks?.[hookIndex];
  const hook = {
    state: oldHook ? oldHook.state : { current: initial },
    queue: [],
  };
  wipFiber!.hooks!.push(hook);
  hookIndex++;

  return hook.state;
}
