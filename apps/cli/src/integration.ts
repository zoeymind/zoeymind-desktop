import { requestDocumentPortal } from "./index.js";

type PortalResponse = Record<string, unknown> & {
  success?: boolean;
  error?: string;
  errorCode?: string;
};
type ProjectState = {
  projectId: string;
  title: string;
  exists: boolean;
  open: boolean;
  active: boolean;
  ready: boolean;
};

const timeoutMs = 20_000;
const pollMs = 100;
const title = `Portal CLI Integration ${new Date().toISOString()}`;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function call(
  tool: Parameters<typeof requestDocumentPortal>[0],
  input: unknown,
) {
  const response = (await requestDocumentPortal(tool, input)) as PortalResponse;
  if (response.success === false)
    throw new Error(
      `${tool} failed: ${response.errorCode ?? "PORTAL_FAILURE"}: ${response.error ?? "Unknown error"}`,
    );
  return response;
}

async function waitForBroker(): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      await call("projects", { action: "list" });
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
  }
  throw new Error(
    `APP or Broker did not become available: ${String(lastError)}`,
  );
}

async function waitForReadyProject(projectId: string): Promise<ProjectState> {
  const deadline = Date.now() + timeoutMs;
  let observed: ProjectState | undefined;
  while (Date.now() < deadline) {
    const response = await call("projects", { action: "list" });
    const projects = Array.isArray(response.projects)
      ? (response.projects as ProjectState[])
      : [];
    observed = projects.find((project) => project.projectId === projectId);
    if (observed?.active && observed.open && observed.ready) return observed;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  throw new Error(
    `Created project did not become active, open, and ready within ${timeoutMs}ms: ${JSON.stringify(observed)}`,
  );
}

function anchor(response: PortalResponse): string {
  assert(
    typeof response.anchorTag === "string",
    "Portal response did not include anchorTag",
  );
  return response.anchorTag;
}

function returnedView(response: PortalResponse): PortalResponse {
  assert(
    typeof response.view === "object" && response.view !== null,
    "Edit did not return a fresh view",
  );
  return response.view as PortalResponse;
}

function lineNumber(response: PortalResponse, text: string): number {
  const line = String(response.content)
    .split("\n")
    .find((candidate) => candidate.includes(text));
  assert(line, `View omitted expected line: ${text}`);
  const number = Number(line.split(":", 1)[0]);
  assert(
    Number.isInteger(number) && number > 0,
    `Invalid projected line number: ${line}`,
  );
  return number;
}

async function applyRepair(
  anchorTag: string,
  patch: string,
): Promise<PortalResponse> {
  const direct = (await requestDocumentPortal("edit_current_mindmap", {
    anchorTag,
    patch,
  })) as PortalResponse;
  if (direct.success === true) return direct;
  assert(
    direct.errorCode === "DOCUMENT_PREVIEW_REQUIRED",
    `Localized repair failed: ${JSON.stringify(direct)}`,
  );
  const preview = await call("edit_current_mindmap", {
    anchorTag,
    patch,
    preview: true,
  });
  const confirmationToken = preview.confirmationToken;
  assert(
    typeof confirmationToken === "string",
    "Repair preview omitted confirmation token",
  );
  return call("edit_current_mindmap", { anchorTag, patch, confirmationToken });
}

await waitForBroker();
process.stdout.write("PASS app and Broker are available\n");

const created = await call("projects", { action: "create", title });
assert(
  typeof created.projectId === "string",
  "Project creation did not return projectId",
);
const projectId = created.projectId;
const ready = await waitForReadyProject(projectId);
assert(ready.title === title, `Created project title mismatch: ${ready.title}`);
process.stdout.write(
  `PASS project created, Tab active, editor mounted, MindMap ready (${projectId})\n`,
);

await call("activate_project", { projectId });
await waitForReadyProject(projectId);
process.stdout.write(
  "PASS explicit activation keeps the created editor current and ready\n",
);
const initial = await call("query_current_mindmap", {
  mode: "outline",
  maxLines: 100,
});
const initialAnchor = anchor(initial);
assert(
  typeof initial.content === "string" && initial.content.length > 0,
  "Initial query returned no content",
);
process.stdout.write("PASS current new project queried\n");

const noStepEdit = await call("edit_current_mindmap", {
  anchorTag: initialAnchor,
  patch: "PUT >13:\n+[P2] 无步骤用例 & 前置条件",
});
const noStepDiagnostics = noStepEdit.diagnostics as
  PortalResponse[] | undefined;
assert(
  noStepEdit.success === true &&
    noStepDiagnostics?.[0]?.code === "CASE_HAS_NO_STEPS",
  `Missing-step edit did not return a successful warning: ${JSON.stringify(noStepEdit)}`,
);
const repairedNoStep = await applyRepair(
  anchor(returnedView(noStepEdit)),
  String(noStepDiagnostics[0]?.repairPatchHint),
);
assert(
  Array.isArray(repairedNoStep.diagnostics) &&
    repairedNoStep.diagnostics.length === 0,
  `Localized missing-step repair still warned: ${JSON.stringify(repairedNoStep)}`,
);
process.stdout.write(
  "PASS case without steps applied with warning and localized repair\n",
);

const malformedAnchor = anchor(returnedView(repairedNoStep));
const malformedStepEdit = await call("edit_current_mindmap", {
  anchorTag: malformedAnchor,
  patch: "PUT >4:\n+[P2] 非法步骤用例 & 前置条件\n+  只有操作没有预期",
});
const malformedDiagnostics = malformedStepEdit.diagnostics as
  PortalResponse[] | undefined;
assert(
  malformedStepEdit.success === true &&
    malformedDiagnostics?.[0]?.code === "STEP_HAS_NO_EXPECTED_RESULT",
  `Malformed-step edit did not return a successful warning: ${JSON.stringify(malformedStepEdit)}`,
);
const repairedMalformedStep = await applyRepair(
  anchor(returnedView(malformedStepEdit)),
  String(malformedDiagnostics[0]?.repairPatchHint),
);
assert(
  Array.isArray(repairedMalformedStep.diagnostics) &&
    repairedMalformedStep.diagnostics.length === 0,
  `Localized malformed-step repair still warned: ${JSON.stringify(repairedMalformedStep)}`,
);
process.stdout.write(
  "PASS incomplete step applied with warning and localized repair\n",
);

const resumed = await call("query_current_mindmap", {
  mode: "outline",
  maxLines: 100,
});
const resumedAnchor = anchor(resumed);

const firstEdit = await call("edit_current_mindmap", {
  anchorTag: resumedAnchor,
  patch:
    "PUT >13:\n+[P1] 完整用例A & 已创建新项目\n+  执行第一次编辑 & 返回新局部视图和锚点",
  returnView: { view: "subtree", maxLines: 100 },
});
const firstView = returnedView(firstEdit);
const firstAnchor = anchor(firstView);
assert(
  String(firstView.content).includes("完整用例A"),
  "First edit view omitted inserted case",
);
process.stdout.write("PASS complete case inserted with fresh returned view\n");

const caseALine = String(firstView.content)
  .split("\n")
  .find((line) => line.includes("[P1] 完整用例A"));
assert(caseALine, "Returned view omitted complete case A");
const caseALineNumber = Number(caseALine.split(":", 1)[0]);
const secondEdit = await call("edit_current_mindmap", {
  anchorTag: firstAnchor,
  patch: `PUT >${caseALineNumber}:\n+[P2] 完整用例B & 已获得第一次编辑结果\n+  直接复用返回锚点继续编辑 & 第二次编辑成功`,
  returnView: { view: "subtree", maxLines: 100 },
});
const secondView = returnedView(secondEdit);
assert(
  String(secondView.content).includes("完整用例A"),
  "Second edit lost first case",
);
assert(
  String(secondView.content).includes("完整用例B"),
  "Second edit omitted second case",
);
process.stdout.write(
  "PASS sequential edit reused prior edit result without query\n",
);

const finalRead = await call("query_current_mindmap", {
  mode: "subtree",
  path: ["核心模块D"],
  maxLines: 100,
});
assert(
  String(finalRead.content).includes("执行第一次编辑 & 返回新局部视图和锚点"),
  "Case A step missing",
);
assert(
  String(finalRead.content).includes(
    "直接复用返回锚点继续编辑 & 第二次编辑成功",
  ),
  "Case B step missing",
);
assert(finalRead.truncated === false, "Final subtree unexpectedly truncated");

const search = await call("query_current_mindmap", {
  mode: "search",
  query: "完整用例B",
  fields: ["caseTitle"],
});
assert(
  search.total === 1,
  `Structured search did not locate case B: ${JSON.stringify(search)}`,
);
process.stdout.write("PASS structured search finds the edited live case\n");

const destructiveAnchor = anchor(finalRead);
const caseBLine = String(finalRead.content)
  .split("\n")
  .find((line) => line.includes("[P2] 完整用例B"));
assert(caseBLine, "Final subtree omitted case B line");
const caseBLineNumber = Number(caseBLine.split(":", 1)[0]);
const destructivePatch = `CUT ${caseBLineNumber}:`;
const preview = await call("edit_current_mindmap", {
  anchorTag: destructiveAnchor,
  patch: destructivePatch,
  preview: true,
});
const confirmationToken = preview.confirmationToken;
assert(
  typeof confirmationToken === "string",
  "Destructive preview returned no token",
);
const fakeConfirmation = (await requestDocumentPortal("edit_current_mindmap", {
  confirmationToken: "fake-token",
})) as PortalResponse;
assert(
  fakeConfirmation.success === false,
  "Fake destructive confirmation unexpectedly succeeded",
);
assert(
  fakeConfirmation.errorCode === "DOCUMENT_PREVIEW_REQUIRED",
  "Fake token returned wrong error",
);
const confirmed = await call("edit_current_mindmap", {
  confirmationToken,
  returnView: { view: "subtree", maxLines: 100 },
});
assert(
  !String(returnedView(confirmed).content).includes("完整用例B"),
  "Confirmed deletion retained case B",
);
process.stdout.write(
  "PASS destructive preview rejects fake token and accepts one-time token\n",
);

const staleEdit = (await requestDocumentPortal("edit_current_mindmap", {
  anchorTag: destructiveAnchor,
  patch: `PUT >${caseBLineNumber}:\n+[P3] 过期锚点 & 已完成删除\n+  使用旧锚点编辑 & 操作被拒绝`,
})) as PortalResponse;
assert(
  staleEdit.success === false,
  "Consumed anchor unexpectedly remained editable",
);
assert(
  staleEdit.errorCode === "DOCUMENT_ANCHOR_EXPIRED" ||
    staleEdit.errorCode === "DOCUMENT_EDIT_CONFLICT",
  `Unexpected stale-anchor error: ${JSON.stringify(staleEdit)}`,
);
process.stdout.write("PASS stale anchor rejected after committed edit\n");

const wholeTree = await call("query_current_mindmap", {
  mode: "subtree",
  maxLines: 200,
});
const rootReplacementPatch = [
  `PUT 1.=${String(wholeTree.content).split("\n").length}:`,
  "+复杂集成项目",
  "+  # 朋友圈首页",
  "+    # 动态卡片",
  "+      # 评论按钮",
  "+        # 评论输入弹窗",
  "+          # 弹窗通用行为",
  "+            [P1] 关闭评论弹窗 & 弹窗已打开",
  "+              点击遮罩区域 & 弹窗关闭且未发送评论",
  "+          # 评论输入框",
  "+            [P1] 输入评论内容 & 评论弹窗已打开",
  "+              输入有效评论文本 & 输入框显示完整文本",
  "+          # 发送按钮",
  "+            [P1] 发送评论 & 已输入有效评论",
  "+              点击发送按钮 & 评论发布成功并关闭弹窗",
  "+      # 点赞按钮",
  "+        # 点赞状态切换",
  "+          [P1] 点赞好友动态 & 当前未点赞",
  "+            点击点赞按钮 & 点赞状态生效且数量增加 1",
  "+        # 点赞异常处理",
  "+          [P2] 点赞请求失败 & 网络异常",
  "+            点击点赞按钮 & 恢复原状态并提示失败",
  "+  # 消息中心",
  "+    # 评论通知",
  "+      [P2] 打开评论通知 & 存在未读评论通知",
  "+        点击通知 & 跳转对应动态并标记已读",
].join("\n");
const rootPreview = await call("edit_current_mindmap", {
  anchorTag: anchor(wholeTree),
  patch: rootReplacementPatch,
  preview: true,
});
const rootConfirmationToken = rootPreview.confirmationToken;
assert(
  typeof rootConfirmationToken === "string",
  "Root replacement returned no token",
);
const rootEdit = await call("edit_current_mindmap", {
  anchorTag: anchor(wholeTree),
  patch: rootReplacementPatch,
  confirmationToken: rootConfirmationToken,
  returnView: { view: "outline", maxLines: 200 },
});
const rootView = returnedView(rootEdit);
assert(
  String(rootView.content).includes("评论输入弹窗"),
  "Deep root replacement lost nested module",
);
assert(
  String(rootView.content).includes("点赞异常处理"),
  "Deep root replacement lost sibling module",
);
process.stdout.write(
  "PASS five-level nested root replacement rendered in the live editor\n",
);

const commentSubtree = await call("query_current_mindmap", {
  mode: "subtree",
  path: ["朋友圈首页", "动态卡片", "评论按钮", "评论输入弹窗", "评论输入框"],
  maxLines: 100,
});
const existingCommentCase = lineNumber(commentSubtree, "[P1] 输入评论内容");
const nestedFirstEdit = await call("edit_current_mindmap", {
  anchorTag: anchor(commentSubtree),
  patch: `PUT >${existingCommentCase}:\n+[P2] 输入超长评论 & 评论弹窗已打开\n+  输入超过上限的评论文本 & 阻止继续输入并显示字数上限`,
  returnView: { view: "subtree", maxLines: 100 },
});
const nestedFirstView = returnedView(nestedFirstEdit);
const longCommentCase = lineNumber(nestedFirstView, "[P2] 输入超长评论");
const nestedSecondEdit = await call("edit_current_mindmap", {
  anchorTag: anchor(nestedFirstView),
  patch: `PUT >${longCommentCase}:\n+[P3] 输入空白评论 & 评论弹窗已打开\n+  仅输入空格并点击发送 & 阻止发送并提示评论不能为空`,
  returnView: { view: "subtree", maxLines: 100 },
});
const nestedSecondView = returnedView(nestedSecondEdit);
assert(
  String(nestedSecondView.content).includes("输入超长评论"),
  "Nested second edit lost prior case",
);
assert(
  String(nestedSecondView.content).includes("输入空白评论"),
  "Nested second edit omitted new case",
);
process.stdout.write(
  "PASS nested second edit reused the first nested edit result without query\n",
);

const cardSubtree = await call("query_current_mindmap", {
  mode: "subtree",
  path: ["朋友圈首页", "动态卡片"],
  maxLines: 200,
});
const abnormalModuleLine = lineNumber(cardSubtree, "# 点赞异常处理");
const commentButtonLine = lineNumber(cardSubtree, "# 评论按钮");
const moveEdit = await call("edit_current_mindmap", {
  anchorTag: anchor(cardSubtree),
  patch: `MOVE ${abnormalModuleLine} -> ${commentButtonLine}:`,
  returnView: { view: "outline", maxLines: 200 },
});
assert(
  String(returnedView(moveEdit).content).includes("点赞异常处理"),
  "MOVE result omitted moved subtree",
);
const movedRead = await call("query_current_mindmap", {
  mode: "subtree",
  path: ["朋友圈首页", "动态卡片", "评论按钮", "点赞异常处理"],
  maxLines: 100,
});
assert(
  String(movedRead.content).includes("点赞请求失败"),
  "Cross-parent MOVE lost case subtree",
);
process.stdout.write(
  "PASS cross-parent nested MOVE preserved the complete subtree\n",
);

const notificationRead = await call("query_current_mindmap", {
  mode: "subtree",
  path: ["消息中心", "评论通知"],
  maxLines: 100,
});
const notificationCaseLine = lineNumber(notificationRead, "[P2] 打开评论通知");
const atomicPatch = [
  `PUT ${notificationCaseLine}.=${notificationCaseLine}:`,
  "+[P1] 打开评论通知 & 存在未读评论通知",
  `PUT >${notificationCaseLine}:`,
  "+[P2] 评论通知已读状态 & 通知已打开",
  "+  返回消息中心 & 通知保持已读状态",
].join("\n");
const atomicEdit = await call("edit_current_mindmap", {
  anchorTag: anchor(notificationRead),
  patch: atomicPatch,
  returnView: { view: "subtree", maxLines: 100 },
});
const atomicView = returnedView(atomicEdit);
assert(
  String(atomicView.content).includes("[P1] 打开评论通知"),
  "Atomic patch missed title update",
);
assert(
  String(atomicView.content).includes("评论通知已读状态"),
  "Atomic patch missed sibling insertion",
);
process.stdout.write(
  "PASS atomic multi-operation patch updated and inserted in one transaction\n",
);

const finalComplexTree = await call("query_current_mindmap", {
  mode: "subtree",
  maxLines: 300,
});
for (const required of [
  "评论输入弹窗",
  "输入超长评论",
  "输入空白评论",
  "点赞异常处理",
  "点赞请求失败",
  "评论通知已读状态",
])
  assert(
    String(finalComplexTree.content).includes(required),
    `Final complex tree omitted ${required}`,
  );
assert(
  finalComplexTree.truncated === false,
  "Final complex tree was truncated",
);
process.stdout.write(
  "PASS final full-tree read verifies nested convergence without truncation\n",
);
process.stdout.write(
  "PASS final live subtree contains complete cases and steps\n",
);
process.stdout.write(
  `PASS live app CLI integration complete; project retained as ${title}\n`,
);
