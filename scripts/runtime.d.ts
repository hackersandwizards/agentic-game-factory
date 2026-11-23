declare const Bun: {
  Glob: new (pattern: string) => {
    match(path: string): boolean;
    scanSync(root: string): Iterable<string>;
  };
};

declare module "spdx-expression-parse" {
  type Expression = { license: string } | { conjunction: "and" | "or"; left: Expression; right: Expression };

  export default function parse(source: string): Expression;
}
