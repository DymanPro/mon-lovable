import { supabase } from './supabase';

export async function saveProjectToSupabase(project: { id: string; name: string; html: string; messages: any[] }) {
  const { error } = await supabase
    .from('project buldy')
    .upsert({ id: project.id, name: project.name, html: project.html, messages: project.messages });
  if (error) console.error('Erreur sauvegarde:', error);
}

export async function loadProjectsFromSupabase() {
  const { data, error } = await supabase
    .from('project buldy')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('Erreur chargement:', error); return []; }
  return data || [];
}
