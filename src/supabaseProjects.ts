import { supabase } from './supabase';

export async function saveProjectToSupabase(project: { id: string; name: string; html: string; messages: any[] }) {
  const { error } = await supabase
    .from('projects')
    .upsert({ id: parseInt(project.id), name: project.name, html: project.html, messages: project.messages });
  if (error) console.error('Erreur sauvegarde:', error);
  else console.log('Projet sauvegardé !');
}

export async function loadProjectsFromSupabase() {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('Erreur chargement:', error); return []; }
  return (data || []).map((p: any) => ({ ...p, id: p.id.toString() }));
}
