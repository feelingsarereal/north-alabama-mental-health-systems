import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Pack Markdown rendered as written (geo/NOTES.md). Loaded only where it is needed. */
export default function Markdown({ md }: { md: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}</a> }}>{md}</ReactMarkdown>;
}
