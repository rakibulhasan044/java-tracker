import fs from 'fs';
import path from 'path';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';

export default async function CapstonePage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const filePath = path.join(process.cwd(), 'public', 'capstones', `${params.slug}.md`);
  let content = '';
  
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return (
      <div className="min-h-screen p-8 max-w-4xl mx-auto flex items-center justify-center flex-col">
        <div className="text-xl text-red-500 mb-4">Capstone document not found.</div>
        <Link href="/projects" className="action-btn active inline-block">Return to Projects</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto pb-24">
      <Link href="/projects" className="text-[var(--primary)] hover:underline mb-8 inline-block font-bold">
        &larr; Back to Projects
      </Link>
      <div className="card p-8 bg-[var(--surface)] border rounded-xl shadow-lg" style={{ borderColor: 'var(--border)' }}>
        <div className="markdown-container text-[var(--foreground)]">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
