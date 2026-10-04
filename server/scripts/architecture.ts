import path from "node:path";
import ts from "typescript";
import { Prisma } from "@prisma/client";

const owners: Record<string, string> = {
  Event: "meetings",
  Participant: "meetings",
  Vote: "meetings",
  UserEvent: "meetings",
  User: "accounts",
  UserIdentity: "accounts",
  UserSession: "accounts",
  Venue: "places",
};
const relations = new Map(
  Prisma.dmmf.datamodel.models.map((model) => [
    model.name,
    new Map(
      model.fields
        .filter((field) => field.kind === "object")
        .map((field) => [field.name, field.type])
    ),
  ])
);
const wrappers = new Set([
  "where",
  "include",
  "select",
  "data",
  "orderBy",
  "cursor",
  "having",
  "create",
  "createMany",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "connect",
  "disconnect",
  "connectOrCreate",
  "upsert",
  "some",
  "every",
  "none",
  "is",
  "isNot",
  "AND",
  "OR",
  "NOT",
  "set",
  "_count",
]);

export interface BoundaryViolation {
  file: string;
  line: number;
  message: string;
}

/** Analyze real source plus optional virtual files used by the negative-fixture tests. */
export function checkArchitecture(
  root: string,
  virtualFiles: Record<string, string> = {}
): BoundaryViolation[] {
  const configPath = ts.findConfigFile(root, (name) => ts.sys.fileExists(name), "tsconfig.json");
  if (!configPath) throw new Error("Missing TypeScript project configuration");
  const config = ts.readConfigFile(configPath, (name) => ts.sys.readFile(name));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const virtual = new Map(
    Object.entries(virtualFiles).map(([name, source]) => [path.resolve(root, name), source])
  );
  const host = ts.createCompilerHost(parsed.options);
  const originalRead = host.readFile.bind(host);
  const originalExists = host.fileExists.bind(host);
  host.readFile = (name) => virtual.get(path.resolve(name)) ?? originalRead(name);
  host.fileExists = (name) => virtual.has(path.resolve(name)) || originalExists(name);
  host.getSourceFile = (name, languageVersion) => {
    const source = host.readFile(name);
    return source === undefined
      ? undefined
      : ts.createSourceFile(name, source, languageVersion, true);
  };
  const program = ts.createProgram(
    [
      ...parsed.fileNames.filter((name) => name.includes(`${path.sep}src${path.sep}`)),
      ...virtual.keys(),
    ],
    parsed.options,
    host
  );
  const checker = program.getTypeChecker();
  const violations: BoundaryViolation[] = [];

  for (const source of program.getSourceFiles()) {
    const file = path.relative(root, source.fileName).replaceAll(path.sep, "/");
    if (!file.startsWith("src/") || source.isDeclarationFile) continue;
    const moduleName = /^src\/modules\/([^/]+)\//.exec(file)?.[1];
    const store = Boolean(moduleName && file === `src/modules/${moduleName}/store.ts`);
    const report = (node: ts.Node, message: string) => {
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      if (
        !violations.some(
          (entry) => entry.file === file && entry.line === line && entry.message === message
        )
      ) {
        violations.push({ file, line, message });
      }
    };
    const ownModel = (node: ts.Node, model: string) => {
      if (moduleName && owners[model] !== moduleName)
        report(
          node,
          `${moduleName} cannot access ${model}, owned by ${owners[model] ?? "unknown"}`
        );
    };
    const dependency = (node: ts.Node, specifier: string) => {
      const resolved = ts.resolveModuleName(specifier, source.fileName, parsed.options, host)
        .resolvedModule?.resolvedFileName;
      const target = resolved ? path.relative(root, resolved).replaceAll(path.sep, "/") : specifier;
      const targetModule = /^src\/modules\/([^/]+)\/(.+)$/.exec(target);
      if (
        targetModule &&
        targetModule[1] !== moduleName &&
        targetModule[2] !== "index.ts" &&
        file !== "src/app.ts"
      ) {
        report(node, "Cross-module access must use the public index");
      }
      if (specifier === "@prisma/client" && !store && file !== "src/runtime/database.ts") {
        report(node, "Prisma is limited to module stores and runtime/database");
      }
      if (
        file.startsWith("src/http/") &&
        (target === "src/runtime/database.ts" || target.endsWith("/store.ts"))
      ) {
        report(node, "HTTP cannot import database or private stores");
      }
      if (
        moduleName &&
        (target.startsWith("src/http/") ||
          /^(?:fastify|@fastify\/|ioredis|redis$)/.test(specifier) ||
          target === "src/runtime/notifications.ts")
      ) {
        report(node, "Modules cannot depend on HTTP or Redis");
      }
      if (moduleName && !store && target === "src/runtime/database.ts")
        report(node, "Operations outside stores cannot import database access");
    };

    const inspectType = (node: ts.Node, type: ts.Type, model: string, visited: Set<ts.Type>) => {
      if (visited.has(type)) return;
      visited.add(type);
      if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) {
        report(node, "Query shape must be statically known to check relation ownership");
        return;
      }
      if (type.isUnionOrIntersection()) {
        for (const member of type.types) inspectType(node, member, model, visited);
        return;
      }
      if (checker.isArrayType(type) || checker.isTupleType(type)) {
        const item = checker.getIndexTypeOfType(type, ts.IndexKind.Number);
        if (item) inspectType(node, item, model, visited);
        return;
      }
      for (const field of type.getProperties()) {
        const name = field.getName();
        const related = relations.get(model)?.get(name);
        if (related) ownModel(node, related);
        if (related || wrappers.has(name))
          inspectType(
            node,
            checker.getTypeOfSymbolAtLocation(field, node),
            related ?? model,
            visited
          );
      }
    };
    const inspectQuery = (
      node: ts.Expression,
      model: string,
      visited = new Set<ts.Node>()
    ): void => {
      if (visited.has(node)) return;
      visited.add(node);
      if (
        ts.isAsExpression(node) ||
        ts.isSatisfiesExpression(node) ||
        ts.isParenthesizedExpression(node)
      ) {
        inspectQuery(node.expression, model, visited);
      } else if (ts.isArrayLiteralExpression(node)) {
        for (const entry of node.elements) inspectQuery(entry, model, visited);
      } else if (ts.isObjectLiteralExpression(node)) {
        for (const entry of node.properties) {
          if (ts.isSpreadAssignment(entry)) {
            inspectQuery(entry.expression, model, visited);
            continue;
          }
          if (!ts.isPropertyAssignment(entry) && !ts.isShorthandPropertyAssignment(entry)) {
            report(entry, "Query methods cannot be checked for relation ownership");
            continue;
          }
          const name = ts.isComputedPropertyName(entry.name)
            ? ts.isStringLiteral(entry.name.expression)
              ? entry.name.expression.text
              : undefined
            : entry.name.text;
          if (!name) {
            report(entry, "Computed query keys must be string literals");
            continue;
          }
          const related = relations.get(model)?.get(name);
          if (related) ownModel(entry, related);
          if (related || wrappers.has(name))
            inspectQuery(
              ts.isPropertyAssignment(entry) ? entry.initializer : entry.name,
              related ?? model,
              visited
            );
        }
      } else if (ts.isIdentifier(node)) {
        const declaration = checker.getSymbolAtLocation(node)?.valueDeclaration;
        if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer)
          inspectQuery(declaration.initializer, model, visited);
        else inspectType(node, checker.getTypeAtLocation(node), model, new Set());
      } else inspectType(node, checker.getTypeAtLocation(node), model, new Set());
    };
    const delegateModel = (node: ts.Expression): string | undefined => {
      const type = checker.getTypeAtLocation(node);
      const name = type.getSymbol()?.getName() ?? type.aliasSymbol?.getName();
      return name?.match(/^(\w+)Delegate$/)?.[1];
    };
    const visit = (node: ts.Node) => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        dependency(node, node.moduleSpecifier.text);
      }
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === "require"))
      ) {
        const first = node.arguments[0];
        if (first && ts.isStringLiteral(first)) dependency(node, first.text);
        else report(node, "Dynamic module dependencies must be string literals");
      }
      if (
        moduleName &&
        (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))
      ) {
        const model = delegateModel(node);
        if (model) ownModel(node, model);
        const receiver = node.expression;
        const receiverModel = delegateModel(receiver);
        if (receiverModel) {
          if (ts.isCallExpression(node.parent) && node.parent.expression === node) {
            for (const argument of node.parent.arguments) inspectQuery(argument, receiverModel);
          } else
            report(node, "Call Prisma delegate methods directly so query ownership can be checked");
        }
        if (
          ts.isPropertyAccessExpression(node) &&
          /^\$(?:queryRaw|executeRaw)/.test(node.name.text)
        )
          report(node, "Raw SQL is not allowed in domain modules");
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return violations;
}
