import { Fragment } from "react";
import { parseMd, runs } from "../markdown/markdown";

// AI output is rendered as React text nodes, never as HTML.
const Inline = ({ text }: { text: string }) => (
  <>{runs(text).map((r, i) => r.bold ? <strong key={i}>{r.text}</strong> : <Fragment key={i}>{r.text}</Fragment>)}</>
);

export function Markdown({ md }: { md: string }) {
  return (
    <>
      {parseMd(md).map((b, i) => b.t === "h" ? <h4 key={i}>{b.text}</h4>
        : b.t === "ul" ? <ul key={i}>{b.items.map((item, j) => <li key={j}><Inline text={item} /></li>)}</ul>
        : <p key={i}><Inline text={b.text} /></p>)}
    </>
  );
}
