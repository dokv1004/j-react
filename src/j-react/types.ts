export interface JReactElement {
  type: any; // 함수를 받기 위해 any로 수정
  props: {
    children: JReactElement[];
    [key: string]: any;
  };
}

export interface Hook {
  state: any; // 현재 상태
  queue: any[]; // 상태 변경 요청을 담을 큐
}

export interface Fiber {
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

declare global {
  namespace JSX {
    interface IntrinsicElements {
      // 임시로 문자열로 된 태그는 다 받는다.
      [elemName: string]: any;
    }
  }
}
