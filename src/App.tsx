import { useState, useRef, useEffect } from "react";

type Message = { role: "user" | "assistant"; content: string };
type Project = { id: string; name: string; html: string; messages: Message[] };

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
  const [preview, setPreview] = useState("");
  const [currentHTML, setCurrentHTML] = useState("");
  const [projectName, setProjectName] = useState("Nouveau projet");
  const [projects, setProjects] = useState<Project[]>([]);
  const [showProjects, setShowProjects] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("projects");
    if (saved) setProjects(JSON.parse(saved));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const systemPrompt = `Tu es un expert en développement web. Génère du code HTML complet et autonome avec CSS et JS inclus. Retourne TOUJOURS le code complet dans un bloc html. Le code doit être moderne, beau, avec des animations et un design professionnel. Si l'utilisateur demande une modification, retourne le code HTML complet modifié.`;

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput("");
    const newMessages: Message[] = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8000,
          system: systemPrompt,
          messages: newMessages,
        }),
      });
      const data = await response.json();
      const assistantContent = data.content[0].text;
      const updatedMessages: Message[] = [...newMessages, { role: "assistant", content: assistantContent }];
      setMessages(updatedMessages);
      const html = extractHTML(assistantContent);
      if (html) { setCurrentHTML(html); setPreview(html); }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Erreur de connexion." }]);
    } finally {
      setLoading(false);
    }
  }

  function saveProject() {
    const project: Project = {
      id: Date.now().toString(),
      name: projectName,
      html: currentHTML,
      messages,
    };
    const updated = [...projects, project];
    setProjects(updated);
    localStorage.setItem("projects", JSON.stringify(updated));
  }

  function loadProject(p: Project) {
    setProjectName(p.name);
    setMessages(p.messages);
    setCurrentHTML(p.html);
    setPreview(p.html);
    setShowProjects(false);
  }

  function newProject() {
    setProjectName("Nouveau projet");
    setMessages([]);
    setCurrentHTML("");
    setPreview("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#0a0a0f", color: "#e2e8f0", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "12px 20px", background: "#0d0d1a", borderBottom: "1px solid #1e1e3a", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "32px", height: "32px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>⚡</div>
          <span style={{ fontWeight: "700", fontSize: "18px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Mon Lovable</span>
        </div>
        <input value={projectName} onChange={e => setProjectName(e.target.value)} style={{ flex: 1, background: "#1a1a2e", border: "1px solid #2d2d4e", borderRadius: "8px", padding: "6px 12px", color: "#e2e8f0", fontSize: "14px", maxWidth: "200px" }} />
        <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
          <button onClick={newProject} style={{ padding: "8px 16px", background: "#1a1a2e", border: "1px solid #2d2d4e", borderRadius: "8px", color: "#a0aec0", cursor: "pointer", fontSize: "13px" }}>+ Nouveau</button>
          <button onClick={() => setShowProjects(!showProjects)} style={{ padding: "8px 16px", background: "#1a1a2e", border: "1px solid #2d2d4e", borderRadius: "8px", color: "#a0aec0", cursor: "pointer", fontSize: "13px" }}>Projets ({projects.length})</button>
          <button onClick={saveProject} style={{ padding: "8px 16px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", borderRadius: "8px", color: "white", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>Sauvegarder</button>
        </div>
      </div>
      {showProjects && (
        <div style={{ position: "absolute", top: "60px", right: "20px", background: "#0d0d1a", border: "1px solid #1e1e3a", borderRadius: "12px", padding: "12px", zIndex: 100, minWidth: "220px", boxShadow: "0 20px 40px rgba(0,0,0,0.5)" }}>
          {projects.length === 0 ? <p style={{ color: "#4a4a6a", fontSize: "13px", textAlign: "center" }}>Aucun projet sauvegardé</p> :
            projects.map(p => (
              <div key={p.id} onClick={() => loadProject(p)} style={{ padding: "10px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", color: "#a0aec0" }}>
                📁 {p.name}
              </div>
            ))}
        </div>
      )}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ width: "420px", display: "flex", flexDirection: "column", borderRight: "1px solid #1e1e3a" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
            {messages.length === 0 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "16px", opacity: 0.6 }}>
                <div style={{ fontSize: "48px" }}>🚀</div>
                <p style={{ fontSize: "16px", fontWeight: "600", color: "#6366f1" }}>Décris ton application</p>
                <p style={{ fontSize: "13px", color: "#4a4a6a", textAlign: "center" }}>Ex : Crée une calculatrice moderne</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "85%", padding: "12px 16px", borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: m.role === "user" ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "#1a1a2e", border: m.role === "assistant" ? "1px solid #2d2d4e" : "none", fontSize: "13px", lineHeight: "1.6", color: "#e2e8f0" }}>
                  {m.role === "assistant" && extractHTML(m.content) ? (
                    <div>
                      <span style={{ color: "#6366f1", fontWeight: "600" }}>✓ HTML généré</span>
                      <button onClick={() => { setPreview(extractHTML(m.content)!); setActiveTab("preview"); }} style={{ display: "block", marginTop: "8px", padding: "6px 12px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", borderRadius: "6px", color: "white", cursor: "pointer", fontSize: "12px" }}>
                        Voir aperçu
                      </button>
                    </div>
                  ) : m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", gap: "4px", padding: "12px 16px", background: "#1a1a2e", borderRadius: "18px 18px 18px 4px", width: "fit-content", border: "1px solid #2d2d4e" }}>
                {[0,1,2].map(i => <div key={i} style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#6366f1" }} />)}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div style={{ padding: "16px", borderTop: "1px solid #1e1e3a" }}>
            <div style={{ display: "flex", gap: "8px", background: "#1a1a2e", border: "1px solid #2d2d4e", borderRadius: "12px", padding: "8px" }}>
              <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder={messages.length > 0 ? "Demande une modification..." : "Décris ton application..."} rows={2} style={{ flex: 1, background: "transparent", border: "none", color: "#e2e8f0", fontSize: "13px", resize: "none", outline: "none", lineHeight: "1.5" }} />
              <button onClick={sendMessage} disabled={loading} style={{ padding: "8px 16px", background: loading ? "#2d2d4e" : "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", borderRadius: "8px", color: "white", cursor: loading ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: "600", alignSelf: "flex-end" }}>
                {loading ? "..." : "↑"}
              </button>
            </div>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", padding: "0 20px", background: "#0d0d1a", borderBottom: "1px solid #1e1e3a", gap: "4px" }}>
            <button onClick={() => setActiveTab("preview")} style={{ padding: "12px 16px", background: "none", border: "none", color: activeTab === "preview" ? "#6366f1" : "#4a4a6a", cursor: "pointer", fontSize: "13px", fontWeight: activeTab === "preview" ? "600" : "400", borderBottom: activeTab === "preview" ? "2px solid #6366f1" : "2px solid transparent" }}>Aperçu en direct</button>
            <button onClick={() => setActiveTab("code")} style={{ padding: "12px 16px", background: "none", border: "none", color: activeTab === "code" ? "#6366f1" : "#4a4a6a", cursor: "pointer", fontSize: "13px", fontWeight: activeTab === "code" ? "600" : "400", borderBottom: activeTab === "code" ? "2px solid #6366f1" : "2px solid transparent" }}>Code</button>
            {preview && <span style={{ marginLeft: "auto", fontSize: "11px", color: "#4a4a6a" }}>● {projectName}</span>}
          </div>
          {activeTab === "preview" ? (
            preview ? <iframe srcDoc={preview} style={{ flex: 1, border: "none", background: "white" }} /> :
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", opacity: 0.4 }}>
              <div style={{ fontSize: "48px" }}>💻</div>
              <p style={{ fontSize: "14px", color: "#4a4a6a" }}>L'aperçu apparaîtra ici</p>
            </div>
          ) : (
            <textarea value={currentHTML} onChange={e => { setCurrentHTML(e.target.value); setPreview(e.target.value); }} style={{ flex: 1, background: "#0d0d1a", color: "#a0aec0", border: "none", padding: "20px", fontSize: "12px", fontFamily: "monospace", resize: "none", outline: "none", lineHeight: "1.6" }} />
          )}
        </div>
      </div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2d2d4e; border-radius: 2px; }
      `}</style>
    </div>
  );
}
