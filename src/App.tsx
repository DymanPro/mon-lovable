import { useState, useRef, useEffect } from "react";

type Message = { role: "user" | "assistant"; content: string };
type Project = { id: string; name: string; html: string; messages: Message[]; createdAt: string };

function extractHTML(text: string): string | null {
  const match = text.match(/```html\n([\s\S]*?)```/);
  if (match) return match[1];
  if (text.includes("<!DOCTYPE html>") || text.includes("<html")) return text;
  return null;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [currentHTML, setCurrentHTML] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>(() => {
    try { return JSON.parse(localStorage.getItem("mon-lovable-projects") || "[]"); } catch { return []; }
  });
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [showProjects, setShowProjects] = useState(false);
  const [projectName, setProjectName] = useState("Nouveau projet");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { localStorage.setItem("mon-lovable-projects", JSON.stringify(projects)); }, [projects]);

  function saveProject() {
    if (!currentHTML) return;
    if (currentProject) {
      const updated = projects.map(p => p.id === currentProject.id ? { ...p, name: projectName, html: currentHTML, messages } : p);
      setProjects(updated);
      setCurrentProject({ ...currentProject, name: projectName, html: currentHTML, messages });
    } else {
      const newProject: Project = { id: Date.now().toString(), name: projectName, html: currentHTML, messages, createdAt: new Date().toLocaleDateString("fr-FR") };
      setProjects(prev => [newProject, ...prev]);
      setCurrentProject(newProject);
    }
    alert("Projet sauvegarde !");
  }

  function loadProject(project: Project) {
    setCurrentProject(project);
    setMessages(project.messages || []);
    setCurrentHTML(project.html);
    setPreview(project.html);
    setProjectName(project.name);
    setShowProjects(false);
  }

  function newProject() {
    setCurrentProject(null);
    setMessages([]);
    setCurrentHTML(null);
    setPreview(null);
    setProjectName("Nouveau projet");
    setShowProjects(false);
  }

  function deleteProject(id: string) {
    setProjects(prev => prev.filter(p => p.id !== id));
    if (currentProject?.id === id) newProject();
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMessage: Message = { role: "user", content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    const systemPrompt = currentHTML
      ? "Tu modifies du code HTML existant. Genere TOUJOURS un seul bloc ```html avec la page complete mise a jour. Code actuel:\n\n" + currentHTML
      : "Tu generes TOUJOURS un seul bloc ```html avec une page HTML complete autonome (CSS dans style, JS dans script). Jamais de React.";
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 4096,
          system: systemPrompt,
          messages: newMessages,
        }),
      });
      const data = await response.json();
      const assistantContent = data.content[0].text;
      setMessages(prev => [...prev, { role: "assistant", content: assistantContent }]);
      const html = extractHTML(assistantContent);
      if (html) { setCurrentHTML(html); setPreview(html); }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Erreur de connexion." }]);
    } finally {
      setLoading(false);
    }
  }

  const btn = (bg: string): React.CSSProperties => ({
    background: bg, color: "#fff", border: "none", borderRadius: "8px",
    padding: "8px 14px", fontSize: "13px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap"
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#0f0f0f", color: "#f0f0f0", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 20px", background: "#1a1a1a", borderBottom: "1px solid #2a2a2a" }}>
        <span style={{ fontSize: "20px" }}>&#9889;</span>
        <span style={{ fontSize: "16px", fontWeight: "700", color: "#fff" }}>Mon Lovable</span>
        <input value={projectName} onChange={e => setProjectName(e.target.value)}
          style={{ background: "#0f0f0f", border: "1px solid #333", borderRadius: "6px", color: "#aaa", padding: "4px 10px", fontSize: "13px", width: "180px" }} />
        <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
          <button onClick={newProject} style={btn("#333")}>+ Nouveau</button>
          <button onClick={() => setShowProjects(!showProjects)} style={btn("#333")}>Projets ({projects.length})</button>
          {currentHTML && <button onClick={saveProject} style={btn("#16a34a")}>Sauvegarder</button>}
        </div>
      </div>
      {showProjects && (
        <div style={{ position: "absolute", top: "52px", right: "20px", background: "#1a1a1a", border: "1px solid #333", borderRadius: "12px", padding: "16px", zIndex: 100, width: "280px", maxHeight: "400px", overflowY: "auto" }}>
          <p style={{ fontSize: "13px", fontWeight: "600", color: "#aaa", margin: "0 0 12px" }}>Mes projets</p>
          {projects.length === 0 && <p style={{ fontSize: "13px", color: "#555" }}>Aucun projet</p>}
          {projects.map(p => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px", borderRadius: "8px", background: currentProject?.id === p.id ? "#1e3a5f" : "#0f0f0f", marginBottom: "6px" }}>
              <div style={{ flex: 1, cursor: "pointer" }} onClick={() => loadProject(p)}>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#ddd" }}>{p.name}</p>
                <p style={{ margin: 0, fontSize: "11px", color: "#555" }}>{p.createdAt}</p>
              </div>
              <button onClick={() => deleteProject(p.id)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer" }}>X</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ display: "flex", flexDirection: "column", width: "50%", borderRight: "1px solid #2a2a2a" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {messages.length === 0 && (
              <div style={{ textAlign: "center", margin: "auto", padding: "40px" }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>&#128640;</div>
                <p style={{ fontSize: "18px", fontWeight: "600", color: "#ddd", margin: "0 0 8px" }}>Decris ton application</p>
                <p style={{ fontSize: "13px", color: "#555", margin: 0 }}>Ex : Cree une calculatrice</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} style={{ background: msg.role === "user" ? "#1e3a5f" : "#1a1a1a", border: msg.role === "assistant" ? "1px solid #2a2a2a" : "none", borderRadius: "12px", padding: "12px 16px", alignSelf: msg.role === "user" ? "flex-end" : "flex-start", maxWidth: "90%" }}>
                <div style={{ fontSize: "11px", color: "#666", marginBottom: "6px", fontWeight: "600" }}>{msg.role === "user" ? "Toi" : "IA"}</div>
                {msg.role === "assistant" ? (
                  extractHTML(msg.content) ? (
                    <div>
                      <div style={{ background: "#0f0f0f", borderRadius: "6px", padding: "10px", fontSize: "12px", fontFamily: "monospace", color: "#888", marginBottom: "8px" }}>
                        HTML genere · {msg.content.length} caracteres
                      </div>
                      <button onClick={() => { const h = extractHTML(msg.content); if (h) { setCurrentHTML(h); setPreview(h); }}} style={btn("#2563eb")}>Voir apercu</button>
                    </div>
                  ) : <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>{msg.content}</p>
                ) : <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.6" }}>{msg.content}</p>}
              </div>
            ))}
            {loading && (
              <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "12px", padding: "12px 16px", alignSelf: "flex-start" }}>
                <div style={{ fontSize: "11px", color: "#666", marginBottom: "6px" }}>IA</div>
                <div style={{ color: "#555" }}>Generation en cours...</div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div style={{ display: "flex", gap: "10px", padding: "14px", background: "#1a1a1a", borderTop: "1px solid #2a2a2a", alignItems: "flex-end" }}>
            <textarea style={{ flex: 1, background: "#0f0f0f", border: "1px solid #333", borderRadius: "8px", color: "#f0f0f0", padding: "10px 14px", fontSize: "14px", resize: "none", outline: "none", lineHeight: "1.5" }}
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }}}
              placeholder={currentHTML ? "Demande une modification..." : "Decris ton application..."}
              rows={3} />
            <button style={btn(loading ? "#333" : "#2563eb")} onClick={sendMessage} disabled={loading}>
              {loading ? "..." : "Envoyer"}
            </button>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", width: "50%" }}>
          <div style={{ padding: "12px 20px", background: "#1a1a1a", borderBottom: "1px solid #2a2a2a", fontSize: "13px", fontWeight: "600", color: "#aaa" }}>
            Apercu en direct {currentProject && <span style={{ color: "#16a34a", marginLeft: "8px" }}>· {currentProject.name}</span>}
          </div>
          {preview
            ? <iframe style={{ flex: 1, border: "none", background: "#fff", width: "100%", height: "100%" }} srcDoc={preview} title="apercu" sandbox="allow-scripts allow-same-origin" />
            : <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontSize: "14px", flexDirection: "column", gap: "12px" }}>
                <span style={{ fontSize: "40px" }}>&#128187;</span><p>L apercu apparaitra ici</p>
              </div>}
        </div>
      </div>
    </div>
  );
}
