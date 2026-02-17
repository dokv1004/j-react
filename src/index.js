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
// -------------------- [1. 타입 정의] --------------------
var wipRoot = null;
var currentRoot = null;
var deletions = [];
// -------------------- [2. 엘리먼트 생성 함수] --------------------
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
// -------------------- [3. DOM 조작 헬퍼 함수들 (위치 변경!)] --------------------
var isEvent = function (key) { return key.startsWith("on"); };
var isProperty = function (key) { return key !== "children" && !isEvent(key); };
var isNew = function (prev, next) { return function (key) {
    return prev[key] !== next[key];
}; };
var isGone = function (prev, next) { return function (key) { return !(key in next); }; };
function updateDom(dom, prevProps, nextProps) {
    // 1. 이벤트 제거
    Object.keys(prevProps)
        .filter(isEvent)
        .filter(function (key) { return !(key in nextProps) || isNew(prevProps, nextProps)(key); })
        .forEach(function (name) {
        var eventType = name.toLowerCase().substring(2);
        dom.removeEventListener(eventType, prevProps[name]);
    });
    // 2. 속성 제거
    Object.keys(prevProps)
        .filter(isProperty)
        .filter(isGone(prevProps, nextProps))
        .forEach(function (name) {
        dom[name] = "";
    });
    // 3. 속성 설정
    Object.keys(nextProps)
        .filter(isProperty)
        .filter(isNew(prevProps, nextProps))
        .forEach(function (name) {
        dom[name] = nextProps[name];
    });
    // 4. 이벤트 추가
    Object.keys(nextProps)
        .filter(isEvent)
        .filter(isNew(prevProps, nextProps))
        .forEach(function (name) {
        var eventType = name.toLowerCase().substring(2);
        dom.addEventListener(eventType, nextProps[name]);
    });
}
// -------------------- [4. DOM 생성 함수 (수정됨!)] --------------------
function createDom(fiber) {
    var dom = fiber.type === "TEXT_ELEMENT"
        ? document.createTextNode("")
        : document.createElement(fiber.type);
    // ✅ 수정된 부분: 이제 updateDom을 재사용해서 이벤트를 연결합니다!
    updateDom(dom, {}, fiber.props);
    return dom;
}
// -------------------- [5. 엔진 (Work Loop)] --------------------
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
// -------------------- [6. 작업 수행 (Perform Unit Of Work)] --------------------
function performUnitOfWork(fiber) {
    if (!fiber.dom) {
        fiber.dom = createDom(fiber);
    }
    var elements = fiber.props.children;
    reconcileChildren(fiber, elements);
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
// -------------------- [7. 렌더 & 커밋 함수] --------------------
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
    var _a, _b;
    if (!fiber)
        return;
    var parentDom = (_a = fiber.parent) === null || _a === void 0 ? void 0 : _a.dom;
    if (fiber.effectTag === "PLACEMENT" && fiber.dom && parentDom) {
        parentDom.appendChild(fiber.dom);
    }
    else if (fiber.effectTag === "UPDATE" && fiber.dom) {
        updateDom(fiber.dom, (_b = fiber.alternate) === null || _b === void 0 ? void 0 : _b.props, fiber.props);
    }
    else if (fiber.effectTag === "DELETION" && parentDom) {
        if (fiber.dom)
            parentDom.removeChild(fiber.dom);
        return;
    }
    commitWork(fiber.child);
    commitWork(fiber.sibling);
}
// -------------------- [8. 실행 코드] --------------------
var container = document.getElementById("root");
// 1. 초기 렌더링
var element1 = createElement("div", { id: "foo", style: "background: #eee; padding: 20px;" }, createElement("h1", null, "Hello J-React! 👋"), createElement("p", null, "잠시 후 내용이 바뀝니다..."));
if (container)
    render(element1, container);
// 2. 2초 뒤 업데이트
setTimeout(function () {
    var element2 = createElement("div", { id: "foo", style: "background: #ffcccc; padding: 20px;" }, createElement("h1", null, "Wow! It updated! 🚀"), createElement("p", { style: "color: blue" }, "화면이 깜빡이지 않고 부드럽게 변경되었어요."), 
    // 버튼 클릭 이벤트 테스트!
    createElement("button", { onClick: function () { return alert("성공! 🎉"); } }, "클릭해보세요"));
    if (container)
        render(element2, container);
}, 2000);
