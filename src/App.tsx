import { useState, useRef, useEffect } from "react";
import { saveProjectToSupabase, loadProjectsFromSupabase, saveVersionToSupabase, loadVersionsFromSupabase } from "./supabaseProjects";
import CodeEditor from "./CodeEditor";
import JSZip from "jszip";
import { saveAs } from "file-saver";

type Message = { role: "user" | "assistant"; content: string; images?: { name: string; content: string }[] };
type Project = { id: string; name: string; html: string; messages: Message[] };

const TEMPLATES = [
  { icon: "🚀", name: "Landing Page", prompt: "Crée une landing page moderne et professionnelle avec hero section, fonctionnalités, témoignages et CTA" },
  { icon: "📊", name: "Dashboard", prompt: "Crée un dashboard admin avec graphiques, statistiques, tableau de données et sidebar de navigation" },
  { icon: "📝", name: "Formulaire", prompt: "Crée un formulaire de contact élégant avec validation, animations et confirmation d'envoi" },
  { icon: "🛍️", name: "E-commerce", prompt: "Crée une page produit e-commerce avec galerie photos, sélecteur de variantes et panier" },
  { icon: "🎮", name: "Mini-jeu", prompt: "Crée un mini-jeu interactif et amusant avec score et animations" },
  { icon: "📅", name: "Calendrier", prompt: "Crée un calendrier interactif avec gestion d'événements et vue mensuelle" },
];

function generateSlug(name: string, uniqueSuffix: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (base || "site") + "-" + uniqueSuffix.slice(-4);
}

function extractHTML(text: string): string | null {
  const match = text.match(/```html\n([\s\S]*?)```/);
  if (match) return match[1];
  if (text.includes("<!DOCTYPE html>") || text.includes("<html")) return text;
  return null;
}

