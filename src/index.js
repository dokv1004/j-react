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
// -------------------- [3. DOM 생성 헬퍼 함수] --------------------
function createDom(fiber) {
    var dom = fiber.type === "TEXT_ELEMENT"
        ? document.createTextNode("")
        : document.createElement(fiber.type);
    var isProperty = function (key) { return key !== "children"; };
    Object.keys(fiber.props)
        .filter(isProperty)
        .forEach(function (name) {
        dom[name] = fiber.props[name];
    });
    return dom;
}
// -------------------- [4. 엔진 (Work Loop)] --------------------
var nextUnitOfWork = null;
function workLoop(deadline) {
    var shouldYield = false;
    while (nextUnitOfWork && !shouldYield) {
        nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
        shouldYield = deadline.timeRemaining() < 1;
    }
    requestIdleCallback(workLoop);
}
requestIdleCallback(workLoop); // 엔진 시동!
// -------------------- [5. 작업 수행 (Perform Unit Of Work)] --------------------
function performUnitOfWork(fiber) {
    var _a;
    // A. DOM 노드 생성 (아직 없으면)
    if (!fiber.dom) {
        fiber.dom = createDom(fiber);
    }
    // B. [중요] 부모 DOM에 내 DOM 붙이기 (여기가 질문한 부분!)
    // (Day 3에서는 이 부분을 제거하고 'Commit Phase'로 옮길 예정)
    if (fiber.parent && fiber.dom) {
        (_a = fiber.parent.dom) === null || _a === void 0 ? void 0 : _a.appendChild(fiber.dom);
    }
    // C. 자식 Fiber 생성 및 연결 (Linked List 만들기)
    var elements = fiber.props.children;
    var index = 0;
    var prevSibling = null;
    while (index < elements.length) {
        var element_1 = elements[index];
        var newFiber = {
            type: element_1.type,
            props: element_1.props,
            parent: fiber,
            dom: undefined,
        };
        if (index === 0) {
            fiber.child = newFiber; // 첫째는 child로
        }
        else {
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
    var nextFiber = fiber;
    while (nextFiber) {
        if (nextFiber.sibling) {
            return nextFiber.sibling;
        }
        nextFiber = nextFiber.parent;
    }
    return null;
}
// -------------------- [6. 렌더 함수 (진입점)] --------------------
function render(element, container) {
    nextUnitOfWork = {
        dom: container,
        props: {
            children: [element],
        },
    };
}
// -------------------- [7. 실행 코드] --------------------
var element = createElement("div", { id: "foo", style: "background: #eee; padding: 20px;" }, createElement("h1", null, "J-React Day 2 성공! 🎉"), createElement("p", null, "이제 Fiber 아키텍처가 작동합니다."));
var container = document.getElementById("root");
if (container)
    render(element, container);
