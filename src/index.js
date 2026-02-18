var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
// 1. 전역 변수 및 타입 정의
var wipRoot = null;
var currentRoot = null;
var deletions = [];
// Hooks를 위한 전역변수, 어떤 Fiber가 몇번째 훅을 호출했는지 추적
var wipFiber = null; // 현재 작업 중인 Fiber
var hookIndex = 0; // 현재 처리 중인 Hook의 순서
// 2. 엘리먼트 생성 함수
function createElement(type, props) {
    var children = [];
    for (var _i = 2; _i < arguments.length; _i++) {
        children[_i - 2] = arguments[_i];
    }
    return {
        type: type,
        props: __assign(__assign({}, props), { children: children.map(function (child) {
                return typeof child === "object" ? child : createTextElement(child);
            }) }),
    };
}
function createTextElement(text) {
    return {
        type: "TEXT_ELEMENT",
        props: {
            nodeValue: text,
            children: [],
        },
    };
}
// 3. DOM 조작 헬퍼 함수
var isEvent = function (key) { return key.startsWith("on"); };
var isProperty = function (key) { return key !== "children" && !isEvent(key); };
var isNew = function (prev, next) { return function (key) {
    return prev[key] !== next[key];
}; };
var isGone = function (prev, next) { return function (key) { return !(key in next); }; };
function updateDom(dom, prevProps, nextProps) {
    // 이벤트 파싱
    Object.keys(prevProps)
        .filter(isEvent)
        .filter(function (key) { return !(key in nextProps) || isNew(prevProps, nextProps)(key); })
        .forEach(function (name) {
        var eventType = name.toLowerCase().substring(2);
        dom.removeEventListener(eventType, prevProps[name]);
    });
    // 속성 제거
    Object.keys(prevProps)
        .filter(isProperty)
        .filter(isGone(prevProps, nextProps))
        .forEach(function (name) {
        dom[name] = "";
    });
    // 속성 설정
    Object.keys(nextProps)
        .filter(isProperty)
        .filter(isNew(prevProps, nextProps))
        .forEach(function (name) {
        dom[name] = nextProps[name];
    });
    // 이벤트 추가
    Object.keys(nextProps)
        .filter(isEvent)
        .filter(isNew(prevProps, nextProps))
        .forEach(function (name) {
        var eventType = name.toLowerCase().substring(2);
        dom.addEventListener(eventType, nextProps[name]);
    });
}
// 4. DOM 생성 함수
function createDom(fiber) {
    var dom = fiber.type === "TEXT_ELEMENT"
        ? document.createTextNode("")
        : document.createElement(fiber.type);
    updateDom(dom, {}, fiber.props);
    return dom;
}
// 5. 엔진 (Work Loop)
var nextUnitOfWork = null;
function workLoop(deadline) {
    var shouldYield = false;
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
function performUnitOfWork(fiber) {
    // 함수형 컴포넌트 로직 분기
    if (typeof fiber.type === "function")
        updateFunctionComponent(fiber);
    else
        updateHostComponent(fiber);
    if (fiber.child) {
        return fiber.child;
    }
    var nextFiber = fiber;
    while (nextFiber) {
        if (nextFiber.sibling) {
            return nextFiber.sibling;
        }
        nextFiber = nextFiber.parent;
    }
    return null;
}
function updateFunctionComponent(fiber) {
    wipFiber = fiber;
    hookIndex = 0;
    wipFiber.hooks = [];
    var children = fiber.type(fiber.props);
    reconcileChildren(fiber, [children]);
}
function updateHostComponent(fiber) {
    if (!fiber.dom) {
        fiber.dom = createDom(fiber);
    }
    var elements = fiber.props.children;
    reconcileChildren(fiber, elements);
}
// 비교 로직
function reconcileChildren(wipFiber, elements) {
    var _a;
    var index = 0;
    var oldFiber = (_a = wipFiber.alternate) === null || _a === void 0 ? void 0 : _a.child;
    var prevSibling = null;
    while (index < elements.length || oldFiber != null) {
        var element = elements[index];
        var newFiber = null;
        var sameType = oldFiber && element && element.type == oldFiber.type;
        if (sameType) {
            newFiber = {
                type: oldFiber.type,
                props: element.props,
                dom: oldFiber.dom,
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
            }
            else if (prevSibling) {
                prevSibling.sibling = newFiber;
            }
            prevSibling = newFiber;
        }
        index++;
    }
}
// 7. 렌더 & 커밋 함수
function render(element, container) {
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
    if (!wipRoot)
        return;
    deletions.forEach(commitWork);
    commitWork(wipRoot.child);
    currentRoot = wipRoot;
    wipRoot = null;
}
function commitWork(fiber) {
    var _a;
    if (!fiber)
        return;
    // 함수형 컴포넌트는 DOM이 없음
    var parentFiber = fiber.parent;
    while (parentFiber && !parentFiber.dom) {
        parentFiber = parentFiber.parent;
    }
    if (!parentFiber)
        return;
    // parentFiber가 undefined면 멈춤 (루트보다 더 위로 가는 경우 방지)
    var parentDom = parentFiber.dom;
    if (fiber.effectTag === "PLACEMENT" && fiber.dom && parentDom) {
        parentDom.appendChild(fiber.dom);
    }
    else if (fiber.effectTag === "UPDATE" && fiber.dom) {
        updateDom(fiber.dom, (_a = fiber.alternate) === null || _a === void 0 ? void 0 : _a.props, fiber.props);
    }
    else if (fiber.effectTag === "DELETION" && parentDom) {
        commitDeletion(fiber, parentDom);
        return;
    }
    commitWork(fiber.child);
    commitWork(fiber.sibling);
}
// JReactHooks
// useState
function useState(initial) {
    var _a, _b;
    // 옵셔널 체이닝으로 이전에 Hook이 있는지 안전하게 찾음
    var oldHook = (_b = (_a = wipFiber === null || wipFiber === void 0 ? void 0 : wipFiber.alternate) === null || _a === void 0 ? void 0 : _a.hooks) === null || _b === void 0 ? void 0 : _b[hookIndex];
    var hook = {
        state: oldHook ? oldHook.state : initial,
        queue: [],
    };
    // 큐 처리
    var actions = oldHook ? oldHook.queue : [];
    actions.forEach(function (action) {
        hook.state = typeof action === "function" ? action(hook.state) : action;
    });
    // 함수든 값이든 뭔가 들어오겠지...
    var setState = function (action) {
        hook.queue.push(action);
        wipRoot = {
            dom: currentRoot.dom,
            props: currentRoot.props,
            alternate: currentRoot,
        };
        nextUnitOfWork = wipRoot;
        deletions = [];
    };
    wipFiber.hooks.push(hook);
    hookIndex++;
    return [hook.state, setState];
}
// 삭제 전용
function commitDeletion(fiber, parentDom) {
    if (fiber.dom) {
        parentDom.removeChild(fiber.dom);
    }
    else {
        if (fiber.child)
            commitDeletion(fiber.child, parentDom);
    }
}
// 8. 테스트 코드
function Counter() {
    var _a = useState(1), count = _a[0], setCount = _a[1];
    var _b = useState("Apple"), text = _b[0], setText = _b[1];
    return createElement("div", { style: "padding: 30px; background: #f0f0f0; border-radius: 10px;" }, createElement("h1", null, "Count: ".concat(count)), createElement("button", {
        onclick: function () {
            setCount(function (c) { return c + 1; });
        },
    }, "+1 증가 (Re-render Trigger)"), createElement("hr", null), createElement("h2", null, "".concat(text, " is delicious")), createElement("button", {
        onclick: function () {
            setText(function (t) { return (t === "Apple" ? "Banana" : "Apple"); });
        },
    }, "과일 바꾸기 (State 분리 테스트)"));
}
var container = document.getElementById("root");
// 이제 함수형 컴포넌트(Counter)를 렌더링합니다!
// createElement의 첫 번째 인자로 문자열("div")이 아니라 함수(Counter)가 들어갑니다.
render(createElement(Counter, null), container);