function stripHTMLBlock(text: string): string {
  const match = text.match(/```html\n[\s\S]*?```/);
  if (match) return text.replace(match[0], "").trim();
  if (text.includes("<!DOCTYPE html>") || text.trim().startsWith("<html")) return "";
  return text.trim();
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [preview, setPreview] = useState("");
  const [currentHTML, setCurrentHTML] = useState("");
  const [projectName, setProjectName] = useState("Nouveau projet");
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentSlug, setCurrentSlug] = useState<string | null>(null);
  const [showProjects, setShowProjects] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview");
  const [uploadedFiles, setUploadedFiles] = useState<{name: string, content: string, type: string}[]>([]);
  const [showFiles, setShowFiles] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [urlPageText, setUrlPageText] = useState<{ title: string; text: string; url: string } | null>(null);
  const [analyzingUrl, setAnalyzingUrl] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadProjectsFromSupabase().then(data => setProjects(data));

  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); saveProject(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); sendMessage(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [messages, input, currentHTML, projectName, projects]);

  const systemPrompt = `Tu es Buddy, l'assistant IA de Buildly. Tu te comportes comme un assistant humain, chaleureux et professionnel.

PERSONNALITÉ ET STYLE DE COMMUNICATION :
- Tu poses UNE SEULE question à la fois, jamais plusieurs d'un coup
- Tu attends la réponse avant de poser la suivante
- Tu proposes toujours des choix concrets (ex: "Tu préfères A ou B ?")
- Tu reformules ce que tu as compris avant de coder
- Tu ne codes JAMAIS sans avoir dit "Ok je commence !" et reçu confirmation
- Tu es patient, encourageant, jamais pressé
- Tes messages sont courts et clairs, pas de longs paragraphes

PROCESSUS OBLIGATOIRE AVANT DE CODER :
1. Accueille la demande chaleureusement
2. Pose UNE question sur le style ou les couleurs
3. Attends la réponse
4. Pose UNE question sur les fonctionnalités principales
5. Attends la réponse
6. Pose UNE question sur le public cible ou l'usage
7. Attends la réponse
8. Reformule : "Voici ce que j'ai compris : [résumé]. Je commence ?"
9. Attends confirmation avant de générer le code

IMAGES JOINTES PAR L'UTILISATEUR :
- Si l'utilisateur joint des photos (ex: photos de son activité, de son équipe, de son produit) et te demande de les utiliser, insère-les avec EXACTEMENT ce format : <img src="PHOTO:nom-exact-du-fichier.jpg">
- Remplace "nom-exact-du-fichier.jpg" par le nom réel du fichier tel que fourni (respecte la casse et les espaces exacts)
- Ne mets JAMAIS de vrai code base64 toi-même, utilise UNIQUEMENT ce format de placeholder PHOTO:
- Si l'utilisateur joint une capture d'écran/mockup comme référence de STYLE (pas comme photo à utiliser), inspire-toi de sa palette de couleurs, sa mise en page, son ambiance — n'utilise PAS de placeholder PHOTO: pour celle-ci
- Si tu as besoin d'images supplémentaires en plus de celles fournies, complète avec Unsplash (voir section suivante) en gardant le même thème et la même ambiance visuelle que les photos fournies, pour un rendu cohérent

IMAGES - UTILISE L'API UNSPLASH :
- Dans le HTML, charge les images via fetch vers https://mon-lovable-hs9h.vercel.app/api/unsplash?query=mot-clé-anglais
- Exemple :
  fetch('https://mon-lovable-hs9h.vercel.app/api/unsplash?query=spa+massage+luxury')
    .then(r => r.json())
    .then(data => { if(data.urls[0]) document.getElementById('img1').src = data.urls[0]; })
- Ajoute un placeholder gris pendant le chargement
- Utilise minimum 3 images pertinentes par app

QUALITÉ DU DESIGN - NIVEAU PROFESSIONNEL :
- Navigation fixe en haut
- Hero section avec grande image et texte percutant
- Typographie pro : Google Fonts (Playfair Display pour titres, Inter pour le corps)
- Titres en 60px+ bold
- Boutons avec hover effects
- Couleurs harmonieuses, ombres douces
- JAMAIS d'emojis comme visuels principaux
- Inspire-toi de Airbnb, Apple, Stripe
- Anime intelligemment : apparitions progressives au scroll, transitions douces sur les boutons/cartes (0.3s), jamais d'animations agressives ou distrayantes

RESPONSIVE ET ACCESSIBILITÉ (OBLIGATOIRE) :
- Inclus toujours <meta name="viewport" content="width=device-width, initial-scale=1.0">
- Utilise des media queries pour adapter le design en dessous de 768px (mobile) : menu hamburger si besoin, colonnes qui s'empilent, texte redimensionné
- Teste mentalement l'affichage mobile avant de finaliser le code
- Ajoute des attributs alt descriptifs sur toutes les images
- Assure un bon contraste texte/fond pour la lisibilité
- Tous les boutons et liens doivent être fonctionnels (pas de href="#" vide sans action)

JEUX - NIVEAU AVANCÉ (quand l'utilisateur demande un jeu) :
- Utilise <canvas> avec requestAnimationFrame pour une animation fluide (jamais setInterval pour l'animation)
- Physique simple (gravité, rebonds, vitesse, collisions) : calcule-la toi-même en JavaScript avec des variables de vélocité/accélération
- Physique complexe (jeu de plateforme avec plusieurs objets qui interagissent) : utilise la librairie Matter.js via CDN : https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js
- Sons : génère des effets sonores synthétiques avec l'API Web Audio (AudioContext + OscillatorNode) pour les sauts, collisions, victoires, game over — jamais besoin de fichiers audio externes
- Structure complète obligatoire : écran de démarrage avec bouton "Jouer", système de score visible en jeu, plusieurs niveaux avec difficulté progressive (vitesse ou obstacles qui augmentent), écran de game over avec le score final et un bouton "Rejouer"
- Contrôles : clavier (flèches/espace) ET tactile (boutons ou swipe à l'écran pour mobile)
- Sauvegarde le meilleur score (high score) dans le localStorage du navigateur et affiche-le

APRÈS GÉNÉRATION :
- Propose 3 améliorations sous forme de choix : "Tu veux que j'ajoute A, B ou C ?"

GÉNÉRATION DE CODE :
- Retourne TOUJOURS le HTML complet dans un bloc \`\`\`html
- CSS et JS inclus dans le même fichier HTML
- Vérifie que le code est valide et sans erreur de syntaxe avant de répondre`;

  function compressImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (ev) => {
        img.onload = () => {
          const maxDim = 1024;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) { height = Math.round(height * (maxDim / width)); width = maxDim; }
            else { width = Math.round(width * (maxDim / height)); height = maxDim; }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) { reject(new Error("canvas context")); return; }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.7));
        };
        img.onerror = reject;
        img.src = ev.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      if (file.type.startsWith("image/")) {
        compressImage(file).then(content => {
          setUploadedFiles(prev => [...prev, { name: file.name, content, type: "image/jpeg" }]);
        });
      } else {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const content = ev.target?.result as string;
          setUploadedFiles(prev => [...prev, { name: file.name, content, type: file.type }]);
        };
        reader.readAsText(file);
      }
    });
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach(file => {
      if (file.type.startsWith("image/")) {
        compressImage(file).then(content => {
          setUploadedFiles(prev => [...prev, { name: file.name, content, type: "image/jpeg" }]);
        });
      } else {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const content = ev.target?.result as string;
          setUploadedFiles(prev => [...prev, { name: file.name, content, type: file.type }]);
        };
        reader.readAsText(file);
      }
    });
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
  }

  function removeFile(name: string) {
    setUploadedFiles(prev => prev.filter(f => f.name !== name));
  }

  function cancelGeneration() {
    if (abortRef.current) { abortRef.current.abort(); setLoading(false); setLoadingStep(""); }
  }

  async function fetchUnsplashImages(keywords: string[]): Promise<string[]> {
    const urls: string[] = [];
    for (const keyword of keywords) {
      try {
        const res = await fetch(`https://mon-lovable-hs9h.vercel.app/api/unsplash?query=${encodeURIComponent(keyword)}`);
        const data = await res.json();
        if (data.urls && data.urls[0]) urls.push(data.urls[0]);
      } catch {}
    }
    return urls;
  }

  function extractKeywords(text: string): string[] {
    const common = ["massage", "spa", "wellness", "yoga", "fitness", "food", "restaurant", 
                   "travel", "business", "technology", "nature", "fashion", "beauty",
                   "sport", "music", "art", "architecture", "medical", "education"];
    const lower = text.toLowerCase();
    return common.filter(k => lower.includes(k)).slice(0, 3);
  }

  async function sendMessage(customInput?: string) {
    const text = customInput || input;
    if (!text.trim() || loading) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    const nonImageFiles = uploadedFiles.filter(f => !f.type.startsWith("image/"));
    const attachmentNote = nonImageFiles.length > 0 ? '\n📎 ' + nonImageFiles.map(f => f.name).join(', ') : '';
    const urlNote = urlPageText ? '\n🔗 ' + (urlPageText.title || urlPageText.url) : '';
    const urlContext = urlPageText
      ? '\n\nCONTENU DE LA PAGE ANALYSÉE (' + urlPageText.url + ') - Titre: ' + urlPageText.title + '\nTexte de la page: ' + urlPageText.text
      : '';
    const imagesForBubble = uploadedFiles.filter(f => f.type.startsWith("image/")).map(f => ({ name: f.name, content: f.content }));
    const newMessages: Message[] = [...messages, { role: "user", content: text.trim() + attachmentNote + urlNote, images: imagesForBubble.length > 0 ? imagesForBubble : undefined }];
    setMessages(newMessages);
    setLoading(true);
    setLoadingStep("Buddy réfléchit...");
    abortRef.current = new AbortController();
    try {
      setTimeout(() => setLoadingStep("Buddy analyse ta demande..."), 2000);
      setTimeout(() => setLoadingStep("Buddy code ton app... ⚡"), 5000);
      
      const keywords = extractKeywords(text);
      let imageUrls: string[] = [];
      if (keywords.length > 0) {
        imageUrls = await fetchUnsplashImages(keywords);
      }

      const imageContext = imageUrls.length > 0
        ? '\n\nIMGS UNSPLASH - UTILISE CES URLs DIRECTEMENT dans <img src="URL">. NE PAS utiliser fetch:\n' + imageUrls.map((url, i) => 'Image ' + (i+1) + ': ' + url).join('\n')
        : '';

      const messagesWithImages: Message[] = newMessages.map(m => ({ role: m.role, content: m.content }));
      if (imageUrls.length > 0) {
        messagesWithImages[messagesWithImages.length - 1] = {
          ...messagesWithImages[messagesWithImages.length - 1],
          content: messagesWithImages[messagesWithImages.length - 1].content + imageContext
        };
      }
      if (urlContext) {
        messagesWithImages[messagesWithImages.length - 1] = {
          ...messagesWithImages[messagesWithImages.length - 1],
          content: messagesWithImages[messagesWithImages.length - 1].content + urlContext
        };
      }

      const imageFilesToSend = uploadedFiles.filter(f => f.type.startsWith("image/"));
      if (imageFilesToSend.length > 0) {
        const lastMsg = messagesWithImages[messagesWithImages.length - 1];
        const contentBlocks: any[] = [{ type: "text", text: lastMsg.content }];
        imageFilesToSend.forEach(f => {
          const base64Data = f.content.split(",")[1];
          contentBlocks.push({ type: "image", source: { type: "base64", media_type: f.type, data: base64Data } });
        });
        messagesWithImages[messagesWithImages.length - 1] = { ...lastMsg, content: contentBlocks as any };
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: 8000, system: systemPrompt, messages: messagesWithImages }),
        signal: abortRef.current.signal,
      });
      const data = await response.json();
      if (!data.content || !data.content[0]) {
        setMessages(prev => [...prev, { role: "assistant", content: "Erreur : " + (data.error?.message || "réponse inattendue de l'IA.") }]);
        setLoading(false);
        setLoadingStep("");
        return;
      }
      const assistantContent = data.content[0].text;
      const updatedMessages: Message[] = [...newMessages, { role: "assistant", content: assistantContent }];
      setMessages(updatedMessages);
      setUploadedFiles([]);
      setUrlPageText(null);
      let html = extractHTML(assistantContent);
      if (html) {
        uploadedFiles.forEach(f => {
          const placeholder = 'PHOTO:' + f.name;
          html = html!.split(placeholder).join(f.content);
        });
        setCurrentHTML(html); setPreview(html); setActiveTab("preview");
        const idToUse = currentProjectId || Date.now().toString();
        const slugToUse = currentSlug || generateSlug(projectName, idToUse);
        if (!currentProjectId) setCurrentProjectId(idToUse);
        if (!currentSlug) setCurrentSlug(slugToUse);
        const projectToSave: Project = { id: idToUse, name: projectName, html, messages: updatedMessages };
        setProjects(prev => {
          const exists = prev.some(p => p.id === idToUse);
          return exists ? prev.map(p => p.id === idToUse ? projectToSave : p) : [...prev, projectToSave];
        });
        saveProjectToSupabase({ ...projectToSave, slug: slugToUse });
        saveVersionToSupabase(idToUse, html, updatedMessages);
      }
    } catch (e: any) {
      if (e.name !== "AbortError") setMessages(prev => [...prev, { role: "assistant", content: "Erreur de connexion." }]);
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  }

  function saveProject() {
    const id = currentProjectId || Date.now().toString();
    const slug = currentSlug || generateSlug(projectName, id);
    const project: Project = { id, name: projectName, html: currentHTML, messages };
    if (!currentProjectId) {
      setCurrentProjectId(id);
      setCurrentSlug(slug);
      setProjects(prev => [...prev, project]);
    } else {
      setProjects(prev => prev.map(p => p.id === id ? project : p));
    }
    saveProjectToSupabase({ ...project, slug });
    setShowMenu(false);
  }

  function loadProject(p: Project & { slug?: string }) {
    setProjectName(p.name);
    setMessages(p.messages);
    setCurrentHTML(p.html);
    setPreview(p.html);
    setCurrentProjectId(p.id);
    setCurrentSlug(p.slug || null);
    setShowProjects(false);
  }

  function newProject() {
    setProjectName("Nouveau projet");
    setMessages([]);
    setCurrentHTML("");
    setPreview("");
    setCurrentProjectId(null);
    setCurrentSlug(null);
  }

  async function analyzeUrl() {
    const url = window.prompt("Colle l'URL du site à analyser (avec https://) :");
    if (!url || !url.trim()) return;
    setAnalyzingUrl(true);
    try {
      const [screenshotRes, textRes] = await Promise.all([
        fetch("/api/screenshot?url=" + encodeURIComponent(url)),
        fetch("/api/fetch-url?url=" + encodeURIComponent(url)),
      ]);
      const screenshotData = await screenshotRes.json();
      const textData = await textRes.json();

      if (screenshotData.image) {
        const domain = url.replace(/^https?:\/\//, "").split("/")[0];
        const ext = (screenshotData.mediaType || "image/png").split("/")[1] || "png";
        setUploadedFiles(prev => [...prev, { name: "capture-" + domain + "." + ext, content: screenshotData.image, type: screenshotData.mediaType || "image/png" }]);
      }
      if (textData.text) {
        setUrlPageText({ title: textData.title || "", text: textData.text, url });
      }
    } catch (e) {
      alert("Impossible d'analyser cette URL.");
    } finally {
      setAnalyzingUrl(false);
    }
  }

  function restoreVersion(v: any) {
    setCurrentHTML(v.html);
    setPreview(v.html);
    if (v.messages) setMessages(v.messages);
    setActiveTab("preview");
    setShowHistory(false);
  }

  function exportZip() {
    const zip = new JSZip();
    zip.file("index.html", currentHTML);
    uploadedFiles.forEach(f => zip.file(f.name, f.content));
    zip.generateAsync({ type: "blob" }).then(blob => saveAs(blob, `${projectName}.zip`));
    setShowMenu(false);
  }

  function publishApp() {
    if (!currentHTML) { alert("Génère dabord une application !"); return; }
    const blob = new Blob([currentHTML], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#0a0a0f", color: "#e2e8f0", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "12px 20px", background: "#0d0d1a", borderBottom: "1px solid #1e1e3a", gap: "12px", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "32px", height: "32px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>⚡</div>
          <span style={{ fontWeight: "700", fontSize: "18px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Buildly</span>
        </div>
        <input value={projectName} onChange={e => setProjectName(e.target.value)} style={{ flex: 1, background: "#1a1a2e", border: "1px solid #2d2d4e", borderRadius: "8px", padding: "6px 12px", color: "#e2e8f0", fontSize: "14px", maxWidth: "200px" }} />
        <div style={{ marginLeft: "auto", display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={newProject} style={{ padding: "8px 16px", background: "#1a1a2e", border: "1px solid #2d2d4e", borderRadius: "8px", color: "#a0aec0", cursor: "pointer", fontSize: "13px" }}>+ Nouveau</button>
          <button onClick={() => { setShowTemplates(!showTemplates); setShowProjects(false); setShowMenu(false); setShowFiles(false); }} style={{ padding: "8px 16px", background: "#1a1a2e", border: "1px solid #2d2d4e", borderRadius: "8px", color: "#a0aec0", cursor: "pointer", fontSize: "13px" }}>⚡ Templates</button>
          <button onClick={() => { setShowProjects(!showProjects); setShowMenu(false); setShowFiles(false); setShowTemplates(false); }} style={{ padding: "8px 16px", background: "#1a1a2e", border: "1px solid #2d2d4e", borderRadius: "8px", color: "#a0aec0", cursor: "pointer", fontSize: "13px" }}>Projets ({projects.length})</button>
          <button onClick={() => { setShowFiles(!showFiles); setShowMenu(false); setShowProjects(false); setShowTemplates(false); }} style={{ padding: "8px 16px", background: "#1a1a2e", border: "1px solid #2d2d4e", borderRadius: "8px", color: "#a0aec0", cursor: "pointer", fontSize: "13px" }}>📎 Fichiers ({uploadedFiles.length})</button>
          <button onClick={async () => { const v = await loadVersionsFromSupabase(currentProjectId || ""); setVersions(v); setShowHistory(!showHistory); setShowMenu(false); setShowProjects(false); setShowTemplates(false); setShowFiles(false); }} disabled={!currentProjectId} style={{ padding: "8px 16px", background: "#1a1a2e", border: "1px solid #2d2d4e", borderRadius: "8px", color: currentProjectId ? "#a0aec0" : "#4a4a6a", cursor: currentProjectId ? "pointer" : "not-allowed", fontSize: "13px" }}>🕐 Historique</button>
          <button onClick={async () => {
            if (!currentProjectId) { alert("Génère d'abord une app avant de publier."); return; }
            const link = window.location.origin + "/api/site?" + (currentSlug ? ("slug=" + currentSlug) : ("id=" + currentProjectId));
            try {
              await navigator.clipboard.writeText(link);
              alert("Lien copié !\n\n" + link);
            } catch {
              window.prompt("Copie ce lien :", link);
            }
          }} disabled={!currentProjectId} style={{ padding: "8px 16px", background: currentProjectId ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "#1a1a2e", border: "1px solid #2d2d4e", borderRadius: "8px", color: currentProjectId ? "white" : "#4a4a6a", cursor: currentProjectId ? "pointer" : "not-allowed", fontSize: "13px", fontWeight: "600" }}>🌐 Publier</button>
          <button onClick={() => { setShowMenu(!showMenu); setShowProjects(false); setShowFiles(false); setShowTemplates(false); }} style={{ padding: "8px 16px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", borderRadius: "8px", color: "white", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>Menu ▾</button>
        </div>

        {showMenu && (
          <div style={{ position: "absolute", top: "56px", right: "20px", background: "#0d0d1a", border: "1px solid #1e1e3a", borderRadius: "12px", padding: "8px", zIndex: 200, minWidth: "200px", boxShadow: "0 20px 40px rgba(0,0,0,0.7)" }}>
            <div onClick={saveProject} style={{ padding: "10px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", color: "#6366f1", display: "flex", alignItems: "center", gap: "8px" }} onMouseEnter={e => (e.currentTarget.style.background = "#1a1a2e")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>💾 Sauvegarder (⌘S)</div>
            <div onClick={exportZip} style={{ padding: "10px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", color: "#a0aec0", display: "flex", alignItems: "center", gap: "8px" }} onMouseEnter={e => (e.currentTarget.style.background = "#1a1a2e")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>⬇ Télécharger ZIP</div>
            <div onClick={publishApp} style={{ padding: "10px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", color: "#10b981", display: "flex", alignItems: "center", gap: "8px" }} onMouseEnter={e => (e.currentTarget.style.background = "#1a1a2e")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>🚀 Publier</div>
          </div>
        )}

        {showTemplates && (
          <div style={{ position: "absolute", top: "56px", right: "20px", background: "#0d0d1a", border: "1px solid #1e1e3a", borderRadius: "12px", padding: "12px", zIndex: 200, minWidth: "280px", boxShadow: "0 20px 40px rgba(0,0,0,0.7)" }}>
            <p style={{ fontSize: "12px", color: "#4a4a6a", marginBottom: "8px", paddingLeft: "4px" }}>Démarrage rapide</p>
            {TEMPLATES.map(t => (
              <div key={t.name} onClick={() => { sendMessage(t.prompt); setShowTemplates(false); }} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", color: "#a0aec0" }} onMouseEnter={e => (e.currentTarget.style.background = "#1a1a2e")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <span style={{ fontSize: "20px" }}>{t.icon}</span>
                <span>{t.name}</span>
              </div>
            ))}
          </div>
        )}

        {showFiles && (
          <div onDrop={handleDrop} onDragOver={handleDragOver} style={{ position: "absolute", top: "56px", right: "20px", background: "#0d0d1a", border: "1px dashed #4a4a6a", borderRadius: "12px", padding: "12px", zIndex: 200, minWidth: "260px", boxShadow: "0 20px 40px rgba(0,0,0,0.7)" }}>
            <input ref={fileInputRef} type="file" multiple onChange={handleFileUpload} style={{ display: "none" }} />
            <button onClick={() => fileInputRef.current?.click()} style={{ width: "100%", padding: "10px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", borderRadius: "8px", color: "white", cursor: "pointer", fontSize: "13px", fontWeight: "600", marginBottom: "8px" }}>+ Ajouter des fichiers</button>
            {uploadedFiles.length === 0 ? <p style={{ color: "#4a4a6a", fontSize: "13px", textAlign: "center" }}>Glisse un fichier ici ou clique ci-dessus</p> :
              uploadedFiles.map(f => (
                <div key={f.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: "8px", background: "#1a1a2e", marginBottom: "4px" }}>
                  <span style={{ fontSize: "12px", color: "#a0aec0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "180px" }}>📄 {f.name}</span>
                  <button onClick={() => removeFile(f.name)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "14px", padding: "0 4px" }}>✕</button>
                </div>
              ))}
          </div>
        )}

        {showProjects && (
          <div style={{ position: "absolute", top: "56px", right: "20px", background: "#0d0d1a", border: "1px solid #1e1e3a", borderRadius: "12px", padding: "12px", zIndex: 200, minWidth: "220px", boxShadow: "0 20px 40px rgba(0,0,0,0.7)" }}>
            {projects.length === 0 ? <p style={{ color: "#4a4a6a", fontSize: "13px", textAlign: "center" }}>Aucun projet sauvegardé</p> :
              projects.map(p => (
                <div key={p.id} onClick={() => loadProject(p)} style={{ padding: "10px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", color: "#a0aec0" }} onMouseEnter={e => (e.currentTarget.style.background = "#1a1a2e")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>📁 {p.name}</div>
              ))}
          </div>
        )}

        {showHistory && (
          <div style={{ position: "absolute", top: "56px", right: "20px", background: "#0d0d1a", border: "1px solid #1e1e3a", borderRadius: "12px", padding: "12px", zIndex: 200, minWidth: "280px", maxHeight: "400px", overflowY: "auto", boxShadow: "0 20px 40px rgba(0,0,0,0.7)" }}>
            {versions.length === 0 ? <p style={{ color: "#4a4a6a", fontSize: "13px", textAlign: "center" }}>Aucune version enregistrée</p> :
              versions.map((v, i) => (
                <div key={v.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: "8px", background: "#1a1a2e", marginBottom: "6px" }}>
                  <span style={{ fontSize: "12px", color: "#a0aec0" }}>{i === 0 ? "🟢 Version actuelle" : "🕐 " + new Date(v.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                  {i !== 0 && <button onClick={() => restoreVersion(v)} style={{ padding: "4px 10px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", borderRadius: "6px", color: "white", cursor: "pointer", fontSize: "11px" }}>Restaurer</button>}
                </div>
              ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ width: "420px", display: "flex", flexDirection: "column", borderRight: "1px solid #1e1e3a" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
            {messages.length === 0 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "16px", opacity: 0.6 }}>
                <div style={{ fontSize: "48px" }}>🚀</div>
                <p style={{ fontSize: "16px", fontWeight: "600", color: "#6366f1" }}>Bonjour ! Je suis Buddy 👋</p>
                <p style={{ fontSize: "13px", color: "#4a4a6a", textAlign: "center" }}>Décris ton app ou choisis un template pour commencer !</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "85%", padding: "12px 16px", borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: m.role === "user" ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "#1a1a2e", border: m.role === "assistant" ? "1px solid #2d2d4e" : "none", fontSize: "13px", lineHeight: "1.6", color: "#e2e8f0", whiteSpace: "pre-wrap" }}>
                  {m.images && m.images.length > 0 && (
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" }}>
                      {m.images.map(img => (
                        <img key={img.name} src={img.content} alt={img.name} style={{ width: "120px", height: "120px", objectFit: "cover", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.2)" }} />
                      ))}
                    </div>
                  )}
                  {m.role === "assistant" && extractHTML(m.content) ? (
                    <div>
                      {stripHTMLBlock(m.content) && <p style={{ margin: "0 0 10px 0", whiteSpace: "pre-wrap" }}>{stripHTMLBlock(m.content)}</p>}
                      <span style={{ color: "#6366f1", fontWeight: "600" }}>✓ App générée !</span>
                      <button onClick={() => { setPreview(extractHTML(m.content)!); setActiveTab("preview"); }} style={{ display: "block", marginTop: "8px", padding: "6px 12px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", borderRadius: "6px", color: "white", cursor: "pointer", fontSize: "12px" }}>Voir aperçu</button>
                    </div>
                  ) : m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px 16px", background: "#1a1a2e", borderRadius: "18px 18px 18px 4px", width: "fit-content", border: "1px solid #2d2d4e", maxWidth: "85%" }}>
                <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#6366f1", animation: `bounce 1s ease-in-out ${i * 0.2}s infinite` }} />
                  ))}
                </div>
                <span style={{ fontSize: "11px", color: "#6366f1" }}>{loadingStep}</span>
                <button onClick={cancelGeneration} style={{ fontSize: "11px", color: "#ef4444", background: "none", border: "1px solid #ef4444", borderRadius: "4px", padding: "2px 8px", cursor: "pointer" }}>✕ Annuler</button>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div style={{ padding: "16px", borderTop: "1px solid #1e1e3a" }}>
            {(uploadedFiles.length > 0 || urlPageText) && (
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" }}>
                {uploadedFiles.map(f => (
                  f.type.startsWith("image/") ? (
                    <div key={f.name} style={{ position: "relative", width: "48px", height: "48px" }}>
                      <img src={f.content} alt={f.name} title={f.name} style={{ width: "48px", height: "48px", objectFit: "cover", borderRadius: "8px", border: "1px solid #2d2d4e" }} />
                      <button onClick={() => removeFile(f.name)} style={{ position: "absolute", top: "-6px", right: "-6px", width: "18px", height: "18px", borderRadius: "50%", background: "#ef4444", border: "2px solid #0d0d1a", color: "white", cursor: "pointer", fontSize: "10px", lineHeight: "1", display: "flex", alignItems: "center", justifyContent: "center", padding: "0" }}>✕</button>
                    </div>
                  ) : (
                    <div key={f.name} style={{ display: "flex", alignItems: "center", gap: "4px", background: "#1a1a2e", border: "1px solid #2d2d4e", borderRadius: "6px", padding: "4px 8px", fontSize: "11px", color: "#a0aec0" }}>
                      📎 {f.name}
                      <button onClick={() => removeFile(f.name)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "11px", padding: "0" }}>✕</button>
                    </div>
                  )
                ))}
                {urlPageText && (
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", background: "#1a1a2e", border: "1px solid #2d2d4e", borderRadius: "6px", padding: "4px 8px", fontSize: "11px", color: "#a0aec0" }}>
                    🔗 {urlPageText.title || urlPageText.url}
                    <button onClick={() => setUrlPageText(null)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "11px", padding: "0" }}>✕</button>
                  </div>
                )}
              </div>
            )}
            <div onDrop={handleDrop} onDragOver={handleDragOver} style={{ background: "#ffffff", borderRadius: "20px", padding: "10px 14px", boxShadow: "0 4px 20px rgba(0,0,0,0.25)" }}>
              <input ref={fileInputRef} type="file" multiple onChange={handleFileUpload} style={{ display: "none" }} />
              <textarea ref={textareaRef} value={input} onChange={e => { setInput(e.target.value); const el = textareaRef.current; if (el) { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 160) + "px"; } }} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder="Écrire un message... (glisse un fichier ici)" rows={1} style={{ width: "100%", background: "transparent", border: "none", color: "#1a1a2e", fontSize: "14px", resize: "none", outline: "none", lineHeight: "1.5", marginBottom: "6px", fontFamily: "inherit", maxHeight: "160px", overflowY: "auto" }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button onClick={() => fileInputRef.current?.click()} style={{ width: "30px", height: "30px", borderRadius: "50%", background: "none", border: "1px solid #d0d0d0", color: "#555", cursor: "pointer", fontSize: "18px", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: "1" }}>+</button>
                  <button onClick={analyzeUrl} disabled={analyzingUrl} title="Analyser une URL" style={{ width: "30px", height: "30px", borderRadius: "50%", background: "none", border: "1px solid #d0d0d0", color: "#555", cursor: analyzingUrl ? "not-allowed" : "pointer", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: "1" }}>{analyzingUrl ? "…" : "🔗"}</button>
                </div>
                <button onClick={() => sendMessage()} disabled={loading} style={{ width: "34px", height: "34px", borderRadius: "50%", background: loading ? "#d0d0d0" : "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", color: "white", cursor: loading ? "not-allowed" : "pointer", fontSize: "15px", display: "flex", alignItems: "center", justifyContent: "center" }}>{loading ? "…" : "↑"}</button>
              </div>
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
            <CodeEditor value={currentHTML} onChange={(v) => { setCurrentHTML(v); setPreview(v); }} />
          )}
        </div>
      </div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2d2d4e; border-radius: 2px; }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
